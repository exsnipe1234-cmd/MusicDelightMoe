import { describe, it, expect } from 'vitest';
import {
  key,
  normalizeSchool,
  rgba,
  flatColour,
  escapeHtml,
  mapsSchool,
  mapsUrl,
  pretty,
  blankDraft,
  blankQuickRow,
  blankRecurring,
  currentMonthRange,
  defaultTeacherColours,
} from '../app/admin/calendar/_components/calendarUtils';
import { teacherInitials } from '../app/admin/calendar/_components/teacherInitials';

describe('key', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(key(new Date('2026-01-15'))).toBe('2026-01-15');
  });

  it('pads single-digit month and day', () => {
    expect(key(new Date('2026-03-05'))).toBe('2026-03-05');
  });

  it('handles year-end dates', () => {
    expect(key(new Date('2025-12-31'))).toBe('2025-12-31');
  });
});

describe('normalizeSchool', () => {
  it('lowercases and removes parentheticals', () => {
    expect(normalizeSchool('Ang Mo Kio Primary School (AMK)')).toBe('ang mo kio primary school');
  });

  it('expands "pri" to "primary school"', () => {
    expect(normalizeSchool('Tampines Pri')).toBe('tampines primary school');
  });

  it('expands "ps" to "primary school"', () => {
    expect(normalizeSchool('Hougang PS')).toBe('hougang primary school');
  });

  it('removes trailing class codes', () => {
    expect(normalizeSchool('Clementi Primary School 3A')).toBe('clementi primary school');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeSchool('  River   Valley   High  ')).toBe('river valley high');
  });

  it('does not strip "cca" when not handled', () => {
    // normalizeSchool does not strip CCA — the regex targets "pri"/"ps" only
    expect(normalizeSchool('Nan Chiau CCA')).toBe('nan chiau cca');
  });
});

describe('rgba', () => {
  it('converts hex to rgba with alpha', () => {
    expect(rgba('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
  });

  it('handles 3-digit hex', () => {
    expect(rgba('#f00', 0.3)).toBe('rgba(255,0,0,0.3)');
  });

  it('returns fallback for invalid hex', () => {
    expect(rgba('not-a-color', 0.5)).toBe('rgba(124,140,255,0.5)');
  });
});

describe('flatColour', () => {
  it('lightens a hex colour by mixing with white', () => {
    const result = flatColour('#ff0000');
    expect(result).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    // Red mixed with white should be a light pink
    const parts = result.match(/\d+/g)!.map(Number);
    expect(parts[0]).toBeGreaterThan(200); // R should be high (red + white)
    expect(parts[1]).toBeGreaterThan(200); // G should be high (white)
    expect(parts[2]).toBeGreaterThan(200); // B should be high (white)
  });

  it('returns fallback for invalid hex', () => {
    expect(flatColour('not-a-color')).toBe('#eef0ff');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('mapsSchool', () => {
  it('appends "primary school" when missing', () => {
    expect(mapsSchool('Tampines')).toBe('Tampines Primary School');
  });

  it('preserves "secondary school"', () => {
    expect(mapsSchool('Clementi Secondary School')).toBe('Clementi Secondary School');
  });

  it('title-cases the result', () => {
    expect(mapsSchool('ang mo kio primary school')).toBe('Ang Mo Kio Primary School');
  });
});

describe('mapsUrl', () => {
  it('generates a Google Maps search URL with encoded school name', () => {
    const url = mapsUrl('Tampines Primary School');
    expect(url).toContain('google.com/maps/search');
    expect(url).toContain('Tampines%20Primary%20School%20Singapore');
  });
});

describe('pretty', () => {
  it('formats a date string in en-SG locale', () => {
    const result = pretty('2026-01-15');
    expect(result).toContain('January');
    expect(result).toContain('2026');
    expect(result).toContain('15');
  });
});

describe('blankDraft', () => {
  it('returns a draft with defaults', () => {
    const draft = blankDraft('2026-01-15');
    expect(draft.date).toBe('2026-01-15');
    expect(draft.school).toBe('');
    expect(draft.className).toBe('');
    expect(draft.startTime).toBe('08:00');
    expect(draft.endTime).toBe('09:00');
    expect(draft.teacher).toBe('');
    expect(draft.unavailable).toBe(false);
    expect(draft.cancelled).toBe(false);
    expect(draft.id).toBeUndefined();
  });
});

describe('blankQuickRow', () => {
  it('returns a quick row with defaults', () => {
    const row = blankQuickRow('2026-01-15', 'Ashley');
    expect(row.date).toBe('2026-01-15');
    expect(row.teacher).toBe('Ashley');
    expect(row.school).toBe('');
    expect(row.className).toBe('');
  });
});

describe('blankRecurring', () => {
  it('returns a recurring draft with Monday selected', () => {
    const draft = blankRecurring();
    expect(draft.weekdays).toEqual([1]); // Monday
    expect(draft.school).toBe('');
    expect(draft.startTime).toBe('09:00');
  });
});

describe('currentMonthRange', () => {
  it('returns the current month range', () => {
    const range = currentMonthRange();
    expect(range.view).toBe('dayGridMonth');
    expect(range.start).toMatch(/^\d{4}-\d{2}-01$/); // first of month
    expect(range.end > range.start).toBe(true);
  });
});

describe('defaultTeacherColours', () => {
  it('contains known teachers', () => {
    expect(defaultTeacherColours).toHaveProperty('ashley');
    expect(defaultTeacherColours).toHaveProperty('audrey');
    expect(defaultTeacherColours).toHaveProperty('claris');
  });

  it('all values are valid hex colours', () => {
    Object.values(defaultTeacherColours).forEach((colour) => {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('teacherInitials', () => {
  it('returns initials for a two-word name', () => {
    expect(teacherInitials('Shi Yi')).toBe('SY');
  });

  it('returns first two letters for a single-word name', () => {
    expect(teacherInitials('Ashley')).toBe('AS');
  });

  it('returns ? for null', () => {
    expect(teacherInitials(null)).toBe('?');
  });

  it('returns ? for Unassigned', () => {
    expect(teacherInitials('Unassigned')).toBe('?');
  });

  it('uses first and last name for multi-word names', () => {
    expect(teacherInitials('Siew Lynn Tan')).toBe('ST');
  });
});
