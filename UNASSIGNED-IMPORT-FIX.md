# Unassigned lesson import fix

- Lessons where the PDF does not contain a recognised teacher are now treated as valid **New** lessons.
- They are selected by **Select safe changes** and can be imported normally.
- Supabase stores their `teacher_name` as `null`, so they appear in the calendar's existing **Unassigned** category.
- Teacher clash detection is skipped for these rows until a teacher is assigned.
- The import preview clearly states that the lesson will appear under **Unassigned**.
