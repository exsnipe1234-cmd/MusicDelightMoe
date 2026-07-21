'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg, DatesSetArg, EventDropArg } from '@fullcalendar/interaction';
import { CalendarPlus, Loader2, Save, Search, Users, X } from 'lucide-react';
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('role,active')
        .eq('id', sessionData.session.user.id)
        .single();
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

  const loadRange = useCallback(
    async (next: Range, force = false) => {
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
    },
    [getLessons],
  );

  useEffect(() => {
    void loadRange(range);
  }, [range, loadRange]);

  const colour = useCallback(
    (name: string | null) => teachers.find((teacher) => teacher.name === name)?.color ?? '#fb7185',
    [teachers],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lessons.filter(
      (lesson) =>
        (filter === 'all' || (filter === 'unassigned' ? !lesson.teacher_name : lesson.teacher_name === filter)) &&
        (!query || `${lesson.school} ${lesson.class_name} ${lesson.teacher_name ?? 'unassigned'}`.toLowerCase().includes(query)),
    );
  }, [lessons, filter, search]);
  const events = useMemo(
    () =>
      visible.map((lesson) => ({
        id: lesson.id,
        title: lesson.school,
        start: `${lesson.lesson_date}T${lesson.start_time.slice(0, 5)}`,
        end: `${lesson.lesson_date}T${lesson.end_time.slice(0, 5)}`,
        backgroundColor: colour(lesson.teacher_name),
        borderColor: colour(lesson.teacher_name),
        textColor: '#08101f',
        extendedProps: lesson,
      })),
    [visible, colour],
  );
  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    visible.forEach((lesson) => counts.set(lesson.teacher_name ?? 'Unassigned', (counts.get(lesson.teacher_name ?? 'Unassigned') ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [visible]);
  const dayLessons = useMemo(
    () => (day ? visible.filter((lesson) => lesson.lesson_date === day).sort((a, b) => a.start_time.localeCompare(b.start_time)) : []),
    [day, visible],
  );

  const openLesson = (lesson: LessonRow) => {
    setDraft({
      id: lesson.id,
      date: lesson.lesson_date,
      school: lesson.school,
      className: lesson.class_name,
      startTime: lesson.start_time.slice(0, 5),
      endTime: lesson.end_time.slice(0, 5),
      teacher: lesson.teacher_name ?? '',
      unavailable: lesson.unavailable,
    });
    setDay(null);
    setDrawer(true);
  };
  const addLesson = (date: string) => {
    setDraft(blankDraft(date));
    setDay(null);
    setDrawer(true);
  };
  const onDatesSet = (arg: DatesSetArg) => {
    const next = { start: key(arg.start), end: key(arg.end) };
    setRange((current) => (current.start === next.start && current.end === next.end ? current : next));
  };
  const overlap = (id: string | undefined, date: string, start: string, end: string, teacher: string | null) =>
    teacher
      ? lessons.some(
          (other) =>
            other.id !== id &&
            other.teacher_name === teacher &&
            other.lesson_date === date &&
            start < other.end_time.slice(0, 5) &&
            end > other.start_time.slice(0, 5),
        )
      : false;

  const move = async (arg: EventDropArg) => {
    const startDate = arg.event.start;
    const endDate = arg.event.end;
    const moved = lessons.find((lesson) => lesson.id === arg.event.id);
    if (!startDate || !endDate || !moved) {
      arg.revert();
      return;
    }
    const date = key(startDate);
    const start = startDate.toTimeString().slice(0, 5);
    const end = endDate.toTimeString().slice(0, 5);
    if (overlap(moved.id, date, start, end, moved.teacher_name) && !window.confirm('This creates a teacher overlap. Move anyway?')) {
      arg.revert();
      return;
    }
    const { error } = await supabase.from('lessons').update({ lesson_date: date, start_time: start, end_time: end }).eq('id', moved.id);
    if (error) {
      arg.revert();
      setMessage(error.message);
      return;
    }
    const updated = { ...moved, lesson_date: date, start_time: start, end_time: end };
    setLessons((current) => current.map((lesson) => (lesson.id === moved.id ? updated : lesson)));
    upsertCachedLesson(updated);
    setMessage('Lesson moved and saved.');
  };

  const save = async () => {
    if (!draft.school.trim() || !draft.className.trim()) return;
    if (
      overlap(draft.id, draft.date, draft.startTime, draft.endTime, draft.teacher || null) &&
      !window.confirm('This teacher already has an overlapping lesson. Save anyway?')
    )
      return;

    const payload = {
      lesson_date: draft.date,
      school: draft.school.trim(),
      class_name: draft.className.trim(),
      start_time: draft.startTime,
      end_time: draft.endTime,
      teacher_name: draft.teacher || null,
      unavailable: draft.unavailable,
      source: draft.id ? 'manual' : 'calendar-editor',
    };
    const result = draft.id
      ? await supabase.from('lessons').update(payload).eq('id', draft.id).select().single()
      : await supabase.from('lessons').insert(payload).select().single();
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    const saved = result.data as LessonRow;
    setLessons((current) => {
      const without = current.filter((lesson) => lesson.id !== saved.id);
      return [...without, saved].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time));
    });
    upsertCachedLesson(saved);
    setDrawer(false);
    setMessage('Lesson saved.');
  };

  const remove = async () => {
    if (!draft.id || !window.confirm('Delete this lesson?')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', draft.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setLessons((current) => current.filter((lesson) => lesson.id !== draft.id));
    removeCachedLesson(draft.id);
    setDrawer(false);
    setMessage('Lesson deleted.');
  };

  return (
    <main className="editorShell">
      <header className="editorHeader">
        <div><p>INTERACTIVE EDITOR</p><h1>Calendar Editor</h1><span>{loading ? 'Loading…' : message}</span></div>
        <Link href="/admin/conflicts" className="conflictLink">Open Conflict Center</Link>
      </header>
      <section className="filterBar">
        <div className="searchBox"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search school, class or teacher…"/></div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All teachers</option><option value="unassigned">Unassigned</option>{teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}</select>
        <button onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button><span>{visible.length} shown</span>
      </section>
      <section className="contentGrid">
        <div className="calendarCard">
          {loading && lessons.length === 0 ? <div className="loading"><Loader2 className="spin"/> Loading calendar…</div> : <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="dayGridMonth" initialDate="2026-07-01" headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} editable selectable height="auto" fixedWeekCount={false} dayMaxEvents={4} lazyFetching events={events} datesSet={onDatesSet} dateClick={(arg: DateClickArg) => setDay(arg.dateStr.slice(0, 10))} eventClick={(arg) => openLesson(arg.event.extendedProps as LessonRow)} eventDrop={move} eventResize={move} eventContent={(arg) => { const lesson = arg.event.extendedProps as LessonRow; const month = arg.view.type === 'dayGridMonth'; return <div className={`eventCard ${month ? 'compact' : 'detailed'}`}><strong>{lesson.school}</strong>{!month && <span>{lesson.class_name}</span>}<small>{month ? `${lesson.start_time.slice(0, 5)} · ${lesson.teacher_name ?? 'Unassigned'}` : `${lesson.teacher_name ?? 'Unassigned'} · ${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`}</small></div>; }} nowIndicator slotMinTime="06:00:00" slotMaxTime="22:00:00"/>}
        </div>
        <aside className="workloadCard"><div className="workloadTitle"><Users size={18}/><div><p>VISIBLE RANGE</p><h2>Top teachers</h2></div></div>{workload.length === 0 ? <span className="empty">No lessons match.</span> : workload.map(([name, count]) => <button key={name} onClick={() => setFilter(name === 'Unassigned' ? 'unassigned' : name)}><div><strong>{name}</strong><span>{count} lessons</span></div><div className="bar"><i style={{ width: `${Math.max(8, count / (workload[0]?.[1] ?? 1) * 100)}%`, background: colour(name === 'Unassigned' ? null : name) }}/></div></button>)}</aside>
      </section>
      {day && <div className="drawerBackdrop" onMouseDown={() => setDay(null)}><aside className="dayPanel" onMouseDown={(event) => event.stopPropagation()}><div className="drawerHeader"><div><p>DAILY SCHEDULE</p><h2>{pretty(day)}</h2><span>{dayLessons.length} lesson{dayLessons.length === 1 ? '' : 's'}</span></div><button onClick={() => setDay(null)}><X/></button></div><button className="addLesson" onClick={() => addLesson(day)}><CalendarPlus size={17}/> Add lesson</button><div className="dayLessonList">{dayLessons.length === 0 ? <div className="noDayLessons">No lessons scheduled.</div> : dayLessons.map((lesson) => <button key={lesson.id} className="dayLesson" onClick={() => openLesson(lesson)}><i style={{ background: colour(lesson.teacher_name) }}/><div><strong>{lesson.start_time.slice(0, 5)}–{lesson.end_time.slice(0, 5)}</strong><h3>{lesson.school}</h3><span>{lesson.class_name}</span><small>{lesson.teacher_name ?? 'Unassigned'}</small></div></button>)}</div></aside></div>}
      {drawer && <div className="drawerBackdrop" onMouseDown={() => setDrawer(false)}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawerHeader"><div><p>LESSON DETAILS</p><h2>{draft.id ? 'Edit lesson' : 'Add lesson'}</h2></div><button onClick={() => setDrawer(false)}><X/></button></div><label>Date<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label><label>School<input value={draft.school} onChange={(event) => setDraft({ ...draft, school: event.target.value })}/></label><label>Class / programme<input value={draft.className} onChange={(event) => setDraft({ ...draft, className: event.target.value })}/></label><div className="row"><label>Start<input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}/></label><label>End<input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}/></label></div><label>Teacher<select value={draft.teacher} onChange={(event) => setDraft({ ...draft, teacher: event.target.value })}><option value="">Unassigned</option>{teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}</select></label><label className="check"><input type="checkbox" checked={draft.unavailable} onChange={(event) => setDraft({ ...draft, unavailable: event.target.checked })}/> Teacher unavailable</label><div className="drawerActions">{draft.id && <button className="delete" onClick={remove}>Delete</button>}<span/><button className="save" onClick={save}><Save size={16}/> Save</button></div></aside></div>}
      <style jsx global>{`
        .editorShell{min-height:100vh;padding:30px;color:#eef2fb}.editorHeader{display:flex;justify-content:space-between;align-items:end;margin-bottom:20px}.editorHeader p,.drawerHeader p,.workloadTitle p{margin:0 0 6px;color:#8b7cff;font-size:11px;font-weight:900;letter-spacing:.16em}.editorHeader h1{margin:0 0 6px;font-size:34px}.editorHeader span{color:#8794ab}.conflictLink{padding:11px 15px;border-radius:11px;background:#6653de;color:white;text-decoration:none;font-weight:750}.filterBar{display:grid;grid-template-columns:minmax(260px,1fr) 190px auto auto;gap:10px;align-items:center;margin-bottom:14px}.filterBar select,.filterBar button,.searchBox{height:44px;border-radius:11px;border:1px solid rgba(148,163,184,.16);background:#0d1425;color:#eef2fb}.searchBox{display:flex;align-items:center;gap:9px;padding:0 12px}.searchBox input{width:100%;border:0;outline:0;background:transparent;color:#eef2fb}.filterBar select,.filterBar button{padding:0 12px}.filterBar>span{text-align:right;color:#8794ab}.contentGrid{display:grid;grid-template-columns:minmax(0,1fr) 245px;gap:14px;align-items:start}.calendarCard,.workloadCard{border:1px solid rgba(148,163,184,.14);background:#0d1425;border-radius:18px}.calendarCard{padding:18px;overflow:hidden}.workloadCard{padding:16px;position:sticky;top:18px}.workloadTitle{display:flex;align-items:center;gap:10px}.workloadTitle h2{margin:0}.workloadCard>button{display:grid;gap:8px;width:100%;padding:12px 0;border:0;border-bottom:1px solid rgba(148,163,184,.1);background:transparent;color:#eef2fb;text-align:left}.workloadCard>button>div:first-child{display:flex;justify-content:space-between}.workloadCard span{color:#8794ab;font-size:12px}.bar{height:5px;background:#192238;border-radius:999px;overflow:hidden}.bar i{display:block;height:100%}.loading{display:flex;justify-content:center;align-items:center;gap:10px;min-height:420px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.fc{--fc-border-color:rgba(148,163,184,.13);--fc-page-bg-color:#0d1425;--fc-neutral-bg-color:#111a2d;color:#eef2fb}.fc .fc-button{background:#6653de;border:0}.fc a{color:#cfd7e7;text-decoration:none}.eventCard{padding:2px 4px;overflow:hidden}.eventCard strong,.eventCard span,.eventCard small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.eventCard small{opacity:.8}.drawerBackdrop{position:fixed;inset:0;z-index:50;background:rgba(2,6,23,.72);display:flex;justify-content:flex-end}.drawer,.dayPanel{width:min(430px,100%);height:100%;overflow:auto;background:#0d1425;padding:24px;box-shadow:-16px 0 45px rgba(0,0,0,.35)}.drawerHeader{display:flex;justify-content:space-between;align-items:start;margin-bottom:18px}.drawerHeader h2{margin:0}.drawerHeader button{border:0;background:transparent;color:#eef2fb}.drawer label{display:grid;gap:6px;margin:13px 0;color:#aab5c8}.drawer input,.drawer select{height:42px;border:1px solid rgba(148,163,184,.18);border-radius:9px;background:#111a2d;color:#eef2fb;padding:0 10px}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center}.check input{height:auto}.drawerActions{display:grid;grid-template-columns:auto 1fr auto;gap:10px;margin-top:20px}.drawerActions button,.addLesson{padding:11px 15px;border:0;border-radius:10px;font-weight:750}.save,.addLesson{background:#6653de;color:white}.delete{background:#3b1720;color:#fda4af}.dayLessonList{display:grid;gap:10px;margin-top:14px}.dayLesson{display:grid;grid-template-columns:5px 1fr;gap:12px;border:1px solid rgba(148,163,184,.13);border-radius:12px;background:#111a2d;color:#eef2fb;padding:12px;text-align:left}.dayLesson i{border-radius:99px}.dayLesson h3{margin:5px 0}.dayLesson span,.dayLesson small{display:block;color:#8794ab}@media(max-width:900px){.editorShell{padding:18px}.editorHeader{align-items:start;gap:12px}.contentGrid{grid-template-columns:1fr}.workloadCard{position:static}.filterBar{grid-template-columns:1fr 1fr}.filterBar>span{text-align:left}}
      `}</style>
    </main>
  );
}
