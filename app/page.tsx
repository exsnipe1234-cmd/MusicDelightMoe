'use client';

import { useMemo, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, LayoutDashboard, Plus, Search, Sparkles, Users } from 'lucide-react';

type Teacher = {
  name: string;
  color: string;
};

type Lesson = {
  id: number;
  day: number;
  school: string;
  className: string;
  time: string;
  teacher: string | null;
  unavailable?: boolean;
};

const teachers: Teacher[] = [
  { name: 'Claris', color: '#70d28c' },
  { name: 'Gerald', color: '#55d6cf' },
  { name: 'Edward', color: '#72c7f0' },
  { name: 'Wero', color: '#d9c7a4' },
  { name: 'Shi Yi', color: '#a98bea' },
  { name: 'Siew Lynn', color: '#f2abc6' },
  { name: 'Joel', color: '#c7ccd4' },
  { name: 'Audrey', color: '#d388d8' },
  { name: 'Ashley', color: '#f2d66d' },
];

const initialLessons: Lesson[] = [
  { id: 1, day: 6, school: 'Compassvale Primary School', className: 'P1-3', time: '12:40 – 13:40', teacher: 'Siew Lynn' },
  { id: 2, day: 7, school: 'Meridian Primary School', className: '4IN Keyboard', time: '08:30 – 09:30', teacher: 'Joel' },
  { id: 3, day: 8, school: 'Compassvale Primary School', className: 'P1-7', time: '10:40 – 11:40', teacher: 'Claris' },
  { id: 4, day: 9, school: 'Chongfu Primary School', className: '4 Innovative', time: '12:30 – 13:30', teacher: 'Wero' },
  { id: 5, day: 10, school: 'Meridian Primary School', className: '4RB', time: '12:00 – 13:00', teacher: 'Gerald' },
  { id: 6, day: 11, school: 'Farrer Park CCA', className: 'Guitar Ensemble', time: '14:00 – 16:00', teacher: 'Joel', unavailable: true },
  { id: 7, day: 13, school: 'Chongfu Primary School', className: '3 Gracious', time: '10:30 – 11:30', teacher: 'Shi Yi' },
  { id: 8, day: 15, school: 'Valour Primary School', className: 'Guitar Ensemble', time: '13:45 – 15:45', teacher: 'Edward' },
  { id: 9, day: 16, school: 'Meridian Primary School', className: '3CA', time: '07:30 – 08:30', teacher: 'Audrey' },
  { id: 10, day: 17, school: 'Bukit Timah Primary School', className: 'Relief Class', time: '09:00 – 10:00', teacher: null },
  { id: 11, day: 20, school: 'Compassvale Primary School', className: 'P1-1', time: '11:10 – 12:10', teacher: 'Siew Lynn' },
  { id: 12, day: 22, school: 'River Valley', className: 'Guitar Programme', time: '15:00 – 18:30', teacher: 'Edward' },
  { id: 13, day: 24, school: 'Chongfu Primary School', className: '4 Sincere', time: '12:30 – 13:30', teacher: 'Gerald' },
  { id: 14, day: 27, school: 'Compassvale Primary School', className: 'P1-5', time: '10:10 – 11:10', teacher: 'Claris' },
  { id: 15, day: 29, school: 'School Pending', className: 'Teacher Required', time: '14:00 – 15:00', teacher: null },
  { id: 16, day: 31, school: 'Chongfu Primary School', className: '3 Observant', time: '11:00 – 12:00', teacher: 'Ashley' },
];

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const leadingDays = [28, 29, 30];
const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
const trailingDays = [1];

function teacherColour(name: string | null) {
  return teachers.find((teacher) => teacher.name === name)?.color ?? '#fb7185';
}

export default function Home() {
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>(teachers.map((teacher) => teacher.name));
  const [search, setSearch] = useState('');

  const visibleLessons = useMemo(() => {
    return initialLessons.filter((lesson) => {
      const matchesTeacher = lesson.teacher === null || selectedTeachers.includes(lesson.teacher);
      const text = `${lesson.school} ${lesson.className} ${lesson.teacher ?? ''}`.toLowerCase();
      return matchesTeacher && text.includes(search.toLowerCase());
    });
  }, [search, selectedTeachers]);

  const toggleTeacher = (name: string) => {
    setSelectedTeachers((current) =>
      current.includes(name) ? current.filter((teacher) => teacher !== name) : [...current, name],
    );
  };

  const unassigned = initialLessons.filter((lesson) => lesson.teacher === null);
  const unavailable = initialLessons.filter((lesson) => lesson.unavailable);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brandMark">MD</div>
        <div className="brandText">
          <strong>Music Delight</strong>
          <span>MOE Operations</span>
        </div>
        <nav>
          <button className="navItem active"><LayoutDashboard size={18} /> Dashboard</button>
          <button className="navItem"><CalendarDays size={18} /> Calendar</button>
          <button className="navItem"><Users size={18} /> Teachers</button>
          <button className="navItem"><Sparkles size={18} /> AI Assistant</button>
        </nav>
        <div className="sidebarFooter">
          <div className="profileAvatar">GA</div>
          <div><strong>Gerald</strong><span>Administrator</span></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ADMIN WORKSPACE</p>
            <h1>Master Calendar</h1>
          </div>
          <div className="topActions">
            <div className="searchBox"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search classes or teachers" /></div>
            <button className="iconButton"><Bell size={18} /><span className="notificationDot" /></button>
            <button className="primaryButton"><Plus size={18} /> Add lesson</button>
          </div>
        </header>

        <section className="statsGrid">
          <article className="statCard"><span>Total lessons</span><strong>{initialLessons.length}</strong><small>July 2026</small></article>
          <article className="statCard"><span>Teachers active</span><strong>{teachers.length}</strong><small>All teaching staff</small></article>
          <article className="statCard warning"><span>Needs assignment</span><strong>{unassigned.length}</strong><small>Action required</small></article>
          <article className="statCard danger"><span>Cannot attend</span><strong>{unavailable.length}</strong><small>Replacement required</small></article>
        </section>

        <section className="workspaceGrid">
          <article className="calendarPanel glassPanel">
            <div className="calendarToolbar">
              <div className="monthNavigation"><button><ChevronLeft size={18} /></button><h2>July 2026</h2><button><ChevronRight size={18} /></button></div>
              <div className="viewToggle"><button className="selected">Month</button><button>Week</button><button>Day</button></div>
            </div>
            <div className="calendarGrid weekdayRow">
              {weekdayLabels.map((label) => <div key={label}>{label}</div>)}
            </div>
            <div className="calendarGrid daysGrid">
              {leadingDays.map((day) => <DayCell key={`lead-${day}`} day={day} muted lessons={[]} />)}
              {monthDays.map((day) => <DayCell key={day} day={day} lessons={visibleLessons.filter((lesson) => lesson.day === day)} />)}
              {trailingDays.map((day) => <DayCell key={`trail-${day}`} day={day} muted lessons={[]} />)}
            </div>
          </article>

          <aside className="rightRail">
            <section className="glassPanel filterPanel">
              <div className="sectionHeading"><div><p className="eyebrow">FILTER</p><h3>Teachers</h3></div><button onClick={() => setSelectedTeachers(teachers.map((teacher) => teacher.name))}>All</button></div>
              <div className="teacherList">
                {teachers.map((teacher) => (
                  <label key={teacher.name} className="teacherOption">
                    <input type="checkbox" checked={selectedTeachers.includes(teacher.name)} onChange={() => toggleTeacher(teacher.name)} />
                    <span className="colourDot" style={{ background: teacher.color }} />
                    <span>{teacher.name}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="glassPanel unassignedPanel">
              <div className="sectionHeading"><div><p className="eyebrow">ACTION REQUIRED</p><h3>Unassigned</h3></div><span className="countBadge">{unassigned.length}</span></div>
              {unassigned.map((lesson) => (
                <div className="unassignedCard" key={lesson.id} draggable>
                  <strong>{lesson.school}</strong>
                  <span>{lesson.className}</span>
                  <small><Clock3 size={14} /> {lesson.time}</small>
                  <button>Assign teacher</button>
                </div>
              ))}
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

function DayCell({ day, muted = false, lessons }: { day: number; muted?: boolean; lessons: Lesson[] }) {
  return (
    <div className={`dayCell ${muted ? 'muted' : ''}`}>
      <span className="dayNumber">{day}</span>
      <div className="lessonStack">
        {lessons.map((lesson) => (
          <div
            className={`lessonCard ${lesson.unavailable ? 'unavailable' : ''} ${lesson.teacher === null ? 'unassigned' : ''}`}
            key={lesson.id}
            draggable
            style={{ '--teacher-colour': teacherColour(lesson.teacher) } as React.CSSProperties}
          >
            <strong>{lesson.time}</strong>
            <span>{lesson.school}</span>
            <small>{lesson.className} · {lesson.teacher ?? 'Unassigned'}</small>
            {lesson.unavailable && <em>Cannot attend</em>}
          </div>
        ))}
      </div>
    </div>
  );
}
