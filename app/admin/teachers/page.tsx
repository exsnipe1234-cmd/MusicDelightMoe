'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Mail, Plus, RefreshCw, ShieldCheck, UserCog, Users } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  role: 'admin' | 'teacher';
  teacher_name: string | null;
  active: boolean;
};

type Teacher = { name: string; color: string };
type AccessRow = { profile_id: string; teacher_name: string };

type Draft = {
  display_name: string;
  role: 'admin' | 'teacher';
  teacher_name: string;
  teacher_names: string[];
  active: boolean;
};

const emptyTeacher = { name: '', color: '#70d28c' };

export default function TeacherManagementPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newTeacher, setNewTeacher] = useState(emptyTeacher);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('Checking administrator access…');

  const loadData = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: ownProfile } = await supabase.from('profiles').select('role,active').eq('id', user.id).single();
    if (ownProfile?.role !== 'admin' || !ownProfile.active) {
      setMessage('Administrator access is required.');
      setLoading(false);
      return;
    }

    const [
      { data: profileRows, error: profileError },
      { data: teacherRows, error: teacherError },
      { data: accessRows, error: accessError },
    ] = await Promise.all([
      supabase.from('profiles').select('id,email,display_name,role,teacher_name,active').order('display_name'),
      supabase.from('teachers').select('name,color').order('name'),
      supabase.from('profile_teacher_access').select('profile_id,teacher_name'),
    ]);

    if (profileError || teacherError || accessError) {
      setMessage(profileError?.message || teacherError?.message || accessError?.message || 'Could not load teacher management. Run the multi-timetable Supabase migration first.');
      setLoading(false);
      return;
    }

    const loadedProfiles = (profileRows ?? []) as Profile[];
    setProfiles(loadedProfiles);
    setTeachers((teacherRows ?? []) as Teacher[]);
    const loadedAccess = (accessRows ?? []) as AccessRow[];
    setDrafts(Object.fromEntries(loadedProfiles.map((profile) => {
      const linked = loadedAccess.filter((row) => row.profile_id === profile.id).map((row) => row.teacher_name);
      const teacherNames = Array.from(new Set([...(profile.teacher_name ? [profile.teacher_name] : []), ...linked]));
      return [profile.id, {
        display_name: profile.display_name,
        role: profile.role,
        teacher_name: profile.teacher_name ?? '',
        teacher_names: teacherNames,
        active: profile.active,
      }];
    })));
    setMessage(`${loadedProfiles.length} account${loadedProfiles.length === 1 ? '' : 's'} loaded.`);
    setLoading(false);
  };

  useEffect(() => { void loadData(); }, []);

  const saveProfile = async (profile: Profile) => {
    const draft = drafts[profile.id];
    if (!draft) return;
    if (draft.role === 'teacher' && !draft.teacher_name) {
      setMessage('Teacher accounts must have a primary timetable.');
      return;
    }
    const linkedTeacherNames = Array.from(new Set([
      ...(draft.teacher_name ? [draft.teacher_name] : []),
      ...draft.teacher_names,
    ]));
    setSavingId(profile.id);
    setMessage(`Saving ${draft.display_name || profile.email || 'account'}…`);
    const { error } = await supabase.from('profiles').update({
      display_name: draft.display_name.trim(),
      role: draft.role,
      teacher_name: draft.teacher_name || null,
      active: draft.active,
    }).eq('id', profile.id);
    if (error) {
      setMessage(`Could not save: ${error.message}`);
      setSavingId(null);
      return;
    }
    const { error: accessError } = await supabase.rpc('set_profile_teacher_access', {
      p_profile_id: profile.id,
      p_teacher_names: linkedTeacherNames,
    });
    if (accessError) {
      setMessage(`Profile saved, but timetable access could not be saved: ${accessError.message}`);
      setSavingId(null);
      return;
    }
    setDrafts((current) => ({ ...current, [profile.id]: { ...draft, teacher_names: linkedTeacherNames } }));
    setProfiles((current) => current.map((item) => item.id === profile.id ? {
      ...item,
      display_name: draft.display_name.trim(),
      role: draft.role,
      teacher_name: draft.teacher_name || null,
      active: draft.active,
    } : item));
    setMessage('Account updated successfully.');
    setSavingId(null);
  };

  const toggleTeacherAccess = (profileId: string, teacherName: string) => {
    const draft = drafts[profileId];
    if (!draft) return;
    const selected = draft.teacher_names.includes(teacherName);
    const teacherNames = selected
      ? draft.teacher_names.filter((name) => name !== teacherName)
      : [...draft.teacher_names, teacherName];
    setDrafts({ ...drafts, [profileId]: { ...draft, teacher_names: teacherNames } });
  };

  const sendReset = async (profile: Profile) => {
    if (!profile.email) return;
    setSavingId(profile.id);
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setMessage(error ? `Could not send reset email: ${error.message}` : `Password reset email sent to ${profile.email}.`);
    setSavingId(null);
  };

  const addTeacher = async (event: FormEvent) => {
    event.preventDefault();
    const name = newTeacher.name.trim();
    if (!name) return;
    setMessage(`Adding ${name}…`);
    const { data, error } = await supabase.from('teachers').insert({ name, color: newTeacher.color }).select('name,color').single();
    if (error) {
      setMessage(error.code === '23505' ? 'That teacher already exists.' : `Could not add teacher: ${error.message}`);
      return;
    }
    setTeachers((current) => [...current, data as Teacher].sort((a, b) => a.name.localeCompare(b.name)));
    setNewTeacher(emptyTeacher);
    setMessage(`${name} added to the teacher list.`);
  };

  return (
    <main className="manageShell">
      <header className="manageHeader">
        <div>
          <Link href="/" className="backLink"><ArrowLeft size={17}/> Back to calendar</Link>
          <p className="eyebrow">ADMIN CONTROL PANEL</p>
          <h1>Teacher Management</h1>
          <span>Manage roles, linked timetables, account access and password resets.</span>
        </div>
        <button className="refreshButton" onClick={() => void loadData()} disabled={loading}><RefreshCw size={17}/> Refresh</button>
      </header>

      <section className="summaryGrid">
        <article><Users size={20}/><span>Accounts</span><strong>{profiles.length}</strong></article>
        <article><ShieldCheck size={20}/><span>Administrators</span><strong>{profiles.filter((profile) => profile.role === 'admin').length}</strong></article>
        <article><UserCog size={20}/><span>Active teachers</span><strong>{profiles.filter((profile) => profile.role === 'teacher' && profile.active).length}</strong></article>
      </section>

      <div className={`status ${message.toLowerCase().includes('could not') || message.toLowerCase().includes('required') ? 'error' : ''}`}>
        {loading ? <Loader2 className="spin" size={18}/> : <CheckCircle2 size={18}/>} {message}
      </div>

      <section className="panel">
        <div className="panelHeading"><div><p className="eyebrow">LOGIN ACCOUNTS</p><h2>Users and permissions</h2></div><small>Create new login users in Supabase Authentication; they will appear here automatically.</small></div>
        <div className="accountList">
          {profiles.map((profile) => {
            const draft = drafts[profile.id];
            if (!draft) return null;
            return (
              <article className="accountCard" key={profile.id}>
                <div className="accountIdentity"><div className="avatar">{(draft.display_name || profile.email || '?').slice(0, 2).toUpperCase()}</div><div><strong>{draft.display_name || 'Unnamed account'}</strong><span>{profile.email || 'No email'}</span></div></div>
                <div className="fields">
                  <label>Display name<input value={draft.display_name} onChange={(event) => setDrafts({...drafts,[profile.id]:{...draft,display_name:event.target.value}})}/></label>
                  <label>Role<select value={draft.role} onChange={(event) => setDrafts({...drafts,[profile.id]:{...draft,role:event.target.value as Draft['role']}})}><option value="teacher">Teacher</option><option value="admin">Admin</option></select></label>
                  <label>Primary timetable<select value={draft.teacher_name} onChange={(event) => { const teacherName = event.target.value; setDrafts({...drafts,[profile.id]:{...draft,teacher_name:teacherName,teacher_names:Array.from(new Set([...(teacherName ? [teacherName] : []), ...draft.teacher_names]))}}); }}><option value="">Not linked</option>{teachers.map((teacher) => <option key={teacher.name} value={teacher.name}>{teacher.name}</option>)}</select></label>
                  <label className="activeLabel"><input type="checkbox" checked={draft.active} onChange={(event) => setDrafts({...drafts,[profile.id]:{...draft,active:event.target.checked}})}/><span>{draft.active ? 'Active' : 'Disabled'}</span></label>
                  <div className="timetableAccess"><span>Visible timetables</span><div>{teachers.map((teacher) => { const isPrimary = teacher.name === draft.teacher_name; const checked = draft.teacher_names.includes(teacher.name) || isPrimary; return <label key={teacher.name} className={isPrimary ? 'primaryTeacher' : ''}><input type="checkbox" checked={checked} disabled={isPrimary} onChange={() => toggleTeacherAccess(profile.id, teacher.name)}/><i style={{background:teacher.color}}/>{teacher.name}{isPrimary ? ' (primary)' : ''}</label>; })}</div></div>
                </div>
                <div className="actions"><button className="secondary" onClick={() => void sendReset(profile)} disabled={!profile.email || savingId === profile.id}><Mail size={15}/> Reset password</button><button className="primary" onClick={() => void saveProfile(profile)} disabled={savingId === profile.id}>{savingId === profile.id ? <Loader2 className="spin" size={15}/> : <CheckCircle2 size={15}/>} Save</button></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel addPanel">
        <div className="panelHeading"><div><p className="eyebrow">TEACHER DIRECTORY</p><h2>Add teacher name</h2></div><small>This adds a timetable name. Create the login separately in Supabase Authentication, then link it above.</small></div>
        <form onSubmit={addTeacher} className="addForm"><label>Teacher name<input value={newTeacher.name} onChange={(event) => setNewTeacher({...newTeacher,name:event.target.value})} placeholder="Teacher name" required/></label><label>Calendar colour<input type="color" value={newTeacher.color} onChange={(event) => setNewTeacher({...newTeacher,color:event.target.value})}/></label><button className="primary" type="submit"><Plus size={16}/> Add teacher</button></form>
        <div className="teacherChips">{teachers.map((teacher) => <span key={teacher.name}><i style={{background:teacher.color}}/>{teacher.name}</span>)}</div>
      </section>

      <style jsx>{`
        .manageShell{min-height:100vh;max-width:1450px;margin:auto;padding:34px;color:#eef2ff}.manageHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}.backLink{display:flex;align-items:center;gap:7px;color:#8997b0;text-decoration:none;margin-bottom:24px;width:max-content}.eyebrow{margin:0 0 6px;color:#8777ff;font-size:11px;font-weight:800;letter-spacing:.15em}.manageHeader h1,.panelHeading h2{margin:0}.manageHeader h1{font-size:34px}.manageHeader span,.panelHeading small{color:#8390a8}.refreshButton,.secondary,.primary{border:0;border-radius:11px;padding:11px 15px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font-weight:700}.refreshButton,.secondary{background:#111a2e;color:#aeb9cd;border:1px solid rgba(148,163,184,.12)}.primary{background:linear-gradient(135deg,#715be8,#5140c6);color:white}.summaryGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.summaryGrid article,.panel,.status{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.94),rgba(10,15,29,.92));border-radius:17px}.summaryGrid article{padding:18px;display:grid;grid-template-columns:auto 1fr;gap:7px 10px;align-items:center;color:#8b7cff}.summaryGrid span{color:#8592aa;font-size:12px}.summaryGrid strong{font-size:24px;color:#f5f7ff}.status{margin:14px 0;padding:12px 14px;display:flex;align-items:center;gap:9px;color:#70d28c}.status.error{color:#fb7185}.panel{padding:20px;margin-top:15px}.panelHeading{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:16px}.panelHeading small{max-width:520px;text-align:right}.accountList{display:grid;gap:12px}.accountCard{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(500px,2fr) auto;gap:16px;align-items:center;padding:16px;border:1px solid rgba(148,163,184,.1);border-radius:14px;background:rgba(7,12,25,.42)}.accountIdentity{display:flex;align-items:center;gap:11px}.accountIdentity>div:last-child{display:grid;gap:4px}.accountIdentity span{font-size:12px;color:#7f8ca5}.avatar{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#5544cf;font-weight:800}.fields{display:grid;grid-template-columns:1.2fr .7fr 1fr auto;gap:10px;align-items:end}.timetableAccess{grid-column:1/-1;display:grid;gap:8px;padding-top:4px}.timetableAccess>span{color:#91a0b8;font-size:11px;font-weight:700}.timetableAccess>div{display:flex;flex-wrap:wrap;gap:7px}.timetableAccess label{display:flex!important;align-items:center;gap:6px;padding:7px 9px;border:1px solid rgba(148,163,184,.13);border-radius:999px;background:#0a1120;color:#b5bfd0;font-size:11px;cursor:pointer}.timetableAccess label.primaryTeacher{border-color:rgba(129,112,242,.35);background:rgba(129,112,242,.1)}.timetableAccess i{width:8px;height:8px;border-radius:50%}.timetableAccess input{margin:0}.fields label,.addForm label{display:grid;gap:6px;color:#91a0b8;font-size:11px;font-weight:700}.fields input:not([type=checkbox]),.fields select,.addForm input{border:1px solid rgba(148,163,184,.13);background:#0a1120;color:#e9edf7;border-radius:9px;padding:10px;outline:0}.activeLabel{display:flex!important;align-items:center;gap:7px;padding:10px 4px}.actions{display:flex;gap:8px}.addForm{display:grid;grid-template-columns:1fr 110px auto;gap:12px;align-items:end}.addForm input[type=color]{padding:4px;height:39px;width:100%}.teacherChips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.teacherChips span{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#0a1120;color:#abb6c9;font-size:12px}.teacherChips i{width:9px;height:9px;border-radius:50%}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1050px){.accountCard{grid-template-columns:1fr}.fields{grid-template-columns:repeat(2,1fr)}.actions{justify-content:flex-end}}@media(max-width:700px){.manageShell{padding:20px}.manageHeader,.panelHeading{align-items:flex-start;flex-direction:column}.summaryGrid{grid-template-columns:1fr}.fields,.addForm{grid-template-columns:1fr}.actions{flex-direction:column}.panelHeading small{text-align:left}}
      `}</style>
    </main>
  );
}
