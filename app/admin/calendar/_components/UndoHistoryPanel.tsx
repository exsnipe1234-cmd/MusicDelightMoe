'use client';

import { memo } from 'react';
import { History, X } from 'lucide-react';
import type { UndoAction } from './calendarUtils';
import styles from './calendar.module.css';

type Props = {
  stack: UndoAction[];
  undoing: boolean;
  onUndoUpTo: (index: number) => void;
  onDismissAll: () => void;
  onClose: () => void;
};

function UndoHistoryPanel({ stack, undoing, onUndoUpTo, onDismissAll, onClose }: Props) {
  if (!stack.length) return null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.undoHistoryBackdrop} onMouseDown={onClose}>
      <div
        className={styles.undoHistoryPanel}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Undo history"
      >
        <div className={styles.undoHistoryHeader}>
          <div>
            <History size={16} />
            <strong>Undo history</strong>
          </div>
          <button onClick={onClose} aria-label="Close undo history">
            <X size={16} />
          </button>
        </div>
        <div className={styles.undoHistoryList}>
          {stack.map((action, index) => (
            <button
              key={`${action.timestamp}-${index}`}
              className={styles.undoHistoryItem}
              onClick={() => onUndoUpTo(index)}
              disabled={undoing}
            >
              <span className={styles.undoHistoryTime}>{formatTime(action.timestamp)}</span>
              <span className={styles.undoHistoryLabel}>{action.label}</span>
              <span className={styles.undoHistoryCount}>
                {action.mode === 'insert'
                  ? `+${action.after.length}`
                  : action.mode === 'delete'
                    ? `-${action.before.length}`
                    : `${action.before.length}`}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.undoHistoryFooter}>
          <button onClick={onDismissAll} className={styles.undoHistoryDismiss}>
            Clear all history
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(UndoHistoryPanel);
