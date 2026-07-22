import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type LessonRow = {
  id: string;
  lesson_date: string;
  school: string;
  class_name: string;
  start_time: string;
  end_time: string;
  teacher_name: string | null;
  unavailable: boolean;
  source: string;
};

type SearchLessonsArgs = {
  teacher?: string;
  school?: string;
  instrument?: string;
  class_name?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  start_time_from?: string;
  start_time_to?: string;
  unavailable?: boolean;
  limit?: number;
};

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_LOOPS = 4;
const DEFAULT_LIMIT = 120;
const HARD_LIMIT = 300;

function cleanMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false;
      const message = item as Partial<ChatMessage>;
      return (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string';
    })
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((message) => message.content.length > 0);
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY is missing."
  );
}

return createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
}

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(teacher|mr|mrs|ms|miss|mister)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function schoolKey(value: string) {
  return normalise(value)
    .replace(/\bprimary school\b/g, '')
    .replace(/\bsecondary school\b/g, '')
    .replace(/\bpri\b/g, '')
    .replace(/\bps\b/g, '')
    .trim();
}

function bestMatches(input: string, values: string[], kind: 'teacher' | 'school') {
  const key = kind === 'school' ? schoolKey(input) : normalise(input);
  if (!key) return [];

  const scored = values.map((value) => {
    const candidate = kind === 'school' ? schoolKey(value) : normalise(value);
    let score = 0;

    if (candidate === key) score = 100;
    else if (candidate.startsWith(key) || key.startsWith(candidate)) score = 90;
    else if (candidate.includes(key) || key.includes(candidate)) score = 80;
    else {
      const wanted = new Set(key.split(' '));
      const present = candidate.split(' ').filter((word) => wanted.has(word)).length;
      score = Math.round((present / Math.max(wanted.size, 1)) * 65);
    }

    return { value, score };
  });

  return scored
    .filter((item) => item.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function isDate(value: string | undefined) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanTime(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

const instrumentAliases: Record<string, string[]> = {
  keyboard: ['keyboard', 'piano'],
  piano: ['piano', 'keyboard'],
  guitar: ['guitar', 'gtr'],
  ukulele: ['ukulele', 'ukulele', 'uke'],
  violin: ['violin', 'strings'],
  drums: ['drum', 'drums', 'percussion'],
  vocals: ['vocal', 'vocals', 'singing'],
  theory: ['theory', 'music theory'],
  ensemble: ['ensemble'],
};

function matchesInstrument(lesson: LessonRow, instrument: string) {
  const requested = normalise(instrument);
  const aliases = instrumentAliases[requested] ?? [requested];
  const haystack = normalise(`${lesson.class_name} ${lesson.school}`);
  return aliases.some((alias) => haystack.includes(normalise(alias)));
}

async function searchLessons(args: SearchLessonsArgs) {
  if (![args.date, args.date_from, args.date_to].every(isDate)) {
    return { error: 'Dates must use YYYY-MM-DD format.' };
  }

  const supabase = getSupabase();
  const requestedLimit = Math.min(Math.max(Number(args.limit) || DEFAULT_LIMIT, 1), HARD_LIMIT);

  const [
    { data: teacherRows, error: teacherError },
    { data: lessonTeacherRows, error: lessonTeacherError },
    { data: schoolRows, error: schoolError },
  ] = await Promise.all([
    supabase.from('teachers').select('name').order('name'),
    supabase.from('lessons').select('teacher_name'),
    supabase.from('lessons').select('school'),
  ]);

  // The lessons table is the source of truth for lesson searches. Some deployments
  // have stricter RLS on `teachers`, so do not fail name matching when that table is
  // empty or inaccessible but lesson rows are readable.
  if (teacherError) console.warn('Calendar AI could not read teachers table:', teacherError.message);
  if (lessonTeacherError) throw lessonTeacherError;
  if (schoolError) throw schoolError;

  const teacherNames = Array.from(
    new Set([
      ...(teacherRows ?? []).map((row) => String(row.name ?? '').trim()),
      ...(lessonTeacherRows ?? []).map((row) => String(row.teacher_name ?? '').trim()),
    ].filter(Boolean)),
  ).sort();
  const schoolNames = Array.from(new Set((schoolRows ?? []).map((row) => String(row.school)).filter(Boolean))).sort();

  let resolvedTeacher: string | undefined;
  let teacherMatches: Array<{ value: string; score: number }> = [];
  if (args.teacher) {
    teacherMatches = bestMatches(args.teacher, teacherNames, 'teacher');
    if (teacherMatches[0]?.score >= 90 && (teacherMatches[1]?.score ?? 0) < teacherMatches[0].score) {
      resolvedTeacher = teacherMatches[0].value;
    } else if (teacherMatches.length === 1 && teacherMatches[0].score >= 80) {
      resolvedTeacher = teacherMatches[0].value;
    } else {
      return {
        needs_clarification: true,
        field: 'teacher',
        requested: args.teacher,
        suggestions: teacherMatches.map((item) => item.value),
        message: teacherMatches.length
          ? 'The teacher name is ambiguous. Ask the user to choose one of the suggestions.'
          : 'No matching teacher was found. Ask the user to check the name.',
      };
    }
  }

  let resolvedSchool: string | undefined;
  let schoolMatches: Array<{ value: string; score: number }> = [];
  if (args.school) {
    schoolMatches = bestMatches(args.school, schoolNames, 'school');
    if (schoolMatches[0]?.score >= 90 && (schoolMatches[1]?.score ?? 0) < schoolMatches[0].score) {
      resolvedSchool = schoolMatches[0].value;
    } else if (schoolMatches.length === 1 && schoolMatches[0].score >= 80) {
      resolvedSchool = schoolMatches[0].value;
    } else {
      return {
        needs_clarification: true,
        field: 'school',
        requested: args.school,
        suggestions: schoolMatches.map((item) => item.value),
        message: schoolMatches.length
          ? 'The school name is ambiguous. Ask the user to choose one of the suggestions.'
          : 'No matching school was found. Ask the user to check the name.',
      };
    }
  }

  let query = supabase
    .from('lessons')
    .select('id,lesson_date,school,class_name,start_time,end_time,teacher_name,unavailable,source')
    .order('lesson_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (resolvedTeacher) query = query.eq('teacher_name', resolvedTeacher);
  if (resolvedSchool) query = query.eq('school', resolvedSchool);
  if (args.class_name) query = query.ilike('class_name', `%${args.class_name.replace(/[%_,]/g, '')}%`);
  if (args.date) query = query.eq('lesson_date', args.date);
  if (args.date_from) query = query.gte('lesson_date', args.date_from);
  if (args.date_to) query = query.lte('lesson_date', args.date_to);
  if (typeof args.unavailable === 'boolean') query = query.eq('unavailable', args.unavailable);

  const startFrom = cleanTime(args.start_time_from);
  const startTo = cleanTime(args.start_time_to);
  if (args.start_time_from && !startFrom) return { error: 'start_time_from must use HH:MM.' };
  if (args.start_time_to && !startTo) return { error: 'start_time_to must use HH:MM.' };
  if (startFrom) query = query.gte('start_time', startFrom);
  if (startTo) query = query.lte('start_time', startTo);

  const { data, error } = await query.limit(HARD_LIMIT);
  if (error) throw error;

  let lessons = (data ?? []) as LessonRow[];
  if (args.instrument) lessons = lessons.filter((lesson) => matchesInstrument(lesson, args.instrument!));
  lessons = lessons.slice(0, requestedLimit);

  return {
    filters_used: {
      ...args,
      teacher: resolvedTeacher ?? args.teacher,
      school: resolvedSchool ?? args.school,
    },
    instrument_note: args.instrument
      ? 'Instrument is inferred from class_name/school text because the lessons table has no dedicated instrument column.'
      : undefined,
    count: lessons.length,
    truncated: lessons.length >= requestedLimit,
    lessons,
  };
}

async function listTeachers() {
  const supabase = getSupabase();
  const [{ data: teachers, error: teacherError }, { data: lessonRows, error: lessonError }] = await Promise.all([
    supabase.from('teachers').select('id,name,color').order('name'),
    supabase.from('lessons').select('teacher_name'),
  ]);

  if (lessonError) throw lessonError;
  if (teacherError) console.warn('Calendar AI could not read teachers table:', teacherError.message);

  const teacherMap = new Map<string, { id: string | null; name: string; color: string | null }>();
  for (const teacher of teachers ?? []) {
    const name = String(teacher.name ?? '').trim();
    if (name) teacherMap.set(normalise(name), { id: teacher.id ?? null, name, color: teacher.color ?? null });
  }
  for (const row of lessonRows ?? []) {
    const name = String(row.teacher_name ?? '').trim();
    if (name && !teacherMap.has(normalise(name))) {
      teacherMap.set(normalise(name), { id: null, name, color: null });
    }
  }

  const result = Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  return { count: result.length, teachers: result };
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_lessons',
      description: 'Read-only search of the live Supabase lessons table. Use this for teacher, school, class, instrument, date and time questions. Never claim to modify data.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          teacher: { type: ['string', 'null'], description: 'Teacher name, including a partial or natural version such as Teacher Joel.' },
          school: { type: ['string', 'null'], description: 'School name or abbreviation such as Meridian or Bukit Timah PS.' },
          instrument: { type: ['string', 'null'], description: 'Instrument such as keyboard, piano, guitar, violin, drums or ukulele.' },
          class_name: { type: ['string', 'null'], description: 'Class/programme text such as 4IN, Guitar Ensemble or MCCA.' },
          date: { type: ['string', 'null'], description: 'Exact lesson date in YYYY-MM-DD.' },
          date_from: { type: ['string', 'null'], description: 'Beginning of date range in YYYY-MM-DD.' },
          date_to: { type: ['string', 'null'], description: 'End of date range in YYYY-MM-DD.' },
          start_time_from: { type: ['string', 'null'], description: 'Earliest start time in 24-hour HH:MM format.' },
          start_time_to: { type: ['string', 'null'], description: 'Latest start time in 24-hour HH:MM format.' },
          unavailable: { type: ['boolean', 'null'], description: 'Filter by unavailable flag.' },
          limit: { type: ['integer', 'null'], minimum: 1, maximum: 300 },
        },
        required: ['teacher', 'school', 'instrument', 'class_name', 'date', 'date_from', 'date_to', 'start_time_from', 'start_time_to', 'unavailable', 'limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_teachers',
      description: 'Return the current teacher list from Supabase. Use when the user asks who the teachers are or when checking a teacher name.',
      strict: true,
      parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
    },
  },
];

function nullableArgs(value: unknown): SearchLessonsArgs {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (item !== null && item !== undefined && item !== '') result[key] = item;
  }
  return result as SearchLessonsArgs;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is missing from the server environment.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const messages = cleanMessages(body?.messages);

    if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
      return NextResponse.json({ error: 'Please enter a message.' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const singaporeDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const systemMessage: OpenAI.Chat.Completions.ChatCompletionSystemMessageParam = {
      role: 'system',
      content: `You are Calendar AI for Music Delight School's MOE scheduling website.

Current Singapore date: ${singaporeDate}. Resolve relative dates such as today, tomorrow, this Friday and next Monday using Asia/Singapore time.

You have read-only tools connected to the live Supabase database. Use them whenever the user asks about real teachers or lessons. Never answer live-data questions from memory or assumptions.

Reliability rules:
- Extract and combine every relevant filter: teacher, school, instrument, class/programme, date/range and time/range.
- Never silently guess an ambiguous teacher or school. If a tool returns needs_clarification, ask one concise clarification question and show its suggestions.
- Instrument currently has no dedicated database column. The tool infers it from class_name and school text. Clearly mention this limitation only when it materially affects confidence.
- Do not claim a teacher is free unless you have checked the complete requested date/time range and have enough information to define what “free” means.
- When no results are found, state the exact filters checked and suggest one useful correction.
- Use Singapore dates (DD MMM YYYY) and 24-hour times in answers.
- Keep results concise, grouped by date, and include teacher, school, class, start and end time.
- You are read-only. Never claim to add, move, edit or delete lessons.`,
    };

    conversation.unshift(systemMessage);

    let finalText = '';

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop += 1) {
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        messages: conversation,
        tools,
        tool_choice: 'auto',
      });

      const assistant = completion.choices[0]?.message;
      if (!assistant) throw new Error('OpenAI returned no assistant message.');
      conversation.push(assistant);

      if (!assistant.tool_calls?.length) {
        finalText = assistant.content || 'I could not produce an answer.';
        break;
      }

      for (const toolCall of assistant.tool_calls) {
        // OpenAI v6 models tool calls as a union of function and custom calls.
        // Only function calls have the `.function` property used below.
        if (toolCall.type !== 'function') continue;

        const functionName = toolCall.function.name;
        const functionArguments = toolCall.function.arguments;

        let output: unknown;
        try {
          const parsed = JSON.parse(functionArguments || '{}');
          if (functionName === 'search_lessons') output = await searchLessons(nullableArgs(parsed));
          else if (functionName === 'list_teachers') output = await listTeachers();
          else output = { error: `Unknown tool: ${functionName}` };
        } catch (error) {
          output = { error: error instanceof Error ? error.message : 'The database tool failed.' };
        }

        conversation.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(output),
        });
      }
    }

    if (!finalText) finalText = 'I could not complete the database search. Please try a more specific question.';

    return new Response(finalText, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Calendar AI route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The AI assistant could not respond.' },
      { status: 500 },
    );
  }
}
