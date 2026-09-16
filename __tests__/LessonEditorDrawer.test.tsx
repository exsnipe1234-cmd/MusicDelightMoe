import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LessonEditorDrawer from '../app/admin/calendar/_components/LessonEditorDrawer';
import type { Draft } from '../app/admin/calendar/_components/calendarUtils';

const teachers = [
  { name: 'Ashley', color: '#d6b94c' },
  { name: 'Audrey', color: '#c77bd5' },
];

const newDraft: Draft = {
  date: '2026-01-15',
  school: '',
  className: '',
  startTime: '09:00',
  endTime: '10:00',
  teacher: '',
  unavailable: false,
  cancelled: false,
};

const editDraft: Draft = {
  id: 'lesson-1',
  date: '2026-01-15',
  school: 'Tampines Primary School',
  className: '4IN',
  startTime: '09:00',
  endTime: '10:00',
  teacher: 'Ashley',
  unavailable: false,
  cancelled: false,
};

describe('LessonEditorDrawer', () => {
  it('renders new lesson form', () => {
    render(
      <LessonEditorDrawer
        draft={newDraft}
        onDraftChange={vi.fn()}
        teachers={teachers}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('NEW LESSON')).toBeInTheDocument();
    expect(screen.getByText('Add lesson')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save lesson/i })).toBeInTheDocument();
  });

  it('renders edit lesson form with school name', () => {
    render(
      <LessonEditorDrawer
        draft={editDraft}
        onDraftChange={vi.fn()}
        teachers={teachers}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('EDIT LESSON')).toBeInTheDocument();
    expect(screen.getByText('Tampines Primary School')).toBeInTheDocument();
  });

  it('shows delete and duplicate buttons for existing lessons', () => {
    render(
      <LessonEditorDrawer
        draft={editDraft}
        onDraftChange={vi.fn()}
        teachers={teachers}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('hides delete and duplicate for new lessons', () => {
    render(
      <LessonEditorDrawer
        draft={newDraft}
        onDraftChange={vi.fn()}
        teachers={teachers}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.queryByText('Duplicate')).toBeNull();
  });

  it('calls onSave when save button clicked', async () => {
    const onSave = vi.fn();
    render(
      <LessonEditorDrawer
        draft={newDraft}
        onDraftChange={vi.fn()}
        teachers={teachers}
        onSave={onSave}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /save lesson/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop clicked', async () => {
    const onClose = vi.fn();
    render(
      <LessonEditorDrawer
        draft={newDraft}
        onDraftChange={vi.fn()}
        teachers={teachers}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onClose={onClose}
      />,
    );
    // Click the backdrop (first child of drawerBackdrop)
    const backdrop = screen.getByRole('dialog').parentElement!;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders teacher options in select', () => {
    render(
      <LessonEditorDrawer
        draft={newDraft}
        onDraftChange={vi.fn()}
        teachers={teachers}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Ashley')).toBeInTheDocument();
    expect(screen.getByText('Audrey')).toBeInTheDocument();
  });

  it('has dialog role for accessibility', () => {
    render(
      <LessonEditorDrawer
        draft={newDraft}
        onDraftChange={vi.fn()}
        teachers={teachers}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});