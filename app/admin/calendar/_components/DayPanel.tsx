'use client';

import { memo } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, MapPin, X } from 'lucide-react';
import type { LessonRow } from '../../../providers/AppDataProvider';
import { mapsUrl, pretty } from './calendarUtils';
import { teacherInitials } from './teacherInitials';
import { useFocusTrap } from './useFocusTrap';
import styles from './calendar.module.css';

type Props = {
  day: string;
  dayLessons: LessonRow[];
  onClose: () => void;
  onAddLesson: (date: string) => void;
  onOpenLesson: (lesson: LessonRow) => void;
  onCopyToQuickAdd: () => void;
  onCopyToDates: () => void;
  onNavigateDay: (direction: -1 | 1) => void;
  teacherColour: (name: string | null) => string;
};

export default memo(DayPanel);

function DayPanel({
  day,
  dayLessons,
  onClose,
  onAddLesson,
  onOpenLesson,
  onCopyToQuickAdd,
  onCopyToDates,
  onNavigateDay,
  teacherColour,
}: Props) {
  const trapRef = useFocusTrap(true);

  const formattedDate = new Intl.DateTimeFormat('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00`));

  return (
    <div className={styles.drawerBackdrop} onMouseDown={onClose}>
      <aside
        ref={trapRef}
        className={styles.dayPanel}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`Schedule for ${pretty(day)}`}
      >
        <div className={styles.drawerHeader}>
          <div>
            <p>DAILY SCHEDULE</p>
            <h2 id="day-panel-title">{pretty(day)}</h2>
            <span>
              {dayLessons.length} lesson{dayLessons.length === 1 ? '' : 's'}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close day panel">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.dayNav}>
          <button
            onClick={() => onNavigateDay(-1)}
            aria-label="Previous day"
            className={styles.dayNavButton}
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.dayNavLabel}>{formattedDate}</span>
          <button
            onClick={() => onNavigateDay(1)}
            aria-label="Next day"
            className={styles.dayNavButton}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button className={styles.addLesson} onClick={() => onAddLesson(day)}>
          <CalendarPlus size={17} aria-hidden="true" /> Add lesson
        </button>
        {dayLessons.length > 0 && (
          <>
            <button className={styles.copyLessons} onClick={onCopyToQuickAdd}>
              <Copy size={17} aria-hidden="true" /> Copy all to Quick Add
            </button>
            <button className={styles.copyLessons} onClick={onCopyToDates}>
              <Copy size={17} aria-hidden="true" /> Copy to multiple dates
            </button>
          </>
        )}
        <div className={styles.dayLessonList} role="list">
          {dayLessons.length === 0 ? (
            <div className={styles.noDayLessons}>No lessons for this date.</div>
          ) : (
            dayLessons.map((lesson) => {
              const initials = teacherInitials(lesson.teacher_name);
              const teacherName = lesson.teacher_name ?? 'Unassigned';
              return (
                <button
                  key={lesson.id}
                  onClick={() => onOpenLesson(lesson)}
                  style={{ borderLeftColor: teacherColour(lesson.teacher_name) }}
                  role="listitem"
                  aria-label={`${lesson.start_time.slice(0, 5)} to ${lesson.end_time.slice(0, 5)}: ${lesson.school}, ${lesson.class_name}, ${teacherName}`}
                >
                  <strong>
                    {lesson.start_time.slice(0, 5)}-{lesson.end_time.slice(0, 5)}
                  </strong>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <span style={{ flex: 1 }}>{lesson.school}</span>
                    <a
                      href={mapsUrl(lesson.school)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ flexShrink: 0, color: 'inherit', opacity: 0.65, display: 'flex' }}
                      aria-label={`Open ${lesson.school} in Google Maps`}
                    >
                      <MapPin size={11} aria-hidden="true" />
                    </a>
                  </span>
                  <small style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="teacherBadge" aria-hidden="true">
                      {initials}
                    </span>
                    {lesson.class_name} \u00b7 {teacherName}
                  </small>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
