# NGIPEN Event Cleanup

## Scope

- Manual admin-only cleanup for events whose `end_date` is at least 7 calendar days before the current date in `Asia/Jakarta`.
- Removes the event poster and all related documentation images from the `posters` and `documentations` Storage buckets through the Supabase Storage API.
- Deletes legacy `public.documentations` rows explicitly; `event_documentations`, reviews, saves, views, and moderation logs are handled by the event foreign-key cascades.
- Copies moderation log rows into `event_cleanup_audit.moderation_snapshot` before the event is deleted.
- Preserves cleanup audit rows without an event foreign key.
- Does not delete a Storage object when another event/documentation row references the same bucket/path.

## Files

- `app/api/admin/events/cleanup/route.ts`: authenticated preview and cleanup endpoints.
- `app/admin-cleanup-panel.tsx`: admin UI for candidates, history, and failed/incomplete attempts; missing poster images render a fallback.
- `app/page.tsx`: adds the Event Cleanup admin tab; completed events no longer expose legacy direct-delete controls and must use Event Cleanup.
- `app/api/admin/events/delete-completed/route.ts`: legacy endpoint returns HTTP 410 after validating origin and admin session.
- `app/api/admin/events/bulk-delete/route.ts`: server accepts only `Rejected`; `Completed` requests are rejected with HTTP 400 and must use Event Cleanup.
- `supabase/migrations/202611090001_event_cleanup.sql`: audit table, active-process guard, and transactional database finalization function.

## Activation

1. Review `supabase/migrations/202611090001_event_cleanup.sql`.
2. Apply the migration to the intended Supabase database using the approved database-change process. The migration is not run by this repository change.
3. Confirm the server environment already contains `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is read only in server routes and must never be exposed to client code.
4. Deploy the code through the separately approved branch/deployment process.
5. Log in as admin and open **Event Cleanup**. The API verifies the admin session against `admin_sessions`.

## Operational safeguards

- The API recalculates the Jakarta date cutoff and re-reads the event before every deletion. The SQL finalizer independently rechecks the seven-day cutoff while locking the event row.
- Sponsored or pinned events require an additional explicit acknowledgement in the UI and API request.
- Only public Storage URLs from the configured Supabase project and the expected buckets are accepted. Unsupported/external URLs fail closed.
- URL query parameters are excluded when resolving object paths.
- Shared object paths are retained if referenced by another event or documentation row, including legacy documentation rows with a NULL `event_id`.
- Missing Storage objects are recorded as already missing and do not prevent cleanup.
- Storage is removed before database rows. If Storage removal fails, the event database record is retained.
- Database deletion and audit completion happen in one PostgreSQL function transaction.
- Incomplete `pending` attempts older than 30 minutes can be marked failed and retried. `storage_deleted` attempts remain in that resumable state if database finalization fails, and can resume using their existing audit row.
- The migration grants audit-table access and finalization-function execution only to `service_role`; no public RLS policy is created.

## Notes / limitations

- `admin_sessions` in the inspected application stores session token hashes and expiry but no individual admin identity. The audit therefore records `admin_actor = 'admin'`, not a personal admin ID. Sponsored/pinned confirmation is recorded in `special_status_confirmed` and rechecked by the SQL finalizer.
- The preview returns at most 200 candidates; the history panel shows the latest 40 audit rows.
- The date policy is calendar-day based (`end_date <= Jakarta current date - 7 days`), matching the agreed retention rule; it is not a rolling 168-hour calculation.
- This change does not run against production, apply SQL, push Git changes, or deploy Vercel.

## Poster replacement safety

- Replacing an event poster no longer removes the previous Storage object immediately. The old object may still be referenced by another record; it is retained rather than risking deletion of a shared file.
- Retained old poster objects may become orphaned. They require a future reference-aware cleanup process; this route intentionally does not delete them.

## Separate existing deletion path

- The existing bulk-delete API for `Rejected` events remains outside this seven-day cleanup workflow. It deletes eligible database rows but does not remove poster Storage objects. This is a pre-existing behavior and should be reviewed separately if the requirement is to guarantee Storage cleanup for every event deletion path, not only expired-event cleanup.
- Completed events are intentionally excluded from both legacy direct-delete and bulk-delete routes. They remain visible in the Completed admin list and are eligible for deletion only through Event Cleanup after the seven-day retention and audit checks.
