# Final local release changes

## PDF import safeguards
- Duplicate lessons are locked and cannot be selected or imported.
- Duplicate status is shown as **Already exists**.
- Duplicate checks now say **Matches an existing calendar record** instead of **No clash found**.
- New and changed lessons remain selected by default.
- Clash and review items remain unselected unless manually reviewed.
- The primary import button clearly distinguishes safe changes from manually selected warning items.

## Import analysis summary
- Added a summary panel showing the uploaded file, lessons scanned, existing records, new lessons, changed lessons, clashes, and the recommended action.
- Possible removals remain review-only and are never deleted automatically.

## Safety
- Existing duplicate protection remains active during the final database write, not only in the interface.
