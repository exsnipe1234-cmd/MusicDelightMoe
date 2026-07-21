-- Run this once in Supabase SQL Editor.

create table if not exists public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  availability_type text not null check (availability_type in ('weekly', 'leave')),
  weekday integer check (weekday between 0 and 6),
  start_time time,
  end_time time,
  start_date date,
  end_date date,
  reason text,
  created_at timestamptz not null default now(),
  constraint weekly_fields check (
    availability_type <> 'weekly' or (weekday is not null and start_time is not null and end_time is not null and start_time < end_time)
  ),
  constraint leave_fields check (
    availability_type <> 'leave' or (start_date is not null and end_date is not null and start_date <= end_date)
  )
);

create index if not exists teacher_availability_teacher_idx on public.teacher_availability (teacher_name);
create index if not exists teacher_availability_dates_idx on public.teacher_availability (start_date, end_date);

alter table public.teacher_availability enable row level security;

drop policy if exists "Authenticated users can read teacher availability" on public.teacher_availability;
create policy "Authenticated users can read teacher availability"
on public.teacher_availability for select
to authenticated
using (true);

drop policy if exists "Admins can insert teacher availability" on public.teacher_availability;
create policy "Admins can insert teacher availability"
on public.teacher_availability for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.active = true
  )
);

drop policy if exists "Admins can update teacher availability" on public.teacher_availability;
create policy "Admins can update teacher availability"
on public.teacher_availability for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.active = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.active = true
  )
);

drop policy if exists "Admins can delete teacher availability" on public.teacher_availability;
create policy "Admins can delete teacher availability"
on public.teacher_availability for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.active = true
  )
);