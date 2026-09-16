import type { LessonRow } from '../../../providers/AppDataProvider';

export type Draft = { id?: string; date: string; school: string; className: string; startTime: string; endTime: string; teacher: string; unavailable: boolean; cancelled: boolean };
export type Range = { start: string; end: string; view: string; currentStart: string; currentEnd: string };
export type QuickRow = { id: number; date: string; startTime: string; endTime: string; school: string; className: string; teacher: string };
export type UndoAction = { label: string; mode: 'update' | 'delete' | 'insert'; before: LessonRow[]; after: LessonRow[] };
export type RecurringDraft = { school: string; className: string; startTime: string; endTime: string; teacher: string; startDate: string; endDate: string; weekdays: number[] };
export type NativeWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

export const blankDraft = (date = new Date().toISOString().slice(0, 10)): Draft => ({ date, school: '', className: '', startTime: '09:00', endTime: '10:00', teacher: '', unavailable: false, cancelled: false });
export const blankQuickRow = (date: string, teacher = ''): QuickRow => ({ id: Date.now(), date, startTime: '09:00', endTime: '10:00', school: '', className: '', teacher });
export const blankRecurring = (): RecurringDraft => ({ school: '', className: '', startTime: '09:00', endTime: '10:00', teacher: '', startDate: key(new Date()), endDate: key(new Date()), weekdays: [1] });

export const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const currentMonthRange = (): Range => {
  const start = new Date(); start.setDate(1);
  const end = new Date(start); end.setMonth(end.getMonth() + 1);
  return { start: key(start), end: key(end), view: 'dayGridMonth', currentStart: key(start), currentEnd: key(end) };
};

export const pretty = (value: string) => new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));

export const rgba = (hex: string, alpha: number) => {
  const safe = hex.replace('#', '');
  const full = safe.length === 3 ? safe.split('').map((part) => part + part).join('') : safe;
  const value = Number.parseInt(full, 16);
  return Number.isFinite(value) ? `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})` : `rgba(124,140,255,${alpha})`;
};

export const flatColour = (hex: string) => {
  const safe = hex.replace('#', '');
  const full = safe.length === 3 ? safe.split('').map((part) => part + part).join('') : safe;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return '#eef0ff';
  const mix = (channel: number) => Math.round(channel * 0.18 + 255 * 0.82);
  return `rgb(${mix((value >> 16) & 255)},${mix((value >> 8) & 255)},${mix(value & 255)})`;
};

export const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);

export const mapsSchool = (value: string) => {
  let school = value.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\bcca\b/gi, '').replace(/\bpri\b/gi, 'primary school').replace(/\bps\b(?!\s+school)/gi, 'primary school').replace(/\bprimary school\b\s+primary school\b/gi, 'primary school').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!school.includes('school') && !school.includes('secondary') && !school.includes('junior')) school = `${school} primary school`;
  return school.replace(/\b\w/g, (char) => char.toUpperCase());
};

export const mapsUrl = (school: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mapsSchool(school)} Singapore`)}`;

export const normalizeSchool = (value: string) => value.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\bpri\b/g, 'primary school').replace(/\bps\b(?!\s+school)/g, 'primary school').replace(/\bprimary school\b\s+primary school\b/g, 'primary school').replace(/\s+[a-z]?\d{1,2}[a-z]{0,3}\s*$/g, '').replace(/\s+/g, ' ').trim();

/**
 * Generate a deterministic colour from a teacher name using a simple hash.
 * Produces HSL colours at 55% saturation and 58% lightness for consistent contrast.
 * Falls back to #7c8cff for empty/null names.
 */
export function colourFromName(name: string | null): string {
  if (!name || name.trim().length === 0) return '#7c8cff';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 58%)`;
}

/**
 * Legacy colour map kept for backward compatibility with existing teachers
 * that already have assigned colours in the database.
 */
export const defaultTeacherColours: Record<string, string> = { ashley: '#d6b94c', audrey: '#c77bd5', claris: '#59b879', edward: '#55b9e6', gerald: '#45c7c0', joel: '#9ba3b1', 'shi yi': '#9878df', 'siew lynn': '#e49ab9', wero: '#cbb98d' };