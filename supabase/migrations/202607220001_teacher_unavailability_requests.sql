create table if not exists public.teacher_unavailability_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  teacher_name text not null,
  start_date date not null,
  end_date date not null,
  reason text not null check (reason in ('MC', 'Sick', 'Annual leave', 'Emergency', 'Family matter', 'Transport issue', 'Other')),
  remarks text,
  affected_lesson_ids uuid[] not null default '{}',
  affected_lessons jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'replacement_assigned', 'cancelled')),
  admin_note text,
  replacement_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_unavailability_range check (end_date >= start_date)
);

create index if not exists teacher_unavailability_requests_teacher_idx
  on public.teacher_unavailability_requests (teacher_user_id, created_at desc);

create index if not exists teacher_unavailability_requests_status_idx
  on public.teacher_unavailability_requests (status, start_date);

alter table public.teacher_unavailability_requests enable row level security;

drop policy if exists "Teachers can view own unavailability requests" on public.teacher_unavailability_requests;
create policy "Teachers can view own unavailability requests"
  on public.teacher_unavailability_requests for select
  using (teacher_user_id = auth.uid());

drop policy if exists "Teachers can create own unavailability requests" on public.teacher_unavailability_requests;
create policy "Teachers can create own unavailability requests"
  on public.teacher_unavailability_requests for insert
  with check (teacher_user_id = auth.uid());

drop policy if exists "Teachers can cancel pending own requests" on public.teacher_unavailability_requests;
create policy "Teachers can cancel pending own requests"
  on public.teacher_unavailability_requests for update
  using (teacher_user_id = auth.uid() and status = 'pending')
  with check (teacher_user_id = auth.uid() and status in ('pending', 'cancelled'));

drop policy if exists "Admins can manage all unavailability requests" on public.teacher_unavailability_requests;
create policy "Admins can manage all unavailability requests"
  on public.teacher_unavailability_requests for all
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

create or replace function public.set_teacher_unavailability_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_teacher_unavailability_updated_at on public.teacher_unavailability_requests;
create trigger set_teacher_unavailability_updated_at
before update on public.teacher_unavailability_requests
for each row execute function public.set_teacher_unavailability_updated_at();
