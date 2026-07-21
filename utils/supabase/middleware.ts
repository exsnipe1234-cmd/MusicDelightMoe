import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

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

  if (!user && !publicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role, active').eq('id', user.id).single();
    if (!profile?.active && !publicPath) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }
    if (profile?.role === 'teacher' && (path === '/' || path.startsWith('/import'))) {
      const teacherUrl = request.nextUrl.clone();
      teacherUrl.pathname = '/teacher';
      return NextResponse.redirect(teacherUrl);
    }
    if (profile?.role === 'admin' && path.startsWith('/teacher')) {
      const adminUrl = request.nextUrl.clone();
      adminUrl.pathname = '/';
      return NextResponse.redirect(adminUrl);
    }
    if (publicPath && profile?.active) {
      const destination = request.nextUrl.clone();
      destination.pathname = profile.role === 'teacher' ? '/teacher' : '/';
      return NextResponse.redirect(destination);
    }
  }

  return response;
}
