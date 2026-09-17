import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkToolbar from '../app/admin/calendar/_components/BulkToolbar';

const teachers = [
  { name: 'Ashley', color: '#d6b94c' },
  { name: 'Audrey', color: '#c77bd5' },
];

describe('BulkToolbar', () => {
  it('renders select all checkbox', () => {
    render(
      <BulkToolbar
        selectedCount={0}
        visibleCount={10}
        onSelectVisible={vi.fn()}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={vi.fn()}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/Select visible lessons/)).toBeInTheDocument();
  });

  it('shows bulk actions when lessons are selected', () => {
    render(
      <BulkToolbar
        selectedCount={3}
        visibleCount={10}
        onSelectVisible={vi.fn()}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={vi.fn()}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Cancel classes')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides bulk actions when nothing selected', () => {
    render(
      <BulkToolbar
        selectedCount={0}
        visibleCount={10}
        onSelectVisible={vi.fn()}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={vi.fn()}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText('Move')).toBeNull();
  });

  it('disables assign button when no teacher selected', () => {
    render(
      <BulkToolbar
        selectedCount={2}
        visibleCount={10}
        onSelectVisible={vi.fn()}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={vi.fn()}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Assign')).toBeDisabled();
  });

  it('calls onSelectVisible when checkbox toggled', async () => {
    const onSelectVisible = vi.fn();
    render(
      <BulkToolbar
        selectedCount={0}
        visibleCount={10}
        onSelectVisible={onSelectVisible}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={vi.fn()}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onSelectVisible).toHaveBeenCalledOnce();
  });

  it('calls onMove when Move clicked', async () => {
    const onMove = vi.fn();
    render(
      <BulkToolbar
        selectedCount={2}
        visibleCount={10}
        onSelectVisible={vi.fn()}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={onMove}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('Move'));
    expect(onMove).toHaveBeenCalledOnce();
  });

  it('calls onDelete when Delete clicked', async () => {
    const onDelete = vi.fn();
    render(
      <BulkToolbar
        selectedCount={2}
        visibleCount={10}
        onSelectVisible={vi.fn()}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={vi.fn()}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('checkbox is checked when all visible are selected', () => {
    render(
      <BulkToolbar
        selectedCount={10}
        visibleCount={10}
        onSelectVisible={vi.fn()}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={vi.fn()}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('checkbox is unchecked when not all visible are selected', () => {
    render(
      <BulkToolbar
        selectedCount={3}
        visibleCount={10}
        onSelectVisible={vi.fn()}
        bulkDate="2026-01-15"
        onBulkDateChange={vi.fn()}
        bulkTeacher=""
        onBulkTeacherChange={vi.fn()}
        teachers={teachers}
        onMove={vi.fn()}
        onAssign={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
