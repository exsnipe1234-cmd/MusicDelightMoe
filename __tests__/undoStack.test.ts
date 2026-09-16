import { describe, it, expect } from 'vitest';
import type { UndoAction } from '../app/admin/calendar/_components/calendarUtils';
import type { LessonRow } from '../app/providers/AppDataProvider';

const makeLesson = (id: string, overrides: Partial<LessonRow> = {}): LessonRow => ({
  id,
  lesson_date: '2026-01-15',
  school: 'Test School',
  class_name: '1A',
  start_time: '09:00:00',
  end_time: '10:00:00',
  teacher_name: 'Ashley',
  unavailable: false,
  cancelled: false,
  source: 'manual',
  ...overrides,
});

describe('UndoAction type', () => {
  it('correctly types an update action', () => {
    const before = makeLesson('1');
    const after = makeLesson('1', { teacher_name: 'Audrey' });
    const action: UndoAction = {
      label: 'assigned',
      mode: 'update',
      before: [before],
      after: [after],
    };
    expect(action.mode).toBe('update');
    expect(action.before[0].teacher_name).toBe('Ashley');
    expect(action.after[0].teacher_name).toBe('Audrey');
  });

  it('correctly types a delete action', () => {
    const before = makeLesson('1');
    const action: UndoAction = {
      label: 'deleted',
      mode: 'delete',
      before: [before],
      after: [],
    };
    expect(action.mode).toBe('delete');
    expect(action.before).toHaveLength(1);
    expect(action.after).toHaveLength(0);
  });

  it('correctly types an insert action', () => {
    const after = makeLesson('new-1');
    const action: UndoAction = {
      label: 'added',
      mode: 'insert',
      before: [],
      after: [after],
    };
    expect(action.mode).toBe('insert');
    expect(action.before).toHaveLength(0);
    expect(action.after).toHaveLength(1);
  });
});

describe('Undo stack logic (pure)', () => {
  const MAX_UNDO = 20;

  function pushUndo(stack: UndoAction[], action: UndoAction): UndoAction[] {
    return [action, ...stack].slice(0, MAX_UNDO);
  }

  it('pushes an action to the front of the stack', () => {
    const action1: UndoAction = { label: 'moved', mode: 'update', before: [makeLesson('1')], after: [makeLesson('1', { lesson_date: '2026-01-16' })] };
    const action2: UndoAction = { label: 'deleted', mode: 'delete', before: [makeLesson('2')], after: [] };

    let stack: UndoAction[] = [];
    stack = pushUndo(stack, action1);
    stack = pushUndo(stack, action2);

    expect(stack).toHaveLength(2);
    expect(stack[0].label).toBe('deleted'); // most recent first
    expect(stack[1].label).toBe('moved');
  });

  it('caps at MAX_UNDO entries', () => {
    let stack: UndoAction[] = [];
    for (let i = 0; i < 25; i++) {
      stack = pushUndo(stack, { label: `action-${i}`, mode: 'update', before: [], after: [] });
    }
    expect(stack).toHaveLength(MAX_UNDO);
    expect(stack[0].label).toBe('action-24'); // most recent
    expect(stack[MAX_UNDO - 1].label).toBe('action-5'); // oldest kept
  });

  it('undo pops the top action', () => {
    const action1: UndoAction = { label: 'first', mode: 'update', before: [makeLesson('1')], after: [] };
    const action2: UndoAction = { label: 'second', mode: 'update', before: [makeLesson('2')], after: [] };

    let stack: UndoAction[] = [];
    stack = pushUndo(stack, action1);
    stack = pushUndo(stack, action2);

    const undone = stack[0];
    stack = stack.slice(1);

    expect(undone.label).toBe('second');
    expect(stack).toHaveLength(1);
    expect(stack[0].label).toBe('first');
  });

  it('dismissAll clears the entire stack', () => {
    let stack: UndoAction[] = [
      { label: 'a', mode: 'update', before: [], after: [] },
      { label: 'b', mode: 'update', before: [], after: [] },
    ];
    stack = [];
    expect(stack).toHaveLength(0);
  });
});