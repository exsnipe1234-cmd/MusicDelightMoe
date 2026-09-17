create extension if not exists pgcrypto;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  lesson_date date not null,
  school text not null,
  class_name text not null,
  start_time time not null,
  end_time time not null,
  teacher_name text,
  unavailable boolean not null default false,
  cancelled boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lessons_unique_entry
on public.lessons (
  lesson_date,
  school,
  class_name,
  start_time,
  end_time,
  coalesce(teacher_name, '')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

alter table public.teachers enable row level security;
alter table public.lessons enable row level security;

-- Role-based access policies. Admins have full access; teachers can only read their own lessons.
-- API routes use the service_role key (SUPABASE_SECRET_KEY) and bypass RLS entirely.
-- Drop any leftover development policies first.
drop policy if exists "development read teachers" on public.teachers;
drop policy if exists "development manage teachers" on public.teachers;
drop policy if exists "development read lessons" on public.lessons;
drop policy if exists "development manage lessons" on public.lessons;

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

insert into public.teachers (name, color) values
  ('Claris', '#70d28c'),
  ('Gerald', '#55d6cf'),
  ('Edward', '#72c7f0'),
  ('Wero', '#d9c7a4'),
  ('Shi Yi', '#a98bea'),
  ('Siew Lynn', '#f2abc6'),
  ('Joel', '#c7ccd4'),
  ('Audrey', '#d388d8'),
  ('Ashley', '#f2d66d')
on conflict (name) do update set color = excluded.color;
