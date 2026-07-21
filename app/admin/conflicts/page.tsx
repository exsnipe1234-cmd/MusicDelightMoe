'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
  UserRoundX,
} from 'lucide-react';
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
type AvailabilityRow = {
  id: string;
  teacher_name: string;
  availability_type: 'weekly' | 'leave';
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  reason: string | null;
};
type Conflict = {
  key: string;
  type: 'overlap' | 'tight';
  teacher: string;
  date: string;
  first: LessonRow;
  second: LessonRow;
  gap?: number;
};
type AvailabilityIssue = { lesson: LessonRow; reason: string };
type RankedTeacher = TeacherRow & { score: number; reasons: string[] };
type AssignmentChange = {
  lessonId: string;
  school: string;
  className: string;
  date: string;
  fromTeacher: string | null;
  toTeacher: string;
  previousUnavailable: boolean;
};
type AssignmentAction = {
  id: string;
  createdAt: string;
  kind: 'single' | 'bulk';
  changes: AssignmentChange[];
  undone: boolean;
};

const REVIEWED_KEY = 'moeReviewedConflicts';
const HISTORY_KEY = 'moeAssignmentHistory';
const minutes = (time: string) => {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const niceDate = (date: string) =>
  new Intl.DateTimeFormat('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${date}T00:00:00`),
  );
const timeRange = (lesson: LessonRow) => `${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`;
const clashes = (a: LessonRow, b: LessonRow) =>
  a.lesson_date === b.lesson_date &&
  minutes(a.start_time) < minutes(b.end_time) &&
  minutes(a.end_time) > minutes(b.start_time);
const weekdayFor = (date: string) => new Date(`${date}T00:00:00`).getDay();

export default function ConflictCenterPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [history, setHistory] = useState<AssignmentAction[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Checking the calendar...');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTeacher, setBulkTeacher] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const saveHistory = (next: AssignmentAction[]) => {
    const limited = next.slice(0, 30);
    setHistory(limited);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(limited));
  };

  const load = async () => {
    setLoading(true);
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

    const [lessonResult, teacherResult, availabilityResult] = await Promise.all([
      supabase.from('lessons').select('*').order('lesson_date').order('start_time'),
      supabase.from('teachers').select('name,color').order('name'),
      supabase.from('teacher_availability').select('*'),
    ]);

    if (lessonResult.error) setMessage(`Could not check conflicts: ${lessonResult.error.message}`);
    else {
      setLessons((lessonResult.data as LessonRow[]) ?? []);
      setMessage(`${lessonResult.data?.length ?? 0} lessons checked against teacher availability.`);
    }
    setTeachers((teacherResult.data as TeacherRow[]) ?? []);
    setAvailability(availabilityResult.error ? [] : ((availabilityResult.data as AvailabilityRow[]) ?? []));
    setSelectedIds([]);
    setBulkTeacher('');
    setLoading(false);
  };

  useEffect(() => {
    try {
      setReviewed(JSON.parse(localStorage.getItem(REVIEWED_KEY) || '[]'));
    } catch {
      setReviewed([]);
    }
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'));
    } catch {
      setHistory([]);
    }
    void load();
  }, []);

  const availabilityReason = (teacherName: string, lesson: LessonRow): string | null => {
    const records = availability.filter((record) => record.teacher_name === teacherName);
    const leave = records.find(
      (record) =>
        record.availability_type === 'leave' &&
        record.start_date &&
        record.end_date &&
        lesson.lesson_date >= record.start_date &&
        lesson.lesson_date <= record.end_date,
    );
    if (leave) return leave.reason ? `On leave: ${leave.reason}` : 'Teacher is on leave / unavailable on this date.';
    const weekly = records.filter((record) => record.availability_type === 'weekly');
    if (weekly.length === 0) return null;
    const match = weekly.some(
      (record) =>
        record.weekday === weekdayFor(lesson.lesson_date) &&
        record.start_time &&
        record.end_time &&
        lesson.start_time.slice(0, 5) >= record.start_time.slice(0, 5) &&
        lesson.end_time.slice(0, 5) <= record.end_time.slice(0, 5),
    );
    return match ? null : 'Lesson falls outside the teacher’s weekly availability.';
  };

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
        const first = ordered[i];
        const second = ordered[i + 1];
        const gap = minutes(second.start_time) - minutes(first.end_time);
        const [teacher, date] = groupKey.split('|');
        if (gap < 0) result.push({ key: `${first.id}-${second.id}-overlap`, type: 'overlap', teacher, date, first, second });
        else if (gap < 30 && first.school.trim().toLowerCase() !== second.school.trim().toLowerCase())
          result.push({ key: `${first.id}-${second.id}-tight`, type: 'tight', teacher, date, first, second, gap });
      }
    }
    return result;
  }, [lessons]);

  const availabilityIssues: AvailabilityIssue[] = lessons
    .filter((lesson) => lesson.teacher_name)
    .map((lesson) => ({ lesson, reason: availabilityReason(lesson.teacher_name!, lesson) }))
    .filter((item): item is AvailabilityIssue => Boolean(item.reason));
  const activeConflicts = conflicts.filter((conflict) => !reviewed.includes(conflict.key));
  const overlaps = activeConflicts.filter((conflict) => conflict.type === 'overlap');
  const tight = activeConflicts.filter((conflict) => conflict.type === 'tight');
  const reviewedCount = conflicts.length - activeConflicts.length;
  const unassigned = lessons.filter((lesson) => !lesson.teacher_name);
  const manuallyUnavailable = lessons.filter((lesson) => lesson.unavailable);
  const issueCount = overlaps.length + tight.length + unassigned.length + manuallyUnavailable.length + availabilityIssues.length;

  const rankedTeachers = (lesson: LessonRow): RankedTeacher[] => {
    const workloads = new Map<string, number>();
    teachers.forEach((teacher) => workloads.set(teacher.name, lessons.filter((item) => item.teacher_name === teacher.name).length));
    const maxLoad = Math.max(1, ...Array.from(workloads.values()));
    return teachers
      .flatMap((teacher) => {
        const teacherLessons = lessons.filter((other) => other.id !== lesson.id && other.teacher_name === teacher.name);
        if (teacherLessons.some((other) => clashes(lesson, other)) || availabilityReason(teacher.name, lesson)) return [];
        let score = 70;
        const reasons = ['Free at this lesson time', 'Within availability'];
        const sameSchoolDay = teacherLessons.some(
          (other) =>
            other.lesson_date === lesson.lesson_date &&
            other.school.trim().toLowerCase() === lesson.school.trim().toLowerCase(),
        );
        const adjacentSameSchool = teacherLessons.some(
          (other) =>
            other.lesson_date === lesson.lesson_date &&
            other.school.trim().toLowerCase() === lesson.school.trim().toLowerCase() &&
            (Math.abs(minutes(other.end_time) - minutes(lesson.start_time)) <= 90 ||
              Math.abs(minutes(lesson.end_time) - minutes(other.start_time)) <= 90),
        );
        if (sameSchoolDay) {
          score += 12;
          reasons.push('Already at the same school that day');
        }
        if (adjacentSameSchool) {
          score += 8;
          reasons.push('Nearby lesson at the same school');
        }
        const load = workloads.get(teacher.name) ?? 0;
        const balance = Math.round((1 - load / maxLoad) * 10);
        score += balance;
        if (balance >= 6) reasons.push('Lower current workload');
        if (teacherLessons.filter((other) => other.lesson_date === lesson.lesson_date).length === 0) {
          score += 5;
          reasons.push('No other lessons that day');
        }
        return [{ ...teacher, score: Math.min(99, score), reasons }];
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  };

  const selectedLessons = lessons.filter((lesson) => selectedIds.includes(lesson.id));
  const bulkChoices = teachers.filter(
    (teacher) =>
      selectedLessons.length > 0 &&
      selectedLessons.every(
        (lesson) =>
          !availabilityReason(teacher.name, lesson) &&
          !lessons.some(
            (other) => !selectedIds.includes(other.id) && other.teacher_name === teacher.name && clashes(lesson, other),
          ),
      ) &&
      !selectedLessons.some((lesson, index) => selectedLessons.slice(index + 1).some((other) => clashes(lesson, other))),
  );

  useEffect(() => {
    if (!bulkChoices.some((teacher) => teacher.name === bulkTeacher)) setBulkTeacher(bulkChoices[0]?.name ?? '');
  }, [selectedIds.join('|'), bulkChoices.map((teacher) => teacher.name).join('|')]);

  const recordAction = (kind: 'single' | 'bulk', changes: AssignmentChange[]) => {
    const action: AssignmentAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      kind,
      changes,
      undone: false,
    };
    saveHistory([action, ...history]);
  };

  const reassign = async (lesson: LessonRow, teacherName: string) => {
    if (!teacherName || teacherName === lesson.teacher_name) return;
    setMessage(`Assigning ${teacherName}...`);
    const { error } = await supabase
      .from('lessons')
      .update({ teacher_name: teacherName, unavailable: false })
      .eq('id', lesson.id);
    if (error) {
      setMessage(`Could not reassign: ${error.message}`);
      return;
    }
    recordAction('single', [
      {
        lessonId: lesson.id,
        school: lesson.school,
        className: lesson.class_name,
        date: lesson.lesson_date,
        fromTeacher: lesson.teacher_name,
        toTeacher: teacherName,
        previousUnavailable: lesson.unavailable,
      },
    ]);
    setLessons((current) =>
      current.map((item) => (item.id === lesson.id ? { ...item, teacher_name: teacherName, unavailable: false } : item)),
    );
    setSelectedIds((current) => current.filter((id) => id !== lesson.id));
    setMessage(`${lesson.class_name} reassigned to ${teacherName}. You can undo this change.`);
  };

  const bulkAssign = async () => {
    if (!bulkTeacher || selectedIds.length === 0) return;
    const affected = lessons.filter((lesson) => selectedIds.includes(lesson.id));
    setBulkSaving(true);
    setMessage(`Assigning ${affected.length} lessons to ${bulkTeacher}...`);
    const { error } = await supabase
      .from('lessons')
      .update({ teacher_name: bulkTeacher, unavailable: false })
      .in('id', selectedIds);
    if (error) setMessage(`Bulk assignment failed: ${error.message}`);
    else {
      recordAction(
        'bulk',
        affected.map((lesson) => ({
          lessonId: lesson.id,
          school: lesson.school,
          className: lesson.class_name,
          date: lesson.lesson_date,
          fromTeacher: lesson.teacher_name,
          toTeacher: bulkTeacher,
          previousUnavailable: lesson.unavailable,
        })),
      );
      setLessons((current) =>
        current.map((item) => (selectedIds.includes(item.id) ? { ...item, teacher_name: bulkTeacher, unavailable: false } : item)),
      );
      setMessage(`${affected.length} lessons assigned to ${bulkTeacher}. You can undo this bulk change.`);
      setSelectedIds([]);
      setBulkTeacher('');
    }
    setBulkSaving(false);
  };

  const undoAction = async (action: AssignmentAction) => {
    if (action.undone || undoing) return;
    setUndoing(true);
    setMessage(`Undoing ${action.changes.length} assignment${action.changes.length === 1 ? '' : 's'}...`);
    const results = await Promise.all(
      action.changes.map((change) =>
        supabase
          .from('lessons')
          .update({ teacher_name: change.fromTeacher, unavailable: change.previousUnavailable })
          .eq('id', change.lessonId),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) setMessage(`Undo failed: ${failed.error.message}`);
    else {
      setLessons((current) =>
        current.map((lesson) => {
          const change = action.changes.find((item) => item.lessonId === lesson.id);
          return change
            ? { ...lesson, teacher_name: change.fromTeacher, unavailable: change.previousUnavailable }
            : lesson;
        }),
      );
      saveHistory(history.map((item) => (item.id === action.id ? { ...item, undone: true } : item)));
      setMessage(`${action.changes.length} assignment${action.changes.length === 1 ? '' : 's'} restored.`);
    }
    setUndoing(false);
  };

  const latestUndoable = history.find((action) => !action.undone);
  const toggleSelected = (id: string) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const selectAllAvailability = () => setSelectedIds(availabilityIssues.map((item) => item.lesson.id));
  const markReviewed = (key: string) => {
    const next = reviewed.includes(key) ? reviewed : [...reviewed, key];
    setReviewed(next);
    localStorage.setItem(REVIEWED_KEY, JSON.stringify(next));
    setMessage('Conflict marked as reviewed and removed from active issues.');
  };

  return (
    <main className="conflictShell">
      <header className="header">
        <div>
          <Link href="/" className="back"><ArrowLeft size={17}/> Back to calendar</Link>
          <p>ADMIN CONTROL PANEL</p>
          <h1>Conflict Center</h1>
          <span>Smart replacements, bulk reassignment, undo and assignment history in one place.</span>
        </div>
        <div className="headerActions">
          <button onClick={() => setHistoryOpen((open) => !open)}><History size={17}/> History</button>
          {latestUndoable && <button className="undoButton" disabled={undoing} onClick={() => void undoAction(latestUndoable)}>{undoing ? <Loader2 className="spin" size={17}/> : <RotateCcw size={17}/>} Undo last</button>}
          <button onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="spin" size={17}/> : <CheckCircle2 size={17}/>} Recheck</button>
        </div>
      </header>

      {latestUndoable && (
        <section className="undoBanner">
          <div>
            <strong>{latestUndoable.kind === 'bulk' ? 'Bulk assignment completed' : 'Assignment completed'}</strong>
            <span>{latestUndoable.changes.length} lesson{latestUndoable.changes.length === 1 ? '' : 's'} changed to {latestUndoable.changes[0]?.toTeacher}.</span>
          </div>
          <button disabled={undoing} onClick={() => void undoAction(latestUndoable)}><RotateCcw size={16}/> Undo</button>
        </section>
      )}

      {historyOpen && (
        <section className="historyPanel">
          <div className="historyHeading"><div><p>ASSIGNMENT LOG</p><h2>Recent changes</h2></div><button onClick={() => setHistoryOpen(false)}>Close</button></div>
          {history.length === 0 ? <div className="emptyHistory">No assignments recorded yet.</div> : history.map((action) => (
            <article key={action.id} className={action.undone ? 'undone' : ''}>
              <div>
                <strong>{action.kind === 'bulk' ? `Bulk assignment · ${action.changes.length} lessons` : action.changes[0]?.className}</strong>
                <span>{new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(action.createdAt))}</span>
                <small>{action.changes[0]?.fromTeacher ?? 'Unassigned'} → {action.changes[0]?.toTeacher}{action.changes.length > 1 ? ` · ${action.changes.length} lessons` : ` · ${action.changes[0]?.school}`}</small>
              </div>
              {action.undone ? <em>UNDONE</em> : <button disabled={undoing} onClick={() => void undoAction(action)}><RotateCcw size={14}/> Undo</button>}
            </article>
          ))}
        </section>
      )}

      <section className="stats">
        <article className={issueCount ? 'danger' : 'good'}><span>Total issues</span><strong>{issueCount}</strong><small>{message}</small></article>
        <article><span>Overlaps</span><strong>{overlaps.length}</strong><small>Same teacher, same time</small></article>
        <article><span>Tight travel</span><strong>{tight.length}</strong><small>Under 30 min, different schools</small></article>
        <article><span>Availability</span><strong>{availabilityIssues.length}</strong><small>Leave or outside weekly hours</small></article>
        <article><span>Needs assignment</span><strong>{unassigned.length}</strong><small>{reviewedCount ? `${reviewedCount} reviewed hidden` : 'No teacher linked'}</small></article>
      </section>

      {selectedIds.length > 0 && (
        <section className="bulkBar">
          <div><strong>{selectedIds.length} lesson{selectedIds.length === 1 ? '' : 's'} selected</strong><span>Choose one teacher for all selected lessons.</span></div>
          <select value={bulkTeacher} onChange={(event) => setBulkTeacher(event.target.value)}><option value="">{bulkChoices.length ? 'Choose teacher…' : 'No teacher can cover all'}</option>{bulkChoices.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}</select>
          <button disabled={!bulkTeacher || bulkSaving} onClick={() => void bulkAssign()}>{bulkSaving ? <Loader2 className="spin" size={16}/> : null} Assign {selectedIds.length}</button>
          <button className="clear" onClick={() => setSelectedIds([])}>Clear</button>
        </section>
      )}

      {!loading && issueCount === 0 && <section className="allClear"><CheckCircle2 size={34}/><h2>No active conflicts found</h2><p>The timetable follows all current availability rules.</p></section>}
      {availabilityIssues.length > 0 && <IssueSection title="Teacher availability conflicts" subtitle="Select several lessons and reassign them together." icon={<CalendarOff size={20}/>} action={<button className="sectionAction" onClick={selectAllAvailability}>Select all {availabilityIssues.length}</button>} items={availabilityIssues.map(({ lesson, reason }) => <LessonCard key={`availability-${lesson.id}`} lesson={lesson} choices={rankedTeachers(lesson)} onReassign={reassign} warning={reason} selectable selected={selectedIds.includes(lesson.id)} onToggle={() => toggleSelected(lesson.id)}/>)} />}
      {overlaps.length > 0 && <IssueSection title="Overlapping lessons" subtitle="Use the ranked recommendation for either lesson, or mark the clash reviewed." icon={<AlertTriangle size={20}/>} items={overlaps.map((item) => <ConflictCard key={item.key} conflict={item} rankedTeachers={rankedTeachers} onReassign={reassign} onReview={() => markReviewed(item.key)}/>)} />}
      {tight.length > 0 && <IssueSection title="Tight travel gaps" subtitle="Different schools with less than 30 minutes between lessons." icon={<MapPin size={20}/>} items={tight.map((item) => <ConflictCard key={item.key} conflict={item} rankedTeachers={rankedTeachers} onReassign={reassign} onReview={() => markReviewed(item.key)}/>)} />}
      {manuallyUnavailable.length > 0 && <IssueSection title="Teacher marked unavailable" subtitle="Smart suggestions exclude unavailable teachers." icon={<UserRoundX size={20}/>} items={manuallyUnavailable.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} choices={rankedTeachers(lesson)} onReassign={reassign}/>)} />}
      {unassigned.length > 0 && <IssueSection title="Unassigned lessons" subtitle="Assign the top recommendation or choose another ranked teacher." icon={<CalendarDays size={20}/>} items={unassigned.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} choices={rankedTeachers(lesson)} onReassign={reassign}/>)} />}

      <style jsx>{`
        .conflictShell{min-height:100vh;padding:34px;max-width:1500px;margin:auto;color:#eef2fb}.header{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.header p,.historyHeading p{margin:16px 0 7px;color:#8978ff;font-size:11px;font-weight:900;letter-spacing:.16em}.header h1{margin:0 0 7px;font-size:34px}.header span{color:#8995ad}.back{display:flex;align-items:center;gap:7px;color:#aa9cff}.headerActions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}.header button,.bulkBar button,.undoBanner button,.historyPanel button{display:flex;align-items:center;gap:8px;padding:11px 15px;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:#111a2d;color:#d4dced;font-weight:750}.header .undoButton,.undoBanner button{background:#6653de;color:white}.undoBanner{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:14px 16px;margin-bottom:14px;border:1px solid rgba(139,124,255,.3);border-radius:15px;background:rgba(102,83,222,.1)}.undoBanner div{display:grid;gap:3px}.undoBanner span{color:#9ca8bd;font-size:13px}.historyPanel{margin-bottom:16px;padding:18px;border:1px solid rgba(148,163,184,.14);border-radius:18px;background:#0d1425}.historyHeading{display:flex;justify-content:space-between;align-items:start;margin-bottom:8px}.historyHeading p{margin:0 0 4px}.historyHeading h2{margin:0}.historyPanel article{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid rgba(148,163,184,.1)}.historyPanel article>div{display:grid;gap:3px}.historyPanel article span,.historyPanel article small{color:#8995ad}.historyPanel article.undone{opacity:.55}.historyPanel em{color:#63d995;font-size:11px;font-style:normal;font-weight:850}.emptyHistory{padding:28px 0;color:#8995ad;text-align:center}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:18px}.stats article,.allClear{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.94),rgba(10,15,29,.92));border-radius:18px}.stats article{padding:18px;display:grid;gap:7px}.stats span,.stats small{color:#8491a9}.stats strong{font-size:28px}.stats .danger strong{color:#fb7185}.stats .good strong{color:#63d995}.bulkBar{position:sticky;top:12px;z-index:20;display:grid;grid-template-columns:1fr 230px auto auto;align-items:center;gap:10px;padding:14px 16px;margin-bottom:16px;border:1px solid rgba(139,124,255,.35);border-radius:15px;background:rgba(13,20,37,.96);box-shadow:0 18px 45px rgba(0,0,0,.3);backdrop-filter:blur(16px)}.bulkBar div{display:grid;gap:3px}.bulkBar span{color:#8995ad;font-size:12px}.bulkBar select{padding:11px;border-radius:10px;border:1px solid rgba(148,163,184,.16);background:#111a2d;color:#eef2fb}.bulkBar button:not(.clear){background:#6653de;color:white}.bulkBar button:disabled{opacity:.45}.allClear{text-align:center;padding:50px;color:#63d995}.allClear h2{color:#eef2fb;margin:12px 0 5px}.allClear p{color:#8491a9}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1100px){.stats{grid-template-columns:repeat(2,1fr)}.bulkBar{grid-template-columns:1fr 1fr}.header{align-items:start}}@media(max-width:700px){.conflictShell{padding:20px}.header{display:grid}.headerActions{justify-content:flex-start}.stats,.bulkBar{grid-template-columns:1fr}.undoBanner{align-items:flex-start;flex-direction:column}.historyPanel article{align-items:flex-start;flex-direction:column}}
      `}</style>
    </main>
  );
}

function IssueSection({ title, subtitle, icon, action, items }: { title: string; subtitle: string; icon: React.ReactNode; action?: React.ReactNode; items: React.ReactNode[] }) {
  return <section className="section"><div className="sectionHeader">{icon}<div><h2>{title}</h2><p>{subtitle}</p></div>{action && <div className="action">{action}</div>}</div><div className="issueList">{items}</div><style jsx>{`.section{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.94),rgba(10,15,29,.92));border-radius:18px;margin-top:16px;overflow:hidden}.sectionHeader{padding:18px 20px;border-bottom:1px solid rgba(148,163,184,.1);display:flex;align-items:center;gap:12px}.sectionHeader h2{font-size:18px;margin:0 0 3px}.sectionHeader p{margin:0;color:#8491a9;font-size:13px}.action{margin-left:auto}.issueList{display:grid;gap:10px;padding:14px}:global(.sectionAction){padding:9px 12px;border-radius:9px;border:1px solid rgba(139,124,255,.25);background:rgba(102,83,222,.12);color:#b8afff;font-weight:800}`}</style></section>;
}

function SmartAssignment({ lesson, choices, onReassign }: { lesson: LessonRow; choices: RankedTeacher[]; onReassign: (lesson: LessonRow, teacherName: string) => void }) {
  const [choice, setChoice] = useState(choices[0]?.name ?? '');
  const best = choices[0];
  useEffect(() => setChoice(choices[0]?.name ?? ''), [lesson.id, choices.map((item) => item.name).join('|')]);
  return <div className="smart"><div className="best">{best ? <><div className="bestTop"><span><Sparkles size={14}/> Best match</span><b>{best.score}%</b></div><strong>{best.name}</strong><small>{best.reasons.slice(0,2).join(' · ')}</small></> : <span>No available teacher</span>}</div><div className="assign"><select value={choice} onChange={(event) => setChoice(event.target.value)}><option value="">{choices.length ? 'Choose teacher…' : 'No available teacher'}</option>{choices.map((teacher) => <option key={teacher.name} value={teacher.name}>{teacher.name} — {teacher.score}%</option>)}</select><button disabled={!choice} onClick={() => onReassign(lesson, choice)}>Assign</button></div><style jsx>{`.smart{display:grid;gap:8px;min-width:260px}.best{display:grid;gap:3px;padding:9px 11px;border-radius:10px;background:rgba(99,217,149,.08);border:1px solid rgba(99,217,149,.18)}.bestTop{display:flex;justify-content:space-between;align-items:center}.bestTop span{display:flex;align-items:center;gap:5px;color:#63d995;font-size:10px;font-weight:850;text-transform:uppercase}.bestTop b{color:#63d995}.best small{color:#8995ad}.assign{display:flex;gap:8px}.assign select{min-width:180px;flex:1;padding:9px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.16);background:#111a2d;color:#dce4f3}.assign button{padding:9px 12px;border:0;border-radius:9px;background:#6653de;color:white;font-weight:750}.assign button:disabled{opacity:.45}@media(max-width:850px){.smart{min-width:0}.assign{align-items:stretch}}`}</style></div>;
}

function ConflictCard({ conflict, rankedTeachers, onReassign, onReview }: { conflict: Conflict; rankedTeachers: (lesson: LessonRow) => RankedTeacher[]; onReassign: (lesson: LessonRow, teacherName: string) => void; onReview: () => void }) {
  return <article className={`issueCard ${conflict.type}`}><div className="badge">{conflict.type === 'overlap' ? 'OVERLAP' : `${conflict.gap} MIN GAP`}</div><div className="meta"><strong>{conflict.teacher}</strong><span>{niceDate(conflict.date)}</span><button onClick={onReview}>Mark reviewed</button></div><div className="lesson"><b>{timeRange(conflict.first)}</b><span>{conflict.first.school}</span><small>{conflict.first.class_name}</small><SmartAssignment lesson={conflict.first} choices={rankedTeachers(conflict.first)} onReassign={onReassign}/></div><div className="arrow">→</div><div className="lesson"><b>{timeRange(conflict.second)}</b><span>{conflict.second.school}</span><small>{conflict.second.class_name}</small><SmartAssignment lesson={conflict.second} choices={rankedTeachers(conflict.second)} onReassign={onReassign}/></div><style jsx>{`.issueCard{display:grid;grid-template-columns:auto 145px 1fr auto 1fr;gap:14px;align-items:center;padding:14px;border-radius:13px;background:#0b1222;border:1px solid rgba(148,163,184,.1)}.issueCard.overlap{border-color:rgba(251,113,133,.35)}.issueCard.tight{border-color:rgba(245,185,76,.3)}.badge{font-size:10px;font-weight:900;letter-spacing:.08em;color:#fb7185}.tight .badge{color:#f5b94c}.issueCard div{display:grid;gap:5px}.issueCard span,.issueCard small{color:#8995ad}.lesson b{color:#eef2fb}.arrow{color:#68758d}.meta button{width:max-content;border:0;background:transparent;color:#9a8cff;padding:3px 0;font-weight:700}@media(max-width:1000px){.issueCard{grid-template-columns:1fr}.arrow{display:none}}`}</style></article>;
}

function LessonCard({ lesson, choices, onReassign, warning, selectable, selected, onToggle }: { lesson: LessonRow; choices: RankedTeacher[]; onReassign: (lesson: LessonRow, teacherName: string) => void; warning?: string; selectable?: boolean; selected?: boolean; onToggle?: () => void }) {
  return <article className={`lessonCard ${selected ? 'selected' : ''}`}>{selectable && <input type="checkbox" checked={Boolean(selected)} onChange={onToggle} aria-label="Select lesson"/>}<Clock3 size={18}/><div><strong>{lesson.teacher_name ?? 'Unassigned'} · {niceDate(lesson.lesson_date)}</strong><span>{timeRange(lesson)} · {lesson.school}</span><small>{lesson.class_name}</small>{warning && <em>{warning}</em>}</div><SmartAssignment lesson={lesson} choices={choices} onReassign={onReassign}/><Link href="/admin/calendar">Open calendar</Link><style jsx>{`.lessonCard{display:flex;align-items:center;gap:12px;padding:14px;border-radius:13px;background:#0b1222;border:1px solid rgba(148,163,184,.1)}.lessonCard.selected{border-color:#766bf6;background:rgba(102,83,222,.1)}.lessonCard>input{width:18px;height:18px;accent-color:#766bf6}.lessonCard>div{display:grid;gap:3px;flex:1}.lessonCard span,.lessonCard small{color:#8995ad}.lessonCard em{margin-top:4px;color:#fb7185;font-size:11px;font-style:normal;font-weight:750}.lessonCard a{color:#9a8cff;font-weight:750;text-decoration:none}@media(max-width:1000px){.lessonCard{align-items:stretch;flex-direction:column}.lessonCard>input{align-self:flex-start}}`}</style></article>;
}
