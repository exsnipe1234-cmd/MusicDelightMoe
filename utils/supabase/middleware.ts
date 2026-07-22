import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Fail closed in production when the Supabase configuration is missing.
  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Application configuration is incomplete.', { status: 503 });
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const publicPath = path === '/login';

  if (!user) {
    if (publicPath) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .single();

  // An authenticated user without a valid active profile must not enter the app.
  if (profileError || !profile?.active || !['admin', 'teacher'].includes(profile.role)) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  if (publicPath) {
    const destination = request.nextUrl.clone();
    destination.pathname = profile.role === 'teacher' ? '/teacher' : '/admin/calendar';
    destination.search = '';
    return NextResponse.redirect(destination);
  }

  if (profile.role === 'teacher') {
    const teacherAllowed = path === '/teacher' || path.startsWith('/teacher/');
    if (!teacherAllowed) {
      const teacherUrl = request.nextUrl.clone();
      teacherUrl.pathname = '/teacher';
      teacherUrl.search = '';
      return NextResponse.redirect(teacherUrl);
    }
  }

  if (profile.role === 'admin' && (path === '/teacher' || path.startsWith('/teacher/'))) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = '/admin/calendar';
    adminUrl.search = '';
    return NextResponse.redirect(adminUrl);
  }

  return response;
}
