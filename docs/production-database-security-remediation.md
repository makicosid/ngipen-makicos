# NGIPEN production database security remediation

Status: drafted for review; **not executed**. No database backup is claimed. The production MCP was reported as configured `read_only=true`; that connection mode must be resolved through the approved configuration owner before applying any migration. Do not attempt to bypass it.

## Baseline recorded from read-only metadata

Source: `supabase_ngipen` MCP metadata and SELECT-only PostgreSQL catalog queries from the audit. No table rows, credentials, password hashes, PINs, session tokens, or personal values were selected. The server reports target `twvmcqbhzqhqtdrtjecr` per task context. Migration metadata tool returned no entries.

- `public.users`: RLS enabled, not forced. Permissive policies discovered: `allow insert users`, `allow select own`, `users can read public view`, `users can register`, `users_delete_all`, `users_insert_all`, `users_select_all`, `users_update_all`. Several policies use `true`; table grants allow `anon` and `authenticated` SELECT/INSERT/UPDATE/DELETE. Sensitive `password_hash` column exists.
- `public.users` column ACL review: no column-level grants were found in the read-only catalog review; broad access was via table-level grants and RLS policies. The migration still explicitly clears column ACLs and checks postflight to remain safe if catalog state differs at apply time.
- `public.public_users`: owner `postgres`; view selects `id`, `username`, `display_name`, `bio`, `avatar_url`, `created_at` from `users`; no `password_hash`, PIN, or token column in its definition. Existing ACL included more than SELECT for public roles. Remediation must reduce it to SELECT only on this exact allowlist, with no column-level mutation privileges.
- `public.event_moderation_logs`: RLS disabled; public roles have table CRUD privileges; no consumer was found in inspected local source. Production/deployment consumers remain to be confirmed.
- `public.costume_rentals`: RLS enabled with a public SELECT policy. `anon` and `authenticated` currently have broad table privileges, though no public write policy was found. `image_path` and `subscription_expires_at` are columns. Local public rental API returns an allowlisted projection and uses the service-role client.
- The `sync_user_to_events()` trigger function is attached to an enabled trigger on the user profile update path. Its definition synchronizes `display_name` changes into related `events` and `event_documentations`. This dependency must remain enabled and its behavior must be checked after profile updates; the migrations do not alter the trigger or function.
- `public.admin_settings`, `public.admin_sessions`, `public.admin_login_attempts`: RLS enabled, no public policies; grants in the catalog were restricted to owner/service role.
- Seven requested login functions were inspected. EXECUTE was available to `postgres` and `service_role`, not `anon`, `authenticated`, or `PUBLIC`. Six `ngipen_*` functions already use an empty search path. `check_admin_login_limit(text)` uses `search_path=public` and has schema-qualified table references.

## Baseline dependencies found in local source

- Registration/login/profile flows use server-side service-role access to `users` in `app/api/auth/route.ts`.
- Admin PIN verification in `app/api/admin-auth/route.ts` now verifies the hashed `scrypt$...` format using scrypt and `timingSafeEqual`. On a successful legacy PIN verification, it upgrades the value with a compare-and-set update; login fails closed if the upgrade fails or a concurrent update cannot be verified. Credential values are not logged or displayed.
- User-password legacy handling in `app/api/auth/route.ts` remains unresolved. The legacy branch still uses constant-time comparison against the legacy stored value and upgrades it after a successful login. Removing all legacy plaintext comparison without locking out those accounts requires a credential conversion or reset path that is not currently implemented; no password reset or mass conversion was performed.
- UI reads public profile projections through `public_users` in `app/page.tsx`; admin user listing also reads this view.
- Rental listing uses `app/api/admin-rentals/route.ts`, which returns selected fields and derives subscription status. Storage writes/deletes use server-side code.
- No reference to `event_moderation_logs` was found in the inspected local source. This is not proof that no external consumer or different deployed revision uses it.
- Local source does not establish what production code or third-party consumers are deployed. Confirm before DB changes.

## Migration files

1. `202611070001_harden_public_access.sql`: removes confirmed broad `users` policies/table grants, makes `public_users` SELECT-only, enables RLS and removes public grants on moderation logs, and restricts direct rental SELECT to the current public response fields. It has transaction-scoped preflight/postflight assertions and does not mutate row data.
2. `202611070002_pin_admin_limiter_search_path.sql`: sets only `check_admin_login_limit(text)` to an empty search path; body and EXECUTE ACL remain unchanged. This is independently deployable after function-body and role ACL review.

## Preconditions before application

1. Confirm the currently deployed application revision matches the reviewed local code.
2. Inventory every external PostgREST client and operational job that accesses `users`, `public_users`, `event_moderation_logs`, or `costume_rentals` directly.
3. On staging with equivalent Supabase/PostgreSQL roles, apply and verify migrations. Confirm the view still returns only approved profile fields when queried as `anon` and `authenticated` after base-table grants are removed.
4. Exercise public and admin rental listing, search, click tracking, photo upload/removal, registration, login, profile edit, event moderation, and admin user listing.
5. Capture current catalog metadata for policy, ACL, view definition/owner, and function ACL as a change record. This is metadata capture, not a data backup.
6. Confirm approved production write access. A read-only MCP connection cannot apply these changes; do not use alternate or unapproved write paths.

## Rollback and recovery

Each migration uses a transaction and preflight checks. Any failed assertion should abort before commit. If post-commit application behavior regresses, prefer a **fix-forward** that restores the specific required feature through an allowlisted API or narrowly scoped policy. Do not restore the old broad `users` policies/grants or open moderation-log access. No rollback SQL that reintroduces those exposures is provided.

For rental compatibility issues, keep the restricted columns protected and repair the public endpoint or an explicitly approved, narrow projection. Do not regrant direct access to `image_path` or `subscription_expires_at` as a generic rollback.

## Post-change verification checklist

- `users`: RLS enabled; no anon/authenticated table or column privileges; no public-facing policies; `service_role` still has the privileges used by the API.
- `public_users`: anon/authenticated SELECT allowed; no anon/authenticated INSERT/UPDATE/DELETE; definition contains only the approved profile projection and no credential/token fields.
- Profile update dependency: `sync_user_to_events()` trigger remains enabled; a staging profile display-name update confirms related event/documentation display names continue to synchronize.
- `event_moderation_logs`: RLS enabled; no public-facing policy or privilege; confirm any approved backend consumer independently.
- `costume_rentals`: anon/authenticated can select only the allowlisted columns; `image_path` and `subscription_expires_at` are not selectable; public policy remains SELECT-only; no write privilege remains.
- Login functions: exact signature/body unchanged except configured search_path for `check_admin_login_limit`; only service role and owner retain EXECUTE.
- Runtime in staging: register, login, logout, profile read/update, public/admin event operations, documentation display/upload, rental search/list/click/admin management, and admin authentication.
- Confirm no business rows were changed by remediation; SQL files contain only catalog reads, policy/privilege/RLS changes, and function configuration changes.

## Items not addressed by these DB migrations

- Admin PIN source hardening is implemented locally but is not deployed: hashed PINs use scrypt and timing-safe verification, and successful legacy PIN verification upgrades with compare-and-set. Existing legacy PINs remain until each successful login; failures to securely upgrade fail closed.
- Legacy user-password plaintext comparison remains in source as a transitional path. It is unresolved because removing it without locking out legacy accounts requires a credential conversion or reset mechanism that is absent. A future change needs an approved account recovery/conversion design; do not mass-reset passwords or read credential values.
- Direct production runtime testing is not part of this migration. Deployment is separate and requires its own approval.
