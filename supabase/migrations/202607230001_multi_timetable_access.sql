-- Multi-timetable access for teacher accounts.
-- Run this once in Supabase SQL Editor before deploying the matching website code.
-- Existing profiles.teacher_name remains the PRIMARY timetable used for leave requests.

create table if not exists public.profile_teacher_access (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  teacher_name text not null references public.teachers(name) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, teacher_name)
);

create index if not exists profile_teacher_access_teacher_idx
  on public.profile_teacher_access (teacher_name);

-- Preserve all existing single-timetable links.
insert into public.profile_teacher_access (profile_id, teacher_name)
select id, teacher_name
from public.profiles
where teacher_name is not null
on conflict (profile_id, teacher_name) do nothing;

alter table public.profile_teacher_access enable row level security;

drop policy if exists "users read own timetable access" on public.profile_teacher_access;
create policy "users read own timetable access"
on public.profile_teacher_access for select
to authenticated
using (profile_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "admins manage timetable access" on public.profile_teacher_access;
create policy "admins manage timetable access"
on public.profile_teacher_access for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Returns every timetable the signed-in account may view.
-- The legacy primary teacher_name is always included as a safety fallback.
create or replace function public.current_teacher_names()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct names.teacher_name) filter (where names.teacher_name is not null), array[]::text[])
  from (
    select p.teacher_name
    from public.profiles p
    where p.id = auth.uid() and p.active

    union all

    select a.teacher_name
    from public.profile_teacher_access a
    join public.profiles p on p.id = a.profile_id
    where a.profile_id = auth.uid() and p.active
  ) names;
$$;

grant execute on function public.current_teacher_names() to authenticated;

-- Atomic helper used by the Teacher Management page.
create or replace function public.set_profile_teacher_access(
  p_profile_id uuid,
  p_teacher_names text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator access is required';
  end if;

  delete from public.profile_teacher_access
  where profile_id = p_profile_id;

  insert into public.profile_teacher_access (profile_id, teacher_name)
  select p_profile_id, value
  from unnest(coalesce(p_teacher_names, array[]::text[])) as value
  where value is not null and btrim(value) <> ''
  on conflict (profile_id, teacher_name) do nothing;
end;
$$;

grant execute on function public.set_profile_teacher_access(uuid, text[]) to authenticated;

-- Replace the old one-timetable teacher lesson policy.
drop policy if exists "teachers read own lessons" on public.lessons;
create policy "teachers read linked lessons"
on public.lessons for select
to authenticated
using (
  public.current_user_is_active()
  and teacher_name = any(public.current_teacher_names())
);
