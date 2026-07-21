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

-- Temporary development policies. These allow the calendar to work before login is added.
-- We will replace them with admin/teacher-specific policies during the authentication phase.
drop policy if exists "development read teachers" on public.teachers;
create policy "development read teachers"
on public.teachers for select
to anon, authenticated
using (true);

drop policy if exists "development manage teachers" on public.teachers;
create policy "development manage teachers"
on public.teachers for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "development read lessons" on public.lessons;
create policy "development read lessons"
on public.lessons for select
to anon, authenticated
using (true);

drop policy if exists "development manage lessons" on public.lessons;
create policy "development manage lessons"
on public.lessons for all
to anon, authenticated
using (true)
with check (true);

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
