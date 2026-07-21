-- Fix recursive profile RLS policies that can make every account look inactive.

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' and active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_teacher_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select teacher_name from public.profiles where id = auth.uid() and active;
$$;

grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_teacher_name() to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles"
on public.profiles for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
on public.profiles for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "authenticated read teachers" on public.teachers;
create policy "authenticated read teachers"
on public.teachers for select
to authenticated
using (public.current_user_is_active());

drop policy if exists "admins manage teachers" on public.teachers;
create policy "admins manage teachers"
on public.teachers for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "admins read all lessons" on public.lessons;
create policy "admins read all lessons"
on public.lessons for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "teachers read own lessons" on public.lessons;
create policy "teachers read own lessons"
on public.lessons for select
to authenticated
using (
  public.current_user_is_active()
  and teacher_name = public.current_teacher_name()
);

drop policy if exists "admins insert lessons" on public.lessons;
create policy "admins insert lessons"
on public.lessons for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "admins update lessons" on public.lessons;
create policy "admins update lessons"
on public.lessons for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "admins delete lessons" on public.lessons;
create policy "admins delete lessons"
on public.lessons for delete
to authenticated
using (public.current_user_is_admin());
