
-- NGIPEN: Restrict public access to user bio.
-- Keep bio readable by trusted server-side service_role only.
-- Does not modify or delete user data.

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.public_users') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.public_users is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_users'
      AND column_name = 'bio'
  ) THEN
    RAISE EXCEPTION 'Preflight failed: bio column is missing from public_users';
  END IF;

  IF NOT has_column_privilege(
    'service_role',
    'public.public_users',
    'bio',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'Preflight failed: service_role cannot read bio';
  END IF;
END;
$preflight$;

-- Remove bio read access from public-facing roles.
REVOKE SELECT (bio)
ON TABLE public.public_users
FROM anon, authenticated, PUBLIC;

DO $postflight$
BEGIN
  IF has_column_privilege(
    'anon',
    'public.public_users',
    'bio',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'Postflight failed: anon can still read bio';
  END IF;

  IF has_column_privilege(
    'authenticated',
    'public.public_users',
    'bio',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'Postflight failed: authenticated can still read bio';
  END IF;

  IF has_column_privilege(
    'service_role',
    'public.public_users',
    'bio',
    'SELECT'
  ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Postflight failed: service_role bio access was not preserved';
  END IF;
END;
$postflight$;

COMMIT;
