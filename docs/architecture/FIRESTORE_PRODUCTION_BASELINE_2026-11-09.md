# Firestore Production Baseline — 2026-11-09

**Firebase project:** studio-proper  
**Database:** (default)  
**Hosting site:** studio-37  
**Capture status:** Partial; production export not yet verified.

## 1. Known active production ruleset

The migration handoff records the active cloud.firestore/(default) ruleset ID as:

aa6d3469-9101-4c7a-8ede-bcba9894d38a

This ID is the production baseline identifier supplied in the approved handoff. The current GitHub integration does not provide Firestore Rules release export or Firebase project read access, and the local Windows worktree/CLI is not available in this session. Therefore the deployed rule source was not downloaded or compared here.

## 2. Local repository rules file

- Path: firestore.rules
- Git blob SHA observed on the migration branch and main: 54d2fe73096f44bce66be66712508d7a01aeaaf3
- The branch copy matches the main copy at capture time.
- This SHA identifies the repository file only. It is not asserted to be the source of the active production ruleset above.
- The handoff explicitly warns that production rules have drifted significantly from the local file.

Before any future production Rules deployment, export the active production ruleset, compare it with the intended branch version, preserve production-only fixes, merge deliberately, run the complete Emulator suite, and obtain explicit deployment approval. Do not deploy firestore.rules wholesale as a shortcut.

## 3. Local repository composite index baseline

- Path: firestore.indexes.json
- Git blob SHA: 512c2dd8db3a4f4599a2d9c3f692cc9d2d3106e8
- Current entries:
  - customerFollowUpTasks(status ASC, completedAt DESC)
  - customerFollowUpEvents(taskId ASC, createdAt DESC)
  - customerFollowUpTasks(status ASC, dueAt ASC, dueTime ASC)

The Follow-up active-list composite is present in the repository, but the handoff records that production returned a missing-index error for customerFollowUpTasks(status, dueAt, dueTime). Whether the index was subsequently deployed is unknown and must be confirmed in the Firebase Console before closing that production incident. This phase does not deploy indexes.

## 4. Query audit summary

Observed application queries include:

- Follow-up active tasks: status in [open, in_progress, snoozed], ordered by dueAt ASC, dueTime ASC, limit 200.
- Follow-up completed tasks: status == completed, ordered by completedAt DESC, limit 50.
- Follow-up event history: taskId == selectedTaskId, ordered by createdAt DESC, limit 30.
- Customers: createdAt DESC list and equality lookup by phoneKey.
- Booking/calendar: clientCalendarSlots.date ASC, Booking date DESC, and client ownership filters by UID/email/phone.
- Booking conversations: bookingId == selectedBookingId, with client UID scoping for the client view.
- Payment proof: equality lookups by clientUid or bookingId.
- Guard attendance: equality/range filters by guardUid and date.
- Bookkeeping: date range filters and date DESC.
- Inventory: updatedAt DESC items and createdAt DESC stock movements.
- Gallery: createdAt DESC.
- Operator Fee entries: bookingDate DESC.
- Maintenance collections: bounded lists ordered by their configured timestamp field.
- Users: Owner account list ordered by createdAt DESC.
- Notifications: all events, optional status == selectedStatus, and client targetUid == auth.uid.

The three composites above are the only explicit composite entries currently present in the repository file. This query inventory is a source-level audit, not a claim that every possible filter combination has been executed against production indexes. Query shapes that combine multiple field filters and ordering must be checked against the actual production index state.

## 5. Safe capture procedure for the next access-enabled session

1. Confirm the selected Firebase project is exactly studio-proper and database is (default).
2. Export/read the active Firestore Rules release and indexes without changing them.
3. Save the raw exported rules and index configuration as dated review artifacts; do not include secrets or customer documents.
4. Compare the deployed release ID and exported source with this baseline note and the current branch.
5. Record all production-only differences and the deployed status of the active Follow-up composite index.
6. Do not publish anything until the user explicitly approves a separate production deployment.
