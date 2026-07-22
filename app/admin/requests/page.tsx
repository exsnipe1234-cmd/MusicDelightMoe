'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, Loader2, RefreshCw, UserRound, XCircle } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'replacement_assigned' | 'cancelled';
type AffectedLesson = {
  id?: string;
  lesson_date?: string;
  date?: string;
  school?: string;
  class_name?: string;
  className?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
};
type RequestRow = {
  id: string;
  teacher_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  remarks: string | null;
  affected_lessons: AffectedLesson[];
  status: RequestStatus;
  admin_note: string | null;
  replacement_summary: string | null;
  created_at: string;
};

const statusLabels: Record<RequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  replacement_assigned: 'Replacement assigned',
  cancelled: 'Cancelled',
};

const prettyDate = (value: string) => new Intl.DateTimeFormat('en-SG', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(`${value}T12:00:00`));

const lessonDate = (lesson: AffectedLesson) => lesson.lesson_date ?? lesson.date ?? '';
const lessonStart = (lesson: AffectedLesson) => (lesson.start_time ?? lesson.startTime ?? '').slice(0, 5);
const lessonEnd = (lesson: AffectedLesson) => (lesson.end_time ?? lesson.endTime ?? '').slice(0, 5);
const lessonClass = (lesson: AffectedLesson) => lesson.class_name ?? lesson.className ?? 'MOE programme';

export default function AdminRequestsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('Loading requests…');
  const [filter, setFilter] = useState<'all' | RequestStatus>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadRequests = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', user.id).single();
    if (profile?.role !== 'admin' || !profile.active) {
      setMessage('Administrator access is required.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('teacher_unavailability_requests')
      .select('id,teacher_name,start_date,end_date,reason,remarks,affected_lessons,status,admin_note,replacement_summary,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message.includes('teacher_unavailability_requests')
        ? 'The request table is not available yet. Run the Supabase migration first.'
        : `Could not load requests: ${error.message}`);
      setRequests([]);
    } else {
      const rows = (data ?? []) as RequestRow[];
      setRequests(rows);
      setNotes(Object.fromEntries(rows.map((request) => [request.id, request.admin_note ?? ''])));
      setMessage(`${rows.filter((request) => request.status === 'pending').length} pending request${rows.filter((request) => request.status === 'pending').length === 1 ? '' : 's'}.`);
    }
    setLoading(false);
  };

  useEffect(() => { void loadRequests(); }, []);

  const updateStatus = async (request: RequestRow, status: RequestStatus) => {
    setSavingId(request.id);
    setMessage(`Updating ${request.teacher_name}'s request…`);
    const { error } = await supabase.from('teacher_unavailability_requests').update({
      status,
      admin_note: notes[request.id]?.trim() || null,
    }).eq('id', request.id);

    if (error) {
      setMessage(`Could not update request: ${error.message}`);
    } else {
      setRequests((current) => current.map((item) => item.id === request.id ? {
        ...item, status, admin_note: notes[request.id]?.trim() || null,
      } : item));
      setMessage(`${request.teacher_name}'s request is now ${statusLabels[status].toLowerCase()}.`);
    }
    setSavingId(null);
  };

  const visibleRequests = requests.filter((request) => filter === 'all' || request.status === filter);
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const affectedCount = requests.filter((request) => request.status === 'pending').reduce((sum, request) => sum + (request.affected_lessons?.length ?? 0), 0);
  const teacherCount = new Set(requests.filter((request) => request.status === 'pending').map((request) => request.teacher_name)).size;

  return (
    <main className="requestShell">
      <header className="requestHeader">
        <div>
          <Link href="/admin/calendar" className="backLink"><ArrowLeft size={17}/> Back to calendar</Link>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Unable to Attend</h1>
          <span>Review teacher requests and start arranging replacement coverage.</span>
        </div>
        <button className="refreshButton" onClick={() => void loadRequests()} disabled={loading}><RefreshCw size={17}/> Refresh</button>
      </header>

      <section className="summaryGrid">
        <article><AlertCircle size={21}/><span>Pending requests</span><strong>{pendingCount}</strong></article>
        <article><CalendarDays size={21}/><span>Affected lessons</span><strong>{affectedCount}</strong></article>
        <article><UserRound size={21}/><span>Teachers affected</span><strong>{teacherCount}</strong></article>
      </section>

      <div className={`statusMessage ${message.toLowerCase().includes('could not') || message.toLowerCase().includes('required') || message.toLowerCase().includes('not available') ? 'error' : ''}`}>
        {loading ? <Loader2 className="spin" size={18}/> : <CheckCircle2 size={18}/>} {message}
      </div>

      <section className="toolbar">
        {(['pending', 'approved', 'replacement_assigned', 'rejected', 'cancelled', 'all'] as const).map((value) => (
          <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
            {value === 'all' ? 'All' : statusLabels[value]}
            {value === 'pending' && pendingCount > 0 ? <b>{pendingCount}</b> : null}
          </button>
        ))}
      </section>

      <section className="requestList">
        {visibleRequests.map((request) => (
          <article className="requestCard" key={request.id}>
            <div className="requestTop">
              <div className="identity"><div className="avatar">{request.teacher_name.slice(0, 2).toUpperCase()}</div><div><h2>{request.teacher_name}</h2><span>Submitted {new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(request.created_at))}</span></div></div>
              <span className={`statusPill ${request.status}`}>{statusLabels[request.status]}</span>
            </div>

            <div className="requestInfo">
              <div><span>Dates</span><strong>{prettyDate(request.start_date)}{request.end_date !== request.start_date ? ` – ${prettyDate(request.end_date)}` : ''}</strong></div>
              <div><span>Reason</span><strong>{request.reason}</strong></div>
              <div><span>Affected</span><strong>{request.affected_lessons?.length ?? 0} lesson{request.affected_lessons?.length === 1 ? '' : 's'}</strong></div>
            </div>

            {request.remarks && <div className="remarks"><span>Teacher remarks</span><p>{request.remarks}</p></div>}

            <div className="lessonList">
              <p className="eyebrow">AFFECTED LESSONS</p>
              {(request.affected_lessons ?? []).map((lesson, index) => (
                <div className="lessonRow" key={lesson.id ?? `${request.id}-${index}`}>
                  <div className="dateBox"><CalendarDays size={15}/><strong>{lessonDate(lesson) ? prettyDate(lessonDate(lesson)) : 'Date unavailable'}</strong></div>
                  <div><strong>{lesson.school ?? 'School unavailable'}</strong><span>{lessonClass(lesson)}</span></div>
                  <div className="time"><Clock3 size={14}/>{lessonStart(lesson) || '--:--'}{lessonEnd(lesson) ? `–${lessonEnd(lesson)}` : ''}</div>
                </div>
              ))}
              {!request.affected_lessons?.length && <div className="emptyLessons">No lesson snapshot was saved with this request.</div>}
            </div>

            <label className="noteField">Admin note<textarea value={notes[request.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Optional note for the teacher"/></label>

            <div className="actions">
              <Link href={`/admin/conflicts?teacher=${encodeURIComponent(request.teacher_name)}&from=${request.start_date}&to=${request.end_date}`} className="replacementButton">Find replacement</Link>
              {request.status === 'pending' && <>
                <button className="reject" onClick={() => void updateStatus(request, 'rejected')} disabled={savingId === request.id}><XCircle size={16}/> Reject</button>
                <button className="approve" onClick={() => void updateStatus(request, 'approved')} disabled={savingId === request.id}>{savingId === request.id ? <Loader2 className="spin" size={16}/> : <CheckCircle2 size={16}/>} Approve</button>
              </>}
              {request.status === 'approved' && <button className="assigned" onClick={() => void updateStatus(request, 'replacement_assigned')} disabled={savingId === request.id}><CheckCircle2 size={16}/> Mark replacement assigned</button>}
            </div>
          </article>
        ))}
        {!loading && !visibleRequests.length && <div className="emptyState"><CheckCircle2 size={36}/><strong>No requests in this section</strong><span>New teacher submissions will appear here automatically.</span></div>}
      </section>

      <style jsx>{`
        .requestShell{min-height:100vh;max-width:1320px;margin:auto;padding:34px;color:#eef2ff}.requestHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}.backLink{display:flex;align-items:center;gap:7px;color:#8997b0;text-decoration:none;margin-bottom:24px;width:max-content}.eyebrow{margin:0 0 6px;color:#8777ff;font-size:10px;font-weight:850;letter-spacing:.15em}.requestHeader h1{font-size:36px;margin:0 0 5px}.requestHeader span{color:#8390a8}.refreshButton{border:1px solid rgba(148,163,184,.12);background:#111a2e;color:#aeb9cd;border-radius:11px;padding:11px 15px;display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700}.summaryGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.summaryGrid article,.statusMessage,.requestCard,.emptyState{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.96),rgba(10,15,29,.93));border-radius:18px}.summaryGrid article{padding:18px;display:grid;grid-template-columns:auto 1fr;gap:7px 11px;align-items:center;color:#9182fa}.summaryGrid span{color:#8592aa;font-size:12px}.summaryGrid strong{grid-column:2;font-size:25px;color:#f5f7ff}.statusMessage{margin:14px 0;padding:12px 14px;display:flex;align-items:center;gap:9px;color:#70d28c}.statusMessage.error{color:#fb7185}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.toolbar button{border:1px solid rgba(148,163,184,.12);background:#0c1425;color:#8290a8;border-radius:999px;padding:9px 13px;cursor:pointer}.toolbar button.active{background:#5d49d1;color:white;border-color:#7665e8}.toolbar b{margin-left:7px;padding:2px 6px;border-radius:999px;background:#ef4444;color:white;font-size:10px}.requestList{display:grid;gap:14px}.requestCard{padding:21px}.requestTop{display:flex;align-items:center;justify-content:space-between;gap:16px}.identity{display:flex;align-items:center;gap:12px}.avatar{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#705ae5,#4e3bb8);font-weight:850}.identity h2{margin:0 0 4px;font-size:20px}.identity span{color:#77849b;font-size:11px}.statusPill{font-size:11px;font-weight:800;padding:7px 10px;border-radius:999px;background:#182238;color:#aeb9ca}.statusPill.pending{background:rgba(245,158,11,.12);color:#fbbf24}.statusPill.approved{background:rgba(56,189,248,.12);color:#7dd3fc}.statusPill.replacement_assigned{background:rgba(52,211,153,.12);color:#6ee7b7}.statusPill.rejected,.statusPill.cancelled{background:rgba(251,113,133,.1);color:#fb7185}.requestInfo{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:10px;margin:18px 0}.requestInfo>div{padding:12px;border:1px solid rgba(148,163,184,.09);border-radius:12px;background:#0a1120;display:grid;gap:4px}.requestInfo span,.remarks span{color:#748198;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.requestInfo strong{font-size:13px}.remarks{padding:13px;border-left:3px solid #7665e8;background:rgba(118,101,232,.07);border-radius:9px;margin-bottom:17px}.remarks p{margin:5px 0 0;color:#c4ccda}.lessonList{display:grid;gap:8px}.lessonRow{display:grid;grid-template-columns:210px 1fr auto;align-items:center;gap:14px;padding:12px;border:1px solid rgba(148,163,184,.09);border-radius:12px;background:#0a1120}.dateBox,.time{display:flex;align-items:center;gap:7px;color:#9d91f3}.lessonRow>div:nth-child(2){display:grid;gap:3px}.lessonRow span{color:#7d8ba2;font-size:12px}.time{color:#aeb8ca;font-size:12px}.emptyLessons{color:#7d8ba2;padding:12px}.noteField{display:grid;gap:7px;color:#8d9ab0;font-size:11px;font-weight:700;margin-top:15px}.noteField textarea{min-height:72px;resize:vertical;border:1px solid rgba(148,163,184,.12);background:#09101f;color:#eef2ff;border-radius:11px;padding:11px;outline:0}.actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:15px}.actions button,.replacementButton{border:0;border-radius:10px;padding:10px 13px;display:flex;align-items:center;gap:7px;text-decoration:none;cursor:pointer;font-weight:750}.replacementButton{background:#17213a;color:#aa9eff;border:1px solid rgba(129,112,242,.2)}.reject{background:rgba(251,113,133,.1);color:#fb7185}.approve,.assigned{background:linear-gradient(135deg,#715be8,#5140c6);color:white}.assigned{background:linear-gradient(135deg,#0e9f79,#08775d)}.emptyState{padding:48px;display:grid;place-items:center;gap:8px;color:#7f8ca3}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:760px){.requestShell{padding:20px}.requestHeader{align-items:flex-start;flex-direction:column}.summaryGrid,.requestInfo{grid-template-columns:1fr}.lessonRow{grid-template-columns:1fr}.actions{justify-content:stretch}.actions button,.replacementButton{justify-content:center;flex:1}}
      `}</style>
    </main>
  );
}
