import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UndoBanner from '../app/admin/calendar/_components/UndoBanner';

describe('UndoBanner', () => {
  it('renders nothing when action is null', () => {
    const { container } = render(
      <UndoBanner
        action={null}
        stackDepth={0}
        undoing={false}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the action label', () => {
    render(
      <UndoBanner
        action={{ label: 'moved' }}
        stackDepth={1}
        undoing={false}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Last change: moved/)).toBeInTheDocument();
  });

  it('shows stack depth when > 1', () => {
    render(
      <UndoBanner
        action={{ label: 'deleted' }}
        stackDepth={3}
        undoing={false}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/\(3 total\)/)).toBeInTheDocument();
  });

  it('does not show stack depth when 1', () => {
    render(
      <UndoBanner
        action={{ label: 'added' }}
        stackDepth={1}
        undoing={false}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByText(/total/)).toBeNull();
  });

  it('calls onUndo when Undo button clicked', async () => {
    const onUndo = vi.fn();
    render(
      <UndoBanner
        action={{ label: 'moved' }}
        stackDepth={1}
        undoing={false}
        onUndo={onUndo}
        onDismiss={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('Undo'));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('disables Undo button when undoing', () => {
    render(
      <UndoBanner
        action={{ label: 'moved' }}
        stackDepth={1}
        undoing={true}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Undoing...')).toBeDisabled();
  });

  it('calls onDismiss when Dismiss all clicked', async () => {
    const onDismiss = vi.fn();
    render(
      <UndoBanner
        action={{ label: 'moved' }}
        stackDepth={1}
        undoing={false}
        onUndo={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.click(screen.getByLabelText('Dismiss all undo history'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('has aria-live polite for screen readers', () => {
    render(
      <UndoBanner
        action={{ label: 'moved' }}
        stackDepth={1}
        undoing={false}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
