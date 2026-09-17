'use client';

import { memo, useId } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import type { TeacherRow } from '../../../providers/AppDataProvider';
import type { RecurringDraft } from './calendarUtils';
import { useFocusTrap } from './useFocusTrap';
import styles from './calendar.module.css';

type Props = {
  draft: RecurringDraft;
  onDraftChange: (updater: (current: RecurringDraft) => RecurringDraft) => void;
  teachers: TeacherRow[];
  onSave: () => void;
  saving: boolean;
  onClose: () => void;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default memo(RecurringDrawer);

function RecurringDrawer({ draft, onDraftChange, teachers, onSave, saving, onClose }: Props) {
  const trapRef = useFocusTrap(true);
  const id = useId();

  return (
    <div className={styles.drawerBackdrop} onMouseDown={onClose}>
      <aside ref={trapRef} className={styles.quickDrawer} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-label="Create recurring weekly lessons">
        <div className={styles.drawerHeader}>
          <div>
            <p>RECURRING LESSONS</p>
            <h2>Create weekly lessons</h2>
            <span>One class across a date range</span>
          </div>
          <button onClick={onClose} aria-label="Close recurring"><X aria-hidden="true" /></button>
        </div>
        <div className={styles.formGrid}>
          <label htmlFor={`${id}-school`}>
            School
            <input id={`${id}-school`} list="calendar-school-options" value={draft.school} onChange={(event) => onDraftChange((current) => ({ ...current, school: event.target.value }))} />
          </label>
          <label htmlFor={`${id}-class`}>
            Class / programme
            <input id={`${id}-class`} list="calendar-class-options" value={draft.className} onChange={(event) => onDraftChange((current) => ({ ...current, className: event.target.value }))} />
          </label>
          <div className={styles.timeRow}>
            <label htmlFor={`${id}-start`}>
              Start
              <input id={`${id}-start`} type="time" value={draft.startTime} onChange={(event) => onDraftChange((current) => ({ ...current, startTime: event.target.value }))} />
            </label>
            <label htmlFor={`${id}-end`}>
              End
              <input id={`${id}-end`} type="time" value={draft.endTime} onChange={(event) => onDraftChange((current) => ({ ...current, endTime: event.target.value }))} />
            </label>
          </div>
          <div className={styles.timeRow}>
            <label htmlFor={`${id}-from`}>
              From
              <input id={`${id}-from`} type="date" value={draft.startDate} onChange={(event) => onDraftChange((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label htmlFor={`${id}-to`}>
              To
              <input id={`${id}-to`} type="date" value={draft.endDate} onChange={(event) => onDraftChange((current) => ({ ...current, endDate: event.target.value }))} />
            </label>
          </div>
          <label htmlFor={`${id}-teacher`}>
            Teacher
            <select id={`${id}-teacher`} value={draft.teacher} onChange={(event) => onDraftChange((current) => ({ ...current, teacher: event.target.value }))}>
              <option value="">Unassigned</option>
              {teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}
            </select>
          </label>
          <fieldset className={styles.weekdayPicker}>
            <legend>Repeat on</legend>
            {WEEKDAYS.map((name, index) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={draft.weekdays.includes(index)}
                  onChange={() => onDraftChange((current) => ({
                    ...current,
                    weekdays: current.weekdays.includes(index)
                      ? current.weekdays.filter((day) => day !== index)
                      : [...current.weekdays, index],
                  }))}
                />
                {name}
              </label>
            ))}
          </fieldset>
        </div>
        <div className={styles.drawerActions}>
          <button className={styles.save} onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className={styles.spin} size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />} Create recurring lessons
          </button>
        </div>
      </aside>
    </div>
  );
}