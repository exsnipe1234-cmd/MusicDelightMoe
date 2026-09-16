'use client';

import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import type { TeacherRow } from '../../../providers/AppDataProvider';
import type { QuickRow } from './calendarUtils';
import { useFocusTrap } from './useFocusTrap';
import styles from './calendar.module.css';

type Props = {
  quickRows: QuickRow[];
  onUpdateRow: (id: number, patch: Partial<QuickRow>) => void;
  onRemoveRow: (id: number) => void;
  onAddRow: () => void;
  onSave: () => void;
  saving: boolean;
  onClose: () => void;
  teachers: TeacherRow[];
  copySourceCount: number;
  copyDateInput: string;
  onCopyDateInputChange: (value: string) => void;
  onAddCopyDate: () => void;
  copyDates: string[];
  onSaveCopies: () => void;
};

export default function QuickAddDrawer({ quickRows, onUpdateRow, onRemoveRow, onAddRow, onSave, saving, onClose, teachers, copySourceCount, copyDateInput, onCopyDateInputChange, onAddCopyDate, copyDates, onSaveCopies }: Props) {
  const trapRef = useFocusTrap(true);
  const id = useId();

  return (
    <div className={styles.drawerBackdrop} onMouseDown={onClose}>
      <aside ref={trapRef} className={styles.quickDrawer} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-label="Quick add multiple lessons">
        <div className={styles.drawerHeader}>
          <div>
            <p>QUICK ADD</p>
            <h2>Add multiple lessons</h2>
            <span>{quickRows.length} draft lesson{quickRows.length === 1 ? '' : 's'}</span>
          </div>
          <button onClick={onClose} aria-label="Close quick add"><X aria-hidden="true" /></button>
        </div>
        {copySourceCount > 0 && (
          <div className={styles.copyDatePanel}>
            <strong>Select dates for these {copySourceCount} classes</strong>
            <div>
              <input type="date" value={copyDateInput} onChange={(event) => onCopyDateInputChange(event.target.value)} aria-label="Copy to date" />
              <button onClick={onAddCopyDate}>Add date</button>
            </div>
            <span>{copyDates.length ? copyDates.join(', ') : 'No dates selected yet.'}</span>
            <button className={styles.save} onClick={onSaveCopies} disabled={!copyDates.length || saving}>
              Create copies
            </button>
          </div>
        )}
        <div className={styles.quickList} role="list">
          {quickRows.map((row, index) => (
            <div className={styles.quickRow} key={row.id} role="listitem" aria-label={`Lesson ${index + 1}`}>
              <div className={styles.quickRowHead}>
                <strong>Lesson {index + 1}</strong>
                <button onClick={() => onRemoveRow(row.id)} aria-label={`Remove lesson ${index + 1}`}>Remove</button>
              </div>
              <div className={styles.formGrid}>
                <label htmlFor={`${id}-date-${row.id}`}>
                  Date
                  <input id={`${id}-date-${row.id}`} type="date" value={row.date} onChange={(event) => onUpdateRow(row.id, { date: event.target.value })} />
                </label>
                <div className={styles.timeRow}>
                  <label htmlFor={`${id}-start-${row.id}`}>
                    Start
                    <input id={`${id}-start-${row.id}`} type="time" value={row.startTime} onChange={(event) => onUpdateRow(row.id, { startTime: event.target.value })} />
                  </label>
                  <label htmlFor={`${id}-end-${row.id}`}>
                    End
                    <input id={`${id}-end-${row.id}`} type="time" value={row.endTime} onChange={(event) => onUpdateRow(row.id, { endTime: event.target.value })} />
                  </label>
                </div>
                <label htmlFor={`${id}-school-${row.id}`}>
                  School
                  <input id={`${id}-school-${row.id}`} list="calendar-school-options" value={row.school} onChange={(event) => onUpdateRow(row.id, { school: event.target.value })} placeholder="School name" />
                </label>
                <label htmlFor={`${id}-class-${row.id}`}>
                  Class / programme
                  <input id={`${id}-class-${row.id}`} list={`quick-class-options-${row.id}`} value={row.className} onChange={(event) => onUpdateRow(row.id, { className: event.target.value })} placeholder="e.g. 4IN, Keyboard" />
                  <datalist id={`quick-class-options-${row.id}`}>
                    {teachers.map((t) => <option key={t.name} value={t.name} />)}
                  </datalist>
                </label>
                <label htmlFor={`${id}-teacher-${row.id}`}>
                  Teacher
                  <select id={`${id}-teacher-${row.id}`} value={row.teacher} onChange={(event) => onUpdateRow(row.id, { teacher: event.target.value })}>
                    <option value="">Unassigned</option>
                    {teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
        <button className={styles.addAnother} onClick={onAddRow}>
          <Plus size={17} aria-hidden="true" /> Add another lesson
        </button>
        <div className={styles.drawerActions}>
          <button className={styles.save} onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : `Save ${quickRows.length} lesson${quickRows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </aside>
    </div>
  );
}