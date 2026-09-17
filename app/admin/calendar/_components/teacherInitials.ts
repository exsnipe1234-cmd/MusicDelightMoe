/** Extract up to 2 initials from a name for colour-blind accessibility badges. */
export function teacherInitials(name: string | null): string {
  if (!name || name === 'Unassigned') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
