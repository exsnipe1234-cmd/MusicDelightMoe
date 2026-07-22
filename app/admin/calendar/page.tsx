'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg, EventDropArg } from '@fullcalendar/interaction';
import { BarChart3, CalendarPlus, Loader2, Printer, Save, Search, X } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';
import { LessonRow, useAppData } from '../../providers/AppDataProvider';

type Draft = {
  id?: string;
  date: string;
  school: string;
  className: string;
  startTime: string;
  endTime: string;
  teacher: string;
  unavailable: boolean;
};
type Range = { start: string; end: string };

const blankDraft = (date = new Date().toISOString().slice(0, 10)): Draft => ({
  date,
  school: '',
  className: '',
  startTime: '09:00',
  endTime: '10:00',
  teacher: '',
  unavailable: false,
});
const key = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const pretty = (value: string) =>
  new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T12:00:00`),
  );
const rgba = (hex: string, alpha: number) => {
  const safe = hex.replace('#', '');
  const full = safe.length === 3 ? safe.split('').map((part) => part + part).join('') : safe;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return `rgba(124,140,255,${alpha})`;
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
};
const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);

export default function CalendarPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const requestId = useRef(0);
  const { teachers, ensureReferences, getLessons, upsertCachedLesson, removeCachedLesson } = useAppData();

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Loading calendar…');
  const [range, setRange] = useState<Range>({ start: '2026-06-28', end: '2026-08-09' });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => blankDraft());

  useEffect(() => {
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', sessionData.session.user.id).single();
      if (!profile?.active || profile.role !== 'admin') {
        router.replace(profile?.role === 'teacher' ? '/teacher' : '/login');
        return;
      }
      try {
        await ensureReferences();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not load teachers.');
      }
    })();
  }, [ensureReferences, router, supabase]);

  const loadRange = useCallback(async (next: Range, force = false) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const rows = await getLessons(next, force);
      if (id !== requestId.current) return;
      setLessons(rows);
      setMessage(`${rows.length} lessons loaded for this view.`);
    } catch (error) {
      if (id !== requestId.current) return;
      setMessage(`Could not load calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [getLessons]);

  useEffect(() => { void loadRange(range); }, [range, loadRange]);

  const colour = useCallback(
    (name: string | null) => teachers.find((teacher) => teacher.name.trim().toLowerCase() === name?.trim().toLowerCase())?.color ?? '#7c8cff',
    [teachers],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lessons.filter((lesson) =>
      (filter === 'all' || (filter === 'unassigned' ? !lesson.teacher_name : lesson.teacher_name === filter)) &&
      (!query || `${lesson.school} ${lesson.class_name} ${lesson.teacher_name ?? 'unassigned'}`.toLowerCase().includes(query)),
    );
  }, [lessons, filter, search]);
  const events = useMemo(() => visible.map((lesson) => {
    const teacherColour = colour(lesson.teacher_name);
    return {
      id: lesson.id,
      title: lesson.school,
      start: `${lesson.lesson_date}T${lesson.start_time.slice(0, 5)}`,
      end: `${lesson.lesson_date}T${lesson.end_time.slice(0, 5)}`,
      backgroundColor: rgba(teacherColour, 0.22),
      borderColor: teacherColour,
      textColor: '#f8fafc',
      extendedProps: { ...lesson, teacherColour },
    };
  }), [visible, colour]);
  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    visible.forEach((lesson) => {
      const name = lesson.teacher_name ?? 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [visible]);
  const dayLessons = useMemo(
    () => day ? visible.filter((lesson) => lesson.lesson_date === day).sort((a, b) => a.start_time.localeCompare(b.start_time)) : [],
    [day, visible],
  );

  const exportPdf = () => {
    if (visible.length === 0) {
      setMessage('There are no visible lessons to export.');
      return;
    }
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=850');
    if (!popup) {
      setMessage('Please allow pop-ups to export the PDF.');
      return;
    }
    const teacherRows = workload.map(([name, count]) =>
      `<div class="stat"><i style="background:${escapeHtml(colour(name === 'Unassigned' ? null : name))}"></i><span>${escapeHtml(name)}</span><strong>${count}</strong></div>`,
    ).join('');
    const lessonRows = [...visible]
      .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time))
      .map((lesson) => `<tr><td>${escapeHtml(pretty(lesson.lesson_date))}</td><td>${escapeHtml(lesson.start_time.slice(0, 5))}–${escapeHtml(lesson.end_time.slice(0, 5))}</td><td>${escapeHtml(lesson.school)}</td><td>${escapeHtml(lesson.class_name)}</td><td><i class="dot" style="background:${escapeHtml(colour(lesson.teacher_name))}"></i>${escapeHtml(lesson.teacher_name ?? 'Unassigned')}</td></tr>`)
      .join('');
    popup.document.write(`<!doctype html><html><head><title>MOE Calendar Export</title><style>
      @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111827;margin:0}header{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:14px}h1{margin:0;font-size:24px}header p{margin:4px 0 0;color:#64748b;font-size:12px}.stats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}.stat{display:flex;align-items:center;gap:7px;border:1px solid #dbe2ea;border-radius:8px;padding:7px 10px;font-size:11px}.stat i,.dot{display:inline-block;width:9px;height:9px;border-radius:50%}.stat strong{margin-left:4px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#f1f5f9;text-align:left}th,td{padding:7px;border:1px solid #dbe2ea;vertical-align:top}.dot{margin-right:6px}.note{margin-top:10px;color:#64748b;font-size:9px}@media print{button{display:none}}
    </style></head><body><header><div><h1>Music Delight MOE Calendar</h1><p>${escapeHtml(pretty(range.start))} to ${escapeHtml(pretty(range.end))} · ${visible.length} lessons</p></div><button onclick="window.print()">Save as PDF</button></header><div class="stats">${teacherRows}</div><table><thead><tr><th>Date</th><th>Time</th><th>School</th><th>Class / Programme</th><th>Teacher</th></tr></thead><tbody>${lessonRows}</tbody></table><p class="note">Exported from Music Delight MOE Calendar.</p><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    popup.document.close();
    setMessage('PDF export opened. Choose “Save as PDF” in the print window.');
  };

  const openLesson = (lesson: LessonRow) => {
    setDraft({ id: lesson.id, date: lesson.lesson_date, school: lesson.school, className: lesson.class_name, startTime: lesson.start_time.slice(0, 5), endTime: lesson.end_time.slice(0, 5), teacher: lesson.teacher_name ?? '', unavailable: lesson.unavailable });
    setDay(null);
    setDrawer(true);
  };
  const addLesson = (date: string) => { setDraft(blankDraft(date)); setDay(null); setDrawer(true); };
  const onDatesSet = (arg: DatesSetArg) => {
    const next = { start: key(arg.start), end: key(arg.end) };
    setRange((current) => current.start === next.start && current.end === next.end ? current : next);
  };
  const overlap = (id: string | undefined, date: string, start: string, end: string, teacher: string | null) => teacher ? lessons.some((other) => other.id !== id && other.teacher_name === teacher && other.lesson_date === date && start < other.end_time.slice(0, 5) && end > other.start_time.slice(0, 5)) : false;

  const move = async (arg: EventDropArg) => {
    const startDate = arg.event.start;
    const endDate = arg.event.end;
    const moved = lessons.find((lesson) => lesson.id === arg.event.id);
    if (!startDate || !endDate || !moved) { arg.revert(); return; }
    const date = key(startDate);
    const start = startDate.toTimeString().slice(0, 5);
    const end = endDate.toTimeString().slice(0, 5);
    if (overlap(moved.id, date, start, end, moved.teacher_name) && !window.confirm('This creates a teacher overlap. Move anyway?')) { arg.revert(); return; }
    const { error } = await supabase.from('lessons').update({ lesson_date: date, start_time: start, end_time: end }).eq('id', moved.id);
    if (error) { arg.revert(); setMessage(error.message); return; }
    const updated = { ...moved, lesson_date: date, start_time: start, end_time: end };
    setLessons((current) => current.map((lesson) => lesson.id === moved.id ? updated : lesson));
    upsertCachedLesson(updated);
    setMessage('Lesson moved and saved.');
  };

  const save = async () => {
    if (!draft.school.trim() || !draft.className.trim()) return;
    if (overlap(draft.id, draft.date, draft.startTime, draft.endTime, draft.teacher || null) && !window.confirm('This teacher already has an overlapping lesson. Save anyway?')) return;
    const payload = { lesson_date: draft.date, school: draft.school.trim(), class_name: draft.className.trim(), start_time: draft.startTime, end_time: draft.endTime, teacher_name: draft.teacher || null, unavailable: draft.unavailable, source: draft.id ? 'manual' : 'calendar-editor' };
    const result = draft.id ? await supabase.from('lessons').update(payload).eq('id', draft.id).select().single() : await supabase.from('lessons').insert(payload).select().single();
    if (result.error) { setMessage(result.error.message); return; }
    const saved = result.data as LessonRow;
    setLessons((current) => [...current.filter((lesson) => lesson.id !== saved.id), saved].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time)));
    upsertCachedLesson(saved);
    setDrawer(false);
    setMessage('Lesson saved.');
  };

  const remove = async () => {
    if (!draft.id || !window.confirm('Delete this lesson?')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', draft.id);
    if (error) { setMessage(error.message); return; }
    setLessons((current) => current.filter((lesson) => lesson.id !== draft.id));
    removeCachedLesson(draft.id);
    setDrawer(false);
    setMessage('Lesson deleted.');
  };

  return (
    <main className="editorShell">
      <header className="editorHeader">
        <div><p>MOE SCHEDULE</p><h1>Calendar</h1><span>{loading ? 'Loading…' : message}</span></div>
        <div className="headerActions"><button className="exportButton" onClick={exportPdf}><Printer size={17}/> Export PDF</button><Link href="/admin/conflicts" className="conflictLink">View conflicts</Link></div>
      </header>

      <section className="filterBar">
        <div className="searchBox"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search school, class or teacher"/></div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All teachers</option><option value="unassigned">Unassigned</option>{teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}</select>
        <button onClick={() => { setSearch(''); setFilter('all'); }}>Clear</button><span>{visible.length} lessons</span>
      </section>

      <section className="workloadPanel">
        <div className="workloadHeading"><BarChart3 size={18}/><div><p>VISIBLE RANGE</p><h2>Teacher workload</h2></div></div>
        <div className="workloadStats">{workload.length === 0 ? <span className="empty">No lessons match the current filters.</span> : workload.map(([name, count]) => <button key={name} onClick={() => setFilter(name === 'Unassigned' ? 'unassigned' : name)}><i style={{ background: colour(name === 'Unassigned' ? null : name) }}/><span>{name}</span><strong>{count}</strong><small>lesson{count === 1 ? '' : 's'}</small></button>)}</div>
      </section>

      <section className="calendarCard">
        {loading && lessons.length === 0 ? <div className="loading"><Loader2 className="spin"/> Loading calendar…</div> : <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="dayGridMonth" initialDate="2026-07-01"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }} editable selectable height="auto" fixedWeekCount={false} dayMaxEvents={3} lazyFetching events={events} datesSet={onDatesSet}
          dateClick={(arg: DateClickArg) => setDay(arg.dateStr.slice(0, 10))} eventClick={(arg) => openLesson(arg.event.extendedProps as LessonRow)} eventDrop={move} eventResize={move}
          eventDidMount={(info) => { const lesson = info.event.extendedProps as LessonRow & { teacherColour?: string }; const teacherColour = lesson.teacherColour ?? colour(lesson.teacher_name); info.el.style.setProperty('--fc-event-bg-color', rgba(teacherColour, 0.22)); info.el.style.setProperty('--fc-event-border-color', teacherColour); info.el.style.backgroundColor = rgba(teacherColour, 0.22); info.el.style.borderColor = teacherColour; info.el.style.borderLeftWidth = '4px'; info.el.style.borderLeftColor = teacherColour; }}
          eventContent={(arg) => { const lesson = arg.event.extendedProps as LessonRow; const month = arg.view.type === 'dayGridMonth'; return month ? <div className="eventCard compact" title={`${lesson.school} · ${lesson.class_name} · ${lesson.teacher_name ?? 'Unassigned'}`}><span>{lesson.start_time.slice(0, 5)}</span><strong>{lesson.school}</strong><small>{lesson.teacher_name ?? 'Unassigned'}</small></div> : <div className="eventCard detailed"><strong>{lesson.school}</strong><span>{lesson.class_name}</span><small>{lesson.start_time.slice(0, 5)}–{lesson.end_time.slice(0, 5)} · {lesson.teacher_name ?? 'Unassigned'}</small></div>; }}
          nowIndicator slotMinTime="06:00:00" slotMaxTime="22:00:00"
        />}
      </section>

      {day && <div className="drawerBackdrop" onMouseDown={() => setDay(null)}><aside className="dayPanel" onMouseDown={(event) => event.stopPropagation()}><div className="drawerHeader"><div><p>DAILY SCHEDULE</p><h2>{pretty(day)}</h2><span>{dayLessons.length} lesson{dayLessons.length === 1 ? '' : 's'}</span></div><button onClick={() => setDay(null)}><X/></button></div><button className="addLesson" onClick={() => addLesson(day)}><CalendarPlus size={17}/> Add lesson</button><div className="dayLessonList">{dayLessons.length === 0 ? <div className="noDayLessons">No lessons for this date.</div> : dayLessons.map((lesson) => <button key={lesson.id} onClick={() => openLesson(lesson)} style={{ borderLeftColor: colour(lesson.teacher_name) }}><strong>{lesson.start_time.slice(0,5)}–{lesson.end_time.slice(0,5)}</strong><span>{lesson.school}</span><small>{lesson.class_name} · {lesson.teacher_name ?? 'Unassigned'}</small></button>)}</div></aside></div>}
      {drawer && <div className="drawerBackdrop" onMouseDown={() => setDrawer(false)}><aside className="lessonDrawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawerHeader"><div><p>{draft.id ? 'EDIT LESSON' : 'NEW LESSON'}</p><h2>{draft.id ? draft.school || 'Lesson' : 'Add lesson'}</h2></div><button onClick={() => setDrawer(false)}><X/></button></div><div className="formGrid"><label>Date<input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}/></label><label>School<input value={draft.school} onChange={(event) => setDraft((current) => ({ ...current, school: event.target.value }))}/></label><label>Class / programme<input value={draft.className} onChange={(event) => setDraft((current) => ({ ...current, className: event.target.value }))}/></label><div className="timeRow"><label>Start<input type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))}/></label><label>End<input type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))}/></label></div><label>Teacher<select value={draft.teacher} onChange={(event) => setDraft((current) => ({ ...current, teacher: event.target.value }))}><option value="">Unassigned</option>{teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}</select></label><label className="checkbox"><input type="checkbox" checked={draft.unavailable} onChange={(event) => setDraft((current) => ({ ...current, unavailable: event.target.checked }))}/> Mark as unavailable</label></div><div className="drawerActions"><button className="save" onClick={() => void save()}><Save size={17}/> Save lesson</button>{draft.id && <button className="delete" onClick={() => void remove()}>Delete</button>}</div></aside></div>}

      <style jsx>{`
        .editorShell{min-height:100vh;padding:24px;max-width:1700px;margin:auto;color:#eef2fb}.editorHeader{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:16px}.editorHeader p,.workloadHeading p,.drawerHeader p{margin:0 0 5px;color:#8b7cff;font-size:11px;font-weight:900;letter-spacing:.15em}.editorHeader h1{margin:0 0 5px;font-size:32px}.editorHeader span{color:#8995ad;font-size:13px}.headerActions{display:flex;gap:9px}.conflictLink,.exportButton{display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 14px;border-radius:10px;color:#fff;text-decoration:none;font-weight:800;font-size:14px}.conflictLink{background:#6653de}.exportButton{border:1px solid rgba(148,163,184,.18);background:#17233a;cursor:pointer}.filterBar{display:flex;align-items:center;gap:10px;margin-bottom:12px}.searchBox{display:flex;align-items:center;gap:8px;flex:1;min-width:220px;padding:0 12px;border:1px solid rgba(148,163,184,.16);border-radius:10px;background:#0b1222;color:#7f8ca4}.searchBox input,.filterBar select{width:100%;padding:10px 0;border:0;outline:0;background:transparent;color:#eef2fb}.filterBar select{width:auto;min-width:165px;padding:10px 12px;border:1px solid rgba(148,163,184,.16);border-radius:10px;background:#0b1222}.filterBar>button{padding:10px 13px;border:1px solid rgba(148,163,184,.16);border-radius:10px;background:#0b1222;color:#aeb8ca;cursor:pointer}.filterBar>span{color:#8995ad;font-size:12px;white-space:nowrap}.workloadPanel{display:flex;align-items:center;gap:18px;margin-bottom:12px;padding:13px 15px;border:1px solid rgba(148,163,184,.14);border-radius:14px;background:#0d1425}.workloadHeading{display:flex;align-items:center;gap:9px;min-width:170px}.workloadHeading h2{margin:0;font-size:16px}.workloadStats{display:flex;gap:8px;overflow-x:auto;padding:2px}.workloadStats button{display:grid;grid-template-columns:9px auto auto;align-items:center;gap:5px 7px;min-width:116px;padding:8px 10px;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:#111a2d;color:#eef2fb;text-align:left;cursor:pointer}.workloadStats i{width:9px;height:9px;border-radius:50%;grid-row:1/3}.workloadStats span{font-size:12px;font-weight:750}.workloadStats strong{font-size:15px}.workloadStats small{grid-column:2/4;color:#8995ad;font-size:10px}.empty{color:#8995ad;font-size:12px}.calendarCard{border:1px solid rgba(148,163,184,.14);background:#0d1425;border-radius:16px;padding:14px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.18)}.loading{min-height:580px;display:flex;align-items:center;justify-content:center;gap:9px;color:#8995ad}.eventCard{min-width:0;overflow:hidden}.eventCard.compact{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:5px;width:100%;padding:1px 3px;font-size:11px;line-height:1.45}.eventCard.compact span{font-variant-numeric:tabular-nums;opacity:.9}.eventCard.compact strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800}.eventCard.compact small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:52px;opacity:.85;font-size:10px}.eventCard.detailed{display:grid;gap:2px;padding:2px}.eventCard.detailed span,.eventCard.detailed small{opacity:.85}.drawerBackdrop{position:fixed;inset:0;z-index:50;background:rgba(3,7,18,.7);backdrop-filter:blur(4px);display:flex;justify-content:flex-end}.dayPanel,.lessonDrawer{width:min(440px,100%);height:100%;overflow:auto;padding:24px;background:#0b1222;border-left:1px solid rgba(148,163,184,.14);box-shadow:-24px 0 70px rgba(0,0,0,.35)}.drawerHeader{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:18px}.drawerHeader h2{margin:0;font-size:25px}.drawerHeader span{color:#8995ad}.drawerHeader button{border:0;background:transparent;color:#aeb8ca;cursor:pointer}.addLesson,.save{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:0;border-radius:11px;background:#6653de;color:#fff;font-weight:800;cursor:pointer}.dayLessonList{display:grid;gap:9px;margin-top:14px}.dayLessonList>button{display:grid;gap:4px;padding:13px;border:1px solid rgba(148,163,184,.12);border-left:4px solid;border-radius:12px;background:#111a2d;color:#eef2fb;text-align:left;cursor:pointer}.dayLessonList small,.noDayLessons{color:#8995ad}.formGrid{display:grid;gap:12px}.formGrid label{display:grid;gap:7px;color:#aeb8ca;font-size:13px;font-weight:700}.formGrid input,.formGrid select{padding:11px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.16);background:#111a2d;color:#eef2fb}.timeRow{display:grid;grid-template-columns:1fr 1fr;gap:10px}.checkbox{display:flex!important;grid-template-columns:auto 1fr;align-items:center}.checkbox input{width:auto}.drawerActions{display:grid;gap:9px;margin-top:18px}.delete{padding:11px;border:1px solid rgba(251,113,133,.25);border-radius:11px;background:rgba(251,113,133,.09);color:#fb7185;cursor:pointer}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}:global(.fc){--fc-border-color:rgba(148,163,184,.18);--fc-page-bg-color:#0d1425;--fc-neutral-bg-color:#111a2d;--fc-list-event-hover-bg-color:#17233a;color:#eef2fb}:global(.fc .fc-toolbar){gap:12px;margin-bottom:14px}:global(.fc .fc-toolbar-title){font-size:24px;font-weight:850}:global(.fc .fc-button){border:1px solid rgba(148,163,184,.16)!important;background:#17233a!important;color:#eef2fb!important;border-radius:8px!important;box-shadow:none!important;text-transform:capitalize;padding:.45em .75em!important}:global(.fc .fc-button:hover),:global(.fc .fc-button-active){background:#6653de!important}:global(.fc .fc-col-header-cell){background:#121b2e}:global(.fc .fc-col-header-cell-cushion){padding:10px 4px;color:#dbe4f3;text-decoration:none}:global(.fc .fc-daygrid-day){background:#0d1425}:global(.fc .fc-daygrid-day:hover){background:#101a2d}:global(.fc .fc-day-today){background:rgba(102,83,222,.12)!important}:global(.fc .fc-daygrid-day-number){padding:8px;color:#dbe4f3;text-decoration:none;font-weight:700}:global(.fc .fc-daygrid-day-frame){min-height:145px}:global(.fc .fc-daygrid-event){margin:2px 4px;border-radius:7px;padding:1px 2px;box-shadow:0 2px 8px rgba(0,0,0,.15);overflow:hidden}:global(.fc .fc-daygrid-more-link){margin:4px;color:#a99cff;font-weight:800}:global(.fc .fc-day-other .fc-daygrid-day-number){color:#56627a}:global(.fc .fc-timegrid-slot){height:2.8em}@media(max-width:800px){.editorShell{padding:16px}.editorHeader,.filterBar{display:grid}.headerActions{display:grid;grid-template-columns:1fr 1fr}.filterBar select{width:100%}.workloadPanel{display:grid}.workloadHeading{min-width:0}:global(.fc .fc-toolbar){display:grid;grid-template-columns:1fr}:global(.fc .fc-toolbar-chunk){display:flex;justify-content:center}:global(.fc .fc-daygrid-day-frame){min-height:110px}.eventCard.compact{grid-template-columns:34px minmax(0,1fr)}.eventCard.compact small{display:none}}
      `}</style>
    </main>
  );
}
