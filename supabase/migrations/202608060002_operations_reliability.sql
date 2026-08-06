-- Operational reliability: transactional timetable imports, guarded restore, and lesson auditing.
-- Additive only. Run once in Supabase SQL Editor before deploying the matching website code.

create table if not exists public.timetable_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  calendar_label text not null,
  date_start date not null,
  date_end date not null,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  status text not null default 'applied' check (status in ('applied', 'restored')),
  created_by uuid,
  created_at timestamptz not null default now(),
  restored_by uuid,
  restored_at timestamptz
);

create table if not exists public.timetable_import_items (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.timetable_imports(id) on delete cascade,
  lesson_id uuid not null,
  action text not null check (action in ('insert', 'update')),
  before_row jsonb,
  after_row jsonb not null
);

create index if not exists timetable_imports_created_idx on public.timetable_imports(created_at desc);
create index if not exists timetable_import_items_import_idx on public.timetable_import_items(import_id);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  table_name text not null,
  record_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_user_id uuid,
  actor_display_name text,
  source text,
  changed_fields text[] not null default array[]::text[],
  old_row jsonb,
  new_row jsonb
);

create index if not exists audit_log_record_idx on public.audit_log(table_name, record_id, occurred_at desc);
create index if not exists audit_log_actor_idx on public.audit_log(actor_user_id, occurred_at desc);
create index if not exists audit_log_occurred_idx on public.audit_log(occurred_at desc);

alter table public.timetable_imports enable row level security;
alter table public.timetable_import_items enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "admins read timetable imports" on public.timetable_imports;
create policy "admins read timetable imports" on public.timetable_imports for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "admins read timetable import items" on public.timetable_import_items;
create policy "admins read timetable import items" on public.timetable_import_items for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "admins read audit log" on public.audit_log;
create policy "admins read audit log" on public.audit_log for select to authenticated
using (public.current_user_is_admin());

grant select on public.timetable_imports, public.timetable_import_items, public.audit_log to authenticated;

create or replace function public.lesson_snapshot(p_lesson public.lessons)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_lesson.id,
    'lesson_date', p_lesson.lesson_date,
    'school', p_lesson.school,
    'class_name', p_lesson.class_name,
    'start_time', p_lesson.start_time,
    'end_time', p_lesson.end_time,
    'teacher_name', p_lesson.teacher_name,
    'unavailable', p_lesson.unavailable,
    'cancelled', p_lesson.cancelled,
    'source', p_lesson.source,
    'created_at', p_lesson.created_at,
    'updated_at', p_lesson.updated_at
  );
$$;

create or replace function public.audit_lesson_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  old_json jsonb;
  new_json jsonb;
  fields text[] := array[]::text[];
begin
  select display_name into actor_name from public.profiles where id = auth.uid();
  old_json := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_json := case when tg_op = 'DELETE' then null else to_jsonb(new) end;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), array[]::text[]) into fields
    from jsonb_object_keys(old_json || new_json) as keys(key)
    where old_json -> key is distinct from new_json -> key;
  end if;

  insert into public.audit_log(table_name, record_id, operation, actor_user_id, actor_display_name, source, changed_fields, old_row, new_row)
  values ('lessons', coalesce(new.id, old.id), tg_op, auth.uid(), actor_name, coalesce(new.source, old.source), fields, old_json, new_json);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists lessons_audit_change on public.lessons;
create trigger lessons_audit_change after insert or update or delete on public.lessons
for each row execute function public.audit_lesson_change();

create or replace function public.apply_timetable_import(
  p_file_name text,
  p_calendar_label text,
  p_date_start date,
  p_date_end date,
  p_new_lessons jsonb,
  p_updates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_id uuid;
  item jsonb;
  before_lesson public.lessons%rowtype;
  after_lesson public.lessons%rowtype;
  inserted_total integer := 0;
  updated_total integer := 0;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator access is required'; end if;

  insert into public.timetable_imports(file_name, calendar_label, date_start, date_end, created_by)
  values (p_file_name, p_calendar_label, p_date_start, p_date_end, auth.uid()) returning id into batch_id;

  for item in select value from jsonb_array_elements(coalesce(p_new_lessons, '[]'::jsonb)) loop
    insert into public.lessons(lesson_date, school, class_name, start_time, end_time, teacher_name, unavailable, cancelled, source)
    values ((item->>'lesson_date')::date, item->>'school', item->>'class_name', (item->>'start_time')::time, (item->>'end_time')::time,
      item->>'teacher_name', false, false, 'pdf') returning * into after_lesson;
    insert into public.timetable_import_items(import_id, lesson_id, action, before_row, after_row)
    values (batch_id, after_lesson.id, 'insert', null, public.lesson_snapshot(after_lesson));
    inserted_total := inserted_total + 1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    select * into before_lesson from public.lessons where id = (item->>'lesson_id')::uuid for update;
    if not found then raise exception 'A lesson selected for update no longer exists'; end if;
    if public.lesson_snapshot(before_lesson) is distinct from item->'expected_snapshot' then
      raise exception 'A lesson changed after preview. Re-open the PDF and review it again.';
    end if;
    if before_lesson.cancelled then raise exception 'Cancelled lessons cannot be changed by PDF import'; end if;

    update public.lessons set teacher_name = item->>'teacher_name', source = 'pdf'
    where id = before_lesson.id returning * into after_lesson;
    insert into public.timetable_import_items(import_id, lesson_id, action, before_row, after_row)
    values (batch_id, after_lesson.id, 'update', public.lesson_snapshot(before_lesson), public.lesson_snapshot(after_lesson));
    updated_total := updated_total + 1;
  end loop;

  update public.timetable_imports set inserted_count = inserted_total, updated_count = updated_total where id = batch_id;
  return batch_id;
end;
$$;

create or replace function public.restore_timetable_import(p_import_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  batch public.timetable_imports%rowtype;
  item public.timetable_import_items%rowtype;
  current_lesson public.lessons%rowtype;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator access is required'; end if;
  select * into batch from public.timetable_imports where id = p_import_id for update;
  if not found then raise exception 'Import history record not found'; end if;
  if batch.status = 'restored' then raise exception 'This import has already been restored'; end if;

  for item in select * from public.timetable_import_items where import_id = p_import_id order by id loop
    select * into current_lesson from public.lessons where id = item.lesson_id for update;
    if not found or public.lesson_snapshot(current_lesson) is distinct from item.after_row then
      raise exception 'Restore stopped because an imported lesson was edited afterward';
    end if;
  end loop;

  for item in select * from public.timetable_import_items where import_id = p_import_id and action = 'insert' order by id desc loop
    delete from public.lessons where id = item.lesson_id;
  end loop;

  for item in select * from public.timetable_import_items where import_id = p_import_id and action = 'update' order by id desc loop
    update public.lessons set
      lesson_date = (item.before_row->>'lesson_date')::date,
      school = item.before_row->>'school', class_name = item.before_row->>'class_name',
      start_time = (item.before_row->>'start_time')::time, end_time = (item.before_row->>'end_time')::time,
      teacher_name = item.before_row->>'teacher_name', unavailable = (item.before_row->>'unavailable')::boolean,
      cancelled = (item.before_row->>'cancelled')::boolean, source = item.before_row->>'source'
    where id = item.lesson_id;
  end loop;

  update public.timetable_imports set status = 'restored', restored_by = auth.uid(), restored_at = now() where id = p_import_id;
end;
$$;

revoke all on function public.audit_lesson_change() from public, anon, authenticated;
revoke all on function public.lesson_snapshot(public.lessons) from public, anon;
revoke all on function public.apply_timetable_import(text, text, date, date, jsonb, jsonb) from public, anon;
revoke all on function public.restore_timetable_import(uuid) from public, anon;
grant execute on function public.apply_timetable_import(text, text, date, date, jsonb, jsonb) to authenticated;
grant execute on function public.restore_timetable_import(uuid) to authenticated;
