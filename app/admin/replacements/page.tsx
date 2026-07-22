'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Loader2, RefreshCw, Sparkles, UserRound } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

type Task = {
  id: string;
  request_id: string;
  lesson_id: string | null;
  original_teacher: string;
  lesson_date: string;
  school: string;
  class_name: string;
  start_time: string;
  end_time: string;
  replacement_teacher: string | null;
  status: 'needs_replacement' | 'assigned' | 'cancelled';
};

type Teacher = { name: string; color: string };
type BusyLesson = { lesson_date: string; start_time: string; end_time: string; school: string; teacher_name: string | null };
type Suggestion = { name: string; score: number; reasons: string[] };

const prettyDate = (value: string) => new Intl.DateTimeFormat('en-SG', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(`${value}T12:00:00`));
const shortTime = (value: string) => value.slice(0, 5);
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && bStart < aEnd;

export default function ReplacementQueuePage() {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [busyLessons, setBusyLessons] = useState<BusyLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('Loading replacement queue…');
  const [selected, setSelected] = useState<Task | null>(null);

  const loadData = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) { window.location.href = '/login'; return; }
    const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', user.id).single();
    if (profile?.role !== 'admin' || !profile.active) {
      setMessage('Administrator access is required.'); setLoading(false); return;
    }

    const [{ data: taskRows, error: taskError }, { data: teacherRows }, { data: lessonRows }] = await Promise.all([
      supabase.from('replacement_tasks').select('*').order('lesson_date').order('start_time'),
      supabase.from('teachers').select('name,color').order('name'),
      supabase.from('lessons').select('lesson_date,start_time,end_time,school,teacher_name'),
    ]);

    if (taskError) {
      setMessage(taskError.message.includes('replacement_tasks')
        ? 'Replacement tasks are not installed yet. Run the new Supabase migration.'
        : `Could not load replacement queue: ${taskError.message}`);
      setTasks([]);
    } else {
      const loaded = (taskRows ?? []) as Task[];
      setTasks(loaded);
      setSelected((current) => current ? loaded.find((task) => task.id === current.id) ?? null : loaded.find((task) => task.status === 'needs_replacement') ?? loaded[0] ?? null);
      setMessage(`${loaded.filter((task) => task.status === 'needs_replacement').length} lesson${loaded.filter((task) => task.status === 'needs_replacement').length === 1 ? '' : 's'} need replacement.`);
    }
    setTeachers((teacherRows ?? []) as Teacher[]);
    setBusyLessons((lessonRows ?? []) as BusyLesson[]);
    setLoading(false);
  };

  useEffect(() => { void loadData(); }, []);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!selected) return [];
    return teachers
      .filter((teacher) => teacher.name !== selected.original_teacher)
      .map((teacher) => {
        const sameDay = busyLessons.filter((lesson) => lesson.teacher_name === teacher.name && lesson.lesson_date === selected.lesson_date);
        const conflict = sameDay.some((lesson) => overlaps(shortTime(selected.start_time), shortTime(selected.end_time), shortTime(lesson.start_time), shortTime(lesson.end_time)));
        if (conflict) return null;
        let score = 80;
        const reasons = ['No timetable clash'];
        if (sameDay.some((lesson) => lesson.school === selected.school)) { score += 12; reasons.push('Already teaching at this school'); }
        if (sameDay.length === 0) { score += 5; reasons.push('Light workload that day'); }
        else if (sameDay.length <= 2) { score += 3; reasons.push('Manageable workload'); }
        score -= Math.min(12, sameDay.length * 2);
        return { name: teacher.name, score: Math.max(1, Math.min(99, score)), reasons };
      })
      .filter((value): value is Suggestion => Boolean(value))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }, [busyLessons, selected, teachers]);

  const assign = async (task: Task, teacherName: string) => {
    setSavingId(task.id);
    setMessage(`Assigning ${teacherName}…`);
    const { error } = await supabase.rpc('assign_replacement_task', { p_task_id: task.id, p_teacher: teacherName });
    if (error) setMessage(`Could not assign replacement: ${error.message}`);
    else {
      setMessage(`${teacherName} is now assigned to ${task.school}. The calendar has been updated.`);
      await loadData();
    }
    setSavingId(null);
  };

  const pending = tasks.filter((task) => task.status === 'needs_replacement');
  const assigned = tasks.filter((task) => task.status === 'assigned');

  return (
    <main className="shell">
      <header>
        <div><Link href="/admin/requests" className="back"><ArrowLeft size={17}/> Unable to Attend</Link><p>OPERATIONS</p><h1>Replacement Queue</h1><span>Choose an affected lesson and assign the best available teacher.</span></div>
        <button onClick={() => void loadData()} disabled={loading}><RefreshCw size={17}/> Refresh</button>
      </header>

      <section className="stats">
        <article><CalendarDays size={20}/><span>Needs replacement</span><strong>{pending.length}</strong></article>
        <article><CheckCircle2 size={20}/><span>Assigned</span><strong>{assigned.length}</strong></article>
        <article><UserRound size={20}/><span>Available teachers</span><strong>{suggestions.length}</strong></article>
      </section>

      <div className={`message ${message.includes('Could not') || message.includes('required') || message.includes('not installed') ? 'error' : ''}`}>{loading ? <Loader2 className="spin" size={18}/> : <CheckCircle2 size={18}/>} {message}</div>

      <section className="workspace">
        <div className="queue">
          <div className="heading"><div><p>QUEUE</p><h2>Lessons awaiting cover</h2></div><b>{pending.length}</b></div>
          {pending.map((task) => <button key={task.id} className={selected?.id === task.id ? 'task active' : 'task'} onClick={() => setSelected(task)}>
            <div><strong>{task.school}</strong><span>{task.class_name}</span></div>
            <small>{prettyDate(task.lesson_date)}</small>
            <em><Clock3 size={13}/>{shortTime(task.start_time)}–{shortTime(task.end_time)}</em>
            <i>Original: {task.original_teacher}</i>
          </button>)}
          {!pending.length && <div className="empty"><CheckCircle2 size={34}/><strong>Queue cleared</strong><span>All approved absences have coverage.</span></div>}
        </div>

        <div className="panel">
          {selected ? <>
            <div className="lessonHero"><div><p>AFFECTED LESSON</p><h2>{selected.school}</h2><span>{selected.class_name}</span></div><div><strong>{shortTime(selected.start_time)}</strong><span>{prettyDate(selected.lesson_date)}</span></div></div>
            <div className="original">Unavailable teacher <strong>{selected.original_teacher}</strong></div>
            <div className="suggestionHeading"><div><p><Sparkles size={14}/> SMART SUGGESTIONS</p><h3>Best available teachers</h3></div><span>Conflict-checked</span></div>
            <div className="suggestions">
              {suggestions.map((suggestion, index) => <article key={suggestion.name}>
                <div className="rank">#{index + 1}</div>
                <div><strong>{suggestion.name}</strong><span>{suggestion.reasons.join(' · ')}</span></div>
                <b>{suggestion.score}%</b>
                <button onClick={() => void assign(selected, suggestion.name)} disabled={savingId === selected.id}>{savingId === selected.id ? <Loader2 className="spin" size={15}/> : 'Assign'}</button>
              </article>)}
              {!suggestions.length && <div className="empty">No conflict-free teachers are available for this time.</div>}
            </div>
          </> : <div className="empty large"><CalendarDays size={40}/><strong>Select a lesson</strong><span>Choose a replacement task from the queue.</span></div>}
        </div>
      </section>

      {assigned.length > 0 && <section className="history"><div className="heading"><div><p>COMPLETED</p><h2>Assigned replacements</h2></div></div>{assigned.map((task) => <article key={task.id}><div><strong>{task.school}</strong><span>{task.class_name} · {prettyDate(task.lesson_date)}</span></div><div>{task.original_teacher} → <strong>{task.replacement_teacher}</strong></div><span>{shortTime(task.start_time)}–{shortTime(task.end_time)}</span></article>)}</section>}

      <style jsx>{`
        .shell{min-height:100vh;max-width:1450px;margin:auto;padding:34px;color:#eef2ff}header{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:20px}.back{display:flex;align-items:center;gap:7px;color:#8997b0;text-decoration:none;margin-bottom:22px;width:max-content}p{margin:0 0 6px;color:#8777ff;font-size:10px;font-weight:850;letter-spacing:.15em}h1{font-size:36px;margin:0 0 5px}header span{color:#8390a8}header button{border:1px solid rgba(148,163,184,.12);background:#111a2e;color:#aeb9cd;border-radius:11px;padding:11px 15px;display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.stats article,.message,.queue,.panel,.history{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.96),rgba(10,15,29,.93));border-radius:18px}.stats article{padding:18px;display:grid;grid-template-columns:auto 1fr;gap:7px 11px;align-items:center;color:#9182fa}.stats span{color:#8592aa;font-size:12px}.stats strong{grid-column:2;font-size:25px}.message{margin:14px 0;padding:12px 14px;display:flex;align-items:center;gap:9px;color:#70d28c}.message.error{color:#fb7185}.workspace{display:grid;grid-template-columns:390px minmax(0,1fr);gap:15px}.queue,.panel,.history{padding:20px}.heading,.suggestionHeading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px}.heading h2,.suggestionHeading h3{margin:0}.heading>b{background:#ef4444;border-radius:999px;padding:4px 9px}.task{width:100%;border:1px solid rgba(148,163,184,.09);background:#091120;color:#eef2ff;border-radius:13px;padding:14px;margin-bottom:9px;display:grid;grid-template-columns:1fr auto;text-align:left;gap:6px;cursor:pointer}.task.active{border-color:#7765ec;background:rgba(104,84,224,.12)}.task div{display:grid;gap:3px}.task div span,.task small,.task i{color:#7f8ca5;font-size:11px;font-style:normal}.task em{display:flex;align-items:center;gap:5px;color:#aeb8ca;font-size:11px;font-style:normal}.task i{grid-column:1/3}.lessonHero{display:flex;justify-content:space-between;align-items:center;padding:20px;border-radius:15px;background:linear-gradient(135deg,rgba(112,91,231,.2),rgba(56,189,248,.08));margin-bottom:12px}.lessonHero h2{font-size:26px;margin:0 0 4px}.lessonHero>div:last-child{display:grid;text-align:right;gap:4px}.lessonHero>div:last-child strong{font-size:28px}.lessonHero span,.original,.suggestionHeading>span{color:#8d99ae}.original{padding:12px 14px;border-radius:11px;background:#0a1120;margin-bottom:20px}.original strong{color:#fff;margin-left:6px}.suggestionHeading p{display:flex;align-items:center;gap:6px}.suggestions{display:grid;gap:9px}.suggestions article{display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center;padding:13px;border:1px solid rgba(148,163,184,.1);border-radius:13px;background:#0a1120}.suggestions article>div:nth-child(2){display:grid;gap:3px}.suggestions article span{color:#7f8ca5;font-size:11px}.suggestions article>b{color:#6ee7b7}.suggestions button{border:0;border-radius:9px;background:#5d49d1;color:#fff;padding:9px 13px;cursor:pointer;font-weight:750}.rank{width:34px;height:34px;border-radius:10px;background:rgba(129,112,242,.12);display:grid;place-items:center;color:#a99cff;font-weight:800}.empty{display:grid;place-items:center;text-align:center;gap:7px;color:#7f8ca3;padding:28px}.empty.large{min-height:360px}.history{margin-top:15px}.history>article{display:grid;grid-template-columns:1fr 1fr auto;gap:14px;padding:12px 0;border-top:1px solid rgba(148,163,184,.09)}.history article>div:first-child{display:grid;gap:3px}.history article span{color:#8794aa;font-size:12px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:900px){.workspace{grid-template-columns:1fr}.stats{grid-template-columns:1fr}}@media(max-width:620px){.shell{padding:18px}header{align-items:flex-start;flex-direction:column}.suggestions article{grid-template-columns:auto 1fr auto}.suggestions button{grid-column:1/4}.history>article{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
