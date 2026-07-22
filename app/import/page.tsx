'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Filter, Loader2, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

type ImportedLesson = { id: number; date: string; school: string; className: string; startTime: string; endTime: string; teacher: string | null; unavailable: boolean };
type PdfTextItem = { str: string; transform: number[]; width?: number; height?: number };
type ExistingRow = { id: string; lesson_date: string; school: string; class_name: string; start_time: string; end_time: string; teacher_name: string | null; unavailable?: boolean };
type ImportStatus = 'new' | 'changed' | 'duplicate' | 'conflict' | 'review';
type PreviewLesson = ImportedLesson & { importStatus: ImportStatus; selected: boolean; issues: string[]; existingTeacher?: string | null };
type RemovedCandidate = ExistingRow;
type Comparison = { newCount: number; duplicateCount: number; changedCount: number; possibleRemovedCount: number; conflictCount: number; reviewCount: number };
type FilterName = 'all' | ImportStatus;
const teacherNames = ['Audrey Jansen', 'Siew Lynn', 'Shi Yi', 'Claris', 'Gerald', 'Edward', 'Wero', 'Joel', 'Audrey', 'Ashley'];
const schoolNames = ['Compassvale Primary School','Meridian Primary School','Chongfu Primary School','Valour Primary School','Rulang Primary School','Bukit Timah Primary School','Bukit Timah PS','Farrer Park CCA','Monfort Junior','River Valley','Rulang Pri'];
const pad = (value: number) => String(value).padStart(2, '0');
function toTime(value: string) { const cleaned = value.replace('.', '').replace(':', '').padStart(4, '0'); return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`; }
function splitSchoolAndClass(value: string) { const school = schoolNames.find((name) => value.toLowerCase().startsWith(name.toLowerCase())); if (!school) { const words = value.trim().split(/\s+/); return { school: words.slice(0, Math.min(3, words.length)).join(' '), className: words.slice(Math.min(3, words.length)).join(' ') || 'Programme' }; } return { school, className: value.slice(school.length).trim() || 'Programme' }; }
function parseLessonLine(line: string, date: string, id: number): ImportedLesson | null { const normalized = line.replace(/\s+/g, ' ').trim(); const timeMatch = normalized.match(/(\d{1,2}[.:]?\d{2})\s*-\s*(\d{1,2}[.:]?\d{2})/); if (!timeMatch || timeMatch.index === undefined) return null; const beforeTime = normalized.slice(0, timeMatch.index).trim(); const afterTime = normalized.slice(timeMatch.index + timeMatch[0].length).trim(); const matchedTeacher = teacherNames.find((teacher) => afterTime.toLowerCase().endsWith(teacher.toLowerCase())); const teacher = matchedTeacher === 'Audrey Jansen' ? 'Audrey' : matchedTeacher ?? null; const { school, className } = splitSchoolAndClass(beforeTime); return { id, date, school, className, startTime: toTime(timeMatch[1]), endTime: toTime(timeMatch[2]), teacher, unavailable: false }; }
function dateForCell(year: number, monthIndex: number, cellIndex: number) { const first = new Date(year, monthIndex, 1); const gridStart = new Date(year, monthIndex, 1 - first.getDay()); gridStart.setDate(gridStart.getDate() + cellIndex); return `${gridStart.getFullYear()}-${pad(gridStart.getMonth() + 1)}-${pad(gridStart.getDate())}`; }
function lessonKey(lesson: Pick<ImportedLesson,'date'|'startTime'|'endTime'|'school'|'className'|'teacher'>) { return `${lesson.date}|${lesson.startTime.slice(0,5)}|${lesson.endTime.slice(0,5)}|${lesson.school.trim().toLowerCase()}|${lesson.className.trim().toLowerCase()}|${lesson.teacher ?? ''}`; }

type PositionedItem = { text: string; x: number; top: number };
const weekdayIndex: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function groupByTop<T extends { top: number }>(items: T[], tolerance = 6) {
  const groups: { top: number; items: T[] }[] = [];
  for (const item of [...items].sort((a, b) => a.top - b.top)) {
    const existing = groups.find((group) => Math.abs(group.top - item.top) <= tolerance);
    if (existing) {
      existing.items.push(item);
      existing.top = existing.items.reduce((sum, entry) => sum + entry.top, 0) / existing.items.length;
    } else groups.push({ top: item.top, items: [item] });
  }
  return groups.sort((a, b) => a.top - b.top);
}

function columnLayout(items: PositionedItem[], viewportWidth: number) {
  const weekdayItems = items
    .filter((item) => weekdayIndex[item.text.toLowerCase()] !== undefined)
    .sort((a, b) => a.x - b.x);

  const centres = new Map<number, number>();
  weekdayItems.forEach((item) => centres.set(weekdayIndex[item.text.toLowerCase()], item.x));

  if (centres.size < 5) {
    const dateGroups = groupByTop(items.filter((item) => /^\d{1,2}$/.test(item.text) && item.top > 50), 6)
      .filter((group) => group.items.length >= 5);
    const widest = dateGroups.sort((a, b) => b.items.length - a.items.length)[0];
    if (widest) {
      widest.items.sort((a, b) => a.x - b.x).slice(0, 7).forEach((item, index) => centres.set(index, item.x));
    }
  }

  if (centres.size < 5) return null;
  const known = [...centres.entries()].sort((a, b) => a[0] - b[0]);
  const gaps: number[] = [];
  for (let i = 1; i < known.length; i += 1) {
    const dayGap = known[i][0] - known[i - 1][0];
    if (dayGap > 0) gaps.push((known[i][1] - known[i - 1][1]) / dayGap);
  }
  const averageGap = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : viewportWidth / 7;
  const first = known[0];
  const projected = Array.from({ length: 7 }, (_, day) => centres.get(day) ?? first[1] + (day - first[0]) * averageGap);
  const bounds = projected.map((centre, index) => {
    const left = index === 0 ? Math.max(0, centre - averageGap / 2) : (projected[index - 1] + centre) / 2;
    const right = index === 6 ? Math.min(viewportWidth, centre + averageGap / 2) : (centre + projected[index + 1]) / 2;
    return { left, right };
  });
  return bounds;
}

function calendarRows(items: PositionedItem[]) {
  return groupByTop(items.filter((item) => /^\d{1,2}$/.test(item.text) && item.top > 55), 7)
    .filter((group) => group.items.length >= 4)
    .sort((a, b) => a.top - b.top)
    .slice(0, 6);
}

async function extractLessons(file: File): Promise<{ lessons: ImportedLesson[]; monthName: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs';
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const lessons: ImportedLesson[] = [];
  let detectedMonth = -1;
  let detectedYear = 0;
  let id = Date.now();

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PositionedItem[] = (content.items as PdfTextItem[])
      .filter((item) => item.str.trim())
      .map((item) => ({ text: item.str.replace(/\s+/g, ' ').trim(), x: item.transform[4], top: viewport.height - item.transform[5] }));

    const fullText = items.map((item) => item.text).join(' ');
    const title = fullText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
    if (title) {
      detectedMonth = monthNames.findIndex((name) => name.toLowerCase() === title[1].toLowerCase());
      detectedYear = Number(title[2]);
    }
    if (detectedMonth < 0 || !detectedYear) continue;

    const columns = columnLayout(items, viewport.width);
    const rows = calendarRows(items);
    if (!columns || rows.length < 4) continue;

    const rowStarts = rows.map((row) => row.top - 3);
    const pageBottom = viewport.height + 5;
    const linesByCell = new Map<number, Map<number, { x: number; text: string }[]>>();

    for (const item of items) {
      if (item.top < rowStarts[0] + 4 || /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/i.test(item.text) || /^\d{1,2}$/.test(item.text)) continue;
      const column = columns.findIndex((bound) => item.x >= bound.left && item.x < bound.right);
      let row = -1;
      for (let index = 0; index < rowStarts.length; index += 1) {
        const end = index === rowStarts.length - 1 ? pageBottom : rowStarts[index + 1];
        if (item.top >= rowStarts[index] && item.top < end) { row = index; break; }
      }
      if (column < 0 || row < 0) continue;
      const cell = row * 7 + column;
      const yKey = Math.round(item.top / 2) * 2;
      const cellLines = linesByCell.get(cell) ?? new Map<number, { x: number; text: string }[]>();
      const line = cellLines.get(yKey) ?? [];
      line.push({ x: item.x, text: item.text });
      cellLines.set(yKey, line);
      linesByCell.set(cell, cellLines);
    }

    for (const [cell, lineMap] of linesByCell) {
      const date = dateForCell(detectedYear, detectedMonth, cell);
      const lines = [...lineMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '));
      for (const line of lines) {
        const parsed = parseLessonLine(line, date, id++);
        if (parsed) lessons.push(parsed);
      }
    }
  }

  if (detectedMonth < 0 || !detectedYear) throw new Error('The month and year could not be detected from this PDF.');
  if (!lessons.length) throw new Error('No lessons could be detected. This PDF may be scanned or use an unsupported layout.');
  const unique = lessons.filter((lesson, index, all) => all.findIndex((candidate) => lessonKey(candidate) === lessonKey(lesson)) === index);
  return { lessons: unique.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)), monthName: `${monthNames[detectedMonth]} ${detectedYear}` };
}

export default function ImportPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [lessons, setLessons] = useState<PreviewLesson[]>([]);
  const [removedCandidates, setRemovedCandidates] = useState<RemovedCandidate[]>([]);
  const [monthName, setMonthName] = useState('');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState<'idle'|'reading'|'ready'|'saving'|'saved'|'error'>('idle');
  const [message, setMessage] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [filter, setFilter] = useState<FilterName>('all');
  const [showRemoved, setShowRemoved] = useState(false);
  const [allowConflicts, setAllowConflicts] = useState(false);

  const assignedCount = useMemo(() => lessons.filter((lesson) => lesson.teacher).length, [lessons]);
  const selectedLessons = useMemo(() => lessons.filter((lesson) => lesson.selected), [lessons]);
  const filteredLessons = useMemo(() => filter === 'all' ? lessons : lessons.filter((lesson) => lesson.importStatus === filter), [lessons, filter]);
  const safeLessons = useMemo(() => lessons.filter((lesson) => lesson.importStatus === 'new' || lesson.importStatus === 'changed'), [lessons]);
  const unsafeSelected = selectedLessons.filter((lesson) => lesson.importStatus === 'conflict' || lesson.importStatus === 'review');

  const baseKey = (value: {date:string;startTime:string;endTime:string;school:string;className:string}) =>
    `${value.date}|${value.startTime.slice(0,5)}|${value.endTime.slice(0,5)}|${value.school.trim().toLowerCase()}|${value.className.trim().toLowerCase()}`;
  const minutes = (value: string) => { const [hour, minute] = value.slice(0,5).split(':').map(Number); return hour * 60 + minute; };
  const overlaps = (a: {startTime:string;endTime:string}, b: {startTime:string;endTime:string}) => minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);

  const analyseImport = (detected: ImportedLesson[], existingRows: ExistingRow[]) => {
    const exactExisting = new Set(existingRows.map((row) => lessonKey({ date: row.lesson_date, startTime: row.start_time, endTime: row.end_time, school: row.school, className: row.class_name, teacher: row.teacher_name })));
    const existingByBase = new Map(existingRows.map((row) => [baseKey({date:row.lesson_date,startTime:row.start_time,endTime:row.end_time,school:row.school,className:row.class_name}), row]));
    const importedBase = new Set(detected.map(baseKey));

    const analysed: PreviewLesson[] = detected.map((lesson) => {
      const issues: string[] = [];
      const sameTeacher = lesson.teacher?.trim().toLowerCase();

      const pdfClashes = detected.filter((other) => other.id !== lesson.id && other.date === lesson.date && sameTeacher && other.teacher?.trim().toLowerCase() === sameTeacher && overlaps(lesson, other));
      if (pdfClashes.length) issues.push(`Overlaps another uploaded lesson for ${lesson.teacher}.`);

      const databaseClashes = existingRows.filter((row) => row.lesson_date === lesson.date && sameTeacher && row.teacher_name?.trim().toLowerCase() === sameTeacher && overlaps(lesson, { startTime: row.start_time, endTime: row.end_time }) && baseKey(lesson) !== baseKey({date:row.lesson_date,startTime:row.start_time,endTime:row.end_time,school:row.school,className:row.class_name}));
      if (databaseClashes.length) issues.push(`Clashes with ${databaseClashes[0].school} ${databaseClashes[0].start_time.slice(0,5)}–${databaseClashes[0].end_time.slice(0,5)} already in the calendar.`);

      const exact = exactExisting.has(lessonKey(lesson));
      const changed = !exact && existingByBase.get(baseKey(lesson));
      let importStatus: ImportStatus = exact ? 'duplicate' : changed ? 'changed' : 'new';
      if (pdfClashes.length || databaseClashes.length) importStatus = 'conflict';

      return {
        ...lesson,
        importStatus,
        selected: importStatus === 'new' || importStatus === 'changed',
        issues,
        existingTeacher: changed?.teacher_name,
      };
    });

    const importedTeachers = new Set(detected.map((lesson) => lesson.teacher?.trim().toLowerCase()).filter(Boolean));
    const relevantExistingRows = importedTeachers.size ? existingRows.filter((row) => row.teacher_name && importedTeachers.has(row.teacher_name.trim().toLowerCase())) : existingRows;
    const removals = relevantExistingRows.filter((row) => !importedBase.has(baseKey({date:row.lesson_date,startTime:row.start_time,endTime:row.end_time,school:row.school,className:row.class_name})));

    const count = (value: ImportStatus) => analysed.filter((lesson) => lesson.importStatus === value).length;
    return {
      analysed,
      removals,
      summary: {
        newCount: count('new'),
        duplicateCount: count('duplicate'),
        changedCount: count('changed'),
        possibleRemovedCount: removals.length,
        conflictCount: count('conflict'),
        reviewCount: count('review'),
      },
    };
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setStatus('reading'); setComparison(null); setLessons([]); setRemovedCandidates([]); setAllowConflicts(false);
    setMessage('Reading the PDF, checking Supabase and scanning for timetable clashes...');
    try {
      const result = await extractLessons(file);
      setMonthName(result.monthName);
      const dates = [...new Set(result.lessons.map((lesson) => lesson.date))].sort();
      const { data: existing, error: compareError } = await supabase.from('lessons').select('id,lesson_date,school,class_name,start_time,end_time,teacher_name,unavailable').gte('lesson_date', dates[0]).lte('lesson_date', dates[dates.length-1]);
      if (compareError) throw compareError;
      const analysis = analyseImport(result.lessons, (existing ?? []) as ExistingRow[]);
      setLessons(analysis.analysed); setRemovedCandidates(analysis.removals); setComparison(analysis.summary); setStatus('ready');
      setMessage(`${result.lessons.length} lessons detected. ${analysis.summary.conflictCount} clash${analysis.summary.conflictCount === 1 ? '' : 'es'} and ${analysis.summary.reviewCount} item${analysis.summary.reviewCount === 1 ? '' : 's'} need review.`);
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'The PDF could not be read.');
    }
  };

  const toggleLesson = (id: number) => setLessons((current) => current.map((lesson) => lesson.id === id && lesson.importStatus !== 'duplicate' ? { ...lesson, selected: !lesson.selected } : lesson));
  const selectSafe = () => setLessons((current) => current.map((lesson) => ({ ...lesson, selected: lesson.importStatus === 'new' || lesson.importStatus === 'changed' })));

  const saveImport = async () => {
    if (!selectedLessons.length) { setMessage('Select at least one new or changed lesson to import.'); return; }
    if (unsafeSelected.length && !allowConflicts) { setMessage('Resolve the selected clashes/review items, or confirm the override first.'); return; }
    setStatus('saving'); setMessage('Applying selected lessons to Supabase...');
    const dates = [...new Set(selectedLessons.map((lesson) => lesson.date))];
    const { data: existing, error: readError } = await supabase.from('lessons').select('id,lesson_date,school,class_name,start_time,end_time,teacher_name').in('lesson_date', dates);
    if (readError) { setStatus('error'); setMessage(`Could not check existing lessons: ${readError.message}`); return; }
    const rows = (existing ?? []) as ExistingRow[];
    const exactKeys = new Set(rows.map((row) => lessonKey({ date: row.lesson_date, startTime: row.start_time, endTime: row.end_time, school: row.school, className: row.class_name, teacher: row.teacher_name })));
    const existingByBase = new Map(rows.map((row) => [baseKey({date:row.lesson_date,startTime:row.start_time,endTime:row.end_time,school:row.school,className:row.class_name}), row]));
    const newLessons = selectedLessons.filter((lesson) => !exactKeys.has(lessonKey(lesson)) && !existingByBase.has(baseKey(lesson)));
    const changedLessons = selectedLessons.filter((lesson) => !exactKeys.has(lessonKey(lesson)) && existingByBase.has(baseKey(lesson)));

    if (newLessons.length) {
      const payload = newLessons.map((lesson) => ({ lesson_date: lesson.date, school: lesson.school.trim(), class_name: lesson.className.trim(), start_time: lesson.startTime, end_time: lesson.endTime, teacher_name: lesson.teacher, unavailable: lesson.unavailable, source: 'pdf' }));
      const { error } = await supabase.from('lessons').insert(payload);
      if (error) { setStatus('error'); setMessage(`Import failed: ${error.message}`); return; }
    }
    for (const lesson of changedLessons) {
      const row = existingByBase.get(baseKey(lesson));
      if (!row) continue;
      const { error } = await supabase.from('lessons').update({ teacher_name: lesson.teacher, unavailable: lesson.unavailable, source: 'pdf' }).eq('id', row.id);
      if (error) { setStatus('error'); setMessage(`Could not update a changed lesson: ${error.message}`); return; }
    }
    setStatus('saved');
    setMessage(`${newLessons.length} new lessons saved and ${changedLessons.length} changed lessons updated. Duplicates and possible removals were left untouched.`);
    setTimeout(() => router.push('/'), 1400);
  };

  const statusLabel: Record<ImportStatus,string> = { new:'New', changed:'Changed', duplicate:'Already exists', conflict:'Clash', review:'Review' };
  const filters: FilterName[] = ['all','new','changed','conflict','review','duplicate'];

  return <main className="importShell">
    <header className="importHeader"><Link href="/" className="backLink"><ArrowLeft size={17}/> Back to calendar</Link><div><p>SMART PDF IMPORT</p><h1>Import MOE timetable</h1><span>Extract lessons, compare changes and catch teacher clashes before anything is saved.</span></div></header>
    <section className="importCard uploadCard"><label className="dropZone"><input type="file" accept="application/pdf,.pdf" onChange={handleFile}/><Upload size={34}/><strong>{fileName || 'Choose MOE calendar PDF'}</strong><span>PDF only · processed in your browser</span></label><div className={`statusBox ${status}`}>{status === 'reading' || status === 'saving' ? <Loader2 className="spin" size={20}/> : status === 'error' ? <XCircle size={20}/> : <CheckCircle2 size={20}/>}<span>{message || 'No PDF selected yet.'}</span></div></section>

    {lessons.length > 0 && <>
      <section className="importStats">
        <article><span>Calendar</span><strong>{monthName}</strong></article><article><span>Detected</span><strong>{lessons.length}</strong></article>
        <article className="new"><span>New</span><strong>{comparison?.newCount ?? '—'}</strong></article><article className="changed"><span>Changed</span><strong>{comparison?.changedCount ?? '—'}</strong></article>
        <article><span>Duplicates</span><strong>{comparison?.duplicateCount ?? '—'}</strong></article><article className="danger"><span>Automatic clashes</span><strong>{comparison?.conflictCount ?? '—'}</strong></article>
        <article className="removed"><span>Possible removed</span><strong>{comparison?.possibleRemovedCount ?? '—'}</strong></article><article className="danger"><span>Needs review</span><strong>{comparison?.reviewCount ?? '—'}</strong></article>
      </section>

      <section className="analysisSummary">
        <div className="analysisIcon"><ShieldCheck size={26}/></div>
        <div className="analysisCopy">
          <p>IMPORT ANALYSIS COMPLETE</p>
          <h2>{fileName}</h2>
          <span>{lessons.length} lessons scanned. Duplicates are locked and will never be imported.</span>
        </div>
        <div className="analysisBreakdown">
          <span><strong>{comparison?.duplicateCount ?? 0}</strong> already exist</span>
          <span className="good"><strong>{comparison?.newCount ?? 0}</strong> new</span>
          <span className="warn"><strong>{comparison?.changedCount ?? 0}</strong> changed</span>
          <span className="bad"><strong>{comparison?.conflictCount ?? 0}</strong> clashes</span>
        </div>
        <div className="analysisRecommendation">
          <strong>Recommended action</strong>
          <span>{safeLessons.length ? `Import ${safeLessons.length} safe change${safeLessons.length === 1 ? '' : 's'}.` : 'No safe changes need importing.'}</span>
          {(comparison?.conflictCount ?? 0) > 0 && <span>Review {comparison?.conflictCount} clash{comparison?.conflictCount === 1 ? '' : 'es'} separately.</span>}
        </div>
      </section>

      {(comparison?.conflictCount ?? 0) > 0 && <section className="clashBanner"><AlertTriangle size={22}/><div><strong>Clashes detected before import</strong><span>Conflicting rows are unselected by default. Review them individually before overriding.</span></div><Link href="/admin/conflicts">Open Conflict Center</Link></section>}

      <section className="importCard previewCard">
        <div className="previewHeader"><div><p>IMPORT PREVIEW</p><h2>Detected lessons</h2></div><div className="previewActions"><button className="secondary" onClick={selectSafe}><ShieldCheck size={16}/> Select safe changes</button><button onClick={saveImport} disabled={status === 'saving' || selectedLessons.length === 0}>{status === 'saving' ? 'Saving…' : unsafeSelected.length ? `Import ${selectedLessons.length} selected` : `Import ${selectedLessons.length} safe change${selectedLessons.length === 1 ? '' : 's'}`}</button></div></div>
        <div className="toolbar"><div className="filterTitle"><Filter size={15}/> Show</div>{filters.map((name) => <button key={name} className={filter === name ? 'active' : ''} onClick={() => setFilter(name)}>{name === 'all' ? `All ${lessons.length}` : `${statusLabel[name as ImportStatus]} ${lessons.filter((lesson) => lesson.importStatus === name).length}`}</button>)}<button className="removedToggle" onClick={() => setShowRemoved((value) => !value)}>Possible removals {removedCandidates.length}</button></div>
        <div className="tableWrap"><table><thead><tr><th><span className="srOnly">Select</span></th><th>Status</th><th>Date</th><th>Time</th><th>School</th><th>Class / programme</th><th>Teacher</th><th>Checks</th></tr></thead><tbody>{filteredLessons.map((lesson) => <tr key={lesson.id} className={`row-${lesson.importStatus}`}><td>{lesson.importStatus === 'duplicate' ? <span className="lockedDuplicate" title="Already in database"><CheckCircle2 size={16}/></span> : <input type="checkbox" checked={lesson.selected} onChange={() => toggleLesson(lesson.id)}/>}</td><td><span className={`badge ${lesson.importStatus}`}>{statusLabel[lesson.importStatus]}</span></td><td>{lesson.date}</td><td>{lesson.startTime}–{lesson.endTime}</td><td>{lesson.school}</td><td>{lesson.className}</td><td>{lesson.importStatus === 'changed' ? <span>{lesson.existingTeacher || 'Unassigned'} → <strong>{lesson.teacher || 'Unassigned'}</strong></span> : lesson.teacher ?? <em>Unassigned</em>}</td><td className="checks">{lesson.importStatus === 'duplicate' ? <span className="existingCheck"><CheckCircle2 size={13}/>Matches an existing calendar record</span> : !lesson.teacher ? <span className="unassignedCheck"><AlertTriangle size={13}/>Will be imported under Unassigned and shown on the calendar</span> : lesson.issues.length ? lesson.issues.map((issue) => <span key={issue}><AlertTriangle size={13}/>{issue}</span>) : <span className="clearCheck"><CheckCircle2 size={13}/>No clash found</span>}</td></tr>)}</tbody></table></div>
        {unsafeSelected.length > 0 && <label className="override"><input type="checkbox" checked={allowConflicts} onChange={(event) => setAllowConflicts(event.target.checked)}/><span>I reviewed the {unsafeSelected.length} selected warning item{unsafeSelected.length === 1 ? '' : 's'} and want to import them anyway.</span></label>}
        {showRemoved && <div className="removedPanel"><div><h3>Possible removals</h3><p>These records are in Supabase for the same teacher/date range but not in this PDF. They will not be deleted automatically.</p></div>{removedCandidates.length ? <div className="removedList">{removedCandidates.map((row) => <article key={row.id}><strong>{row.lesson_date} · {row.start_time.slice(0,5)}–{row.end_time.slice(0,5)}</strong><span>{row.school} · {row.class_name} · {row.teacher_name}</span></article>)}</div> : <p>No possible removals.</p>}</div>}
      </section>
    </>}

    <style jsx>{`.importShell{min-height:100vh;padding:38px;max-width:1550px;margin:auto}.importHeader{display:grid;gap:24px;margin-bottom:24px}.backLink{display:flex;align-items:center;gap:8px;color:#9aa7bf;text-decoration:none;width:max-content}.importHeader p,.previewHeader p{margin:0 0 6px;color:#8174ff;font-size:11px;font-weight:800;letter-spacing:.15em}.importHeader h1{margin:0 0 8px;font-size:34px}.importHeader span{color:#8995ad}.importCard,.importStats article{border:1px solid rgba(148,163,184,.14);background:linear-gradient(145deg,rgba(20,27,48,.92),rgba(11,16,31,.86));border-radius:18px}.uploadCard{padding:20px}.dropZone{min-height:180px;border:1px dashed rgba(129,116,255,.5);border-radius:15px;display:grid;place-items:center;align-content:center;gap:9px;color:#c8c2ff;cursor:pointer;background:rgba(120,87,255,.06)}.dropZone input{display:none}.dropZone span{font-size:12px;color:#76839b}.statusBox{margin-top:14px;padding:12px 14px;border-radius:11px;display:flex;align-items:center;gap:9px;background:#0b1222;color:#8995ad}.statusBox.error,.danger strong{color:#fb7185}.statusBox.ready,.statusBox.saved{color:#70d28c}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.importStats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:16px 0}.importStats article{padding:17px;display:grid;gap:7px}.importStats span{color:#8793aa;font-size:12px}.importStats strong{font-size:21px}.importStats .new strong{color:#70d28c}.importStats .changed strong{color:#fbbf24}.importStats .removed strong{color:#fb7185}.analysisSummary{display:grid;grid-template-columns:auto minmax(260px,1.2fr) minmax(260px,1fr) minmax(260px,1fr);gap:18px;align-items:center;margin:16px 0;padding:18px;border:1px solid rgba(129,116,255,.24);border-radius:18px;background:linear-gradient(135deg,rgba(91,72,205,.13),rgba(13,20,38,.92))}.analysisIcon{width:50px;height:50px;display:grid;place-items:center;border-radius:14px;background:rgba(112,210,140,.12);color:#70d28c}.analysisCopy{display:grid;gap:5px}.analysisCopy p{margin:0;color:#8174ff;font-size:10px;font-weight:800;letter-spacing:.15em}.analysisCopy h2{margin:0;font-size:18px}.analysisCopy span,.analysisRecommendation span{color:#8f9bb0;font-size:12px}.analysisBreakdown{display:grid;grid-template-columns:repeat(2,minmax(110px,1fr));gap:8px}.analysisBreakdown span{padding:9px 10px;border-radius:10px;background:rgba(148,163,184,.06);color:#a8b3c7;font-size:11px}.analysisBreakdown strong{margin-right:5px;color:#dce4f2;font-size:15px}.analysisBreakdown .good strong{color:#70d28c}.analysisBreakdown .warn strong{color:#fbbf24}.analysisBreakdown .bad strong{color:#fb7185}.analysisRecommendation{display:grid;gap:5px;padding:12px;border-radius:12px;background:rgba(112,210,140,.06);border:1px solid rgba(112,210,140,.13)}.analysisRecommendation strong{color:#a9e7b9;font-size:12px}.lockedDuplicate{display:inline-flex;color:#70d28c;opacity:.75}.existingCheck{color:#91a0b6!important}.row-duplicate{opacity:.72}.row-duplicate:hover{opacity:.9}.clashBanner{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:15px 17px;border:1px solid rgba(251,113,133,.28);border-radius:15px;background:rgba(251,113,133,.07);color:#fb7185}.clashBanner div{display:grid;gap:3px;flex:1}.clashBanner span{color:#c5a5ae;font-size:12px}.clashBanner a{padding:9px 12px;border-radius:9px;background:rgba(251,113,133,.12);color:#ffd6dd;text-decoration:none;font-size:12px}.previewCard{overflow:hidden}.previewHeader{padding:18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(148,163,184,.1)}.previewHeader h2{margin:0}.previewActions{display:flex;gap:8px}.previewActions button{display:flex;align-items:center;gap:7px;border:0;border-radius:11px;padding:11px 16px;background:linear-gradient(135deg,#6c56e8,#5544cf);color:white;font-weight:700;cursor:pointer}.previewActions .secondary{border:1px solid rgba(148,163,184,.15);background:#111a2d;color:#c8d1e2}.previewActions button:disabled{opacity:.45;cursor:not-allowed}.toolbar{display:flex;align-items:center;gap:7px;padding:12px 16px;border-bottom:1px solid rgba(148,163,184,.1);overflow:auto}.filterTitle{display:flex;gap:6px;align-items:center;color:#71809a;font-size:11px}.toolbar button{white-space:nowrap;padding:7px 10px;border:1px solid rgba(148,163,184,.12);border-radius:9px;background:transparent;color:#8f9bb0;font-size:11px}.toolbar button.active{border-color:rgba(129,116,255,.45);background:rgba(129,116,255,.12);color:#d7d2ff}.toolbar .removedToggle{margin-left:auto}.tableWrap{overflow:auto;max-height:600px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:11px 12px;text-align:left;border-bottom:1px solid rgba(148,163,184,.08);white-space:nowrap}th{position:sticky;top:0;background:#0c1324;color:#7f8ca5;text-transform:uppercase;font-size:10px;z-index:2}td{color:#c1cadb}.checks{min-width:300px;white-space:normal}.checks span{display:flex;align-items:flex-start;gap:5px;color:#fb9cad}.checks .clearCheck{color:#70d28c}.checks .unassignedCheck{color:#fbbf24}.badge{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase}.badge.new{background:rgba(112,210,140,.12);color:#70d28c}.badge.changed{background:rgba(251,191,36,.12);color:#fbbf24}.badge.duplicate{background:rgba(148,163,184,.1);color:#91a0b6}.badge.conflict,.badge.review{background:rgba(251,113,133,.12);color:#fb7185}.row-conflict,.row-review{background:rgba(251,113,133,.025)}td em{color:#fb7185}.override{display:flex;gap:9px;align-items:flex-start;padding:13px 16px;border-top:1px solid rgba(251,113,133,.18);color:#d9b9c1;font-size:12px;background:rgba(251,113,133,.04)}.removedPanel{padding:17px;border-top:1px solid rgba(148,163,184,.1);background:#0b1222}.removedPanel h3{margin:0 0 5px}.removedPanel p{margin:0;color:#8794ab;font-size:12px}.removedList{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px;margin-top:13px}.removedList article{display:grid;gap:4px;padding:11px;border:1px solid rgba(148,163,184,.1);border-radius:10px;background:#10192c}.removedList span{color:#8794ab;font-size:11px}.srOnly{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:1100px){.analysisSummary{grid-template-columns:auto 1fr}.analysisBreakdown,.analysisRecommendation{grid-column:2}}@media(max-width:900px){.importShell{padding:20px}.importStats{grid-template-columns:repeat(2,1fr)}.previewHeader{align-items:flex-start;flex-direction:column;gap:13px}.previewActions{width:100%;flex-wrap:wrap}.clashBanner{align-items:flex-start;flex-wrap:wrap}.analysisSummary{grid-template-columns:1fr}.analysisIcon,.analysisBreakdown,.analysisRecommendation{grid-column:1}.analysisBreakdown{grid-template-columns:repeat(2,1fr)}}`}</style>
  </main>;
}
