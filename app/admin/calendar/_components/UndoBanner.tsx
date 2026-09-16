'use client';

import styles from './calendar.module.css';

type Props = {
  action: { label: string } | null;
  stackDepth: number;
  undoing: boolean;
  onUndo: () => void;
  onDismiss: () => void;
};

export default function UndoBanner({ action, stackDepth, undoing, onUndo, onDismiss }: Props) {
  if (!action) return null;

  return (
    <div className={styles.undoBanner} role="status" aria-live="polite">
      <span>Last change: {action.label}{stackDepth > 1 ? ` (${stackDepth} total)` : ''}</span>
      <button onClick={onUndo} disabled={undoing}>
        {undoing ? 'Undoing...' : 'Undo'}
      </button>
      <button className={styles.dismissUndo} onClick={onDismiss} aria-label="Dismiss all undo history">
        Dismiss all
      </button>
    </div>
  );
}