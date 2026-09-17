'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Copy, Trash2, X } from 'lucide-react';
import type { TeacherRow } from '../../../providers/AppDataProvider';
import type { LessonRow } from '../../../providers/AppDataProvider';
import styles from './calendar.module.css';

type ContextMenuState = {
  x: number;
  y: number;
  lesson: LessonRow;
} | null;

type Props = {
  state: ContextMenuState;
  teachers: TeacherRow[];
  onClose: () => void;
  onEdit: (lesson: LessonRow) => void;
  onDuplicate: (lesson: LessonRow) => void;
  onMoveToTomorrow: (lesson: LessonRow) => void;
  onAssign: (lesson: LessonRow, teacher: string) => void;
  onCancel: (lesson: LessonRow) => void;
  onDelete: (lesson: LessonRow) => void;
};

function ContextMenu({
  state,
  teachers,
  onClose,
  onEdit,
  onDuplicate,
  onMoveToTomorrow,
  onAssign,
  onCancel,
  onDelete,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!state) return;
    // Adjust position to stay within viewport
    const menuWidth = 200;
    const menuHeight = assignOpen ? 350 : 220;
    let x = state.x;
    let y = state.y;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;
    setPos({ x, y });
  }, [state, assignOpen]);

  useEffect(() => {
    if (!state) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const menu = (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      <button
        onClick={() => {
          onEdit(state.lesson);
          onClose();
        }}
        role="menuitem"
      >
        Edit lesson
      </button>
      <button
        onClick={() => {
          onDuplicate(state.lesson);
          onClose();
        }}
        role="menuitem"
      >
        <Copy size={14} /> Duplicate
      </button>
      <button
        onClick={() => {
          onMoveToTomorrow(state.lesson);
          onClose();
        }}
        role="menuitem"
      >
        Move to tomorrow
      </button>
      <div className={styles.contextMenuDivider} />
      <button
        onClick={() => setAssignOpen((v) => !v)}
        role="menuitem"
        className={styles.contextMenuExpandable}
      >
        <span>Assign to...</span>
        <ChevronRight size={14} className={assignOpen ? styles.rotated : ''} />
      </button>
      {assignOpen && (
        <div className={styles.contextSubmenu}>
          {teachers.map((teacher) => (
            <button
              key={teacher.name}
              onClick={() => {
                onAssign(state.lesson, teacher.name);
                onClose();
              }}
              role="menuitem"
            >
              <i style={{ background: teacher.color }} />
              {teacher.name}
            </button>
          ))}
        </div>
      )}
      <div className={styles.contextMenuDivider} />
      <button
        onClick={() => {
          onCancel(state.lesson);
          onClose();
        }}
        role="menuitem"
      >
        Cancel lesson
      </button>
      <button
        onClick={() => {
          onDelete(state.lesson);
          onClose();
        }}
        role="menuitem"
        className={styles.contextMenuDanger}
      >
        <Trash2 size={14} /> Delete lesson
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}

export default memo(ContextMenu);
