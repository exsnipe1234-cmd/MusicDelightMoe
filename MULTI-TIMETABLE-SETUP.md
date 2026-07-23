# Multi-timetable account access

Each teacher account now has:

- **Primary timetable**: kept in `profiles.teacher_name`. This is the teacher identity used for unable-to-attend requests.
- **Visible timetables**: stored in `profile_teacher_access`. These control all calendars the account may view.

Example:

- Audrey: primary `Audrey`; visible `Audrey`
- Ashley: primary `Ashley`; visible `Ashley`, `Audrey`

## Setup

1. Back up the Supabase project.
2. Open Supabase Dashboard → SQL Editor.
3. Run `supabase/migrations/202607230001_multi_timetable_access.sql`.
4. Start the project in VS Code with `npm run dev`.
5. Sign in as an admin and open Teacher Management.
6. Select a primary timetable and tick every timetable that account may view.

The migration automatically copies every existing `profiles.teacher_name` into the new access table, so current teacher accounts keep working immediately.
