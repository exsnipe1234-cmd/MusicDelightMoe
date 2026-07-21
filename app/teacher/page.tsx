'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  Loader2,
  LogOut,
  MapPin,
  School,
  Sparkles,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

type Profile = {
  display_name: string;
  teacher_name: string | null;
  role: 'admin' | 'teacher';
  active: boolean;
};

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

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value: string) => new Date(`${value}T12:00:00`);
const formatTime = (value: string) => value.slice(0, 5);

const minutesBetween = (start: string, end: string) => {
  const [startHour, startMinute] = start.slice(0, 5).split(':').map(Number);
  const [endHour, endMinute] = end.slice(0, 5).split(':').map(Number);
  return Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute);
};

export default function TeacherPortal() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.replace('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, teacher_name, role, active')
        .eq('id', sessionData.session.user.id)
        .single();

      if (profileError || !profileData?.active) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      if (profileData.role === 'admin') {
        router.replace('/');
        return;
      }

      const typedProfile = profileData as Profile;
      setProfile(typedProfile);

      if (!typedProfile.teacher_name) {
        setLoading(false);
        return;
      }

      const rangeStart = new Date();
      rangeStart.setDate(1);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date();
      rangeEnd.setMonth(rangeEnd.getMonth() + 2, 1);
      rangeEnd.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('lessons')
        .select('id,lesson_date,school,class_name,start_time,end_time,teacher_name,unavailable')
        .eq('teacher_name', typedProfile.teacher_name)
        .gte('lesson_date', dateKey(rangeStart))
        .lt('lesson_date', dateKey(rangeEnd))
        .order('lesson_date')
        .order('start_time');

      if (error) setMessage(error.message);
      else setLessons((data as LessonRow[]) ?? []);
      setLoading(false);
    };

    void load();
  }, [router]);

  const todayKey = dateKey(now);
  const teacherName = profile?.teacher_name ?? profile?.display_name ?? 'Teacher';

  const todayLessons = useMemo(
    () => lessons.filter((lesson) => lesson.lesson_date === todayKey),
    [lessons, todayKey],
  );

  const upcomingLessons = useMemo(
    () => lessons.filter((lesson) => {
      const lessonEnd = new Date(`${lesson.lesson_date}T${lesson.end_time.slice(0, 8)}`);
      return lessonEnd >= now;
    }),
    [lessons, now],
  );

  const nextLesson = upcomingLessons[0] ?? null;

  const weekRange = useMemo(() => {
    const start = new Date(now);
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }, [now]);

  const weekLessons = useMemo(
    () => lessons.filter((lesson) => {
      const date = parseLocalDate(lesson.lesson_date);
      return date >= weekRange.start && date < weekRange.end;
    }),
    [lessons, weekRange],
  );

  const monthLessons = useMemo(
    () => lessons.filter((lesson) => {
      const date = parseLocalDate(lesson.lesson_date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }),
    [lessons, now],
  );

  const weeklyCounts = useMemo(() => {
    const counts = Array.from({ length: 7 }, () => 0);
    for (const lesson of weekLessons) {
      const dayIndex = (parseLocalDate(lesson.lesson_date).getDay() + 6) % 7;
      counts[dayIndex] += 1;
    }
    return counts;
  }, [weekLessons]);

  const weeklyHours = useMemo(
    () => weekLessons.reduce((sum, lesson) => sum + minutesBetween(lesson.start_time, lesson.end_time), 0) / 60,
    [weekLessons],
  );

  const monthlyHours = useMemo(
    () => monthLessons.reduce((sum, lesson) => sum + minutesBetween(lesson.start_time, lesson.end_time), 0) / 60,
    [monthLessons],
  );

  const schoolCount = useMemo(
    () => new Set(monthLessons.map((lesson) => lesson.school)).size,
    [monthLessons],
  );

  const countdown = useMemo(() => {
    if (!nextLesson) return 'No upcoming lessons';
    const start = new Date(`${nextLesson.lesson_date}T${nextLesson.start_time.slice(0, 8)}`);
    const diff = start.getTime() - now.getTime();
    if (diff <= 0) return 'In progress now';
    const totalMinutes = Math.ceil(diff / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `Starts in ${days}d ${hours}h`;
    if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
    return `Starts in ${minutes}m`;
  }, [nextLesson, now]);

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const maxWeeklyCount = Math.max(1, ...weeklyCounts);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  const scrollToSchedule = () => document.getElementById('today-schedule')?.scrollIntoView({ behavior: 'smooth' });

  if (loading) {
    return <main className="loading"><Loader2 className="spin" size={26} /> Loading your dashboard...</main>;
  }

  return (
    <main className="portalShell">
      <header className="portalHeader">
        <div className="brand">
          <span><CalendarDays size={22} /></span>
          <div><p>MUSIC DELIGHT</p><h1>Teacher Portal</h1></div>
        </div>
        <button className="signOut" onClick={signOut}><LogOut size={17} /> Sign out</button>
      </header>

      <section className="welcome">
        <div>
          <p>{new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</p>
          <h2>{greeting}, {teacherName} <span>👋</span></h2>
          <small>Here is everything you need for your teaching day.</small>
        </div>
        <div className="livePill"><i /> Live timetable</div>
      </section>

      {message && <div className="error">{message}</div>}
      {!profile?.teacher_name && <div className="warning">Your account has not been linked to a teacher yet. Ask the administrator to set your teacher name.</div>}

      <section className="heroGrid">
        <article className="nextCard">
          <div className="cardLabel"><Sparkles size={15} /> NEXT LESSON</div>
          {nextLesson ? (
            <>
              <div className="nextMain">
                <div className="timeBadge"><Clock3 size={20} /><strong>{formatTime(nextLesson.start_time)}</strong><span>{formatTime(nextLesson.end_time)}</span></div>
                <div><h3>{nextLesson.school}</h3><p>{nextLesson.class_name}</p><small><CalendarDays size={14} /> {nextLesson.lesson_date === todayKey ? 'Today' : new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: 'numeric', month: 'short' }).format(parseLocalDate(nextLesson.lesson_date))}</small></div>
              </div>
              <div className="countdown"><i /><strong>{countdown}</strong></div>
            </>
          ) : (
            <div className="emptyNext"><CalendarDays size={34} /><strong>No upcoming lessons</strong><span>Your next assigned lesson will appear here.</span></div>
          )}
        </article>

        <article className="weekCard">
          <div className="sectionHeading"><div><p>THIS WEEK</p><h3>Weekly workload</h3></div><BarChart3 size={20} /></div>
          <div className="weekBars">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <div className="barColumn" key={day}>
                <span>{weeklyCounts[index]}</span>
                <div><i style={{ height: `${Math.max(8, weeklyCounts[index] / maxWeeklyCount * 100)}%` }} /></div>
                <small>{day}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="statGrid">
        <article><div className="statIcon purple"><CalendarDays size={18} /></div><span>Lessons this week</span><strong>{weekLessons.length}</strong><small>{weeklyHours.toFixed(1)} teaching hours</small></article>
        <article><div className="statIcon blue"><Clock3 size={18} /></div><span>Hours this month</span><strong>{monthlyHours.toFixed(1)}</strong><small>{monthLessons.length} scheduled lessons</small></article>
        <article><div className="statIcon green"><School size={18} /></div><span>Schools this month</span><strong>{schoolCount}</strong><small>Unique MOE locations</small></article>
      </section>

      <section className="lowerGrid">
        <article className="scheduleCard" id="today-schedule">
          <div className="sectionHeading"><div><p>TODAY</p><h3>Today&apos;s schedule</h3></div><span>{todayLessons.length} lesson{todayLessons.length === 1 ? '' : 's'}</span></div>
          <div className="todayList">
            {todayLessons.length ? todayLessons.map((lesson, index) => (
              <div className={`todayLesson ${lesson.unavailable ? 'unavailable' : ''}`} key={lesson.id}>
                <div className="timeline"><i /><span>{index < todayLessons.length - 1 && <b />}</span></div>
                <div className="lessonTime"><strong>{formatTime(lesson.start_time)}</strong><span>{formatTime(lesson.end_time)}</span></div>
                <div className="lessonDetails"><strong>{lesson.school}</strong><span>{lesson.class_name}</span><small><MapPin size={13} /> MOE programme</small></div>
                {lesson.unavailable && <em>Cannot attend</em>}
              </div>
            )) : <div className="emptySchedule"><CalendarDays size={30} /><strong>No lessons today</strong><span>Enjoy the open space in your schedule.</span></div>}
          </div>
        </article>

        <aside className="quickCard">
          <div className="sectionHeading"><div><p>SHORTCUTS</p><h3>Quick actions</h3></div></div>
          <button onClick={scrollToSchedule}><span className="quickIcon"><CalendarDays size={18} /></span><div><strong>View today&apos;s timetable</strong><small>Jump to your lesson list</small></div><ChevronRight size={18} /></button>
          <button onClick={() => router.refresh()}><span className="quickIcon"><Clock3 size={18} /></span><div><strong>Refresh schedule</strong><small>Check for the latest changes</small></div><ChevronRight size={18} /></button>
          <div className="comingSoon"><span><Sparkles size={15} /> Coming next</span><strong>Attendance and replacement requests</strong><small>These tools will be added in the next teacher portal update.</small></div>
        </aside>
      </section>

      <section className="upcomingCard">
        <div className="sectionHeading"><div><p>UPCOMING</p><h3>Next scheduled lessons</h3></div><button onClick={scrollToSchedule}>Today <ArrowRight size={15} /></button></div>
        <div className="upcomingGrid">
          {upcomingLessons.slice(0, 6).map((lesson) => (
            <article key={lesson.id}>
              <span>{new Intl.DateTimeFormat('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseLocalDate(lesson.lesson_date))}</span>
              <strong>{lesson.school}</strong>
              <small>{lesson.class_name}</small>
              <p><Clock3 size={13} /> {formatTime(lesson.start_time)}–{formatTime(lesson.end_time)}</p>
            </article>
          ))}
          {!upcomingLessons.length && <div className="emptyUpcoming">No upcoming lessons assigned.</div>}
        </div>
      </section>

      <style jsx>{`
        .portalShell{min-height:100vh;padding:28px;max-width:1240px;margin:auto;color:#eef2f8}.portalHeader{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.brand{display:flex;align-items:center;gap:13px}.brand>span{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#7666ee,#4f3bbd);box-shadow:0 12px 30px rgba(103,86,225,.28)}.brand p,.sectionHeading p,.welcome p{margin:0 0 4px;color:#8c7cf4;font-size:10px;font-weight:900;letter-spacing:.16em}.brand h1{margin:0;font-size:22px}.signOut{display:flex;align-items:center;gap:8px;border:1px solid rgba(148,163,184,.15);background:#10182a;color:#b8c2d5;border-radius:11px;padding:10px 13px;cursor:pointer}.welcome{display:flex;justify-content:space-between;align-items:end;margin-bottom:22px}.welcome h2{margin:0 0 6px;font-size:34px;letter-spacing:-.035em}.welcome h2 span{font-size:28px}.welcome small{color:#8794aa}.livePill{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid rgba(52,211,153,.18);border-radius:999px;background:rgba(52,211,153,.07);color:#6ee7b7;font-size:12px;font-weight:750}.livePill i,.countdown i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 5px rgba(52,211,153,.1)}.heroGrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.65fr);gap:15px;margin-bottom:15px}.nextCard,.weekCard,.statGrid article,.scheduleCard,.quickCard,.upcomingCard{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(20,27,48,.96),rgba(10,15,29,.93));border-radius:20px;box-shadow:0 18px 50px rgba(0,0,0,.13)}.nextCard{padding:24px;position:relative;overflow:hidden}.nextCard:after{content:'';position:absolute;width:260px;height:260px;border-radius:50%;right:-90px;top:-140px;background:radial-gradient(circle,rgba(112,91,231,.24),transparent 68%);pointer-events:none}.cardLabel{display:flex;align-items:center;gap:7px;color:#9b8df7;font-size:10px;font-weight:900;letter-spacing:.15em;margin-bottom:22px}.nextMain{display:flex;align-items:center;gap:20px}.timeBadge{width:112px;height:112px;border-radius:24px;display:grid;place-items:center;align-content:center;gap:3px;background:linear-gradient(145deg,#7766ec,#4c39b9);box-shadow:0 18px 40px rgba(91,70,205,.3)}.timeBadge strong{font-size:27px}.timeBadge span{font-size:11px;color:#d9d4ff}.nextMain h3{font-size:28px;margin:0 0 6px}.nextMain p{color:#b5bfd2;margin:0 0 12px}.nextMain small{display:flex;align-items:center;gap:6px;color:#8290a8}.countdown{display:inline-flex;align-items:center;gap:10px;margin-top:22px;padding:10px 13px;border-radius:11px;background:rgba(52,211,153,.07);color:#76e8ba;font-size:13px}.weekCard{padding:21px}.sectionHeading{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.sectionHeading h3{margin:0;font-size:18px}.sectionHeading>span{color:#8290a8;font-size:12px}.weekBars{height:175px;display:grid;grid-template-columns:repeat(7,1fr);gap:9px;align-items:end}.barColumn{height:100%;display:grid;grid-template-rows:18px 1fr 18px;gap:7px;align-items:end;text-align:center}.barColumn>span,.barColumn small{font-size:10px;color:#8290a8}.barColumn>div{height:100%;display:flex;align-items:end;border-radius:8px;background:#0d1425;overflow:hidden}.barColumn i{display:block;width:100%;min-height:8px;border-radius:8px;background:linear-gradient(180deg,#8170f2,#5140bd);transition:height .35s ease}.statGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:15px}.statGrid article{padding:19px;display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center}.statGrid article>span{color:#8794aa;font-size:12px}.statGrid article>strong{font-size:27px;grid-column:2}.statGrid article>small{color:#69768e;grid-column:2}.statIcon{grid-row:1/4;width:42px;height:42px;border-radius:13px;display:grid;place-items:center}.statIcon.purple{background:rgba(129,112,242,.13);color:#a99cff}.statIcon.blue{background:rgba(56,189,248,.12);color:#7dd3fc}.statIcon.green{background:rgba(52,211,153,.11);color:#6ee7b7}.lowerGrid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:15px;margin-bottom:15px}.scheduleCard,.quickCard,.upcomingCard{padding:21px}.todayList{display:grid}.todayLesson{display:grid;grid-template-columns:20px 78px 1fr auto;gap:13px;min-height:78px}.timeline{display:grid;grid-template-rows:16px 1fr;justify-items:center;padding-top:3px}.timeline>i{width:11px;height:11px;border:3px solid #7c6deb;border-radius:50%;background:#11182a}.timeline span{width:1px;background:rgba(129,112,242,.22);position:relative}.lessonTime{display:grid;align-content:start;gap:3px}.lessonTime strong{font-size:15px}.lessonTime span{font-size:11px;color:#748198}.lessonDetails{display:grid;align-content:start;gap:4px}.lessonDetails>span,.lessonDetails small{color:#8390a7}.lessonDetails small{display:flex;align-items:center;gap:5px}.todayLesson em{font-size:11px;color:#fb7185}.emptySchedule,.emptyNext{display:grid;place-items:center;text-align:center;gap:7px;color:#7f8ca3;padding:32px}.quickCard>button{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:11px;width:100%;padding:13px 0;border:0;border-bottom:1px solid rgba(148,163,184,.09);background:transparent;color:#eef2f8;text-align:left;cursor:pointer}.quickCard button div{display:grid;gap:3px}.quickCard button small{color:#748198}.quickIcon{width:38px;height:38px;border-radius:12px;background:rgba(129,112,242,.1);color:#a99cff;display:grid;place-items:center}.comingSoon{margin-top:17px;padding:15px;border-radius:14px;background:linear-gradient(145deg,rgba(112,91,231,.13),rgba(56,189,248,.06));display:grid;gap:6px}.comingSoon>span{display:flex;align-items:center;gap:6px;color:#a99cff;font-size:10px;font-weight:850;letter-spacing:.1em}.comingSoon small{color:#758198}.upcomingCard{margin-bottom:28px}.sectionHeading button{display:flex;align-items:center;gap:6px;border:0;background:transparent;color:#9e91f6;cursor:pointer}.upcomingGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.upcomingGrid article{padding:14px;border:1px solid rgba(148,163,184,.09);border-radius:14px;background:#0b1222;display:grid;gap:5px}.upcomingGrid article>span{color:#9385ee;font-size:10px;font-weight:800;text-transform:uppercase}.upcomingGrid article small{color:#8190a8}.upcomingGrid article p{display:flex;align-items:center;gap:5px;margin:5px 0 0;color:#aab5c8;font-size:11px}.emptyUpcoming{color:#7f8ca3}.warning,.error{padding:12px 14px;border-radius:11px;margin-bottom:15px}.warning{background:rgba(245,158,11,.1);color:#fbbf24}.error{background:rgba(251,113,133,.1);color:#fb7185}.loading{min-height:100vh;display:flex;align-items:center;justify-content:center;gap:10px;color:#aab5c8}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:900px){.heroGrid,.lowerGrid{grid-template-columns:1fr}.statGrid{grid-template-columns:1fr}.weekCard{min-height:260px}.quickCard{order:-1}}@media(max-width:620px){.portalShell{padding:17px}.portalHeader{margin-bottom:20px}.brand h1{font-size:19px}.signOut{font-size:0;padding:10px}.welcome{align-items:flex-start}.welcome h2{font-size:27px}.welcome small,.livePill{display:none}.nextMain{align-items:flex-start}.timeBadge{width:88px;height:88px;border-radius:19px}.timeBadge strong{font-size:21px}.nextMain h3{font-size:21px}.weekBars{height:145px}.todayLesson{grid-template-columns:16px 65px 1fr}.todayLesson em{display:none}.upcomingGrid{grid-template-columns:1fr}.heroGrid{grid-template-columns:1fr}.nextCard,.weekCard,.scheduleCard,.quickCard,.upcomingCard{border-radius:17px;padding:17px}}
      `}</style>
    </main>
  );
}
