-- Phase 5: authentication, profiles and role-based access
-- Run this entire file in Supabase SQL Editor after creating the first users.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  role text not null default 'teacher' check (role in ('admin', 'teacher')),
  teacher_name text references public.teachers(name) on update cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

-- Backfill profiles for users created before this migration.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', split_part(coalesce(email, ''), '@', 1))
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;

-- Remove the temporary public lesson policies from the earlier development phase.
drop policy if exists "development read lessons" on public.lessons;
drop policy if exists "development manage lessons" on public.lessons;
drop policy if exists "development read teachers" on public.teachers;
drop policy if exists "development manage teachers" on public.teachers;

-- Profiles: users can read their own profile; admins can read and manage all profiles.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active
  )
);

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
on public.profiles for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active
  )
);

-- Teachers list: authenticated active users may read it; only admins may change it.
drop policy if exists "authenticated read teachers" on public.teachers;
create policy "authenticated read teachers"
on public.teachers for select
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active)
);

drop policy if exists "admins manage teachers" on public.teachers;
create policy "admins manage teachers"
on public.teachers for all
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active)
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active)
);

-- Lessons: admins see and manage everything. Teachers can only read their own lessons.
drop policy if exists "admins read all lessons" on public.lessons;
create policy "admins read all lessons"
on public.lessons for select
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active)
);

drop policy if exists "teachers read own lessons" on public.lessons;
create policy "teachers read own lessons"
on public.lessons for select
to authenticated
using (
  teacher_name = (
    select p.teacher_name from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher' and p.active
  )
);

drop policy if exists "admins insert lessons" on public.lessons;
create policy "admins insert lessons"
on public.lessons for insert
to authenticated
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active)
);

drop policy if exists "admins update lessons" on public.lessons;
create policy "admins update lessons"
on public.lessons for update
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active)
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active)
);

drop policy if exists "admins delete lessons" on public.lessons;
create policy "admins delete lessons"
on public.lessons for delete
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active)
);

-- IMPORTANT: After creating your own Auth user, promote it using its email:
-- update public.profiles
-- set role = 'admin', display_name = 'Gerald', teacher_name = 'Gerald'
-- where email = 'YOUR_EMAIL_HERE';

-- For each teacher account, connect the login to the correct timetable name:
-- update public.profiles
-- set role = 'teacher', display_name = 'Joel', teacher_name = 'Joel'
-- where email = 'JOEL_EMAIL_HERE';
