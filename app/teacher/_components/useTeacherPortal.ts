'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../utils/supabase/client';
import { dateKey, formatTime, mapsUrl, minutesBetween, parseLocalDate } from './teacherUtils';

export type Profile = {
  display_name: string;
  teacher_name: string | null;
  role: 'admin' | 'teacher';
  active: boolean;
};

export type AccessRow = { teacher_name: string };

export type LessonRow = {
  id: string;
  lesson_date: string;
  school: string;
  class_name: string;
  start_time: string;
  end_time: string;
  teacher_name: string | null;
  unavailable: boolean;
};

export type RequestRow = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'replacement_assigned' | 'cancelled';
  admin_note: string | null;
  replacement_summary: string | null;
  affected_lessons: Array<{
    id: string;
    lesson_date: string;
    school: string;
    class_name: string;
    start_time: string;
    end_time: string;
  }>;
  created_at: string;
};

export function useTeacherPortal() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState('');
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [linkedTeacherNames, setLinkedTeacherNames] = useState<string[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [requestOpen, setRequestOpen] = useState(false);
  const [startDate, setStartDate] = useState(dateKey(new Date()));
  const [endDate, setEndDate] = useState(dateKey(new Date()));
  const [reason, setReason] = useState('MC');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadRequests = async (uid: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('teacher_unavailability_requests')
      .select(
        'id,start_date,end_date,reason,remarks,status,admin_note,replacement_summary,affected_lessons,created_at',
      )
      .eq('teacher_user_id', uid)
      .order('created_at', { ascending: false })
      .limit(8);
    if (!error) setRequests((data as RequestRow[]) ?? []);
  };

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace('/login');
        return;
      }
      setUserId(sessionData.session.user.id);

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

      const { data: accessData, error: accessError } = await supabase
        .from('profile_teacher_access')
        .select('teacher_name')
        .eq('profile_id', sessionData.session.user.id);
      if (accessError) {
        setMessage(`${accessError.message}. Run the multi-timetable Supabase migration first.`);
        setLoading(false);
        return;
      }
      const accessNames = ((accessData ?? []) as AccessRow[]).map((row) => row.teacher_name);
      const visibleTeacherNames = Array.from(
        new Set([
          ...(typedProfile.teacher_name ? [typedProfile.teacher_name] : []),
          ...accessNames,
        ]),
      );
      setLinkedTeacherNames(visibleTeacherNames);
      if (!visibleTeacherNames.length) {
        setLoading(false);
        return;
      }

      const rangeStart = new Date();
      rangeStart.setMonth(0, 1);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date();
      rangeEnd.setFullYear(rangeEnd.getFullYear() + 1, 0, 1);
      rangeEnd.setHours(0, 0, 0, 0);

      const [{ data, error }] = await Promise.all([
        supabase
          .from('lessons')
          .select('id,lesson_date,school,class_name,start_time,end_time,teacher_name,unavailable')
          .in('teacher_name', visibleTeacherNames)
          .eq('cancelled', false)
          .gte('lesson_date', dateKey(rangeStart))
          .lt('lesson_date', dateKey(rangeEnd))
          .order('lesson_date')
          .order('start_time'),
        loadRequests(sessionData.session.user.id),
      ]);
      if (error) setMessage(error.message);
      else setLessons((data as LessonRow[]) ?? []);
      setLoading(false);
    };
    void load();
  }, [router, reloadKey]);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel('teacher-portal-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () =>
        setReloadKey((value) => value + 1),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  const todayKey = dateKey(now);
  const teacherName = profile?.teacher_name ?? profile?.display_name ?? 'Teacher';
  const todayLessons = useMemo(
    () => lessons.filter((l) => l.lesson_date === todayKey),
    [lessons, todayKey],
  );
  const upcomingLessons = useMemo(
    () => lessons.filter((l) => new Date(`${l.lesson_date}T${l.end_time.slice(0, 8)}`) >= now),
    [lessons, now],
  );
  const nextLesson = upcomingLessons[0] ?? null;
  const weekRange = useMemo(() => {
    const start = new Date(now);
    const day = start.getDay();
    start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }, [now]);
  const weekLessons = useMemo(
    () =>
      lessons.filter((l) => {
        const d = parseLocalDate(l.lesson_date);
        return d >= weekRange.start && d < weekRange.end;
      }),
    [lessons, weekRange],
  );
  const monthLessons = useMemo(
    () =>
      lessons.filter((l) => {
        const d = parseLocalDate(l.lesson_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }),
    [lessons, now],
  );
  const weeklyCounts = useMemo(() => {
    const counts = Array.from({ length: 7 }, () => 0);
    for (const lesson of weekLessons)
      counts[(parseLocalDate(lesson.lesson_date).getDay() + 6) % 7] += 1;
    return counts;
  }, [weekLessons]);
  const weeklyHours = useMemo(
    () => weekLessons.reduce((s, l) => s + minutesBetween(l.start_time, l.end_time), 0) / 60,
    [weekLessons],
  );
  const monthlyHours = useMemo(
    () => monthLessons.reduce((s, l) => s + minutesBetween(l.start_time, l.end_time), 0) / 60,
    [monthLessons],
  );
  const schoolCount = useMemo(
    () => new Set(monthLessons.map((l) => l.school)).size,
    [monthLessons],
  );
  const affectedLessons = useMemo(
    () =>
      lessons.filter(
        (l) =>
          l.teacher_name === profile?.teacher_name &&
          l.lesson_date >= startDate &&
          l.lesson_date <= endDate,
      ),
    [lessons, profile?.teacher_name, startDate, endDate],
  );
  const countdown = useMemo(() => {
    if (!nextLesson) return 'No upcoming lessons';
    const diff =
      new Date(`${nextLesson.lesson_date}T${nextLesson.start_time.slice(0, 8)}`).getTime() -
      now.getTime();
    if (diff <= 0) return 'In progress now';
    const m = Math.ceil(diff / 60_000),
      d = Math.floor(m / 1440),
      h = Math.floor((m % 1440) / 60),
      min = m % 60;
    return d > 0
      ? `Starts in ${d}d ${h}h`
      : h > 0
        ? `Starts in ${h}h ${min}m`
        : `Starts in ${min}m`;
  }, [nextLesson, now]);

  const submitRequest = async () => {
    setRequestMessage('');
    if (!profile?.teacher_name || !userId) return;
    if (endDate < startDate) {
      setRequestMessage('The end date cannot be before the start date.');
      return;
    }
    if (!affectedLessons.length) {
      setRequestMessage('There are no assigned lessons in this date range.');
      return;
    }
    setSubmitting(true);
    const payloadLessons = affectedLessons.map(
      ({ id, lesson_date, school, class_name, start_time, end_time }) => ({
        id,
        lesson_date,
        school,
        class_name,
        start_time,
        end_time,
      }),
    );
    const { error } = await createClient()
      .from('teacher_unavailability_requests')
      .insert({
        teacher_user_id: userId,
        teacher_name: profile.teacher_name,
        start_date: startDate,
        end_date: endDate,
        reason,
        remarks: remarks.trim() || null,
        affected_lesson_ids: affectedLessons.map((l) => l.id),
        affected_lessons: payloadLessons,
      });
    setSubmitting(false);
    if (error) {
      setRequestMessage(
        error.message.includes('teacher_unavailability_requests')
          ? 'The request database has not been installed yet. Run the new Supabase migration first.'
          : error.message,
      );
      return;
    }
    await loadRequests(userId);
    setRequestOpen(false);
    setRemarks('');
    setReason('MC');
    setMessage('Your unable-to-attend request was sent to the admin.');
  };

  const cancelRequest = async (id: string) => {
    const { error } = await createClient()
      .from('teacher_unavailability_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) setMessage(error.message);
    else await loadRequests(userId);
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  const scrollToSchedule = () =>
    document.getElementById('today-schedule')?.scrollIntoView({ behavior: 'smooth' });

  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const maxWeeklyCount = Math.max(1, ...weeklyCounts);

  const statusLabel: Record<RequestRow['status'], string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    replacement_assigned: 'Replacement assigned',
    cancelled: 'Cancelled',
  };

  return {
    // State
    profile,
    userId,
    lessons,
    linkedTeacherNames,
    requests,
    loading,
    message,
    now,
    requestOpen,
    startDate,
    endDate,
    reason,
    remarks,
    submitting,
    requestMessage,
    reloadKey,

    // Derived
    todayKey,
    teacherName,
    todayLessons,
    upcomingLessons,
    nextLesson,
    weekRange,
    weekLessons,
    monthLessons,
    weeklyCounts,
    weeklyHours,
    monthlyHours,
    schoolCount,
    affectedLessons,
    countdown,
    greeting,
    maxWeeklyCount,
    statusLabel,

    // Setters
    setMessage,
    setRequestOpen,
    setStartDate,
    setEndDate,
    setReason,
    setRemarks,
    setReloadKey,

    // Actions
    submitRequest,
    cancelRequest,
    signOut,
    scrollToSchedule,
  };
}

// Re-export utilities for the page component
export { dateKey, formatTime, mapsUrl, minutesBetween, parseLocalDate } from './teacherUtils';
