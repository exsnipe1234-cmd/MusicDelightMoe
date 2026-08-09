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

export async function POST(request: Request) {
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

    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '').trim();
    const displayName = String(body?.display_name ?? '').trim();
    const role = body?.role === 'admin' ? 'admin' : 'teacher';
    const teacherName = String(body?.teacher_name ?? '').trim();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'Email address, password and display name are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'The password must be at least 8 characters.' }, { status: 400 });
    }
    if (role === 'teacher' && !teacherName) {
      return NextResponse.json({ error: 'A teacher account must be linked to a timetable.' }, { status: 400 });
    }
    if (role === 'admin' && teacherName) {
      return NextResponse.json({ error: 'Administrator accounts should not have a primary timetable.' }, { status: 400 });
    }

    const supabase = db();

    const { data: createdUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (authError) {
      if (authError.message?.includes('already')) {
        return NextResponse.json({ error: 'An account with this email address already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { error: profileError } = await supabase.from('profiles').update({
      display_name: displayName,
      role,
      teacher_name: role === 'teacher' ? teacherName : null,
      active: true,
    }).eq('id', createdUser.user.id);

    if (profileError) {
      return NextResponse.json({ error: `Account created, but the timetable link could not be saved: ${profileError.message}` }, { status: 200 });
    }

    if (role === 'teacher' && teacherName) {
      await supabase.from('profile_teacher_access').upsert({
        profile_id: createdUser.user.id,
        teacher_name: teacherName,
      }, { onConflict: 'profile_id, teacher_name', ignoreDuplicates: true });
    }

    return NextResponse.json({ success: true, displayName, email }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Creation failed.' }, { status: 500 });
  }
}
