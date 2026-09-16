'use client';

import { BarChart3, School } from 'lucide-react';
import styles from './calendar.module.css';

type TeacherWorkload = [string, number];
type SchoolWorkload = { name: string; count: number };

type Props = {
  teacherWorkload: TeacherWorkload[];
  schoolWorkload: SchoolWorkload[];
  cancelledCount: number;
  filter: string;
  onTeacherFilter: (name: string) => void;
  onSchoolFilter: (name: string) => void;
  onCancelledFilter: () => void;
  teacherColour: (name: string | null) => string;
};

export default function WorkloadPanels({ teacherWorkload, schoolWorkload, cancelledCount, filter, onTeacherFilter, onSchoolFilter, onCancelledFilter, teacherColour }: Props) {
  return (
    <>
      <section className={styles.workloadPanel} aria-label="Teacher workload summary">
        <div className={styles.workloadHeading}>
          <BarChart3 size={18} aria-hidden="true" />
          <div>
            <p>VISIBLE RANGE</p>
            <h2>Teacher workload</h2>
          </div>
        </div>
        <div className={styles.workloadStats}>
          {teacherWorkload.length === 0 ? (
            <span className={styles.empty}>No lessons match the current filters.</span>
          ) : (
            teacherWorkload.map(([name, count]) => (
              <button key={name} onClick={() => onTeacherFilter(name === 'Unassigned' ? 'unassigned' : name)} aria-label={`Filter by ${name}: ${count} lesson${count === 1 ? '' : 's'}`}>
                <i style={{ background: teacherColour(name === 'Unassigned' ? null : name) }} aria-hidden="true" />
                <span>{name}</span>
                <strong>{count}</strong>
                <small>lesson{count === 1 ? '' : 's'}</small>
              </button>
            ))
          )}
          <button className={filter === 'cancelled' ? styles.active : ''} onClick={onCancelledFilter} aria-label={`Filter cancelled classes: ${cancelledCount} class${cancelledCount === 1 ? '' : 'es'}`}>
            <i style={{ background: '#f87171' }} aria-hidden="true" />
            <span>Cancelled</span>
            <strong>{cancelledCount}</strong>
            <small>class{cancelledCount === 1 ? '' : 'es'}</small>
          </button>
        </div>
      </section>
      <section className={styles.workloadPanel} aria-label="School workload summary">
        <div className={styles.workloadHeading}>
          <School size={18} aria-hidden="true" />
          <div>
            <p>VISIBLE RANGE</p>
            <h2>Lessons by school</h2>
          </div>
        </div>
        <div className={styles.workloadStats}>
          {schoolWorkload.length === 0 ? (
            <span className={styles.empty}>No school lessons in this range.</span>
          ) : (
            schoolWorkload.map(({ name, count }) => (
              <button key={name} onClick={() => onSchoolFilter(name)} aria-label={`Filter by ${name}: ${count} lesson${count === 1 ? '' : 's'}`}>
                <i style={{ background: '#55d6cf' }} aria-hidden="true" />
                <span>{name}</span>
                <strong>{count}</strong>
                <small>lesson{count === 1 ? '' : 's'}</small>
              </button>
            ))
          )}
        </div>
      </section>
    </>
  );
}