-- Cancelled lessons are retained for audit and reporting, but excluded from active schedules.
-- Run this once in the Supabase SQL Editor before deploying the matching website code.

alter table public.lessons
  add column if not exists cancelled boolean not null default false;

create index if not exists lessons_active_date_idx
  on public.lessons (lesson_date)
  where cancelled = false;
