'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createClient } from '../../utils/supabase/client';

export type TeacherRow = { name: string; color: string };
export type AvailabilityRow = {
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
export type LessonRange = { start: string; end: string };

type AppDataContextValue = {
  teachers: TeacherRow[];
  availability: AvailabilityRow[];
  referencesLoading: boolean;
  ensureReferences: (force?: boolean) => Promise<void>;
  getLessons: (range: LessonRange, force?: boolean) => Promise<LessonRow[]>;
  invalidateLessons: () => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const referencesLoaded = useRef(false);
  const referencesPromise = useRef<Promise<void> | null>(null);
  const lessonCache = useRef(new Map<string, LessonRow[]>());
  const lessonPromises = useRef(new Map<string, Promise<LessonRow[]>>());

  const ensureReferences = useCallback(async (force = false) => {
    if (referencesLoaded.current && !force) return;
    if (referencesPromise.current && !force) return referencesPromise.current;

    const request = (async () => {
      setReferencesLoading(true);
      const [teacherResult, availabilityResult] = await Promise.all([
        supabase.from('teachers').select('name,color').order('name'),
        supabase.from('teacher_availability').select('*'),
      ]);

      if (teacherResult.error) throw teacherResult.error;
      setTeachers((teacherResult.data as TeacherRow[]) ?? []);
      setAvailability(availabilityResult.error ? [] : ((availabilityResult.data as AvailabilityRow[]) ?? []));
      referencesLoaded.current = true;
    })().finally(() => {
      referencesPromise.current = null;
      setReferencesLoading(false);
    });

    referencesPromise.current = request;
    return request;
  }, [supabase]);

  const getLessons = useCallback(async (range: LessonRange, force = false) => {
    const cacheKey = `${range.start}|${range.end}`;
    if (!force) {
      const cached = lessonCache.current.get(cacheKey);
      if (cached) return cached;
      const pending = lessonPromises.current.get(cacheKey);
      if (pending) return pending;
    }

    const request = (async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('id,lesson_date,school,class_name,start_time,end_time,teacher_name,unavailable')
        .gte('lesson_date', range.start)
        .lt('lesson_date', range.end)
        .order('lesson_date')
        .order('start_time');
      if (error) throw error;
      const rows = (data as LessonRow[]) ?? [];
      lessonCache.current.set(cacheKey, rows);
      return rows;
    })().finally(() => lessonPromises.current.delete(cacheKey));

    lessonPromises.current.set(cacheKey, request);
    return request;
  }, [supabase]);

  const invalidateLessons = useCallback(() => {
    lessonCache.current.clear();
    lessonPromises.current.clear();
  }, []);

  const value = useMemo<AppDataContextValue>(() => ({
    teachers,
    availability,
    referencesLoading,
    ensureReferences,
    getLessons,
    invalidateLessons,
  }), [teachers, availability, referencesLoading, ensureReferences, getLessons, invalidateLessons]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
