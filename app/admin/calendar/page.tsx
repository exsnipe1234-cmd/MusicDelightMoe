'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg, EventDropArg } from '@fullcalendar/interaction';
import { ArrowLeft, CalendarPlus, Loader2, Save, Search, Users, X } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

type Teacher = { name: string; color: string };
type LessonRow = {
  id: string;
  lesson_date: string;
  school: string;
  class_name: string;
  start_time: string;
  end_time: string;
  teacher_name: string | null;
  unavailable: boolean;
};

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

const blankDraft = (date = new Date().toISOString().slice(0, 10)): Draft => ({
  date,
  school: '',
  className: '',
  startTime: '09:00',
  endTime: '10:00',
  teacher: '',
  unavailable: false,
});

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const prettyDate = (value: string) => new Intl.DateTimeFormat('en-SG', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${value}T12:00:00`));

export default function InteractiveCalendarPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Loading calendar...');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => blankDraft());
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dayPanelDate, setDayPanelDate] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { router.replace('/login'); return; }
    const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', sessionData.session.user.id).single();
    if (!profile?.active || profile.role !== 'admin') { router.replace(profile?.role === 'teacher' ? '/teacher' : '/login'); return; }
    const [{ data: lessonData, error }, { data: teacherData }] = await Promise.all([
      supabase.from('lessons').select('*').order('lesson_date').order('start_time'),
      supabase.from('teachers').select('name,color').order('name'),
    ]);
    if (error) setMessage(error.message);
    else {
      setLessons((lessonData as LessonRow[]) ?? []);
      setMessage(`${lessonData?.length ?? 0} lessons loaded.`);
    }
    setTeachers((teacherData as Teacher[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const colourFor = (teacher: string | null) => teachers.find((item) => item.name === teacher)?.color ?? '#fb7185';

  const visibleLessons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const teacherMatch = teacherFilter === 'all' || (teacherFilter === 'unassigned' ? !lesson.teacher_name : lesson.teacher_name === teacherFilter);
      const searchMatch = !query || [lesson.school, lesson.class_name, lesson.teacher_name ?? 'unassigned'].some((value) => value.toLowerCase().includes(query));
      return teacherMatch && searchMatch;
    });
  }, [lessons, search, teacherFilter]);

  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    visibleLessons.forEach((lesson) => {
      const name = lesson.teacher_name ?? 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [visibleLessons]);

  const dayLessons = useMemo(() => {
    if (!dayPanelDate) return [];
    return visibleLessons
      .filter((lesson) => lesson.lesson_date === dayPanelDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [dayPanelDate, visibleLessons]);

  const events = visibleLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.school,
    start: `${lesson.lesson_date}T${lesson.start_time.slice(0, 5)}`,
    end: `${lesson.lesson_date}T${lesson.end_time.slice(0, 5)}`,
    backgroundColor: colourFor(lesson.teacher_name),
    borderColor: colourFor(lesson.teacher_name),
    textColor: '#08101f',
    extendedProps: lesson,
  }));

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
    setDayPanelDate(null);
    setDrawerOpen(true);
  };

  const addLesson = (date: string) => {
    setDraft(blankDraft(date));
    setDayPanelDate(null);
    setDrawerOpen(true);
  };

  const handleDateClick = (arg: DateClickArg) => setDayPanelDate(arg.dateStr.slice(0, 10));

  const handleDrop = async (arg: EventDropArg) => {
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || !end) { arg.revert(); return; }
    const date = dateKey(start);
    const startTime = start.toTimeString().slice(0, 5);
    const endTime = end.toTimeString().slice(0, 5);
    const moved = lessons.find((lesson) => lesson.id === arg.event.id);
    if (!moved) { arg.revert(); return; }
    const overlap = lessons.some((other) => other.id !== moved.id && other.teacher_name === moved.teacher_name && other.lesson_date === date && startTime < other.end_time.slice(0, 5) && endTime > other.start_time.slice(0, 5));
    if (overlap && !window.confirm('This creates a teacher overlap. Move anyway?')) { arg.revert(); return; }
    const { error } = await supabase.from('lessons').update({ lesson_date: date, start_time: startTime, end_time: endTime }).eq('id', moved.id);
    if (error) { arg.revert(); setMessage(`Move failed: ${error.message}`); return; }
    setLessons((current) => current.map((lesson) => lesson.id === moved.id ? { ...lesson, lesson_date: date, start_time: startTime, end_time: endTime } : lesson));
    setMessage('Lesson moved and saved.');
  };

  const saveDraft = async () => {
    if (!draft.school.trim() || !draft.className.trim()) return;
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
    const overlap = lessons.some((other) => other.id !== draft.id && other.teacher_name === (draft.teacher || null) && other.lesson_date === draft.date && draft.startTime < other.end_time.slice(0, 5) && draft.endTime > other.start_time.slice(0, 5));
    if (overlap && !window.confirm('This teacher already has an overlapping lesson. Save anyway?')) return;
    if (draft.id) {
      const { data, error } = await supabase.from('lessons').update(payload).eq('id', draft.id).select().single();
      if (error) { setMessage(error.message); return; }
      setLessons((current) => current.map((lesson) => lesson.id === draft.id ? data as LessonRow : lesson));
    } else {
      const { data, error } = await supabase.from('lessons').insert(payload).select().single();
      if (error) { setMessage(error.message); return; }
      setLessons((current) => [...current, data as LessonRow]);
    }
    setDrawerOpen(false);
    setMessage('Lesson saved.');
  };

  const removeDraft = async () => {
    if (!draft.id || !window.confirm('Delete this lesson?')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', draft.id);
    if (error) { setMessage(error.message); return; }
    setLessons((current) => current.filter((lesson) => lesson.id !== draft.id));
    setDrawerOpen(false);
    setMessage('Lesson deleted.');
  };

  return (
    <main className="editorShell">
      <header className="editorHeader">
        <div><Link href="/" className="back"><ArrowLeft size={17}/> Back to dashboard</Link><p>INTERACTIVE EDITOR</p><h1>Calendar Editor</h1><span>{loading ? 'Loading…' : message}</span></div>
        <Link href="/admin/conflicts" className="conflictLink">Open Conflict Center</Link>
      </header>

      <section className="filterBar">
        <div className="searchBox"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search school, class or teacher…"/></div>
        <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}>
          <option value="all">All teachers</option>
          <option value="unassigned">Unassigned</option>
          {teachers.map((teacher) => <option key={teacher.name} value={teacher.name}>{teacher.name}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setTeacherFilter('all'); }}>Clear filters</button>
        <span>{visibleLessons.length} shown</span>
      </section>

      <section className="contentGrid">
        <div className="calendarCard">
          {loading ? <div className="loading"><Loader2 className="spin"/> Loading calendar…</div> : <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate="2026-07-01"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            editable
            selectable
            height="auto"
            fixedWeekCount={false}
            dayMaxEvents={4}
            moreLinkClick={(arg) => { setDayPanelDate(dateKey(arg.date)); return 'popover'; }}
            moreLinkContent={(arg) => `+${arg.num} more lessons`}
            events={events}
            dateClick={handleDateClick}
            eventClick={(arg) => openLesson(arg.event.extendedProps as LessonRow)}
            eventDrop={handleDrop}
            eventResize={handleDrop}
            eventContent={(arg) => {
              const lesson = arg.event.extendedProps as LessonRow;
              const monthView = arg.view.type === 'dayGridMonth';
              return <div className={`eventCard ${monthView ? 'compact' : 'detailed'}`}>
                <strong>{lesson.school}</strong>
                {!monthView && <span>{lesson.class_name}</span>}
                <small>{monthView ? `${lesson.start_time.slice(0, 5)} · ${lesson.teacher_name ?? 'Unassigned'}` : `${lesson.teacher_name ?? 'Unassigned'} · ${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`}</small>
              </div>;
            }}
            nowIndicator
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
          />}
        </div>

        <aside className="workloadCard">
          <div className="workloadTitle"><Users size={18}/><div><p>WORKLOAD</p><h2>Top teachers</h2></div></div>
          {workload.length === 0 ? <span className="empty">No lessons match.</span> : workload.map(([name, count]) => {
            const max = workload[0]?.[1] ?? 1;
            return <button key={name} onClick={() => setTeacherFilter(name === 'Unassigned' ? 'unassigned' : name)}>
              <div><strong>{name}</strong><span>{count} lessons</span></div>
              <div className="bar"><i style={{ width: `${Math.max(8, (count / max) * 100)}%`, background: colourFor(name === 'Unassigned' ? null : name) }}/></div>
            </button>;
          })}
        </aside>
      </section>

      {dayPanelDate && <div className="drawerBackdrop" onMouseDown={() => setDayPanelDate(null)}><aside className="dayPanel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawerHeader"><div><p>DAILY SCHEDULE</p><h2>{prettyDate(dayPanelDate)}</h2><span>{dayLessons.length} lesson{dayLessons.length === 1 ? '' : 's'}</span></div><button onClick={() => setDayPanelDate(null)}><X/></button></div>
        <button className="addLesson" onClick={() => addLesson(dayPanelDate)}><CalendarPlus size={17}/> Add lesson</button>
        <div className="dayLessonList">
          {dayLessons.length === 0 ? <div className="noDayLessons">No lessons scheduled for this day.</div> : dayLessons.map((lesson) => <button key={lesson.id} className="dayLesson" onClick={() => openLesson(lesson)}>
            <i style={{ background: colourFor(lesson.teacher_name) }}/>
            <div><strong>{lesson.start_time.slice(0, 5)}–{lesson.end_time.slice(0, 5)}</strong><h3>{lesson.school}</h3><span>{lesson.class_name}</span><small>{lesson.teacher_name ?? 'Unassigned'}</small></div>
          </button>)}
        </div>
      </aside></div>}

      {drawerOpen && <div className="drawerBackdrop" onMouseDown={() => setDrawerOpen(false)}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawerHeader"><div><p>LESSON DETAILS</p><h2>{draft.id ? 'Edit lesson' : 'Add lesson'}</h2></div><button onClick={() => setDrawerOpen(false)}><X/></button></div>
        <label>Date<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label>
        <label>School<input value={draft.school} onChange={(event) => setDraft({ ...draft, school: event.target.value })}/></label>
        <label>Class / programme<input value={draft.className} onChange={(event) => setDraft({ ...draft, className: event.target.value })}/></label>
        <div className="row"><label>Start<input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}/></label><label>End<input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}/></label></div>
        <label>Teacher<select value={draft.teacher} onChange={(event) => setDraft({ ...draft, teacher: event.target.value })}><option value="">Unassigned</option>{teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={draft.unavailable} onChange={(event) => setDraft({ ...draft, unavailable: event.target.checked })}/> Teacher unavailable</label>
        <div className="drawerActions">{draft.id && <button className="delete" onClick={removeDraft}>Delete</button>}<span/><button className="save" onClick={saveDraft}><Save size={16}/> Save</button></div>
      </aside></div>}

      <style jsx global>{`
        .editorShell{min-height:100vh;padding:30px;max-width:1650px;margin:auto;color:#eef2fb}.editorHeader{display:flex;justify-content:space-between;align-items:end;margin-bottom:20px}.editorHeader p,.drawerHeader p,.workloadTitle p{margin:14px 0 6px;color:#8b7cff;font-size:11px;font-weight:900;letter-spacing:.16em}.editorHeader h1{margin:0 0 6px;font-size:34px}.editorHeader span{color:#8794ab}.back{display:flex;align-items:center;gap:7px;color:#aa9cff}.conflictLink{padding:11px 15px;border-radius:11px;background:#6653de;color:white;text-decoration:none;font-weight:750}.filterBar{display:grid;grid-template-columns:minmax(260px,1fr) 190px auto auto;gap:10px;align-items:center;margin-bottom:14px}.filterBar select,.filterBar button,.searchBox{height:44px;border-radius:11px;border:1px solid rgba(148,163,184,.16);background:#0d1425;color:#eef2fb}.searchBox{display:flex;align-items:center;gap:9px;padding:0 12px}.searchBox input{width:100%;border:0;outline:0;background:transparent;color:#eef2fb}.filterBar select{padding:0 12px}.filterBar button{padding:0 14px;cursor:pointer}.filterBar>span{text-align:right;color:#8794ab;font-size:13px}.contentGrid{display:grid;grid-template-columns:minmax(0,1fr) 245px;gap:14px;align-items:start}.calendarCard,.workloadCard{border:1px solid rgba(148,163,184,.14);background:#0d1425;border-radius:18px}.calendarCard{padding:18px;overflow:hidden}.workloadCard{padding:16px;position:sticky;top:18px}.workloadTitle{display:flex;align-items:center;gap:10px;margin-bottom:8px}.workloadTitle p{margin:0 0 3px}.workloadTitle h2{font-size:17px;margin:0}.workloadCard>button{display:grid;gap:8px;width:100%;padding:12px 0;border:0;border-bottom:1px solid rgba(148,163,184,.1);background:transparent;color:#eef2fb;text-align:left;cursor:pointer}.workloadCard>button>div:first-child{display:flex;justify-content:space-between;gap:8px}.workloadCard span{color:#8794ab;font-size:12px}.bar{height:5px;background:#192238;border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;border-radius:999px}.empty{display:block;padding:18px 0}.loading{display:flex;justify-content:center;align-items:center;gap:10px;min-height:420px}.fc{--fc-border-color:rgba(148,163,184,.13);--fc-page-bg-color:#0d1425;--fc-neutral-bg-color:#111a2d;--fc-list-event-hover-bg-color:#162039;color:#eef2fb}.fc .fc-button{background:#6653de;border:0}.fc .fc-button-primary:not(:disabled).fc-button-active{background:#493ab8}.fc .fc-daygrid-day-number,.fc .fc-col-header-cell-cushion{color:#cfd7e7;text-decoration:none}.fc .fc-daygrid-day-frame{min-height:135px}.fc .fc-event{cursor:pointer;border-radius:7px;padding:3px 5px;font-weight:700;overflow:hidden;margin-bottom:3px}.fc .fc-daygrid-more-link{display:block;padding:6px 8px;margin:4px 2px 0;border-radius:8px;background:rgba(102,83,222,.16);color:#b9adff;font-size:11px;font-weight:800;text-decoration:none}.eventCard{display:grid;line-height:1.2;padding:1px 0;overflow:hidden}.eventCard strong,.eventCard span,.eventCard small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.eventCard.compact strong{font-size:11px}.eventCard.compact small{font-size:9px;opacity:.76}.eventCard.detailed strong{font-size:12px}.eventCard.detailed span{font-size:11px;opacity:.82}.eventCard.detailed small{font-size:10px;opacity:.72}.drawerBackdrop{position:fixed;inset:0;background:rgba(3,7,18,.68);display:flex;justify-content:flex-end;z-index:2000}.drawer,.dayPanel{width:min(440px,100%);height:100%;background:#0d1425;border-left:1px solid rgba(148,163,184,.16);padding:24px;display:grid;align-content:start;gap:15px;box-shadow:-25px 0 70px rgba(0,0,0,.35);overflow-y:auto}.dayPanel{width:min(470px,100%)}.drawerHeader{display:flex;justify-content:space-between;align-items:start}.drawerHeader h2{margin:0;font-size:25px}.drawerHeader span{color:#8794ab;font-size:13px}.drawerHeader button{border:0;background:transparent;color:#9aa7bd;cursor:pointer}.addLesson{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:0;border-radius:11px;background:#6653de;color:white;font-weight:800;cursor:pointer}.dayLessonList{display:grid;gap:9px}.dayLesson{position:relative;display:grid;grid-template-columns:5px 1fr;gap:12px;width:100%;padding:13px;border:1px solid rgba(148,163,184,.13);border-radius:13px;background:#111a2d;color:#eef2fb;text-align:left;cursor:pointer}.dayLesson:hover{border-color:rgba(139,124,255,.55);transform:translateY(-1px)}.dayLesson i{height:100%;min-height:76px;border-radius:999px}.dayLesson div{display:grid;gap:3px}.dayLesson strong{font-size:12px;color:#aaa0ff}.dayLesson h3{margin:0;font-size:15px}.dayLesson span{font-size:12px;color:#bec7d8}.dayLesson small{font-size:11px;color:#8794ab}.noDayLessons{padding:35px 12px;text-align:center;color:#8794ab;border:1px dashed rgba(148,163,184,.16);border-radius:13px}.drawer label{display:grid;gap:7px;color:#aeb8ca;font-size:13px;font-weight:700}.drawer input,.drawer select{padding:11px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.16);background:#111a2d;color:#eef2fb}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.check{display:flex!important;grid-template-columns:auto 1fr;align-items:center}.check input{width:auto}.drawerActions{display:grid;grid-template-columns:auto 1fr auto;align-items:center;margin-top:8px}.drawerActions button{padding:11px 14px;border:0;border-radius:10px;font-weight:800;cursor:pointer}.drawerActions .delete{background:rgba(251,113,133,.12);color:#fb7185}.drawerActions .save{display:flex;align-items:center;gap:7px;background:#6653de;color:white}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1050px){.contentGrid{grid-template-columns:1fr}.workloadCard{position:static}.workloadCard>button{max-width:420px}}@media(max-width:760px){.editorShell{padding:18px}.editorHeader{display:grid;gap:14px}.filterBar{grid-template-columns:1fr}.filterBar>span{text-align:left}.fc .fc-toolbar{display:grid;gap:10px}.fc .fc-daygrid-day-frame{min-height:110px}.row{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
