'use client';

import Link from 'next/link';
import { ChangeEvent, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Loader2, Upload, XCircle } from 'lucide-react';

type ImportedLesson = {
  id: number;
  date: string;
  school: string;
  className: string;
  startTime: string;
  endTime: string;
  teacher: string | null;
  unavailable: boolean;
};

type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
};

const teacherNames = ['Audrey Jansen', 'Siew Lynn', 'Shi Yi', 'Claris', 'Gerald', 'Edward', 'Wero', 'Joel', 'Audrey', 'Ashley'];
const schoolNames = [
  'Compassvale Primary School',
  'Meridian Primary School',
  'Chongfu Primary School',
  'Valour Primary School',
  'Rulang Primary School',
  'Bukit Timah Primary School',
  'Bukit Timah PS',
  'Farrer Park CCA',
  'Monfort Junior',
  'River Valley',
  'Rulang Pri',
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toTime(value: string) {
  const cleaned = value.replace('.', '').replace(':', '').padStart(4, '0');
  return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
}

function splitSchoolAndClass(value: string) {
  const school = schoolNames.find((name) => value.toLowerCase().startsWith(name.toLowerCase()));
  if (!school) {
    const words = value.trim().split(/\s+/);
    return { school: words.slice(0, Math.min(3, words.length)).join(' '), className: words.slice(Math.min(3, words.length)).join(' ') || 'Programme' };
  }
  return { school, className: value.slice(school.length).trim() || 'Programme' };
}

function parseLessonLine(line: string, date: string, id: number): ImportedLesson | null {
  const normalized = line.replace(/\s+/g, ' ').trim();
  const timeMatch = normalized.match(/(\d{1,2}[.:]?\d{2})\s*-\s*(\d{1,2}[.:]?\d{2})/);
  if (!timeMatch || timeMatch.index === undefined) return null;

  const beforeTime = normalized.slice(0, timeMatch.index).trim();
  const afterTime = normalized.slice(timeMatch.index + timeMatch[0].length).trim();
  const matchedTeacher = teacherNames.find((teacher) => afterTime.toLowerCase().endsWith(teacher.toLowerCase()));
  const teacher = matchedTeacher === 'Audrey Jansen' ? 'Audrey' : matchedTeacher ?? null;
  const { school, className } = splitSchoolAndClass(beforeTime);

  return {
    id,
    date,
    school,
    className,
    startTime: toTime(timeMatch[1]),
    endTime: toTime(timeMatch[2]),
    teacher,
    unavailable: false,
  };
}

function dateForCell(year: number, monthIndex: number, cellIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const gridStart = new Date(year, monthIndex, 1 - first.getDay());
  gridStart.setDate(gridStart.getDate() + cellIndex);
  return `${gridStart.getFullYear()}-${pad(gridStart.getMonth() + 1)}-${pad(gridStart.getDate())}`;
}

async function extractLessons(file: File): Promise<{ lessons: ImportedLesson[]; monthName: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = (content.items as PdfTextItem[])
    .filter((item) => item.str.trim())
    .map((item) => ({
      text: item.str.trim(),
      x: item.transform[4],
      top: viewport.height - item.transform[5],
    }));

  const title = items.map((item) => item.text).join(' ').match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
  if (!title) throw new Error('The month and year could not be detected from this PDF.');

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthIndex = monthNames.findIndex((name) => name.toLowerCase() === title[1].toLowerCase());
  const year = Number(title[2]);

  const dateItems = items.filter((item) => /^\d{1,2}$/.test(item.text) && item.top > 80);
  const rowGroups = new Map<number, typeof dateItems>();
  for (const item of dateItems) {
    const rowKey = Math.round(item.top / 4) * 4;
    const group = rowGroups.get(rowKey) ?? [];
    group.push(item);
    rowGroups.set(rowKey, group);
  }

  const rows = [...rowGroups.entries()]
    .filter(([, group]) => group.length >= 7)
    .sort(([a], [b]) => a - b)
    .slice(0, 6);
  if (rows.length < 5) throw new Error('The calendar grid could not be detected. Please use the standard Music Delight MOE calendar PDF.');

  const firstRowDates = rows[0][1].sort((a, b) => a.x - b.x).slice(0, 7);
  const columnStarts = firstRowDates.map((item) => item.x - 1);
  const rowStarts = rows.map(([top]) => top - 2);
  const pageBottom = viewport.height - 20;

  const linesByCell = new Map<number, Map<number, { x: number; text: string }[]>>();
  for (const item of items) {
    if (item.top < rowStarts[0] + 5 || /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/i.test(item.text) || /^\d{1,2}$/.test(item.text)) continue;

    let column = -1;
    for (let index = 0; index < columnStarts.length; index += 1) {
      const end = index === columnStarts.length - 1 ? viewport.width : columnStarts[index + 1];
      if (item.x >= columnStarts[index] && item.x < end) column = index;
    }

    let row = -1;
    for (let index = 0; index < rowStarts.length; index += 1) {
      const end = index === rowStarts.length - 1 ? pageBottom : rowStarts[index + 1];
      if (item.top >= rowStarts[index] && item.top < end) row = index;
    }
    if (column < 0 || row < 0) continue;

    const cell = row * 7 + column;
    const yKey = Math.round(item.top * 2) / 2;
    const cellLines = linesByCell.get(cell) ?? new Map<number, { x: number; text: string }[]>();
    const line = cellLines.get(yKey) ?? [];
    line.push({ x: item.x, text: item.text });
    cellLines.set(yKey, line);
    linesByCell.set(cell, cellLines);
  }

  const lessons: ImportedLesson[] = [];
  let id = Date.now();
  for (const [cell, lineMap] of linesByCell) {
    const date = dateForCell(year, monthIndex, cell);
    const lines = [...lineMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '));

    for (const line of lines) {
      const parsed = parseLessonLine(line, date, id++);
      if (parsed) lessons.push(parsed);
    }
  }

  const unique = lessons.filter((lesson, index, all) => all.findIndex((candidate) => `${candidate.date}|${candidate.school}|${candidate.className}|${candidate.startTime}|${candidate.teacher}` === `${lesson.date}|${lesson.school}|${lesson.className}|${lesson.startTime}|${lesson.teacher}`) === index);
  return { lessons: unique.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)), monthName: `${monthNames[monthIndex]} ${year}` };
}

export default function ImportPage() {
  const [lessons, setLessons] = useState<ImportedLesson[]>([]);
  const [monthName, setMonthName] = useState('');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState<'idle' | 'reading' | 'ready' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const assignedCount = useMemo(() => lessons.filter((lesson) => lesson.teacher).length, [lessons]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatus('reading');
    setMessage('Reading the calendar grid and detecting lessons...');
    try {
      const result = await extractLessons(file);
      setLessons(result.lessons);
      setMonthName(result.monthName);
      setStatus('ready');
      setMessage(`${result.lessons.length} lessons detected. Review them before importing.`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'The PDF could not be read.');
    }
  };

  const saveImport = () => {
    localStorage.setItem('moeImportedLessons', JSON.stringify(lessons));
    localStorage.setItem('moeImportedAt', new Date().toISOString());
    setStatus('saved');
    setMessage(`${lessons.length} lessons were saved in this browser for calendar import.`);
  };

  const removeLesson = (id: number) => setLessons((current) => current.filter((lesson) => lesson.id !== id));

  return (
    <main className="importShell">
      <header className="importHeader">
        <Link href="/" className="backLink"><ArrowLeft size={17} /> Back to calendar</Link>
        <div><p>PHASE 3</p><h1>Import MOE timetable</h1><span>Upload the standard Music Delight calendar PDF, review the detected lessons, then save the import.</span></div>
      </header>

      <section className="importCard uploadCard">
        <label className="dropZone">
          <input type="file" accept="application/pdf,.pdf" onChange={handleFile} />
          <Upload size={34} />
          <strong>{fileName || 'Choose MOE calendar PDF'}</strong>
          <span>PDF only · the file stays in your browser</span>
        </label>
        <div className={`statusBox ${status}`}>
          {status === 'reading' ? <Loader2 className="spin" size={20} /> : status === 'error' ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{message || 'No PDF selected yet.'}</span>
        </div>
      </section>

      {lessons.length > 0 && (
        <>
          <section className="importStats">
            <article><span>Calendar</span><strong>{monthName}</strong></article>
            <article><span>Lessons detected</span><strong>{lessons.length}</strong></article>
            <article><span>Teachers detected</span><strong>{assignedCount}</strong></article>
            <article><span>Needs review</span><strong>{lessons.length - assignedCount}</strong></article>
          </section>

          <section className="importCard previewCard">
            <div className="previewHeader"><div><p>IMPORT PREVIEW</p><h2>Detected lessons</h2></div><button onClick={saveImport}>Import {lessons.length} lessons</button></div>
            <div className="tableWrap">
              <table>
                <thead><tr><th>Date</th><th>Time</th><th>School</th><th>Class / programme</th><th>Teacher</th><th /></tr></thead>
                <tbody>{lessons.map((lesson) => <tr key={lesson.id}><td>{lesson.date}</td><td>{lesson.startTime} - {lesson.endTime}</td><td>{lesson.school}</td><td>{lesson.className}</td><td>{lesson.teacher ?? <em>Unassigned</em>}</td><td><button className="removeButton" onClick={() => removeLesson(lesson.id)}>Remove</button></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <style jsx>{`
        .importShell{min-height:100vh;padding:38px;max-width:1500px;margin:auto}.importHeader{display:grid;gap:24px;margin-bottom:24px}.backLink{display:flex;align-items:center;gap:8px;color:#9aa7bf;text-decoration:none;width:max-content}.importHeader p,.previewHeader p{margin:0 0 6px;color:#8174ff;font-size:11px;font-weight:800;letter-spacing:.15em}.importHeader h1{margin:0 0 8px;font-size:34px}.importHeader span{color:#8995ad}.importCard,.importStats article{border:1px solid rgba(148,163,184,.14);background:linear-gradient(145deg,rgba(20,27,48,.92),rgba(11,16,31,.86));border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.18)}.uploadCard{padding:20px}.dropZone{min-height:180px;border:1px dashed rgba(129,116,255,.5);border-radius:15px;display:grid;place-items:center;align-content:center;gap:9px;color:#c8c2ff;cursor:pointer;background:rgba(120,87,255,.06)}.dropZone input{display:none}.dropZone span{font-size:12px;color:#76839b}.statusBox{margin-top:14px;padding:12px 14px;border-radius:11px;display:flex;align-items:center;gap:9px;background:#0b1222;color:#8995ad}.statusBox.error{color:#fb7185}.statusBox.ready,.statusBox.saved{color:#70d28c}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.importStats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:16px 0}.importStats article{padding:17px;display:grid;gap:7px}.importStats span{color:#8793aa;font-size:12px}.importStats strong{font-size:21px}.previewCard{overflow:hidden}.previewHeader{padding:18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(148,163,184,.1)}.previewHeader h2{margin:0}.previewHeader button{border:0;border-radius:11px;padding:11px 16px;background:linear-gradient(135deg,#6c56e8,#5544cf);color:white;font-weight:700;cursor:pointer}.tableWrap{overflow:auto;max-height:580px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:11px 13px;text-align:left;border-bottom:1px solid rgba(148,163,184,.08);white-space:nowrap}th{position:sticky;top:0;background:#0c1324;color:#7f8ca5;text-transform:uppercase;font-size:10px;letter-spacing:.08em}td{color:#c1cadb}td em{color:#fb7185}.removeButton{border:0;background:transparent;color:#fb7185;cursor:pointer}@media(max-width:900px){.importShell{padding:20px}.importStats{grid-template-columns:repeat(2,1fr)}}
      `}</style>
    </main>
  );
}
