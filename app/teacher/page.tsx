'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock3, Loader2, LogOut, MapPin } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

type Profile = { display_name: string; teacher_name: string | null; role: 'admin' | 'teacher'; active: boolean };
type LessonRow = { id: string; lesson_date: string; school: string; class_name: string; start_time: string; end_time: string; teacher_name: string | null; unavailable: boolean };

export default function TeacherPortal() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace('/login'); return; }
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('display_name, teacher_name, role, active').eq('id', sessionData.session.user.id).single();
      if (profileError || !profileData?.active) { await supabase.auth.signOut(); router.replace('/login'); return; }
      if (profileData.role === 'admin') { router.replace('/'); return; }
      setProfile(profileData as Profile);
      const { data, error } = await supabase.from('lessons').select('*').order('lesson_date').order('start_time');
      if (error) setMessage(error.message);
      else setLessons((data as LessonRow[]) ?? []);
      setLoading(false);
    };
    void load();
  }, [router]);

  const grouped = useMemo(() => {
    const map = new Map<string, LessonRow[]>();
    for (const lesson of lessons) {
      const group = map.get(lesson.lesson_date) ?? [];
      group.push(lesson);
      map.set(lesson.lesson_date, group);
    }
    return [...map.entries()];
  }, [lessons]);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  const formatDate = (value: string) => new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
  const formatTime = (value: string) => value.slice(0, 5);

  if (loading) return <main className="loading"><Loader2 className="spin" size={26} /> Loading your timetable...</main>;

  return (
    <main className="portalShell">
      <header className="portalHeader">
        <div className="brand"><span><CalendarDays size={22} /></span><div><p>MUSIC DELIGHT</p><h1>{profile?.teacher_name ?? profile?.display_name}&apos;s Timetable</h1></div></div>
        <button onClick={signOut}><LogOut size={17} /> Sign out</button>
      </header>

      <section className="summary">
        <article><span>Teacher</span><strong>{profile?.teacher_name ?? 'Not assigned'}</strong></article>
        <article><span>Upcoming lessons</span><strong>{lessons.length}</strong></article>
        <article><span>Access</span><strong>View only</strong></article>
      </section>

      {message && <div className="error">{message}</div>}
      {!profile?.teacher_name && <div className="warning">Your account has not been linked to a teacher yet. Ask the administrator to set your teacher name.</div>}

      <section className="schedule">
        {grouped.length ? grouped.map(([date, dayLessons]) => (
          <article className="dayGroup" key={date}>
            <h2>{formatDate(date)}</h2>
            <div className="lessonList">
              {dayLessons.map((lesson) => (
                <div className={`lesson ${lesson.unavailable ? 'unavailable' : ''}`} key={lesson.id}>
                  <div className="time"><Clock3 size={17} /><strong>{formatTime(lesson.start_time)} – {formatTime(lesson.end_time)}</strong></div>
                  <div className="details"><strong>{lesson.school}</strong><span>{lesson.class_name}</span><small><MapPin size={13} /> MOE programme</small></div>
                  {lesson.unavailable && <em>Cannot attend</em>}
                </div>
              ))}
            </div>
          </article>
        )) : <div className="empty"><CalendarDays size={34} /><strong>No lessons assigned</strong><span>Your assigned lessons will appear here.</span></div>}
      </section>

      <style jsx>{`
        .portalShell{min-height:100vh;padding:30px;max-width:1150px;margin:auto;color:#eef2f8}.portalHeader{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.brand{display:flex;align-items:center;gap:14px}.brand>span{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#7160e6,#4d3bbb)}.brand p{margin:0 0 4px;color:#8678f7;font-size:10px;font-weight:800;letter-spacing:.15em}.brand h1{margin:0;font-size:27px}.portalHeader button{display:flex;align-items:center;gap:8px;border:1px solid rgba(148,163,184,.16);background:#10182a;color:#b8c2d5;border-radius:11px;padding:10px 13px;cursor:pointer}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px}.summary article,.dayGroup,.empty{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.93),rgba(10,15,29,.9));border-radius:17px}.summary article{padding:17px;display:grid;gap:7px}.summary span{color:#8390a7;font-size:12px}.summary strong{font-size:20px}.schedule{display:grid;gap:15px}.dayGroup{padding:18px}.dayGroup h2{margin:0 0 14px;font-size:17px}.lessonList{display:grid;gap:10px}.lesson{display:grid;grid-template-columns:180px 1fr auto;align-items:center;gap:18px;padding:14px;border:1px solid rgba(148,163,184,.09);border-radius:13px;background:#0b1222}.lesson.unavailable{border-color:rgba(251,113,133,.35)}.time{display:flex;align-items:center;gap:8px;color:#b7c2d5}.details{display:grid;gap:4px}.details span,.details small{color:#8390a7}.details small{display:flex;align-items:center;gap:5px}.lesson em{color:#fb7185;font-size:12px}.warning,.error{padding:12px 14px;border-radius:11px;margin-bottom:15px}.warning{background:rgba(245,158,11,.1);color:#fbbf24}.error{background:rgba(251,113,133,.1);color:#fb7185}.empty{padding:45px;display:grid;place-items:center;gap:8px;color:#8794aa}.loading{min-height:100vh;display:flex;align-items:center;justify-content:center;gap:10px;color:#aab5c8}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:760px){.portalShell{padding:18px}.summary{grid-template-columns:1fr}.lesson{grid-template-columns:1fr}.portalHeader{align-items:flex-start}.brand h1{font-size:21px}}
      `}</style>
    </main>
  );
}
