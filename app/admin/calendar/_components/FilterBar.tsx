'use client';

import { memo } from 'react';
import { Search } from 'lucide-react';
import type { TeacherRow } from '../../../providers/AppDataProvider';
import styles from './calendar.module.css';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  schoolFilter: string;
  onSchoolFilterChange: (value: string) => void;
  teachers: TeacherRow[];
  schools: string[];
  visibleCount: number;
  onClear: () => void;
};

function FilterBar({ search, onSearchChange, filter, onFilterChange, schoolFilter, onSchoolFilterChange, teachers, schools, visibleCount, onClear }: Props) {
  return (
    <section className={styles.filterBar} aria-label="Calendar filters">
      <div className={styles.searchBox}>
        <Search size={17} aria-hidden="true" />
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search school, class or teacher" aria-label="Search lessons" />
      </div>
      <select value={filter} onChange={(event) => onFilterChange(event.target.value)} aria-label="Filter by teacher">
        <option value="all">All teachers</option>
        <option value="unassigned">Unassigned</option>
        <option value="cancelled">Cancelled classes</option>
        {teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}
      </select>
      <select value={schoolFilter} onChange={(event) => onSchoolFilterChange(event.target.value)} aria-label="Filter by school">
        <option value="all">All schools</option>
        {schools.map((school) => <option key={school}>{school}</option>)}
      </select>
      <button onClick={onClear} aria-label="Clear all filters">Clear</button>
      <span aria-live="polite">{visibleCount} lessons</span>
    </section>
  );
}

export default memo(FilterBar);