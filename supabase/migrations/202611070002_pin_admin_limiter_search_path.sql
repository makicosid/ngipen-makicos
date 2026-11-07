-- Search-path hardening only. Function body and EXECUTE ACL are unchanged.
-- All application table references in the current definition are schema-qualified;
-- built-in functions resolve through pg_catalog.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.check_admin_login_limit(text)') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.check_admin_login_limit(text) is missing';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.check_admin_login_limit(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.check_admin_login_limit(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.check_admin_login_limit(text)', 'EXECUTE')
     OR EXISTS (
       SELECT 1
       FROM pg_proc p
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
       ) AS acl
       WHERE p.oid = 'public.check_admin_login_limit(text)'::regprocedure
         AND acl.grantee = 0::oid
         AND acl.privilege_type = 'EXECUTE'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_proc p
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
       ) AS acl
       WHERE p.oid = 'public.check_admin_login_limit(text)'::regprocedure
         AND acl.privilege_type = 'EXECUTE'
         AND acl.grantee <> p.proowner
         AND acl.grantee <> (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
     )
     OR EXISTS (
       SELECT 1
       FROM pg_proc p
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
       ) AS acl
       WHERE p.oid = 'public.check_admin_login_limit(text)'::regprocedure
         AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
         AND acl.privilege_type = 'EXECUTE'
         AND acl.is_grantable
     ) THEN
    RAISE EXCEPTION 'Preflight failed: function EXECUTE ACL differs from the expected service-only scope';
  END IF;
END;
$preflight$;

ALTER FUNCTION public.check_admin_login_limit(text) SET search_path = '';

DO $postflight$
DECLARE
  v_config text[];
BEGIN
  SELECT proconfig INTO v_config FROM pg_proc
  WHERE oid = 'public.check_admin_login_limit(text)'::regprocedure;
  IF NOT ('search_path=""' = ANY (coalesce(v_config, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'Postflight failed: empty search_path not recorded';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.check_admin_login_limit(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.check_admin_login_limit(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.check_admin_login_limit(text)', 'EXECUTE')
     OR EXISTS (
       SELECT 1
       FROM pg_proc p
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
       ) AS acl
       WHERE p.oid = 'public.check_admin_login_limit(text)'::regprocedure
         AND acl.grantee = 0::oid
         AND acl.privilege_type = 'EXECUTE'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_proc p
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
       ) AS acl
       WHERE p.oid = 'public.check_admin_login_limit(text)'::regprocedure
         AND acl.privilege_type = 'EXECUTE'
         AND acl.grantee <> p.proowner
         AND acl.grantee <> (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
     )
     OR EXISTS (
       SELECT 1
       FROM pg_proc p
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
       ) AS acl
       WHERE p.oid = 'public.check_admin_login_limit(text)'::regprocedure
         AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
         AND acl.privilege_type = 'EXECUTE'
         AND acl.is_grantable
     ) THEN
    RAISE EXCEPTION 'Postflight failed: function EXECUTE ACL changed';
  END IF;
END;
$postflight$;

COMMIT;
