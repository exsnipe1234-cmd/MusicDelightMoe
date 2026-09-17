'use client';

import { useEffect, useRef } from 'react';
import type FullCalendar from '@fullcalendar/react';

type ShortcutHandlers = {
  onQuickAdd: () => void;
  onUndo: () => void;
  onCloseAll: () => void;
  calendarRef: React.RefObject<FullCalendar | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
};

export function useKeyboardShortcuts({
  onQuickAdd,
  onUndo,
  onCloseAll,
  calendarRef,
  searchInputRef,
}: ShortcutHandlers) {
  const handlersRef = useRef({ onQuickAdd, onUndo, onCloseAll });
  handlersRef.current = { onQuickAdd, onUndo, onCloseAll };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Slash always focuses search (even in inputs, it's the search shortcut)
      if (event.key === '/' && !isInput) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Other shortcuts only work when not in an input
      if (isInput) return;

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        handlersRef.current.onQuickAdd();
        return;
      }

      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        calendarRef.current?.getApi().today();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        handlersRef.current.onUndo();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handlersRef.current.onCloseAll();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calendarRef, searchInputRef]);
}
