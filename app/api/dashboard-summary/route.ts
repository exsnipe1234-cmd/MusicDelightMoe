import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server environment variables are missing.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const sgDate = (offset = 0) => {
  const date = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publicKey) throw new Error('Supabase public environment variables are missing.');
    const cookieStore = cookies();
    const sessionClient = createServerClient(url, publicKey, { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } });
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: profile } = await sessionClient.from('profiles').select('role,active').eq('id', user.id).single();
    if (profile?.role !== 'admin' || !profile.active) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });

    const supabase = db();
    const today = sgDate();
    const tomorrow = sgDate(1);
    const nextWeek = sgDate(7);

    const [todayResult, tomorrowResult, upcomingResult, requestResult, taskResult, availabilityResult] = await Promise.all([
      supabase.from('lessons').select('id,lesson_date,teacher_name,school,class_name,start_time,end_time,unavailable').eq('lesson_date', today).eq('cancelled', false),
      supabase.from('lessons').select('id,teacher_name,school,class_name,start_time,end_time,unavailable').eq('lesson_date', tomorrow).eq('cancelled', false),
      supabase.from('lessons').select('id,lesson_date,teacher_name,school,class_name,start_time,end_time').gte('lesson_date',today).lte('lesson_date',nextWeek).eq('cancelled',false).order('lesson_date').order('start_time'),
      supabase.from('teacher_unavailability_requests').select('id,teacher_name,start_date,end_date,status,reason').eq('status','pending').order('created_at'),
      supabase.from('replacement_tasks').select('id,original_teacher,lesson_date,school,class_name,start_time,end_time,status,replacement_teacher').eq('status','needs_replacement').order('lesson_date').order('start_time'),
      supabase.from('teacher_availability').select('teacher_name,availability_type,start_date,end_date,reason').eq('availability_type', 'leave').lte('start_date', nextWeek).gte('end_date', today),
    ]);

    const optional = <T,>(result: { data: T[] | null; error: { message: string } | null }, table: string) => {
      if (result.error) console.warn(`Dashboard summary could not read ${table}:`, result.error.message);
      return result.data ?? [];
    };

    if (todayResult.error) throw todayResult.error;
    if (tomorrowResult.error) throw tomorrowResult.error;
    if (upcomingResult.error) throw upcomingResult.error;

    const todayRows = todayResult.data ?? [];
    const tomorrowRows = tomorrowResult.data ?? [];
    const upcomingRows = upcomingResult.data ?? [];
    const requests = optional(requestResult, 'teacher_unavailability_requests');
    const tasks = optional(taskResult, 'replacement_tasks');
    const leaveRows = optional(availabilityResult, 'teacher_availability');

    const uniqueTeachers = new Set(todayRows.map((row) => row.teacher_name).filter(Boolean));
    const uniqueSchools = new Set(todayRows.map((row) => row.school).filter(Boolean));
    const conflicts: Array<{teacher_name:string;lesson_date:string;first:string;second:string}> = [];
    for(let index=0;index<upcomingRows.length;index++){const first=upcomingRows[index];if(!first.teacher_name)continue;for(let other=index+1;other<upcomingRows.length;other++){const second=upcomingRows[other];if(first.teacher_name===second.teacher_name&&first.lesson_date===second.lesson_date&&first.start_time<second.end_time&&second.start_time<first.end_time)conflicts.push({teacher_name:first.teacher_name,lesson_date:first.lesson_date,first:first.school,second:second.school})}}
    const unassigned = upcomingRows.filter((row) => !row.teacher_name);

    const unavailableTomorrow = new Set<string>();
    for (const request of requests) {
      if (request.start_date <= tomorrow && request.end_date >= tomorrow) unavailableTomorrow.add(request.teacher_name);
    }
    for (const leave of leaveRows) {
      if (leave.start_date && leave.end_date && leave.start_date <= tomorrow && leave.end_date >= tomorrow) unavailableTomorrow.add(leave.teacher_name);
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      today,
      tomorrow,
      counts: {
        lessonsToday: todayRows.length,
        teachersWorking: uniqueTeachers.size,
        schoolsToday: uniqueSchools.size,
        conflictsToday: conflicts.filter((row)=>row.lesson_date===today).length,
        pendingRequests: requests.length,
        openReplacements: tasks.length,
        unassignedTomorrow: tomorrowRows.filter((row) => !row.teacher_name).length,
      },
      unavailableTomorrow: [...unavailableTomorrow].sort(),
      replacementTasks: tasks.slice(0, 5),
      alerts: {
        unassigned: unassigned.slice(0,5),
        conflicts: conflicts.slice(0,5),
        requests: requests.slice(0,5),
        replacements: tasks.slice(0,5),
      },
      alertCounts: { unassigned: unassigned.length, conflicts: conflicts.length, requests: requests.length, replacements: tasks.length },
      suggestions: [
        ...(tasks.length ? [`${tasks.length} replacement task${tasks.length === 1 ? '' : 's'} still need coverage.`] : []),
        ...(unavailableTomorrow.size ? [`${[...unavailableTomorrow].join(', ')} unavailable tomorrow.`] : []),
        ...(tomorrowRows.some((row) => !row.teacher_name) ? ['There are unassigned lessons tomorrow.'] : []),
      ].slice(0, 3),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not build dashboard summary.' }, { status: 500 });
  }
}
