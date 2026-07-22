'use client';

import { useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';

type TeacherColour = {
  name: string;
  color: string;
};

const normalise = (value: string) => value.trim().toLowerCase();

export default function CalendarTeacherColourSync() {
  useEffect(() => {
    const supabase = createClient();
    let observer: MutationObserver | null = null;
    let cancelled = false;

    const start = async () => {
      const { data, error } = await supabase.from('teachers').select('name,color');
      if (cancelled || error || !data) return;

      const teachers = (data as TeacherColour[])
        .filter((teacher) => teacher.name && teacher.color)
        .map((teacher) => ({
          name: normalise(teacher.name),
          color: teacher.color,
        }))
        .sort((a, b) => b.name.length - a.name.length);

      const applyTeacherColours = () => {
        document.querySelectorAll<HTMLElement>('.fc-event').forEach((eventElement) => {
          const eventText = normalise(eventElement.textContent ?? '');
          const teacher = teachers.find((item) => eventText.includes(item.name));
          if (!teacher) return;

          eventElement.style.setProperty('--fc-event-bg-color', teacher.color);
          eventElement.style.setProperty('--fc-event-border-color', teacher.color);
          eventElement.style.setProperty('--fc-event-text-color', '#ffffff');
          eventElement.style.setProperty('background-color', teacher.color, 'important');
          eventElement.style.setProperty('border-color', teacher.color, 'important');
          eventElement.style.setProperty('color', '#ffffff', 'important');

          eventElement.querySelectorAll<HTMLElement>('.fc-event-main, .fc-event-main-frame').forEach((child) => {
            child.style.setProperty('background', 'transparent', 'important');
            child.style.setProperty('color', '#ffffff', 'important');
          });
        });
      };

      applyTeacherColours();
      observer = new MutationObserver(applyTeacherColours);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };

    void start();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
