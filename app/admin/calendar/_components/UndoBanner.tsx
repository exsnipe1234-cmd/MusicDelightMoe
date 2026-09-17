'use client';

import { memo, useEffect, useRef } from 'react';
import { Undo2, X } from 'lucide-react';
import styles from './calendar.module.css';

type Props = {
  action: { label: string } | null;
  stackDepth: number;
  undoing: boolean;
  onUndo: () => void;
  onDismiss: () => void;
  onOpenHistory: () => void;
};

function UndoBanner({ action, stackDepth, undoing, onUndo, onDismiss, onOpenHistory }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!action) return;
    timerRef.current = setTimeout(() => onDismiss(), 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [action, onDismiss]);

  if (!action) return null;

  return (
    <div className={styles.undoToast} role="status" aria-live="polite">
      <div
        className={styles.undoToastContent}
        onClick={onOpenHistory}
        style={{ cursor: 'pointer' }}
        title="Click to view undo history"
      >
        <Undo2 size={14} aria-hidden="true" />
        <span>
          {action.label}
          {stackDepth > 1 ? ` (${stackDepth} total)` : ''}
        </span>
      </div>
      <div className={styles.undoToastActions}>
        <button onClick={onUndo} disabled={undoing}>
          {undoing ? 'Undoing...' : 'Undo'}
        </button>
        <button
          className={styles.undoToastDismiss}
          onClick={onDismiss}
          aria-label="Dismiss all undo history"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default memo(UndoBanner);
