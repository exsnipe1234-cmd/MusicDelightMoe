# V4 Local Changes

## Automatic clash detection
- PDF imports are checked against other rows in the uploaded PDF.
- PDF imports are checked against existing Supabase lessons in the same date range.
- Teacher overlaps and possible duplicate records are flagged before import.
- Conflict/review rows are unselected by default and require an explicit override.
- Calendar AI has a live `search_conflicts` tool for overlap and double-booking questions.

## Smarter PDF import
- Per-row statuses: New, Changed, Duplicate, Clash, Review.
- Safe changes can be selected in one click.
- Import only selected rows.
- Changed rows show the previous teacher and new teacher.
- Filter preview by status.
- Possible removals are shown separately and never deleted automatically.

## ChatGPT-like assistant
- Cleaner structured rendering for headings, bullets, numbered lists, bold text and inline code.
- Suggested follow-up prompts based on the latest answer.
- Copy and retry controls.
- Stop-generation button.
- Auto-growing message box.
- Session conversation history retained.
