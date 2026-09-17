'use client';

import { memo } from 'react';
import { BarChart3, ChevronDown, ChevronRight, School } from 'lucide-react';
import styles from './calendar.module.css';

type TeacherWorkload = { name: string; count: number; hours: number };
type SchoolWorkload = { name: string; count: number };

type Props = {
  teacherWorkload: TeacherWorkload[];
  schoolWorkload: SchoolWorkload[];
  teacherMaxHours: Map<string, number>;
  cancelledCount: number;
  filter: string;
  onTeacherFilter: (name: string) => void;
  onSchoolFilter: (name: string) => void;
  onCancelledFilter: () => void;
  teacherColour: (name: string | null) => string;
  workloadCollapsed: boolean;
  onToggleWorkload: () => void;
  schoolWorkloadCollapsed: boolean;
  onToggleSchoolWorkload: () => void;
};

function WorkloadPanels({
  teacherWorkload,
  schoolWorkload,
  teacherMaxHours,
  cancelledCount,
  filter,
  onTeacherFilter,
  onSchoolFilter,
  onCancelledFilter,
  teacherColour,
  workloadCollapsed,
  onToggleWorkload,
  schoolWorkloadCollapsed,
  onToggleSchoolWorkload,
}: Props) {
  const totalTeacherLessons = teacherWorkload.reduce((sum, { count }) => sum + count, 0);
  const totalTeacherHours = teacherWorkload.reduce((sum, { hours }) => sum + hours, 0);
  const totalSchoolLessons = schoolWorkload.reduce((sum, { count }) => sum + count, 0);

  return (
    <>
      <section className={styles.workloadPanel} aria-label="Teacher workload summary">
        <div className={styles.workloadHeading}>
          <BarChart3 size={18} aria-hidden="true" />
          <div>
            <p>VISIBLE RANGE</p>
            <h2>Teacher workload</h2>
          </div>
          <button
            className={styles.workloadToggle}
            onClick={onToggleWorkload}
            aria-label={workloadCollapsed ? 'Expand teacher workload' : 'Collapse teacher workload'}
          >
            {workloadCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {workloadCollapsed ? (
          <span className={styles.workloadSummary}>
            {teacherWorkload.length} teacher{teacherWorkload.length !== 1 ? 's' : ''} ·{' '}
            {totalTeacherLessons} lesson{totalTeacherLessons !== 1 ? 's' : ''} ·{' '}
            {totalTeacherHours.toFixed(1)}h{cancelledCount > 0 && ` · ${cancelledCount} cancelled`}
          </span>
        ) : (
          <div className={styles.workloadStats}>
            {teacherWorkload.length === 0 ? (
              <span className={styles.empty}>No lessons match the current filters.</span>
            ) : (
              teacherWorkload.map(({ name, count, hours }) => {
                const maxHours = teacherMaxHours.get(name);
                const pct = maxHours ? Math.min(100, (hours / maxHours) * 100) : 0;
                const isOver = maxHours ? hours > maxHours : false;
                const isWarn = maxHours ? hours >= maxHours * 0.8 && !isOver : false;
                return (
                  <button
                    key={name}
                    onClick={() => onTeacherFilter(name === 'Unassigned' ? 'unassigned' : name)}
                    aria-label={`Filter by ${name}: ${count} lesson${count === 1 ? '' : 's'}, ${hours.toFixed(1)} hours`}
                  >
                    <i
                      style={{ background: teacherColour(name === 'Unassigned' ? null : name) }}
                      aria-hidden="true"
                    />
                    <span>{name}</span>
                    <strong>{count}</strong>
                    <small>{hours.toFixed(1)}h</small>
                    {maxHours && (
                      <div
                        className={`${styles.workloadBar} ${isOver ? styles.workloadBarOver : isWarn ? styles.workloadBarWarn : ''}`}
                        title={`${hours.toFixed(1)} / ${maxHours}h target`}
                      >
                        <div style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
            <button
              className={filter === 'cancelled' ? styles.active : ''}
              onClick={onCancelledFilter}
              aria-label={`Filter cancelled classes: ${cancelledCount} class${cancelledCount === 1 ? '' : 'es'}`}
            >
              <i style={{ background: '#f87171' }} aria-hidden="true" />
              <span>Cancelled</span>
              <strong>{cancelledCount}</strong>
              <small>class{cancelledCount === 1 ? '' : 'es'}</small>
            </button>
          </div>
        )}
      </section>
      <section className={styles.workloadPanel} aria-label="School workload summary">
        <div className={styles.workloadHeading}>
          <School size={18} aria-hidden="true" />
          <div>
            <p>VISIBLE RANGE</p>
            <h2>Lessons by school</h2>
          </div>
          <button
            className={styles.workloadToggle}
            onClick={onToggleSchoolWorkload}
            aria-label={
              schoolWorkloadCollapsed ? 'Expand school workload' : 'Collapse school workload'
            }
          >
            {schoolWorkloadCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {schoolWorkloadCollapsed ? (
          <span className={styles.workloadSummary}>
            {schoolWorkload.length} school{schoolWorkload.length !== 1 ? 's' : ''} ·{' '}
            {totalSchoolLessons} lesson{totalSchoolLessons !== 1 ? 's' : ''}
          </span>
        ) : (
          <div className={styles.workloadStats}>
            {schoolWorkload.length === 0 ? (
              <span className={styles.empty}>No school lessons in this range.</span>
            ) : (
              schoolWorkload.map(({ name, count }) => (
                <button
                  key={name}
                  onClick={() => onSchoolFilter(name)}
                  aria-label={`Filter by ${name}: ${count} lesson${count === 1 ? '' : 's'}`}
                >
                  <i style={{ background: '#55d6cf' }} aria-hidden="true" />
                  <span>{name}</span>
                  <strong>{count}</strong>
                  <small>lesson{count === 1 ? '' : 's'}</small>
                </button>
              ))
            )}
          </div>
        )}
      </section>
    </>
  );
}

export default memo(WorkloadPanels);
