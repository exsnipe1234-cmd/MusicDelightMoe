'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, Loader2, MapPin, UserRoundX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../utils/supabase/client';

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

type TeacherRow = { name: string; color: string };
type Conflict = { key: string; type: 'overlap' | 'tight'; teacher: string; date: string; first: LessonRow; second: LessonRow; gap?: number };

const REVIEWED_KEY = 'moeReviewedConflicts';
const minutes = (time: string) => { const [h, m] = time.slice(0, 5).split(':').map(Number); return h * 60 + m; };
const niceDate = (date: string) => new Intl.DateTimeFormat('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
const timeRange = (lesson: LessonRow) => `${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`;
const clashes = (a: LessonRow, b: LessonRow) => a.lesson_date === b.lesson_date && minutes(a.start_time) < minutes(b.end_time) && minutes(a.end_time) > minutes(b.start_time);

export default function ConflictCenterPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Checking the calendar...');

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { router.replace('/login'); return; }
    const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', sessionData.session.user.id).single();
    if (!profile?.active || profile.role !== 'admin') { router.replace(profile?.role === 'teacher' ? '/teacher' : '/login'); return; }
    const [{ data, error }, { data: teacherData }] = await Promise.all([
      supabase.from('lessons').select('*').order('lesson_date').order('start_time'),
      supabase.from('teachers').select('name,color').order('name'),
    ]);
    if (error) setMessage(`Could not check conflicts: ${error.message}`);
    else { setLessons((data as LessonRow[]) ?? []); setMessage(`${data?.length ?? 0} lessons checked.`); }
    setTeachers((teacherData as TeacherRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    try { setReviewed(JSON.parse(localStorage.getItem(REVIEWED_KEY) || '[]')); } catch { setReviewed([]); }
    void load();
  }, []);

  const conflicts = useMemo(() => {
    const result: Conflict[] = [];
    const groups = new Map<string, LessonRow[]>();
    for (const lesson of lessons) {
      if (!lesson.teacher_name) continue;
      const key = `${lesson.teacher_name}|${lesson.lesson_date}`;
      groups.set(key, [...(groups.get(key) ?? []), lesson]);
    }
    for (const [groupKey, group] of groups) {
      const ordered = [...group].sort((a, b) => a.start_time.localeCompare(b.start_time));
      for (let i = 0; i < ordered.length - 1; i += 1) {
        const first = ordered[i]; const second = ordered[i + 1];
        const gap = minutes(second.start_time) - minutes(first.end_time);
        const [teacher, date] = groupKey.split('|');
        if (gap < 0) result.push({ key: `${first.id}-${second.id}-overlap`, type: 'overlap', teacher, date, first, second });
        else if (gap < 30 && first.school.trim().toLowerCase() !== second.school.trim().toLowerCase()) result.push({ key: `${first.id}-${second.id}-tight`, type: 'tight', teacher, date, first, second, gap });
      }
    }
    return result;
  }, [lessons]);

  const activeConflicts = conflicts.filter((item) => !reviewed.includes(item.key));
  const overlaps = activeConflicts.filter((item) => item.type === 'overlap');
  const tight = activeConflicts.filter((item) => item.type === 'tight');
  const reviewedCount = conflicts.length - activeConflicts.length;
  const unassigned = lessons.filter((lesson) => !lesson.teacher_name);
  const unavailable = lessons.filter((lesson) => lesson.unavailable);
  const issueCount = overlaps.length + tight.length + unassigned.length + unavailable.length;

  const availableTeachers = (lesson: LessonRow) => teachers.filter((teacher) => !lessons.some((other) => other.id !== lesson.id && other.teacher_name === teacher.name && clashes(lesson, other)));

  const reassign = async (lesson: LessonRow, teacherName: string) => {
    if (!teacherName) return;
    setMessage(`Assigning ${teacherName}...`);
    const { error } = await supabase.from('lessons').update({ teacher_name: teacherName, unavailable: false }).eq('id', lesson.id);
    if (error) { setMessage(`Could not reassign: ${error.message}`); return; }
    setLessons((current) => current.map((item) => item.id === lesson.id ? { ...item, teacher_name: teacherName, unavailable: false } : item));
    setMessage(`${lesson.class_name} reassigned to ${teacherName}.`);
  };

  const markReviewed = (key: string) => {
    const next = reviewed.includes(key) ? reviewed : [...reviewed, key];
    setReviewed(next);
    localStorage.setItem(REVIEWED_KEY, JSON.stringify(next));
    setMessage('Conflict marked as reviewed and removed from active issues.');
  };

  return (
    <main className="conflictShell">
      <header className="header">
        <div><Link href="/" className="back"><ArrowLeft size={17}/> Back to calendar</Link><p>ADMIN CONTROL PANEL</p><h1>Conflict Center</h1><span>Review clashes and resolve them directly without returning to the calendar.</span></div>
        <button onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="spin" size={17}/> : <CheckCircle2 size={17}/>} Recheck</button>
      </header>

      <section className="stats">
        <article className={issueCount ? 'danger' : 'good'}><span>Total issues</span><strong>{issueCount}</strong><small>{message}</small></article>
        <article><span>Overlaps</span><strong>{overlaps.length}</strong><small>Same teacher, same time</small></article>
        <article><span>Tight travel gaps</span><strong>{tight.length}</strong><small>Under 30 min, different schools</small></article>
        <article><span>Needs assignment</span><strong>{unassigned.length}</strong><small>{reviewedCount ? `${reviewedCount} reviewed conflict${reviewedCount === 1 ? '' : 's'} hidden` : 'No teacher linked'}</small></article>
      </section>

      {!loading && issueCount === 0 && <section className="allClear"><CheckCircle2 size={34}/><h2>No active conflicts found</h2><p>The timetable has no unresolved issues.</p></section>}

      {overlaps.length > 0 && <IssueSection title="Overlapping lessons" subtitle="Choose a replacement teacher for either lesson, or mark the clash as reviewed." icon={<AlertTriangle size={20}/>} items={overlaps.map((item) => <ConflictCard key={item.key} conflict={item} availableTeachers={availableTeachers} onReassign={reassign} onReview={() => markReviewed(item.key)}/>)} />}
      {tight.length > 0 && <IssueSection title="Tight travel gaps" subtitle="Different schools with less than 30 minutes between lessons." icon={<MapPin size={20}/>} items={tight.map((item) => <ConflictCard key={item.key} conflict={item} availableTeachers={availableTeachers} onReassign={reassign} onReview={() => markReviewed(item.key)}/>)} />}
      {unavailable.length > 0 && <IssueSection title="Teacher marked unavailable" subtitle="Assign a replacement teacher directly below." icon={<UserRoundX size={20}/>} items={unavailable.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} choices={availableTeachers(lesson)} onReassign={reassign}/>)} />}
      {unassigned.length > 0 && <IssueSection title="Unassigned lessons" subtitle="Choose an available teacher and save immediately." icon={<CalendarDays size={20}/>} items={unassigned.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} choices={availableTeachers(lesson)} onReassign={reassign}/>)} />}

      <style jsx>{`
        .conflictShell{min-height:100vh;padding:34px;max-width:1450px;margin:auto;color:#eef2fb}.header{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:22px}.header p{margin:16px 0 7px;color:#8978ff;font-size:11px;font-weight:900;letter-spacing:.16em}.header h1{margin:0 0 7px;font-size:34px}.header span{color:#8995ad}.back{display:flex;align-items:center;gap:7px;color:#aa9cff}.header button{display:flex;align-items:center;gap:8px;padding:11px 15px;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:#111a2d;color:#d4dced;font-weight:750;cursor:pointer}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.stats article,.allClear{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.94),rgba(10,15,29,.92));border-radius:18px}.stats article{padding:18px;display:grid;gap:7px}.stats span,.stats small{color:#8491a9}.stats strong{font-size:28px}.stats .danger strong{color:#fb7185}.stats .good strong{color:#63d995}.allClear{text-align:center;padding:50px;color:#63d995}.allClear h2{color:#eef2fb;margin:12px 0 5px}.allClear p{color:#8491a9}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:950px){.stats{grid-template-columns:repeat(2,1fr)}.header{align-items:start}.conflictShell{padding:20px}}@media(max-width:560px){.stats{grid-template-columns:1fr}.header{display:grid}}
      `}</style>
    </main>
  );
}

function IssueSection({ title, subtitle, icon, items }: { title: string; subtitle: string; icon: React.ReactNode; items: React.ReactNode[] }) {
  return <section className="section"><div className="sectionHeader">{icon}<div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="issueList">{items}</div><style jsx>{`.section{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.94),rgba(10,15,29,.92));border-radius:18px;margin-top:16px;overflow:hidden}.sectionHeader{padding:18px 20px;border-bottom:1px solid rgba(148,163,184,.1);display:flex;align-items:center;gap:12px}.sectionHeader h2{font-size:18px;margin:0 0 3px}.sectionHeader p{margin:0;color:#8491a9;font-size:13px}.issueList{display:grid;gap:10px;padding:14px}`}</style></section>;
}

function AssignmentControl({ lesson, choices, onReassign }: { lesson: LessonRow; choices: TeacherRow[]; onReassign: (lesson: LessonRow, teacherName: string) => void }) {
  const [choice, setChoice] = useState('');
  return <div className="assignment"><select value={choice} onChange={(event) => setChoice(event.target.value)}><option value="">Available teacher…</option>{choices.map((teacher) => <option key={teacher.name} value={teacher.name}>{teacher.name}</option>)}</select><button disabled={!choice} onClick={() => onReassign(lesson, choice)}>Assign</button><style jsx>{`.assignment{display:flex;gap:8px;align-items:center}.assignment select{min-width:155px;padding:9px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.16);background:#111a2d;color:#dce4f3}.assignment button{padding:9px 12px;border:0;border-radius:9px;background:#6653de;color:white;font-weight:750;cursor:pointer}.assignment button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:850px){.assignment{align-items:stretch}.assignment select{flex:1}}`}</style></div>;
}

function ConflictCard({ conflict, availableTeachers, onReassign, onReview }: { conflict: Conflict; availableTeachers: (lesson: LessonRow) => TeacherRow[]; onReassign: (lesson: LessonRow, teacherName: string) => void; onReview: () => void }) {
  return <article className={`issueCard ${conflict.type}`}><div className="badge">{conflict.type === 'overlap' ? 'OVERLAP' : `${conflict.gap} MIN GAP`}</div><div className="meta"><strong>{conflict.teacher}</strong><span>{niceDate(conflict.date)}</span><button onClick={onReview}>Mark reviewed</button></div><div className="lesson"><b>{timeRange(conflict.first)}</b><span>{conflict.first.school}</span><small>{conflict.first.class_name}</small><AssignmentControl lesson={conflict.first} choices={availableTeachers(conflict.first)} onReassign={onReassign}/></div><div className="arrow">→</div><div className="lesson"><b>{timeRange(conflict.second)}</b><span>{conflict.second.school}</span><small>{conflict.second.class_name}</small><AssignmentControl lesson={conflict.second} choices={availableTeachers(conflict.second)} onReassign={onReassign}/></div><style jsx>{`.issueCard{display:grid;grid-template-columns:auto 150px 1fr auto 1fr;gap:14px;align-items:center;padding:14px;border-radius:13px;background:#0b1222;border:1px solid rgba(148,163,184,.1)}.issueCard.overlap{border-color:rgba(251,113,133,.35)}.issueCard.tight{border-color:rgba(245,185,76,.3)}.badge{font-size:10px;font-weight:900;letter-spacing:.08em;color:#fb7185}.tight .badge{color:#f5b94c}.issueCard div{display:grid;gap:5px}.issueCard span,.issueCard small{color:#8995ad}.lesson b{color:#eef2fb}.arrow{color:#68758d}.meta button{width:max-content;border:0;background:transparent;color:#9a8cff;padding:3px 0;cursor:pointer;font-weight:700}@media(max-width:850px){.issueCard{grid-template-columns:1fr}.arrow{display:none}}`}</style></article>;
}

function LessonCard({ lesson, choices, onReassign }: { lesson: LessonRow; choices: TeacherRow[]; onReassign: (lesson: LessonRow, teacherName: string) => void }) {
  return <article className="lessonCard"><Clock3 size={18}/><div><strong>{lesson.teacher_name ?? 'Unassigned'} · {niceDate(lesson.lesson_date)}</strong><span>{timeRange(lesson)} · {lesson.school}</span><small>{lesson.class_name}</small></div><AssignmentControl lesson={lesson} choices={choices} onReassign={onReassign}/><Link href="/">Open calendar</Link><style jsx>{`.lessonCard{display:flex;align-items:center;gap:12px;padding:14px;border-radius:13px;background:#0b1222;border:1px solid rgba(148,163,184,.1)}.lessonCard>div{display:grid;gap:3px;flex:1}.lessonCard span,.lessonCard small{color:#8995ad}.lessonCard a{color:#9a8cff;font-weight:750;text-decoration:none}@media(max-width:850px){.lessonCard{align-items:stretch;flex-direction:column}}`}</style></article>;
}
