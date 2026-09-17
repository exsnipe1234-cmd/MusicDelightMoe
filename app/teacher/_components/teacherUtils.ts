export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const parseLocalDate = (value: string) => new Date(`${value}T12:00:00`);

export const formatTime = (value: string) => value.slice(0, 5);

export const mapsUrl = (school: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mapsSchool(school)} Singapore`)}`;

const mapsSchool = (value: string) => {
  let school = value
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\bcca\b/gi, '')
    .replace(/\bpri\b/gi, 'primary school')
    .replace(/\bps\b(?!\s+school)/gi, 'primary school')
    .replace(/\bprimary school\b\s+primary school\b/gi, 'primary school')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!school.includes('school') && !school.includes('secondary') && !school.includes('junior'))
    school = `${school} primary school`;
  return school.replace(/\b\w/g, (char) => char.toUpperCase());
};

export const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.slice(0, 5).split(':').map(Number);
  const [eh, em] = end.slice(0, 5).split(':').map(Number);
  return Math.max(0, eh * 60 + em - sh * 60 - sm);
};
