'use client';

import type { LessonRow } from '../../../providers/AppDataProvider';
import { escapeHtml, key, pretty, rgba } from './calendarUtils';

type ExportRange = { start: string; end: string };

export function openPrintPreview(
  title: string,
  body: string,
  landscape: boolean,
  exportRange: ExportRange,
  exportLessons: LessonRow[],
  onMessage: (msg: string) => void,
) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:5mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;padding:22px;background:#e8edf5}.page{max-width:${landscape ? '1200px' : '850px'};margin:auto;background:white;padding:24px;box-shadow:0 12px 36px rgba(15,23,42,.16)}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #6556d9;padding:0 0 13px;margin-bottom:16px}h1{margin:0;color:#17214a;font-size:25px;letter-spacing:-.02em}header p{margin:5px 0 0;color:#60708a;font-size:12px;font-weight:600}.actions{display:flex;gap:8px}.actions button{border:0;border-radius:8px;padding:9px 13px;background:#5546cb;color:white;font-weight:700;cursor:pointer}.actions button.secondary{background:#e8edf5;color:#334155}@media print{body{padding:0;background:white}.page{max-width:none;box-shadow:none;padding:0}.actions{display:none}}</style></head><body><div class="page"><header><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(pretty(exportRange.start))} to ${escapeHtml(pretty(exportRange.end))} \u00b7 ${exportLessons.length} lessons</p></div><div class="actions"><button onclick="window.print()">Print / Save PDF</button><button class="secondary" onclick="window.close()">Close</button></div></header>${body}</div></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, '_blank');
  if (!popup) {
    URL.revokeObjectURL(url);
    onMessage('Please allow pop-ups to open the export preview.');
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  onMessage(`${title} preview opened. Click \u201cPrint / Save PDF\u201d.`);
}

export function buildCalendarPdfBody(
  exportLessons: LessonRow[],
  exportRange: ExportRange,
  teacherColour: (name: string | null) => string,
): string {
  const byDate = new Map<string, LessonRow[]>();
  exportLessons.forEach((lesson) =>
    byDate.set(lesson.lesson_date, [...(byDate.get(lesson.lesson_date) ?? []), lesson]),
  );
  const start = new Date(`${exportRange.start}T12:00:00`);
  const end = new Date(`${exportRange.end}T12:00:00`);
  const cells: string[] = Array.from(
    { length: start.getDay() },
    () => '<section class="day empty"></section>',
  );
  for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
    const date = key(cursor);
    const items = (byDate.get(date) ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time));
    cells.push(
      `<section class="day"><div class="date"><strong>${cursor.getDate()}</strong><span>${cursor.toLocaleDateString('en-SG', { weekday: 'short' })}</span></div>${items
        .map((lesson) => {
          const c = teacherColour(lesson.teacher_name);
          return `<div class="lesson" style="border-left-color:${escapeHtml(c)};background:${escapeHtml(rgba(c, 0.13))}"><b>${escapeHtml(lesson.start_time.slice(0, 5))}\u2013${escapeHtml(lesson.end_time.slice(0, 5))}</b><span>${escapeHtml(lesson.school)}</span><small>${escapeHtml(lesson.class_name)} - ${escapeHtml(lesson.teacher_name ?? 'Unassigned')}</small></div>`;
        })
        .join('')}</section>`,
    );
  }
  return `<style>.weekdays,.grid{display:grid;grid-template-columns:repeat(7,1fr)}.weekdays div{padding:6px 5px;text-align:center;background:#1d2753;border-right:1px solid rgba(255,255,255,.16);color:#fff;font-size:9px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.weekdays div:first-child{border-radius:7px 0 0 0}.weekdays div:last-child{border:0;border-radius:0 7px 0 0}.day{min-height:92px;border-right:1px solid #d7deeb;border-bottom:1px solid #d7deeb;padding:4px;background:#fff}.day:nth-child(7n+1){border-left:1px solid #d7deeb}.day.empty{background:#f4f6fa}.date{display:flex;justify-content:space-between;align-items:center;color:#66738b;font-size:8px;font-weight:700;margin:0 1px 4px}.date strong{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#eef1fb;color:#27345f;font-size:10px}.lesson{display:grid;gap:1px;margin-bottom:3px;padding:3px 4px;border-left:3px solid;border-radius:4px;box-shadow:0 1px 2px rgba(15,23,42,.08);font-size:8px;line-height:1.15}.lesson b{color:#24304b;font-size:7px;white-space:nowrap}.lesson span{color:#16213d;font-weight:800;overflow-wrap:anywhere}.lesson small{color:#56647b;font-size:7px;font-weight:600;overflow-wrap:anywhere}</style><div class="weekdays"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div><div class="grid">${cells.join('')}</div>`;
}

export function buildSchedulePdfBody(
  exportLessons: LessonRow[],
  teacherColour: (name: string | null) => string,
): string {
  const groups = new Map<string, LessonRow[]>();
  exportLessons.forEach((lesson) => {
    const name = lesson.teacher_name ?? 'Unassigned';
    groups.set(name, [...(groups.get(name) ?? []), lesson]);
  });
  const sections = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, rows]) => {
      const c = teacherColour(name === 'Unassigned' ? null : name);
      const list = rows
        .sort(
          (a, b) =>
            a.lesson_date.localeCompare(b.lesson_date) || a.start_time.localeCompare(b.start_time),
        )
        .map(
          (lesson) =>
            `<tr><td>${escapeHtml(pretty(lesson.lesson_date))}</td><td>${escapeHtml(lesson.start_time.slice(0, 5))}\u2013${escapeHtml(lesson.end_time.slice(0, 5))}</td><td>${escapeHtml(lesson.school)}</td><td>${escapeHtml(lesson.class_name)}</td></tr>`,
        )
        .join('');
      return `<section class="teacher"><h2 style="border-left-color:${escapeHtml(c)}">${escapeHtml(name)} <small>${rows.length} lesson${rows.length === 1 ? '' : 's'}</small></h2><table><thead><tr><th>Date</th><th>Time</th><th>School</th><th>Class / Programme</th></tr></thead><tbody>${list}</tbody></table></section>`;
    })
    .join('');
  return `<style>.teacher{break-inside:avoid;margin-bottom:18px}.teacher h2{border-left:6px solid;padding:8px 10px;margin:0 0 8px;background:#f8fafc;font-size:16px}.teacher h2 small{color:#64748b;font-size:11px;font-weight:500;margin-left:8px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#e2e8f0;text-align:left}th,td{padding:7px;border:1px solid #cbd5e1;vertical-align:top}</style>${sections}`;
}
