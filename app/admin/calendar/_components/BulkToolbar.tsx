'use client';

import { memo } from 'react';
import type { TeacherRow } from '../../../providers/AppDataProvider';
import styles from './calendar.module.css';

type Props = {
  selectedCount: number;
  visibleCount: number;
  onSelectVisible: () => void;
  bulkDate: string;
  onBulkDateChange: (value: string) => void;
  bulkTeacher: string;
  onBulkTeacherChange: (value: string) => void;
  teachers: TeacherRow[];
  onMove: () => void;
  onAssign: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

function BulkToolbar({ selectedCount, visibleCount, onSelectVisible, bulkDate, onBulkDateChange, bulkTeacher, onBulkTeacherChange, teachers, onMove, onAssign, onCancel, onDelete }: Props) {
  return (
    <section className={styles.bulkToolbar} aria-label="Bulk operations">
      <label>
        <input type="checkbox" checked={visibleCount > 0 && selectedCount === visibleCount} onChange={onSelectVisible} />
        Select visible lessons
      </label>
      {selectedCount > 0 && (
        <>
          <strong aria-live="polite">{selectedCount} selected</strong>
          <input type="date" value={bulkDate} onChange={(event) => onBulkDateChange(event.target.value)} aria-label="Move selected lessons to date" />
          <button onClick={onMove}>Move</button>
          <select value={bulkTeacher} onChange={(event) => onBulkTeacherChange(event.target.value)} aria-label="Assign selected lessons to teacher">
            <option value="">Assign teacher...</option>
            {teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}
          </select>
          <button disabled={!bulkTeacher} onClick={onAssign}>Assign</button>
          <button onClick={onCancel}>Cancel classes</button>
          <button className={styles.dangerAction} onClick={onDelete}>Delete</button>
        </>
      )}
    </section>
  );
}

export default memo(BulkToolbar);