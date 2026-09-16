'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg, EventChangeArg } from '@fullcalendar/core';
import { CalendarDays, CalendarPlus, List, Plus, WifiOff } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';
import { LessonRow, useAppData } from '../../providers/AppDataProvider';
import SmartDashboard from '../components/SmartDashboard';
import CalendarView from './_components/CalendarView';
import DayPanel from './_components/DayPanel';
import LessonEditorDrawer from './_components/LessonEditorDrawer';
import QuickAddDrawer from './_components/QuickAddDrawer';
import RecurringDrawer from './_components/RecurringDrawer';
import FilterBar from './_components/FilterBar';
import BulkToolbar from './_components/BulkToolbar';
import WorkloadPanels from './_components/WorkloadPanels';
import UndoBanner from './_components/UndoBanner';
import { openPrintPreview, buildCalendarPdfBody, buildSchedulePdfBody } from './_components/PdfExport';
import {
  type Draft, type Range, type QuickRow, type UndoAction, type RecurringDraft, type NativeWindow,
  blankDraft, blankQuickRow, blankRecurring, key, currentMonthRange,
  rgba, normalizeSchool, defaultTeacherColours, colourFromName,
} from './_components/calendarUtils';
import { strings } from './_components/calendarStrings';
import styles from './_components/calendar.module.css';

const MAX_UNDO = 20;
const RETRY_DELAYS = [1000, 2000, 4000];
const DAY_MAX_EVENTS_KEY = 'music-delight-day-max-events';

/** Retry a promise with exponential backoff. Returns the result or throws after all retries exhausted. */
async function withRetry<T>(fn: () => Promise<T>, delays: number[] = RETRY_DELAYS): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < delays.length) await new Promise((r) => setTimeout(r, delays[i]));
    }
  }
  throw lastError;
}

/** Generate a temporary ID for optimistic inserts. */
function tempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const requestId = useRef(0);
  const calendarRef = useRef<FullCalendar | null>(null);
  const { teachers, ensureReferences, getLessons, upsertCachedLesson, removeCachedLesson } = useAppData();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Loading calendar\u2026');
  const [messageType, setMessageType] = useState<'info' | 'error'>('info');
  const [range, setRange] = useState<Range>(currentMonthRange);
  const [filter, setFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => blankDraft());
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickRows, setQuickRows] = useState<QuickRow[]>([]);
  const [quickSaving, setQuickSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTeacher, setBulkTeacher] = useState('');
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringDraft, setRecurringDraft] = useState<RecurringDraft>(blankRecurring);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [bulkDate, setBulkDate] = useState(key(new Date()));
  const [copySourceLessons, setCopySourceLessons] = useState<LessonRow[]>([]);
  const [copyDateInput, setCopyDateInput] = useState(key(new Date()));
  const [copyDates, setCopyDates] = useState<string[]>([]);
  const [mobileCalendar, setMobileCalendar] = useState(false);
  const [nativeCalendar, setNativeCalendar] = useState(false);
  const [connected, setConnected] = useState(true);
  const [dayMaxEvents, setDayMaxEvents] = useState(() => {
    if (typeof window === 'undefined') return 3;
    const stored = window.localStorage.getItem(DAY_MAX_EVENTS_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) && parsed >= 2 && parsed <= 6 ? parsed : 3;
  });
  const failedPayload = useRef<(() => Promise<void>) | null>(null);

  // ── Helpers ──
  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack((prev) => [action, ...prev].slice(0, MAX_UNDO));
  }, []);

  const showError = useCallback((msg: string, retry?: () => Promise<void>) => {
    setMessage(msg);
    setMessageType('error');
    failedPayload.current = retry ?? null;
  }, []);

  const showInfo = useCallback((msg: string) => {
    setMessage(msg);
    setMessageType('info');
    failedPayload.current = null;
  }, []);

  // ── Auth & Data Loading ──
  useEffect(() => { void (async () => { const { data: sessionData } = await supabase.auth.getSession(); if (!sessionData.session) { router.replace('/login'); return; } const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', sessionData.session.user.id).single(); if (!profile?.active || profile.role !== 'admin') { router.replace(profile?.role === 'teacher' ? '/teacher' : '/login'); return; } try { await ensureReferences(); } catch (error) { showError(error instanceof Error ? error.message : 'Could not load teachers.'); } })(); }, [ensureReferences, router, supabase, showError]);

  const loadRange = useCallback(async (next: Range, force = false) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const rows = await withRetry(() => getLessons(next, force));
      if (id !== requestId.current) return;
      setLessons(rows);
      showInfo(`${rows.length} lessons loaded for this view.`);
    } catch (error) {
      if (id !== requestId.current) return;
      showError(`Could not load calendar: ${error instanceof Error ? error.message : 'Unknown error'}`, () => loadRange(next, true));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [getLessons, showError, showInfo]);

  useEffect(() => { void loadRange(range); }, [range, loadRange]);

  // ── Real-time sync with connection monitoring ──
  useEffect(() => {
    const channel = supabase
      .channel('admin-calendar-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () => { void loadRange(range, true); })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          showError('Live sync disconnected. Changes may not appear in real time.', () => loadRange(range, true));
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [loadRange, range, supabase, showError]);

  useEffect(() => { const requested = new URLSearchParams(window.location.search).get('filter'); if (requested && (requested === 'unassigned' || requested === 'cancelled' || teachers.some((teacher) => teacher.name === requested))) setFilter(requested); }, [teachers]);
  useEffect(() => { const media = window.matchMedia('(max-width: 900px)'); const update = () => setMobileCalendar(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { const capacitor = (window as NativeWindow).Capacitor; setNativeCalendar(Boolean(capacitor?.isNativePlatform?.() || window.localStorage.getItem('music-delight-native-app') === '1')); }, []);
  useEffect(() => { if (mobileCalendar || nativeCalendar) calendarRef.current?.getApi().changeView('timeGridDay'); }, [mobileCalendar, nativeCalendar]);

  // ── Derived State ──
  const schools = useMemo(() => { const seen = new Set<string>(); return lessons.map((lesson) => lesson.school).filter(Boolean).filter((school) => { const k = normalizeSchool(school); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.localeCompare(b)); }, [lessons]);
  const classesForSchool = useCallback((school: string) => {
    const key = normalizeSchool(school);
    return Array.from(new Set(lessons.filter((lesson) => normalizeSchool(lesson.school) === key).map((lesson) => lesson.class_name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [lessons]);
  const colour = useCallback((name: string | null) => {
    const dbColour = teachers.find((teacher) => teacher.name.trim().toLowerCase() === name?.trim().toLowerCase())?.color;
    if (dbColour && dbColour !== '#7c8cff') return dbColour;
    return defaultTeacherColours[name?.trim().toLowerCase() ?? ''] ?? colourFromName(name);
  }, [teachers]);
  const visible = useMemo(() => { const query = search.trim().toLowerCase(); return lessons.filter((lesson) => (filter === 'cancelled' ? lesson.cancelled : !lesson.cancelled && (filter === 'all' || (filter === 'unassigned' ? !lesson.teacher_name : lesson.teacher_name === filter))) && (schoolFilter === 'all' || normalizeSchool(lesson.school) === normalizeSchool(schoolFilter)) && (!query || `${lesson.school} ${lesson.class_name} ${lesson.teacher_name ?? 'unassigned'}`.toLowerCase().includes(query))); }, [lessons, filter, schoolFilter, search]);
  const selectedLessons = useMemo(() => lessons.filter((lesson) => selectedIds.includes(lesson.id)), [lessons, selectedIds]);
  const events = useMemo(() => visible.map((lesson) => { const teacherColour = lesson.cancelled ? '#f87171' : colour(lesson.teacher_name); return { id: lesson.id, title: lesson.school, start: `${lesson.lesson_date}T${lesson.start_time.slice(0, 5)}`, end: `${lesson.lesson_date}T${lesson.end_time.slice(0, 5)}`, backgroundColor: rgba(teacherColour, 0.45), borderColor: teacherColour, textColor: '#172033', extendedProps: { ...lesson, teacherColour } }; }), [visible, colour]);
  const workload = useMemo(() => { const counts = new Map<string, number>(); lessons.filter((lesson) => !lesson.cancelled).forEach((lesson) => { const name = lesson.teacher_name ?? 'Unassigned'; counts.set(name, (counts.get(name) ?? 0) + 1); }); return [...counts.entries()].sort((a, b) => b[1] - a[1]); }, [lessons]);
  const schoolWorkload = useMemo(() => { const groups = new Map<string, { name: string; count: number }>(); lessons.filter((lesson) => !lesson.cancelled).forEach((lesson) => { const group = normalizeSchool(lesson.school); const current = groups.get(group); groups.set(group, { name: current?.name ?? lesson.school, count: (current?.count ?? 0) + 1 }); }); return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)); }, [lessons]);
  const cancelledCount = useMemo(() => lessons.filter((lesson) => lesson.cancelled).length, [lessons]);
  const dayLessons = useMemo(() => day ? visible.filter((lesson) => lesson.lesson_date === day).sort((a, b) => a.start_time.localeCompare(b.start_time)) : [], [day, visible]);
  const exportRange = useMemo(() => range.view === 'dayGridMonth' ? { start: range.currentStart, end: range.currentEnd } : { start: range.start, end: range.end }, [range]);
  const exportLessons = useMemo(() => visible.filter((lesson) => lesson.lesson_date >= exportRange.start && lesson.lesson_date < exportRange.end), [visible, exportRange]);

  // ── CRUD Operations ──
  const openLesson = (lesson: LessonRow) => { setDraft({ id: lesson.id, date: lesson.lesson_date, school: lesson.school, className: lesson.class_name, startTime: lesson.start_time.slice(0, 5), endTime: lesson.end_time.slice(0, 5), teacher: lesson.teacher_name ?? '', unavailable: lesson.unavailable, cancelled: lesson.cancelled }); setDay(null); setDrawer(true); };
  const addLesson = (date: string) => { setDraft(blankDraft(date)); setDay(null); setDrawer(true); };
  const onDatesSet = (arg: DatesSetArg) => { const next = { start: key(arg.start), end: key(arg.end), view: arg.view.type, currentStart: key(arg.view.currentStart), currentEnd: key(arg.view.currentEnd) }; setRange((current) => current.start === next.start && current.end === next.end && current.view === next.view && current.currentStart === next.currentStart && current.currentEnd === next.currentEnd ? current : next); };

  // move() already has optimistic-like behavior (local state updated after server confirms, but revert on error)
  const move = async (arg: EventChangeArg) => {
    const startDate = arg.event.start; const endDate = arg.event.end;
    const moved = lessons.find((lesson) => lesson.id === arg.event.id);
    if (!startDate || !endDate || !moved) { arg.revert(); return; }
    const before = moved;
    const date = key(startDate); const start = startDate.toTimeString().slice(0, 5); const end = endDate.toTimeString().slice(0, 5);

    // Optimistic: update local state immediately
    const optimistic: LessonRow = { ...moved, lesson_date: date, start_time: start, end_time: end };
    setLessons((current) => current.map((l) => l.id === moved.id ? optimistic : l));
    upsertCachedLesson(optimistic);

    const { error } = await supabase.from('lessons').update({ lesson_date: date, start_time: start, end_time: end }).eq('id', moved.id);
    if (error) {
      // Revert
      setLessons((current) => current.map((l) => l.id === moved.id ? moved : l));
      upsertCachedLesson(moved);
      arg.revert();
      showError(error.message, () => move(arg));
      return;
    }
    pushUndo({ label: 'moved', mode: 'update', before: [before], after: [optimistic] });
    showInfo('Lesson moved and saved.');
  };

  const save = async () => {
    if (!draft.school.trim() || !draft.className.trim()) return;
    const isUpdate = Boolean(draft.id);
    const before = isUpdate ? lessons.find((l) => l.id === draft.id) : undefined;
    const payload = { lesson_date: draft.date, school: draft.school.trim(), class_name: draft.className.trim(), start_time: draft.startTime, end_time: draft.endTime, teacher_name: draft.teacher || null, unavailable: draft.unavailable, cancelled: draft.cancelled, source: isUpdate ? 'manual' : 'calendar-editor' };

    // Optimistic
    const optimisticId = isUpdate ? draft.id! : tempId();
    const optimistic: LessonRow = {
      id: optimisticId, lesson_date: payload.lesson_date, school: payload.school, class_name: payload.class_name,
      start_time: payload.start_time, end_time: payload.end_time, teacher_name: payload.teacher_name,
      unavailable: payload.unavailable, cancelled: payload.cancelled, source: payload.source,
    };
    const previousLessons = lessons;
    setLessons((current) => {
      const next = current.filter((l) => l.id !== optimisticId);
      next.push(optimistic);
      return next.sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time));
    });
    upsertCachedLesson(optimistic);
    setDrawer(false);

    const result = isUpdate
      ? await supabase.from('lessons').update(payload).eq('id', draft.id).select().single()
      : await supabase.from('lessons').insert(payload).select().single();

    if (result.error) {
      setLessons(previousLessons);
      if (!isUpdate) removeCachedLesson(optimisticId);
      showError(result.error.message, () => save());
      return;
    }
    const saved = result.data as LessonRow;
    setLessons((current) => {
      const next = current.filter((l) => l.id !== optimisticId);
      next.push(saved);
      return next.sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time));
    });
    upsertCachedLesson(saved);
    if (optimisticId !== saved.id) removeCachedLesson(optimisticId);
    pushUndo({ label: isUpdate ? 'updated' : 'added', mode: isUpdate ? 'update' : 'insert', before: before ? [before] : [], after: [saved] });
    showInfo(saved.cancelled ? 'Lesson cancelled.' : 'Lesson saved.');
  };

  const remove = async () => {
    if (!draft.id || !window.confirm('Delete this lesson?')) return;
    const before = lessons.find((l) => l.id === draft.id);
    if (!before) return;

    // Optimistic
    const previousLessons = lessons;
    setLessons((current) => current.filter((l) => l.id !== draft.id));
    removeCachedLesson(draft.id!);
    setDrawer(false);

    const { error } = await supabase.from('lessons').delete().eq('id', draft.id);
    if (error) {
      setLessons(previousLessons);
      upsertCachedLesson(before);
      showError(error.message, () => remove());
      return;
    }
    pushUndo({ label: 'deleted', mode: 'delete', before: [before], after: [] });
    showInfo('Lesson deleted.');
  };

  const setSelection = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const selectVisible = () => setSelectedIds((current) => current.length === visible.length ? [] : visible.map((lesson) => lesson.id));

  const bulkUpdate = async (changes: Partial<LessonRow>, label: string) => {
    if (!selectedLessons.length) return;
    const before = selectedLessons;
    const previousLessons = lessons;

    // Optimistic
    setLessons((current) => current.map((l) => selectedIds.includes(l.id) ? { ...l, ...changes } : l));
    setSelectedIds([]);

    const { data, error } = await supabase.from('lessons').update(changes).in('id', selectedIds).select();
    if (error) {
      setLessons(previousLessons);
      showError(`Could not ${label.toLowerCase()}: ${error.message}`, () => bulkUpdate(changes, label));
      return;
    }
    const after = (data ?? []) as LessonRow[];
    setLessons((current) => current.map((l) => after.find((item) => item.id === l.id) ?? l));
    after.forEach(upsertCachedLesson);
    pushUndo({ label, mode: 'update', before, after });
    showInfo(`${after.length} lessons ${label.toLowerCase()}.`);
  };

  const bulkMove = async () => { if (!selectedLessons.length || !bulkDate) return; await bulkUpdate({ lesson_date: bulkDate }, 'moved'); };

  const bulkDelete = async () => {
    if (!selectedLessons.length || !window.confirm(`Delete ${selectedLessons.length} selected lessons?`)) return;
    const before = selectedLessons;
    const previousLessons = lessons;

    // Optimistic
    setLessons((current) => current.filter((l) => !selectedIds.includes(l.id)));
    selectedLessons.forEach((l) => removeCachedLesson(l.id));
    setSelectedIds([]);

    const { error } = await supabase.from('lessons').delete().in('id', selectedIds);
    if (error) {
      setLessons(previousLessons);
      before.forEach(upsertCachedLesson);
      showError(`Could not delete lessons: ${error.message}`, () => bulkDelete());
      return;
    }
    pushUndo({ label: 'deleted', mode: 'delete', before, after: [] });
    showInfo(`${before.length} lessons deleted.`);
  };

  const undoLast = async () => {
    if (!undoStack.length) return;
    const action = undoStack[0];
    setUndoing(true);
    let error: { message: string } | null = null;
    if (action.mode === 'update') {
      const result = await Promise.all(action.before.map((lesson) => supabase.from('lessons').update({ lesson_date: lesson.lesson_date, school: lesson.school, class_name: lesson.class_name, start_time: lesson.start_time, end_time: lesson.end_time, teacher_name: lesson.teacher_name, unavailable: lesson.unavailable, cancelled: lesson.cancelled, source: lesson.source }).eq('id', lesson.id)));
      error = result.find((item) => item.error)?.error ?? null;
    } else if (action.mode === 'delete') {
      const result = await supabase.from('lessons').insert(action.before);
      error = result.error;
    } else {
      const result = await supabase.from('lessons').delete().in('id', action.after.map((lesson) => lesson.id));
      error = result.error;
    }
    if (error) {
      showError(`Undo failed: ${error.message}`, () => undoLast());
    } else {
      setLessons((current) => {
        if (action.mode === 'delete') return [...current, ...action.before].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time));
        if (action.mode === 'insert') return current.filter((l) => !action.after.some((item) => item.id === l.id));
        return current.map((l) => action.before.find((item) => item.id === l.id) ?? l);
      });
      action.before.forEach(upsertCachedLesson);
      setUndoStack((prev) => prev.slice(1));
      showInfo('Last change undone.');
    }
    setUndoing(false);
  };

  const dismissAllUndo = () => setUndoStack([]);

  const saveRecurring = async () => {
    if (!recurringDraft.school.trim() || !recurringDraft.className.trim() || !recurringDraft.weekdays.length || recurringDraft.endDate < recurringDraft.startDate) { showError('Complete the recurring lesson details, choose at least one weekday, and check the date range.'); return; }
    const rows: Array<{ lesson_date: string; school: string; class_name: string; start_time: string; end_time: string; teacher_name: string | null; unavailable: boolean; cancelled: boolean; source: string }> = [];
    const cursor = new Date(`${recurringDraft.startDate}T12:00:00`); const end = new Date(`${recurringDraft.endDate}T12:00:00`);
    while (cursor <= end) { if (recurringDraft.weekdays.includes(cursor.getDay())) rows.push({ lesson_date: key(cursor), school: recurringDraft.school.trim(), class_name: recurringDraft.className.trim(), start_time: recurringDraft.startTime, end_time: recurringDraft.endTime, teacher_name: recurringDraft.teacher || null, unavailable: false, cancelled: false, source: 'recurring-calendar' }); cursor.setDate(cursor.getDate() + 1); }
    if (!rows.length) { showError('No selected weekdays fall inside this date range.'); return; }

    // Optimistic: create temp rows
    const tempRows: LessonRow[] = rows.map((r) => ({ id: tempId(), ...r }));
    const previousLessons = lessons;
    setLessons((current) => [...current, ...tempRows].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time)));
    tempRows.forEach(upsertCachedLesson);
    setRecurringSaving(true);
    setRecurringOpen(false);

    const { data, error } = await supabase.from('lessons').insert(rows).select();
    setRecurringSaving(false);
    if (error) {
      setLessons(previousLessons);
      tempRows.forEach((r) => removeCachedLesson(r.id));
      showError(`Could not create recurring lessons: ${error.message}`, () => saveRecurring());
      return;
    }
    const saved = (data ?? []) as LessonRow[];
    setLessons((current) => [...current.filter((l) => !tempRows.some((t) => t.id === l.id)), ...saved].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time)));
    tempRows.forEach((r) => removeCachedLesson(r.id));
    saved.forEach(upsertCachedLesson);
    pushUndo({ label: 'added recurring lessons', mode: 'insert', before: [], after: saved });
    setRecurringDraft(blankRecurring());
    showInfo(`${saved.length} recurring lessons added.`);
  };

  const openQuickAdd = () => { const teacher = filter !== 'all' && filter !== 'unassigned' && filter !== 'cancelled' ? filter : ''; setQuickRows([blankQuickRow(day ?? key(new Date()), teacher)]); setQuickAdd(true); };
  const copyDayLessons = () => { if (!day || !dayLessons.length) return; setQuickRows(dayLessons.map((lesson, index) => ({ id: Date.now() + index, date: day, startTime: lesson.start_time.slice(0, 5), endTime: lesson.end_time.slice(0, 5), school: lesson.school, className: lesson.class_name, teacher: lesson.teacher_name ?? '' }))); setQuickAdd(true); };
  const copyDayToDates = () => { if (!day || !dayLessons.length) return; setCopySourceLessons(dayLessons); setCopyDates([]); setCopyDateInput(day); setQuickAdd(true); };
  const addCopyDate = () => { if (copyDateInput && !copyDates.includes(copyDateInput)) setCopyDates((current) => [...current, copyDateInput].sort()); };

  const saveCopyDates = async () => {
    if (!copySourceLessons.length || !copyDates.length) return;
    const payload = copyDates.flatMap((date) => copySourceLessons.map((lesson) => ({ lesson_date: date, school: lesson.school, class_name: lesson.class_name, start_time: lesson.start_time, end_time: lesson.end_time, teacher_name: lesson.teacher_name, unavailable: false, cancelled: false, source: 'calendar-copy' })));
    const tempRows: LessonRow[] = payload.map((r) => ({ id: tempId(), ...r }));
    const previousLessons = lessons;
    setLessons((current) => [...current, ...tempRows].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time)));
    tempRows.forEach(upsertCachedLesson);
    setQuickSaving(true);

    const { data, error } = await supabase.from('lessons').insert(payload).select();
    setQuickSaving(false);
    if (error) {
      setLessons(previousLessons);
      tempRows.forEach((r) => removeCachedLesson(r.id));
      showError(`Could not copy lessons: ${error.message}`, () => saveCopyDates());
      return;
    }
    const saved = (data ?? []) as LessonRow[];
    setLessons((current) => [...current.filter((l) => !tempRows.some((t) => t.id === l.id)), ...saved].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time)));
    tempRows.forEach((r) => removeCachedLesson(r.id));
    saved.forEach(upsertCachedLesson);
    pushUndo({ label: 'copied lessons', mode: 'insert', before: [], after: saved });
    setCopySourceLessons([]); setCopyDates([]); setQuickRows([]); setQuickAdd(false);
    showInfo(`${saved.length} lesson copies added.`);
  };

  const duplicateLesson = () => { setDraft((current) => ({ ...current, id: undefined })); setDrawer(true); };
  const addQuickRow = () => { const last = quickRows[quickRows.length - 1]; setQuickRows((current) => [...current, blankQuickRow(last?.date ?? day ?? key(new Date()), last?.teacher ?? (filter !== 'all' && filter !== 'unassigned' && filter !== 'cancelled' ? filter : ''))]); };
  const updateQuickRow = (id: number, patch: Partial<QuickRow>) => setQuickRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  const removeQuickRow = (id: number) => setQuickRows((current) => current.filter((row) => row.id !== id));

  const saveQuickRows = async () => {
    if (!quickRows.length) return;
    if (quickRows.some((row) => !row.school.trim() || !row.className.trim())) { showError('Complete the school and class for every lesson before saving.'); return; }
    const payload = quickRows.map((row) => ({ lesson_date: row.date, school: row.school.trim(), class_name: row.className.trim(), start_time: row.startTime, end_time: row.endTime, teacher_name: row.teacher || null, unavailable: false, cancelled: false, source: 'calendar-editor' }));
    const tempRows: LessonRow[] = payload.map((r) => ({ id: tempId(), ...r }));
    const previousLessons = lessons;
    setLessons((current) => [...current, ...tempRows].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time)));
    tempRows.forEach(upsertCachedLesson);
    setQuickSaving(true);

    const { data, error } = await supabase.from('lessons').insert(payload).select();
    setQuickSaving(false);
    if (error) {
      setLessons(previousLessons);
      tempRows.forEach((r) => removeCachedLesson(r.id));
      showError(`Could not save quick add: ${error.message}`, () => saveQuickRows());
      return;
    }
    const saved = (data ?? []) as LessonRow[];
    setLessons((current) => [...current.filter((l) => !tempRows.some((t) => t.id === l.id)), ...saved].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time)));
    tempRows.forEach((r) => removeCachedLesson(r.id));
    saved.forEach(upsertCachedLesson);
    pushUndo({ label: 'added quick lessons', mode: 'insert', before: [], after: saved });
    setQuickRows([]); setQuickAdd(false);
    showInfo(`${saved.length} lessons added.`);
  };

  const retryFailed = async () => {
    if (failedPayload.current) {
      const fn = failedPayload.current;
      failedPayload.current = null;
      await fn();
    }
  };

  // ── PDF Export ──
  const exportCalendarPdf = () => {
    if (!exportLessons.length) { showError('There are no visible lessons to export.'); return; }
    const body = buildCalendarPdfBody(exportLessons, exportRange, colour);
    openPrintPreview(filter === 'all' ? 'Music Delight Calendar' : filter === 'unassigned' ? 'Unassigned Lessons Calendar' : filter === 'cancelled' ? 'Cancelled Classes Calendar' : `${filter} Calendar`, body, true, exportRange, exportLessons, showInfo);
  };

  const exportSchedulePdf = () => {
    if (!exportLessons.length) { showError('There are no visible lessons to export.'); return; }
    const body = buildSchedulePdfBody(exportLessons, colour);
    openPrintPreview('Music Delight Teacher Schedule PDF', body, false, exportRange, exportLessons, showInfo);
  };

  // ── Render ──
  const topAction = undoStack[0] ?? null;

  return (
    <main className={styles.editorShell}>
      <SmartDashboard />
      <datalist id="calendar-school-options">{schools.map((school) => <option key={school} value={school} />)}</datalist>
      <datalist id="calendar-class-options">{classesForSchool(draft.school).map((className) => <option key={className} value={className} />)}</datalist>

      <header className={styles.editorHeader}>
        <div>
          <p>MOE SCHEDULE</p>
          <h1>Calendar</h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-live="polite" role={messageType === 'error' ? 'alert' : 'status'}>
            {!connected && <span title="Live sync disconnected"><WifiOff size={14} style={{ color: '#fb7185', flexShrink: 0 }} /></span>}
            {loading ? 'Loading\u2026' : (
              <>
                {message}
                {messageType === 'error' && failedPayload.current && (
                  <button onClick={() => void retryFailed()} style={{ marginLeft: 8, padding: '3px 8px', border: '1px solid #fb7185', borderRadius: 6, background: 'rgba(251,113,133,.12)', color: '#fb7185', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>
                    Retry
                  </button>
                )}
              </>
            )}
          </span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.quickAddButton} onClick={openQuickAdd}><Plus size={17} /> Quick add</button>
          <button className={styles.exportButton} onClick={() => { setRecurringDraft(blankRecurring()); setRecurringOpen(true); }}><CalendarPlus size={17} /> Recurring</button>
          <button className={styles.exportButton} onClick={exportCalendarPdf}><CalendarDays size={17} /> Calendar PDF</button>
          <button className={styles.exportButton} onClick={exportSchedulePdf}><List size={17} /> Schedule PDF</button>
          <Link href="/admin/conflicts" className={styles.conflictLink}>Conflicts</Link>
        </div>
      </header>

      <UndoBanner action={topAction} stackDepth={undoStack.length} undoing={undoing} onUndo={() => void undoLast()} onDismiss={dismissAllUndo} />

      <FilterBar
        search={search} onSearchChange={setSearch}
        filter={filter} onFilterChange={setFilter}
        schoolFilter={schoolFilter} onSchoolFilterChange={setSchoolFilter}
        teachers={teachers} schools={schools}
        visibleCount={visible.length}
        onClear={() => { setSearch(''); setFilter('all'); setSchoolFilter('all'); setSelectedIds([]); }}
      />

      <BulkToolbar
        selectedCount={selectedLessons.length} visibleCount={visible.length}
        onSelectVisible={selectVisible}
        bulkDate={bulkDate} onBulkDateChange={setBulkDate}
        bulkTeacher={bulkTeacher} onBulkTeacherChange={setBulkTeacher}
        teachers={teachers}
        onMove={() => void bulkMove()}
        onAssign={() => void bulkUpdate({ teacher_name: bulkTeacher, unavailable: false }, 'assigned')}
        onCancel={() => { if (!selectedLessons.length || !window.confirm(`Cancel ${selectedLessons.length} selected lessons?`)) return; void bulkUpdate({ cancelled: true }, 'cancelled'); }}
        onDelete={() => void bulkDelete()}
      />

      <WorkloadPanels
        teacherWorkload={workload} schoolWorkload={schoolWorkload}
        cancelledCount={cancelledCount} filter={filter}
        onTeacherFilter={(name) => setFilter(name)}
        onSchoolFilter={setSchoolFilter}
        onCancelledFilter={() => setFilter('cancelled')}
        teacherColour={colour}
      />

      <CalendarView
        calendarRef={calendarRef}
        events={events}
        loading={loading}
        mobileCalendar={mobileCalendar}
        nativeCalendar={nativeCalendar}
        onDatesSet={onDatesSet}
        onDateClick={setDay}
        onEventClick={openLesson}
        onMove={move}
        dayMaxEvents={dayMaxEvents}
      />

      {day && (
        <DayPanel
          day={day} dayLessons={dayLessons}
          onClose={() => setDay(null)}
          onAddLesson={addLesson}
          onOpenLesson={openLesson}
          onCopyToQuickAdd={copyDayLessons}
          onCopyToDates={copyDayToDates}
          teacherColour={colour}
        />
      )}

      {drawer && (
        <LessonEditorDrawer
          draft={draft}
          onDraftChange={setDraft}
          teachers={teachers}
          onSave={() => void save()}
          onDelete={() => void remove()}
          onDuplicate={duplicateLesson}
          onClose={() => setDrawer(false)}
        />
      )}

      {recurringOpen && (
        <RecurringDrawer
          draft={recurringDraft}
          onDraftChange={setRecurringDraft}
          teachers={teachers}
          onSave={() => void saveRecurring()}
          saving={recurringSaving}
          onClose={() => setRecurringOpen(false)}
        />
      )}

      {quickAdd && (
        <QuickAddDrawer
          quickRows={quickRows}
          onUpdateRow={updateQuickRow}
          onRemoveRow={removeQuickRow}
          onAddRow={addQuickRow}
          onSave={() => void saveQuickRows()}
          saving={quickSaving}
          onClose={() => setQuickAdd(false)}
          teachers={teachers}
          copySourceCount={copySourceLessons.length}
          copyDateInput={copyDateInput}
          onCopyDateInputChange={setCopyDateInput}
          onAddCopyDate={addCopyDate}
          copyDates={copyDates}
          onSaveCopies={() => void saveCopyDates()}
        />
      )}
    </main>
  );
}