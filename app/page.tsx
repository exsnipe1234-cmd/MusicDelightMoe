'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, FileUp,
  LayoutDashboard, Pencil, Plus, Search, Sparkles, Trash2, Users, X,
} from 'lucide-react';

type ViewMode = 'month' | 'week' | 'day';
type Teacher = { name: string; color: string };
type Lesson = {
  id: number; date: string; school: string; className: string;
  startTime: string; endTime: string; teacher: string | null; unavailable?: boolean;
};
type LessonDraft = Omit<Lesson, 'id'>;

const STORAGE_KEY = 'moeCalendarLessons';
const teachers: Teacher[] = [
  { name: 'Claris', color: '#70d28c' }, { name: 'Gerald', color: '#55d6cf' },
  { name: 'Edward', color: '#72c7f0' }, { name: 'Wero', color: '#d9c7a4' },
  { name: 'Shi Yi', color: '#a98bea' }, { name: 'Siew Lynn', color: '#f2abc6' },
  { name: 'Joel', color: '#c7ccd4' }, { name: 'Audrey', color: '#d388d8' },
  { name: 'Ashley', color: '#f2d66d' },
];

const initialLessons: Lesson[] = [
  { id: 1, date: '2026-07-06', school: 'Compassvale Primary School', className: 'P1-3', startTime: '12:40', endTime: '13:40', teacher: 'Siew Lynn' },
  { id: 2, date: '2026-07-07', school: 'Meridian Primary School', className: '4IN Keyboard', startTime: '08:30', endTime: '09:30', teacher: 'Joel' },
  { id: 3, date: '2026-07-08', school: 'Compassvale Primary School', className: 'P1-7', startTime: '10:40', endTime: '11:40', teacher: 'Claris' },
  { id: 4, date: '2026-07-09', school: 'Chongfu Primary School', className: '4 Innovative', startTime: '12:30', endTime: '13:30', teacher: 'Wero' },
  { id: 5, date: '2026-07-10', school: 'Meridian Primary School', className: '4RB', startTime: '12:00', endTime: '13:00', teacher: 'Gerald' },
  { id: 6, date: '2026-07-11', school: 'Farrer Park CCA', className: 'Guitar Ensemble', startTime: '14:00', endTime: '16:00', teacher: 'Joel', unavailable: true },
  { id: 7, date: '2026-07-13', school: 'Chongfu Primary School', className: '3 Gracious', startTime: '10:30', endTime: '11:30', teacher: 'Shi Yi' },
  { id: 8, date: '2026-07-15', school: 'Valour Primary School', className: 'Guitar Ensemble', startTime: '13:45', endTime: '15:45', teacher: 'Edward' },
  { id: 9, date: '2026-07-16', school: 'Meridian Primary School', className: '3CA', startTime: '07:30', endTime: '08:30', teacher: 'Audrey' },
  { id: 10, date: '2026-07-17', school: 'Bukit Timah Primary School', className: 'Relief Class', startTime: '09:00', endTime: '10:00', teacher: null },
];

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (value: number) => String(value).padStart(2, '0');
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const teacherColour = (name: string | null) => teachers.find((teacher) => teacher.name === name)?.color ?? '#fb7185';
const monthLabel = (date: Date) => new Intl.DateTimeFormat('en-SG', { month: 'long', year: 'numeric' }).format(date);
const dayLabel = (date: Date) => new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
function startOfWeek(date: Date) { const result = new Date(date); result.setDate(result.getDate() - result.getDay()); result.setHours(0, 0, 0, 0); return result; }
function createBlankLesson(date: Date): LessonDraft { return { date: toDateKey(date), school: '', className: '', startTime: '09:00', endTime: '10:00', teacher: null, unavailable: false }; }

export default function Home() {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [loaded, setLoaded] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState(teachers.map((teacher) => teacher.name));
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [cursorDate, setCursorDate] = useState(new Date(2026, 6, 1));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<LessonDraft>(() => createBlankLesson(new Date(2026, 6, 1)));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Lesson[];
        if (Array.isArray(parsed)) setLessons(parsed);
      }
    } catch { /* keep starter data */ }
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons)); }, [lessons, loaded]);

  const visibleLessons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const matchesTeacher = lesson.teacher === null || selectedTeachers.includes(lesson.teacher);
      const text = `${lesson.school} ${lesson.className} ${lesson.teacher ?? ''}`.toLowerCase();
      return matchesTeacher && (!query || text.includes(query));
    });
  }, [lessons, search, selectedTeachers]);

  const unassigned = lessons.filter((lesson) => lesson.teacher === null);
  const unavailable = lessons.filter((lesson) => lesson.unavailable);
  const toggleTeacher = (name: string) => setSelectedTeachers((current) => current.includes(name) ? current.filter((teacher) => teacher !== name) : [...current, name]);
  const moveCursor = (direction: -1 | 1) => setCursorDate((current) => { const next = new Date(current); if (viewMode === 'month') next.setMonth(next.getMonth() + direction, 1); if (viewMode === 'week') next.setDate(next.getDate() + direction * 7); if (viewMode === 'day') next.setDate(next.getDate() + direction); return next; });
  const openAddModal = (date = cursorDate) => { setEditingId(null); setDraft(createBlankLesson(date)); setModalOpen(true); };
  const openEditModal = (lesson: Lesson) => { setEditingId(lesson.id); setDraft({ date: lesson.date, school: lesson.school, className: lesson.className, startTime: lesson.startTime, endTime: lesson.endTime, teacher: lesson.teacher, unavailable: lesson.unavailable ?? false }); setModalOpen(true); };
  const saveLesson = (event: FormEvent) => { event.preventDefault(); if (!draft.school.trim() || !draft.className.trim()) return; setLessons((current) => editingId === null ? [...current, { ...draft, id: Date.now() }] : current.map((lesson) => lesson.id === editingId ? { ...lesson, ...draft } : lesson)); setModalOpen(false); };
  const deleteLesson = () => { if (editingId === null) return; setLessons((current) => current.filter((lesson) => lesson.id !== editingId)); setModalOpen(false); };
  const moveLessonToDate = (lessonId: number, date: string) => setLessons((current) => current.map((lesson) => lesson.id === lessonId ? { ...lesson, date } : lesson));
  const heading = viewMode === 'month' ? monthLabel(cursorDate) : viewMode === 'week' ? `Week of ${dayLabel(startOfWeek(cursorDate))}` : dayLabel(cursorDate);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brandMark">MD</div><div className="brandText"><strong>Music Delight</strong><span>MOE Operations</span></div>
        <nav><button className="navItem active"><LayoutDashboard size={18} /> Dashboard</button><button className="navItem"><CalendarDays size={18} /> Calendar</button><button className="navItem"><Users size={18} /> Teachers</button><button className="navItem"><Sparkles size={18} /> AI Assistant</button></nav>
        <div className="sidebarFooter"><div className="profileAvatar">GA</div><div><strong>Gerald</strong><span>Administrator</span></div></div>
      </aside>
      <section className="content">
        <header className="topbar"><div><p className="eyebrow">ADMIN WORKSPACE</p><h1>Master Calendar</h1></div><div className="topActions"><div className="searchBox"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search classes or teachers" /></div><button className="iconButton" aria-label="Notifications"><Bell size={18} /><span className="notificationDot" /></button><Link href="/import" className="primaryButton"><FileUp size={18} /> Import PDF</Link><button className="primaryButton" onClick={() => openAddModal()}><Plus size={18} /> Add lesson</button></div></header>
        <section className="statsGrid"><article className="statCard"><span>Total lessons</span><strong>{lessons.length}</strong><small>{monthLabel(cursorDate)}</small></article><article className="statCard"><span>Teachers active</span><strong>{teachers.length}</strong><small>All teaching staff</small></article><article className="statCard warning"><span>Needs assignment</span><strong>{unassigned.length}</strong><small>Action required</small></article><article className="statCard danger"><span>Cannot attend</span><strong>{unavailable.length}</strong><small>Replacement required</small></article></section>
        <section className="workspaceGrid"><article className="calendarPanel glassPanel"><div className="calendarToolbar"><div className="monthNavigation"><button onClick={() => moveCursor(-1)} aria-label="Previous"><ChevronLeft size={18} /></button><h2>{heading}</h2><button onClick={() => moveCursor(1)} aria-label="Next"><ChevronRight size={18} /></button></div><div className="toolbarRight"><button className="todayButton" onClick={() => setCursorDate(new Date())}>Today</button><div className="viewToggle">{(['month', 'week', 'day'] as ViewMode[]).map((mode) => <button key={mode} className={viewMode === mode ? 'selected' : ''} onClick={() => setViewMode(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div></div></div>
          {viewMode === 'month' && <MonthView cursorDate={cursorDate} lessons={visibleLessons} onAdd={openAddModal} onEdit={openEditModal} onMove={moveLessonToDate} />}
          {viewMode === 'week' && <WeekView cursorDate={cursorDate} lessons={visibleLessons} onAdd={openAddModal} onEdit={openEditModal} />}
          {viewMode === 'day' && <DayView cursorDate={cursorDate} lessons={visibleLessons} onAdd={openAddModal} onEdit={openEditModal} />}
        </article><aside className="rightRail"><section className="glassPanel filterPanel"><div className="sectionHeading"><div><p className="eyebrow">FILTER</p><h3>Teachers</h3></div><button onClick={() => setSelectedTeachers(teachers.map((teacher) => teacher.name))}>All</button></div><div className="teacherList">{teachers.map((teacher) => <label key={teacher.name} className="teacherOption"><input type="checkbox" checked={selectedTeachers.includes(teacher.name)} onChange={() => toggleTeacher(teacher.name)} /><span className="colourDot" style={{ background: teacher.color }} /><span>{teacher.name}</span></label>)}</div></section><section className="glassPanel unassignedPanel"><div className="sectionHeading"><div><p className="eyebrow">ACTION REQUIRED</p><h3>Unassigned</h3></div><span className="countBadge">{unassigned.length}</span></div>{unassigned.map((lesson) => <div className="unassignedCard" key={lesson.id}><strong>{lesson.school}</strong><span>{lesson.className}</span><small><Clock3 size={14} /> {lesson.startTime} – {lesson.endTime}</small><button onClick={() => openEditModal(lesson)}>Assign teacher</button></div>)}</section></aside></section>
      </section>
      {modalOpen && <div className="modalBackdrop" onMouseDown={() => setModalOpen(false)}><form className="lessonModal" onSubmit={saveLesson} onMouseDown={(event) => event.stopPropagation()}><div className="modalHeader"><div><p className="eyebrow">LESSON DETAILS</p><h2>{editingId === null ? 'Add lesson' : 'Edit lesson'}</h2></div><button type="button" className="closeButton" onClick={() => setModalOpen(false)}><X size={20} /></button></div><label>Date<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required /></label><label>School<input value={draft.school} onChange={(event) => setDraft({ ...draft, school: event.target.value })} required /></label><label>Class / programme<input value={draft.className} onChange={(event) => setDraft({ ...draft, className: event.target.value })} required /></label><div className="formRow"><label>Start time<input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} required /></label><label>End time<input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} required /></label></div><label>Teacher<select value={draft.teacher ?? ''} onChange={(event) => setDraft({ ...draft, teacher: event.target.value || null })}><option value="">Unassigned</option>{teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}</select></label><label className="checkboxRow"><input type="checkbox" checked={draft.unavailable ?? false} onChange={(event) => setDraft({ ...draft, unavailable: event.target.checked })} /> Teacher cannot attend</label><div className="modalActions">{editingId !== null && <button type="button" className="deleteButton" onClick={deleteLesson}><Trash2 size={16} /> Delete</button>}<span /><button type="button" className="secondaryButton" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="primaryButton"><Pencil size={16} /> Save lesson</button></div></form></div>}
    </main>
  );
}

function MonthView({ cursorDate, lessons, onAdd, onEdit, onMove }: { cursorDate: Date; lessons: Lesson[]; onAdd: (date: Date) => void; onEdit: (lesson: Lesson) => void; onMove: (lessonId: number, date: string) => void }) {
  const first = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1); const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay()); const cells = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  return <><div className="calendarGrid weekdayRow">{weekdayLabels.map((label) => <div key={label}>{label}</div>)}</div><div className="calendarGrid daysGrid">{cells.map((date) => { const key = toDateKey(date); const dayLessons = lessons.filter((lesson) => lesson.date === key).sort((a, b) => a.startTime.localeCompare(b.startTime)); return <div key={key} className={`dayCell ${date.getMonth() !== cursorDate.getMonth() ? 'muted' : ''}`} onDoubleClick={() => onAdd(date)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = Number(event.dataTransfer.getData('text/lesson-id')); if (id) onMove(id, key); }}><span className="dayNumber">{date.getDate()}</span><button className="dayAddButton" onClick={() => onAdd(date)}><Plus size={12} /></button><div className="lessonStack">{dayLessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onEdit={onEdit} />)}</div></div>; })}</div></>;
}
function WeekView({ cursorDate, lessons, onAdd, onEdit }: { cursorDate: Date; lessons: Lesson[]; onAdd: (date: Date) => void; onEdit: (lesson: Lesson) => void }) { const start = startOfWeek(cursorDate); const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; }); return <div className="weekGrid">{days.map((date) => { const key = toDateKey(date); const dayLessons = lessons.filter((lesson) => lesson.date === key).sort((a, b) => a.startTime.localeCompare(b.startTime)); return <section className="weekColumn" key={key}><button className="weekHeading" onClick={() => onAdd(date)}><span>{weekdayLabels[date.getDay()]}</span><strong>{date.getDate()}</strong></button><div className="weekLessons">{dayLessons.length ? dayLessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onEdit={onEdit} />) : <button className="emptySlot" onClick={() => onAdd(date)}>+ Add lesson</button>}</div></section>; })}</div>; }
function DayView({ cursorDate, lessons, onAdd, onEdit }: { cursorDate: Date; lessons: Lesson[]; onAdd: (date: Date) => void; onEdit: (lesson: Lesson) => void }) { const dayLessons = lessons.filter((lesson) => lesson.date === toDateKey(cursorDate)).sort((a, b) => a.startTime.localeCompare(b.startTime)); return <div className="dayAgenda"><div className="agendaHeader"><div><p className="eyebrow">DAILY SCHEDULE</p><h2>{dayLabel(cursorDate)}</h2></div><button className="primaryButton" onClick={() => onAdd(cursorDate)}><Plus size={17} /> Add lesson</button></div>{dayLessons.length ? dayLessons.map((lesson) => <button key={lesson.id} className="agendaItem" onClick={() => onEdit(lesson)} style={{ '--teacher-colour': teacherColour(lesson.teacher) } as React.CSSProperties}><span className="agendaTime">{lesson.startTime}<small>{lesson.endTime}</small></span><span className="agendaAccent" /><span className="agendaDetails"><strong>{lesson.school}</strong><small>{lesson.className} · {lesson.teacher ?? 'Unassigned'}</small></span>{lesson.unavailable && <em>Cannot attend</em>}</button>) : <div className="emptyAgenda"><CalendarDays size={30} /><strong>No lessons scheduled</strong><span>Add the first lesson for this day.</span></div>}</div>; }
function LessonCard({ lesson, onEdit }: { lesson: Lesson; onEdit: (lesson: Lesson) => void }) { return <button className={`lessonCard ${lesson.unavailable ? 'unavailable' : ''} ${lesson.teacher === null ? 'unassigned' : ''}`} draggable onDragStart={(event) => event.dataTransfer.setData('text/lesson-id', String(lesson.id))} onClick={() => onEdit(lesson)} style={{ '--teacher-colour': teacherColour(lesson.teacher) } as React.CSSProperties}><strong>{lesson.startTime} – {lesson.endTime}</strong><span>{lesson.school}</span><small>{lesson.className} · {lesson.teacher ?? 'Unassigned'}</small>{lesson.unavailable && <em>Cannot attend</em>}</button>; }
