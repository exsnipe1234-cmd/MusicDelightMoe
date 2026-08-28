import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DetectedLesson = { date: string; startTime: string; endTime: string; className: string; teacher: string | null; confidence?: number; reviewReasons?: string[] };

const validDate = (value: unknown) => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value);
const validTime = (value: unknown) => typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publicKey || !process.env.OPENAI_API_KEY) throw new Error('Required server environment variables are missing.');

    const cookieStore = cookies();
    const sessionClient = createServerClient(url, publicKey, { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } });
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: profile } = await sessionClient.from('profiles').select('role,active').eq('id', user.id).single();
    if (profile?.role !== 'admin' || !profile.active) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });

    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File) || !image.type.startsWith('image/')) return NextResponse.json({ error: 'Upload a PNG, JPEG, or WebP timetable image.' }, { status: 400 });
    if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'The image must be 10 MB or smaller.' }, { status: 400 });

    const base64 = Buffer.from(await image.arrayBuffer()).toString('base64');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_OCR_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You extract dated school timetable lessons from images. Return JSON only. Never invent unreadable data.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Read this timetable image and return exactly this JSON shape: {"monthName":"string","lessons":[{"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","className":"string","teacher":"string or null","confidence":0,"reviewReasons":[]}]}. Extract only confirmed dated sessions. Use the title for programme context, such as "Guitar - 5N". Resolve dates with the year printed in the image; if no year is visible, return an empty lessons array. Ignore blacked-out, cancelled, blank, holiday, or unreadable cells. Teacher must be null unless a full teacher name is visibly printed. Set confidence from 0 to 100 based on legibility and add concise reviewReasons when date, time, class, or teacher text is uncertain.` },
            { type: 'image_url', image_url: { url: `data:${image.type};base64,${base64}`, detail: 'high' } },
          ],
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) throw new Error('The image parser returned no timetable data.');
    const parsed = JSON.parse(raw) as { monthName?: unknown; lessons?: unknown };
    const lessons = Array.isArray(parsed.lessons) ? parsed.lessons.filter((lesson): lesson is DetectedLesson => {
      if (!lesson || typeof lesson !== 'object') return false;
      const row = lesson as DetectedLesson;
      return validDate(row.date) && validTime(row.startTime) && validTime(row.endTime) && typeof row.className === 'string' && row.className.trim().length > 0 && (typeof row.teacher === 'string' || row.teacher === null) && (row.confidence === undefined || (Number.isInteger(row.confidence) && row.confidence >= 0 && row.confidence <= 100)) && (row.reviewReasons === undefined || Array.isArray(row.reviewReasons));
    }) : [];
    return NextResponse.json({ monthName: typeof parsed.monthName === 'string' ? parsed.monthName : 'Image timetable', lessons });
  } catch (error) {
    console.error('Image timetable OCR error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Image timetable analysis failed.' }, { status: 500 });
  }
}
