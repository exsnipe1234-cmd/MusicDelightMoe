create table if not exists public.replacement_tasks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.teacher_unavailability_requests(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  original_teacher text not null,
  lesson_date date not null,
  school text not null,
  class_name text not null,
  start_time time not null,
  end_time time not null,
  replacement_teacher text,
  status text not null default 'needs_replacement' check (status in ('needs_replacement','assigned','cancelled')),
  assigned_at timestamptz,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, lesson_id)
);

create index if not exists replacement_tasks_status_date_idx
  on public.replacement_tasks(status, lesson_date, start_time);

alter table public.replacement_tasks enable row level security;

drop policy if exists "Admins can manage replacement tasks" on public.replacement_tasks;
create policy "Admins can manage replacement tasks"
  on public.replacement_tasks for all
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin' and profiles.active = true
  ))
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin' and profiles.active = true
  ));

drop policy if exists "Teachers can view relevant replacement tasks" on public.replacement_tasks;
create policy "Teachers can view relevant replacement tasks"
  on public.replacement_tasks for select
  using (original_teacher = (select teacher_name from public.profiles where id = auth.uid())
    or replacement_teacher = (select teacher_name from public.profiles where id = auth.uid()));

create or replace function public.create_replacement_tasks_for_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.teacher_unavailability_requests%rowtype;
  item jsonb;
  resolved_lesson_id uuid;
begin
  select * into req from public.teacher_unavailability_requests where id = p_request_id;
  if req.id is null or req.status not in ('approved','replacement_assigned') then return; end if;

  for item in select * from jsonb_array_elements(coalesce(req.affected_lessons, '[]'::jsonb))
  loop
    resolved_lesson_id := nullif(coalesce(item->>'id',''), '')::uuid;
    insert into public.replacement_tasks (
      request_id, lesson_id, original_teacher, lesson_date, school, class_name, start_time, end_time
    ) values (
      req.id,
      resolved_lesson_id,
      req.teacher_name,
      coalesce(item->>'lesson_date', item->>'date')::date,
      coalesce(item->>'school','School unavailable'),
      coalesce(item->>'class_name', item->>'className', 'MOE programme'),
      coalesce(item->>'start_time', item->>'startTime')::time,
      coalesce(item->>'end_time', item->>'endTime')::time
    ) on conflict (request_id, lesson_id) do nothing;

    if resolved_lesson_id is not null then
      update public.lessons set unavailable = true where id = resolved_lesson_id;
    end if;
  end loop;
end;
$$;

create or replace function public.on_unavailability_request_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved','replacement_assigned') and old.status is distinct from new.status then
    perform public.create_replacement_tasks_for_request(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists create_replacement_tasks_after_approval on public.teacher_unavailability_requests;
create trigger create_replacement_tasks_after_approval
after update of status on public.teacher_unavailability_requests
for each row execute function public.on_unavailability_request_approved();

-- Backfill requests that were already approved before this migration was installed.
do $$
declare r record;
begin
  for r in select id from public.teacher_unavailability_requests where status in ('approved','replacement_assigned') loop
    perform public.create_replacement_tasks_for_request(r.id);
  end loop;
end $$;

create or replace function public.assign_replacement_task(p_task_id uuid, p_teacher text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  task public.replacement_tasks%rowtype;
  remaining integer;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true) then
    raise exception 'Administrator access required';
  end if;

  select * into task from public.replacement_tasks where id = p_task_id for update;
  if task.id is null then raise exception 'Replacement task not found'; end if;

  update public.replacement_tasks set
    replacement_teacher = p_teacher,
    status = 'assigned',
    assigned_at = now(),
    assigned_by = auth.uid(),
    updated_at = now()
  where id = p_task_id;

  if task.lesson_id is not null then
    update public.lessons set
      teacher_name = p_teacher,
      unavailable = false,
      source = 'replacement'
    where id = task.lesson_id;
  end if;

  select count(*) into remaining from public.replacement_tasks
  where request_id = task.request_id and status = 'needs_replacement';

  if remaining = 0 then
    update public.teacher_unavailability_requests set
      status = 'replacement_assigned',
      replacement_summary = 'All affected lessons have replacement teachers assigned.'
    where id = task.request_id;
  end if;
end;
$$;