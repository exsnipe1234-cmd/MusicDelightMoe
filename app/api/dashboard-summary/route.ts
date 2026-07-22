import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const supabase = db();
    const today = sgDate();
    const tomorrow = sgDate(1);
    const nextWeek = sgDate(7);

    const [todayResult, tomorrowResult, requestResult, taskResult, availabilityResult] = await Promise.all([
      supabase.from('lessons').select('id,teacher_name,school,class_name,start_time,end_time,unavailable').eq('lesson_date', today),
      supabase.from('lessons').select('id,teacher_name,school,class_name,start_time,end_time,unavailable').eq('lesson_date', tomorrow),
      supabase.from('teacher_unavailability_requests').select('id,teacher_name,start_date,end_date,status,reason').in('status', ['pending', 'approved']).lte('start_date', nextWeek).gte('end_date', today),
      supabase.from('replacement_tasks').select('id,teacher_name,lesson_date,school,class_name,start_time,end_time,status,replacement_teacher_name').in('status', ['open', 'pending']),
      supabase.from('teacher_availability').select('teacher_name,availability_type,start_date,end_date,reason').eq('availability_type', 'leave').lte('start_date', nextWeek).gte('end_date', today),
    ]);

    const optional = <T,>(result: { data: T[] | null; error: { message: string } | null }, table: string) => {
      if (result.error) console.warn(`Dashboard summary could not read ${table}:`, result.error.message);
      return result.data ?? [];
    };

    if (todayResult.error) throw todayResult.error;
    if (tomorrowResult.error) throw tomorrowResult.error;

    const todayRows = todayResult.data ?? [];
    const tomorrowRows = tomorrowResult.data ?? [];
    const requests = optional(requestResult, 'teacher_unavailability_requests');
    const tasks = optional(taskResult, 'replacement_tasks');
    const leaveRows = optional(availabilityResult, 'teacher_availability');

    const uniqueTeachers = new Set(todayRows.map((row) => row.teacher_name).filter(Boolean));
    const uniqueSchools = new Set(todayRows.map((row) => row.school).filter(Boolean));
    const conflicts = new Map<string, number>();
    for (const lesson of todayRows) {
      if (!lesson.teacher_name) continue;
      const key = `${lesson.teacher_name}|${lesson.start_time}|${lesson.end_time}`;
      conflicts.set(key, (conflicts.get(key) ?? 0) + 1);
    }

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
        conflictsToday: [...conflicts.values()].filter((count) => count > 1).length,
        pendingRequests: requests.filter((row) => row.status === 'pending').length,
        openReplacements: tasks.length,
        unassignedTomorrow: tomorrowRows.filter((row) => !row.teacher_name).length,
      },
      unavailableTomorrow: [...unavailableTomorrow].sort(),
      replacementTasks: tasks.slice(0, 5),
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
