# V2 local test update

Added for offline VS Code testing:

1. Calendar AI Pro
- Reads lessons and teachers.
- Reads teacher weekly availability and leave.
- Reads unable-to-attend requests.
- Reads replacement tasks.
- Can produce date-range operations summaries.
- Remains read-only.

2. Smart dashboard
- Live summary above the admin calendar.
- Today's lessons and teachers working.
- Current conflicts, pending requests and open replacements.
- Unavailable teachers tomorrow and suggested actions.

3. Smarter PDF import
- Compares detected PDF lessons with Supabase before import.
- Shows new, changed, duplicate and possible-removed counts.
- Adds new rows and updates teacher assignment on changed rows.
- Never automatically deletes possible removals.

Environment variables required:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- OPENAI_API_KEY

Run locally:
1. Extract the ZIP.
2. Copy your existing `.env.local` into the folder.
3. Run `npm install` (or `npm ci`).
4. Run `npm run dev`.
