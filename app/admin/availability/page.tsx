'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarOff, Clock3, Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

type Teacher = { name: string; color: string };
type Availability = {
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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TeacherAvailabilityPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<Availability[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Loading teacher availability...');
  const [mode, setMode] = useState<'weekly' | 'leave'>('weekly');
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [startDate, setStartDate] = useState('2026-07-21');
  const [endDate, setEndDate] = useState('2026-07-21');
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { router.replace('/login'); return; }
    const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', sessionData.session.user.id).single();
    if (!profile?.active || profile.role !== 'admin') { router.replace(profile?.role === 'teacher' ? '/teacher' : '/login'); return; }

    const [{ data: teacherData }, { data: availabilityData, error }] = await Promise.all([
      supabase.from('teachers').select('name,color').order('name'),
      supabase.from('teacher_availability').select('*').order('teacher_name').order('availability_type'),
    ]);

    const loadedTeachers = (teacherData as Teacher[]) ?? [];
    setTeachers(loadedTeachers);
    setSelectedTeacher((current) => current || loadedTeachers[0]?.name || '');
    if (error) {
      setMessage(error.message.includes('teacher_availability') ? 'Database setup required. Run supabase/teacher_availability.sql in the Supabase SQL Editor.' : error.message);
      setRecords([]);
    } else {
      setRecords((availabilityData as Availability[]) ?? []);
      setMessage(`${availabilityData?.length ?? 0} availability records loaded.`);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const selectedRecords = records.filter((item) => item.teacher_name === selectedTeacher);
  const weekly = selectedRecords.filter((item) => item.availability_type === 'weekly').sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  const leave = selectedRecords.filter((item) => item.availability_type === 'leave').sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  const selectedColour = teachers.find((teacher) => teacher.name === selectedTeacher)?.color ?? '#8b7cff';

  const addRecord = async () => {
    if (!selectedTeacher) return;
    if (mode === 'weekly' && startTime >= endTime) { setMessage('End time must be later than start time.'); return; }
    if (mode === 'leave' && startDate > endDate) { setMessage('End date must be the same as or later than start date.'); return; }
    setSaving(true);
    const payload = mode === 'weekly'
      ? { teacher_name: selectedTeacher, availability_type: 'weekly', weekday, start_time: startTime, end_time: endTime, start_date: null, end_date: null, reason: reason.trim() || null }
      : { teacher_name: selectedTeacher, availability_type: 'leave', weekday: null, start_time: null, end_time: null, start_date: startDate, end_date: endDate, reason: reason.trim() || null };
    const { data, error } = await supabase.from('teacher_availability').insert(payload).select().single();
    if (error) setMessage(`Could not save: ${error.message}`);
    else {
      setRecords((current) => [...current, data as Availability]);
      setReason('');
      setMessage(mode === 'weekly' ? 'Weekly availability added.' : 'Leave block added.');
    }
    setSaving(false);
  };

  const removeRecord = async (record: Availability) => {
    if (!window.confirm('Delete this availability record?')) return;
    const { error } = await supabase.from('teacher_availability').delete().eq('id', record.id);
    if (error) { setMessage(`Could not delete: ${error.message}`); return; }
    setRecords((current) => current.filter((item) => item.id !== record.id));
    setMessage('Availability record deleted.');
  };

  return (
    <main className="shell">
      <header className="header">
        <div><Link href="/" className="back"><ArrowLeft size={17}/> Back to dashboard</Link><p>ADMIN CONTROL PANEL</p><h1>Teacher Availability</h1><span>{message}</span></div>
        <Link href="/admin/conflicts" className="conflicts">Open Conflict Center</Link>
      </header>

      <section className="teacherStrip">
        {teachers.map((teacher) => <button key={teacher.name} className={selectedTeacher === teacher.name ? 'active' : ''} onClick={() => setSelectedTeacher(teacher.name)} style={{ '--teacher': teacher.color } as React.CSSProperties}><i/>{teacher.name}</button>)}
      </section>

      {loading ? <div className="loading"><Loader2 className="spin"/> Loading availability...</div> : <section className="grid">
        <div className="panel summary">
          <div className="teacherHeading"><i style={{ background: selectedColour }}/><div><p>SELECTED TEACHER</p><h2>{selectedTeacher || 'No teacher'}</h2></div></div>
          <div className="stats"><article><strong>{weekly.length}</strong><span>Weekly windows</span></article><article><strong>{leave.length}</strong><span>Leave blocks</span></article></div>
          <p className="help">Weekly windows represent when a teacher is normally available. Leave blocks override those windows for specific dates.</p>
        </div>

        <div className="panel formPanel">
          <div className="tabs"><button className={mode === 'weekly' ? 'active' : ''} onClick={() => setMode('weekly')}><Clock3 size={16}/> Weekly availability</button><button className={mode === 'leave' ? 'active' : ''} onClick={() => setMode('leave')}><CalendarOff size={16}/> Leave / unavailable</button></div>
          {mode === 'weekly' ? <div className="formGrid"><label>Day<select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Start<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)}/></label><label>End<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)}/></label></div> : <div className="formGrid dates"><label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)}/></label><label>End date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)}/></label></div>}
          <label>Reason / note<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={mode === 'weekly' ? 'Optional, e.g. regular MOE availability' : 'Optional, e.g. annual leave or reservist'}/></label>
          <button className="add" disabled={saving || !selectedTeacher} onClick={() => void addRecord()}>{saving ? <Loader2 className="spin" size={17}/> : <Plus size={17}/>} Add {mode === 'weekly' ? 'availability' : 'leave block'}</button>
        </div>

        <div className="panel records"><div className="sectionTitle"><Clock3 size={18}/><div><h2>Weekly availability</h2><p>Normal recurring windows</p></div></div>{weekly.length === 0 ? <div className="empty">No weekly availability added.</div> : weekly.map((record) => <Record key={record.id} record={record} label={`${DAYS[record.weekday ?? 0]} · ${record.start_time?.slice(0,5)}–${record.end_time?.slice(0,5)}`} onDelete={removeRecord}/>)}</div>
        <div className="panel records"><div className="sectionTitle"><CalendarOff size={18}/><div><h2>Leave & unavailable dates</h2><p>Specific date overrides</p></div></div>{leave.length === 0 ? <div className="empty">No leave blocks added.</div> : leave.map((record) => <Record key={record.id} record={record} label={`${record.start_date}${record.end_date !== record.start_date ? ` → ${record.end_date}` : ''}`} onDelete={removeRecord}/>)}</div>
      </section>}

      <style jsx>{`
        .shell{min-height:100vh;padding:32px;max-width:1450px;margin:auto;color:#eef2fb}.header{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:20px}.header p,.teacherHeading p{margin:15px 0 6px;color:#8b7cff;font-size:11px;font-weight:900;letter-spacing:.16em}.header h1{margin:0 0 7px;font-size:34px}.header span{color:#8995ad}.back{display:flex;align-items:center;gap:7px;color:#aa9cff}.conflicts{padding:11px 15px;border-radius:11px;background:#6653de;color:#fff;text-decoration:none;font-weight:800}.teacherStrip{display:flex;gap:9px;overflow:auto;padding:4px 0 14px}.teacherStrip button{display:flex;align-items:center;gap:8px;white-space:nowrap;padding:10px 13px;border-radius:999px;border:1px solid rgba(148,163,184,.14);background:#0d1425;color:#b9c3d5;cursor:pointer}.teacherStrip button.active{border-color:var(--teacher);color:#fff;background:#111a2d}.teacherStrip i{width:9px;height:9px;border-radius:50%;background:var(--teacher)}.grid{display:grid;grid-template-columns:1fr 1.45fr;gap:14px}.panel{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.94),rgba(10,15,29,.92));border-radius:18px;padding:19px}.teacherHeading{display:flex;align-items:center;gap:12px}.teacherHeading>i{width:18px;height:42px;border-radius:999px}.teacherHeading p{margin:0 0 4px}.teacherHeading h2{margin:0;font-size:23px}.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.stats article{display:grid;gap:4px;padding:14px;border-radius:13px;background:#0b1222}.stats strong{font-size:25px}.stats span,.help,.sectionTitle p,.empty,.record small{color:#8995ad}.help{line-height:1.55;margin:0}.tabs{display:flex;gap:8px;margin-bottom:16px}.tabs button{display:flex;align-items:center;gap:7px;padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.14);background:#0b1222;color:#9eabc0;cursor:pointer}.tabs button.active{background:#6653de;color:#fff}.formGrid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px}.formGrid.dates{grid-template-columns:1fr 1fr}.formPanel label{display:grid;gap:7px;margin-bottom:12px;color:#aeb8ca;font-size:13px;font-weight:700}.formPanel input,.formPanel select{padding:11px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.16);background:#111a2d;color:#eef2fb}.add{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;border:0;border-radius:11px;background:#6653de;color:white;font-weight:850;cursor:pointer}.add:disabled{opacity:.5}.sectionTitle{display:flex;align-items:center;gap:10px;margin-bottom:12px}.sectionTitle h2{font-size:18px;margin:0 0 3px}.sectionTitle p{font-size:12px;margin:0}.records{min-height:260px}.empty{padding:28px 0;text-align:center}.loading{display:flex;justify-content:center;align-items:center;gap:10px;min-height:380px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:900px){.grid{grid-template-columns:1fr}.header{align-items:start}}@media(max-width:620px){.shell{padding:18px}.header{display:grid}.formGrid,.formGrid.dates{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}

function Record({ record, label, onDelete }: { record: Availability; label: string; onDelete: (record: Availability) => void }) {
  return <article className="record"><div><strong>{label}</strong><small>{record.reason || 'No note added'}</small></div><button onClick={() => onDelete(record)} aria-label="Delete"><Trash2 size={16}/></button><style jsx>{`.record{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid rgba(148,163,184,.1)}.record div{display:grid;gap:4px}.record small{color:#8995ad}.record button{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:9px;background:rgba(251,113,133,.12);color:#fb7185;cursor:pointer}`}</style></article>;
}