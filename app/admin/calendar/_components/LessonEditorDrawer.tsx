'use client';

import { memo, useId, useMemo } from 'react';
import { AlertTriangle, Copy, Save, X } from 'lucide-react';
import type { TeacherRow, LessonRow } from '../../../providers/AppDataProvider';
import type { Draft } from './calendarUtils';
import { normalizeSchool } from './calendarUtils';
import { useFocusTrap } from './useFocusTrap';
import styles from './calendar.module.css';

type Props = {
  draft: Draft;
  onDraftChange: (updater: (current: Draft) => Draft) => void;
  teachers: TeacherRow[];
  lessons: LessonRow[];
  schoolHistory: Map<string, { className: string; startTime: string; endTime: string }>;
  onSave: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
};

export default memo(LessonEditorDrawer);

function LessonEditorDrawer({
  draft,
  onDraftChange,
  teachers,
  lessons,
  schoolHistory,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}: Props) {
  const trapRef = useFocusTrap(true);
  const id = useId();
  const schoolErrorId = `${id}-school-error`;
  const classErrorId = `${id}-class-error`;

  const schoolEmpty = !draft.school.trim();
  const classEmpty = !draft.className.trim();
  const hasError = schoolEmpty || classEmpty;

  // 3c: Quick-fill history for the current school
  const historyEntry = schoolHistory.get(normalizeSchool(draft.school));

  // 3d: Conflict pre-check — count overlapping lessons at same school + date
  const conflictCount = useMemo(() => {
    if (!draft.school.trim() || !draft.date || !draft.startTime || !draft.endTime) return 0;
    const nSchool = normalizeSchool(draft.school);
    return lessons.filter(
      (l) =>
        l.id !== draft.id &&
        l.lesson_date === draft.date &&
        normalizeSchool(l.school) === nSchool &&
        l.start_time < draft.endTime &&
        l.end_time > draft.startTime,
    ).length;
  }, [lessons, draft.id, draft.date, draft.school, draft.startTime, draft.endTime]);

  const conflictBadge =
    conflictCount === 0 ? null : conflictCount <= 2 ? styles.conflictAmber : styles.conflictRed;

  return (
    <div className={styles.drawerBackdrop} onMouseDown={onClose}>
      <aside
        ref={trapRef}
        className={styles.lessonDrawer}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={draft.id ? 'Edit lesson' : 'Add new lesson'}
      >
        <div className={styles.drawerHeader}>
          <div>
            <p>{draft.id ? 'EDIT LESSON' : 'NEW LESSON'}</p>
            <h2>{draft.id ? draft.school || 'Lesson' : 'Add lesson'}</h2>
          </div>
          <button onClick={onClose} aria-label="Close editor">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className={styles.formGrid}>
          <label htmlFor={`${id}-date`}>
            Date
            <input
              id={`${id}-date`}
              type="date"
              value={draft.date}
              onChange={(event) =>
                onDraftChange((current) => ({ ...current, date: event.target.value }))
              }
            />
          </label>
          <label htmlFor={`${id}-school`}>
            School
            <input
              id={`${id}-school`}
              list="calendar-school-options"
              value={draft.school}
              onChange={(event) => {
                const newSchool = event.target.value;
                onDraftChange((current) => {
                  // 3c: Auto-fill class from history if currently empty
                  const entry = schoolHistory.get(normalizeSchool(newSchool));
                  return {
                    ...current,
                    school: newSchool,
                    className:
                      !current.className.trim() && entry ? entry.className : current.className,
                    startTime: !current.startTime && entry ? entry.startTime : current.startTime,
                    endTime: !current.endTime && entry ? entry.endTime : current.endTime,
                  };
                });
              }}
              aria-describedby={schoolEmpty ? schoolErrorId : undefined}
              aria-invalid={schoolEmpty}
            />
            {schoolEmpty && (
              <span id={schoolErrorId} className={styles.fieldError} role="alert">
                School is required.
              </span>
            )}
          </label>
          <label htmlFor={`${id}-class`}>
            Class / programme
            <input
              id={`${id}-class`}
              list="calendar-class-options"
              value={draft.className}
              onChange={(event) =>
                onDraftChange((current) => ({ ...current, className: event.target.value }))
              }
              aria-describedby={classEmpty ? classErrorId : undefined}
              aria-invalid={classEmpty}
            />
            {classEmpty && (
              <span id={classErrorId} className={styles.fieldError} role="alert">
                Class is required.
              </span>
            )}
            {/* 3c: Show history hint */}
            {historyEntry && !classEmpty && (
              <span className={styles.fieldHint}>
                Last used: {historyEntry.className} ({historyEntry.startTime}–{historyEntry.endTime}
                )
              </span>
            )}
          </label>
          <div className={styles.timeRow}>
            <label htmlFor={`${id}-start`}>
              Start
              <input
                id={`${id}-start`}
                type="time"
                value={draft.startTime}
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, startTime: event.target.value }))
                }
              />
            </label>
            <label htmlFor={`${id}-end`}>
              End
              <input
                id={`${id}-end`}
                type="time"
                value={draft.endTime}
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, endTime: event.target.value }))
                }
              />
            </label>
          </div>
          {/* 3d: Conflict pre-check badge */}
          {conflictBadge && (
            <div className={`${styles.conflictBadge} ${conflictBadge}`}>
              <AlertTriangle size={14} />
              <span>
                {conflictCount} other lesson{conflictCount !== 1 ? 's' : ''} at this school at this
                time
              </span>
            </div>
          )}
          <label htmlFor={`${id}-teacher`}>
            Teacher
            <select
              id={`${id}-teacher`}
              value={draft.teacher}
              onChange={(event) =>
                onDraftChange((current) => ({ ...current, teacher: event.target.value }))
              }
            >
              <option value="">Unassigned</option>
              {teachers.map((teacher) => (
                <option key={teacher.name}>{teacher.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={draft.unavailable}
              onChange={(event) =>
                onDraftChange((current) => ({ ...current, unavailable: event.target.checked }))
              }
            />
            Mark as unavailable
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={draft.cancelled}
              onChange={(event) =>
                onDraftChange((current) => ({ ...current, cancelled: event.target.checked }))
              }
            />
            Class cancelled
          </label>
        </div>
        <div className={styles.drawerActions}>
          <button className={styles.save} onClick={onSave} aria-disabled={hasError}>
            <Save size={17} aria-hidden="true" /> Save lesson
          </button>
          {draft.id && (
            <button className={styles.duplicate} onClick={onDuplicate}>
              <Copy size={17} aria-hidden="true" /> Duplicate
            </button>
          )}
          {draft.id && (
            <button className={styles.delete} onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
