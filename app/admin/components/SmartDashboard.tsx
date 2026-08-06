'use client';

import Link from 'next/link';
import { AlertTriangle, Building2, CalendarDays, Loader2, RefreshCw, Repeat2, Sparkles, UserRound, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Summary = {
  today: string;
  counts: { lessonsToday: number; teachersWorking: number; schoolsToday: number; conflictsToday: number; pendingRequests: number; openReplacements: number; unassignedTomorrow: number };
  unavailableTomorrow: string[];
  suggestions: string[];
  alertCounts: { unassigned:number;conflicts:number;requests:number;replacements:number };
  alerts: {
    unassigned:Array<{id:string;lesson_date:string;school:string;class_name:string;start_time:string}>;
    conflicts:Array<{teacher_name:string;lesson_date:string;first:string;second:string}>;
    requests:Array<{id:string;teacher_name:string;start_date:string;end_date:string;reason:string}>;
    replacements:Array<{id:string;original_teacher:string;lesson_date:string;school:string;class_name:string}>;
  };
};

export default function SmartDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/dashboard-summary', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load AI dashboard.');
      setData(body);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load dashboard.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section className="smartDashboard">
    <header><div><p><Sparkles size={14}/> CALENDAR AI OVERVIEW</p><h2>Today at a glance</h2><span>{data ? new Intl.DateTimeFormat('en-SG',{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${data.today}T12:00:00`)) : 'Live Supabase summary'}</span></div><button onClick={() => void load()} disabled={loading}>{loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Refresh</button></header>
    {error ? <div className="summaryError">{error}</div> : <>
      <div className="summaryCards">
        <article><CalendarDays/><span>Lessons today</span><strong>{data?.counts.lessonsToday ?? '—'}</strong></article>
        <article><Users/><span>Teachers working</span><strong>{data?.counts.teachersWorking ?? '—'}</strong></article>
        <article><Building2/><span>Schools today</span><strong>{data?.counts.schoolsToday ?? '—'}</strong></article>
        <Link href="/admin/conflicts"><AlertTriangle/><span>Conflicts today</span><strong>{data?.counts.conflictsToday ?? '—'}</strong></Link>
        <Link href="/admin/replacements"><Repeat2/><span>Open replacements</span><strong>{data?.counts.openReplacements ?? '—'}</strong></Link>
        <Link href="/admin/requests"><UserRound/><span>Pending requests</span><strong>{data?.counts.pendingRequests ?? '—'}</strong></Link>
      </div>
      <div className="alertGrid">
        <Link href="/admin/calendar?filter=unassigned"><b>Unassigned lessons <i>{data?.alertCounts.unassigned??0}</i></b>{data?.alerts.unassigned.length?data.alerts.unassigned.slice(0,3).map(item=><span key={item.id}>{item.lesson_date} · {item.school} · {item.start_time.slice(0,5)}</span>):<span>All upcoming lessons are assigned.</span>}</Link>
        <Link href="/admin/conflicts"><b>Schedule conflicts <i>{data?.alertCounts.conflicts??0}</i></b>{data?.alerts.conflicts.length?data.alerts.conflicts.slice(0,3).map((item,index)=><span key={`${item.teacher_name}-${item.lesson_date}-${index}`}>{item.lesson_date} · {item.teacher_name} · {item.first} / {item.second}</span>):<span>No upcoming overlaps detected.</span>}</Link>
        <Link href="/admin/requests"><b>Pending leave requests <i>{data?.alertCounts.requests??0}</i></b>{data?.alerts.requests.length?data.alerts.requests.slice(0,3).map(item=><span key={item.id}>{item.teacher_name} · {item.start_date} · {item.reason}</span>):<span>No requests awaiting review.</span>}</Link>
        <Link href="/admin/replacements"><b>Uncovered replacements <i>{data?.alertCounts.replacements??0}</i></b>{data?.alerts.replacements.length?data.alerts.replacements.slice(0,3).map(item=><span key={item.id}>{item.lesson_date} · {item.original_teacher} · {item.school}</span>):<span>All replacement tasks are covered.</span>}</Link>
      </div>
    </>}
    <style jsx>{`.smartDashboard{margin:0 0 16px;padding:17px;border:1px solid rgba(148,163,184,.14);border-radius:18px;background:linear-gradient(145deg,rgba(25,31,56,.96),rgba(10,15,29,.93));color:#eef2ff}.smartDashboard header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:14px}.smartDashboard p{margin:0 0 5px;display:flex;align-items:center;gap:6px;color:#8b7cff;font-size:10px;font-weight:900;letter-spacing:.14em}.smartDashboard h2{margin:0;font-size:21px}.smartDashboard header span{color:#7f8ca4;font-size:11px}.smartDashboard header button{display:flex;align-items:center;gap:7px;border:1px solid rgba(148,163,184,.14);border-radius:10px;background:#121b2f;color:#b9c3d5;padding:9px 11px;cursor:pointer}.summaryCards{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}.summaryCards article,.summaryCards :global(a){min-height:88px;padding:12px;border:1px solid rgba(148,163,184,.11);border-radius:13px;background:#0c1426;color:#8e80f5;text-decoration:none;display:grid;grid-template-columns:auto 1fr;gap:5px 8px;align-items:center}.summaryCards span{color:#8491a8;font-size:10px}.summaryCards strong{grid-column:2;color:#f7f8ff;font-size:23px}.alertGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:9px}.alertGrid :global(a){display:grid;align-content:start;gap:5px;min-height:105px;padding:12px;border:1px solid rgba(148,163,184,.11);border-radius:12px;background:rgba(8,14,27,.76);color:#8996ac;text-decoration:none;font-size:10px}.alertGrid :global(b){display:flex;justify-content:space-between;color:#dce4f2;font-size:11px}.alertGrid :global(i){padding:2px 6px;border-radius:999px;background:rgba(251,113,133,.15);color:#fda4af;font-style:normal}.summaryError{color:#fb7185}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1000px){.summaryCards{grid-template-columns:repeat(2,1fr)}.alertGrid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.alertGrid{grid-template-columns:1fr}}`}</style>
  </section>;
}
