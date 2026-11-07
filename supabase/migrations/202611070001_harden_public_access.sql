-- NGIPEN production security remediation.
-- Review and apply only through the approved database change path.
-- This migration changes privileges/RLS and stores an ACL snapshot in a
-- transaction-local setting; it does not read or modify application rows or
-- create/drop persistent database objects.
-- It intentionally fails closed if the public profile view is missing or exposes
-- password_hash. It preserves the view as a read-only public projection.

BEGIN;

DO $preflight$
DECLARE
  v_def text;
  v_users_owner name;
  v_view_owner name;
  v_service_role_acl_before jsonb;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.users is missing';
  END IF;
  IF to_regclass('public.public_users') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.public_users is missing';
  END IF;
  IF (SELECT relkind FROM pg_class WHERE oid = 'public.public_users'::regclass) <> 'v' THEN
    RAISE EXCEPTION 'Preflight failed: public.public_users is not a view';
  END IF;

  SELECT pg_get_viewdef('public.public_users'::regclass, true)
    INTO v_def;
  IF v_def IS NULL OR lower(v_def) LIKE '%password_hash%' OR lower(v_def) LIKE '%pin_hash%'
     OR lower(v_def) LIKE '%token_hash%' THEN
    RAISE EXCEPTION 'Preflight failed: public.public_users is missing or projects a sensitive field';
  END IF;

  SELECT pg_get_userbyid(relowner) INTO v_users_owner
    FROM pg_class WHERE oid = 'public.users'::regclass;
  SELECT pg_get_userbyid(relowner) INTO v_view_owner
    FROM pg_class WHERE oid = 'public.public_users'::regclass;
  IF v_users_owner IS DISTINCT FROM v_view_owner THEN
    RAISE EXCEPTION 'Preflight failed: public_users and users owners differ; review view security semantics';
  END IF;

  -- The prior production audit found exactly these eight policies. Fail closed
  -- if the complete inventory or any policy definition has changed since then.
  IF EXISTS (
    WITH expected(policyname, permissive, roles, cmd, qual, with_check) AS (
      VALUES
        ('allow insert users', 'PERMISSIVE', ARRAY['anon']::name[], 'INSERT', NULL::text, 'true'::text),
        ('allow select own', 'PERMISSIVE', ARRAY['anon']::name[], 'SELECT', 'false'::text, NULL::text),
        ('users can read public view', 'PERMISSIVE', ARRAY['anon','authenticated']::name[], 'SELECT', 'true'::text, NULL::text),
        ('users can register', 'PERMISSIVE', ARRAY['anon','authenticated']::name[], 'INSERT', NULL::text, 'true'::text),
        ('users_delete_all', 'PERMISSIVE', ARRAY['public']::name[], 'DELETE', 'true'::text, NULL::text),
        ('users_insert_all', 'PERMISSIVE', ARRAY['public']::name[], 'INSERT', NULL::text, 'true'::text),
        ('users_select_all', 'PERMISSIVE', ARRAY['public']::name[], 'SELECT', 'true'::text, NULL::text),
        ('users_update_all', 'PERMISSIVE', ARRAY['public']::name[], 'UPDATE', 'true'::text, 'true'::text)
    ),
    actual AS (
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'users'
    ),
    differences AS (
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    )
    SELECT 1 FROM differences
  ) THEN
    RAISE EXCEPTION 'Preflight failed: public.users policy inventory differs from the audited eight policies; review every current policy';
  END IF;

  IF to_regclass('public.event_moderation_logs') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.event_moderation_logs is missing';
  END IF;
  IF to_regclass('public.costume_rentals') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.costume_rentals is missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.costume_rentals'::regclass) THEN
    RAISE EXCEPTION 'Preflight failed: public.costume_rentals RLS is not enabled';
  END IF;

  -- The prior production audit found one public rental listing policy.
  -- Fail closed if its full definition changed or any policy was added.
  IF EXISTS (
    WITH expected(policyname, permissive, roles, cmd, qual, with_check) AS (
      VALUES (
        'Public can view costume rentals',
        'PERMISSIVE',
        ARRAY['anon','authenticated']::name[],
        'SELECT', 'true'::text, NULL::text
      )
    ),
    actual AS (
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'costume_rentals'
    ),
    differences AS (
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    )
    SELECT 1 FROM differences
  ) THEN
    RAISE EXCEPTION 'Preflight failed: public.costume_rentals policy inventory differs from the audited listing policy; review every current policy';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.users', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.users', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.users', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.users', 'DELETE') THEN
    RAISE EXCEPTION 'Preflight failed: service_role users privileges differ from expected; review deployed API dependencies';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.costume_rentals', 'SELECT') THEN
    RAISE EXCEPTION 'Preflight failed: service_role cannot read costume_rentals';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.event_moderation_logs', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.event_moderation_logs', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.event_moderation_logs', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.event_moderation_logs', 'DELETE') THEN
    RAISE EXCEPTION 'Preflight failed: service_role moderation-log privileges differ from expected';
  END IF;

  WITH targets(object_name) AS (
    VALUES
      ('public.users'::text),
      ('public.public_users'::text),
      ('public.event_moderation_logs'::text),
      ('public.costume_rentals'::text)
  ), table_snapshot AS (
    SELECT 'table:' || t.object_name AS object_name,
           coalesce(
             array_agg(p.privilege_name ORDER BY p.privilege_name)
               FILTER (WHERE has_table_privilege('service_role', t.object_name, p.privilege_name)),
             ARRAY[]::text[]
           ) AS privileges
    FROM targets t
    CROSS JOIN LATERAL (
      SELECT unnest(ARRAY[
        'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
      ]::text[]) AS privilege_name
      UNION ALL
      SELECT 'MAINTAIN'::text
      WHERE current_setting('server_version_num')::integer >= 170000
    ) AS p
    GROUP BY t.object_name
  ), column_snapshot AS (
    SELECT 'column:' || t.object_name || '.' || a.attname::text AS object_name,
           coalesce(
             array_agg(p.privilege_name ORDER BY p.privilege_name)
               FILTER (WHERE has_column_privilege('service_role', t.object_name, a.attname, p.privilege_name)),
             ARRAY[]::text[]
           ) AS privileges
    FROM targets t
    JOIN pg_class c ON c.oid = to_regclass(t.object_name)
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('REFERENCES'::text)) AS p(privilege_name)
    GROUP BY t.object_name, a.attname
  ), snapshot AS (
    SELECT * FROM table_snapshot
    UNION ALL
    SELECT * FROM column_snapshot
  )
  SELECT jsonb_object_agg(snapshot.object_name, to_jsonb(snapshot.privileges))
    INTO v_service_role_acl_before
  FROM snapshot;
  PERFORM pg_catalog.set_config(
    'ngipen_remediation.service_role_acl_snapshot',
    v_service_role_acl_before::text,
    true
  );
END;
$preflight$;

-- Keep the audited policy objects, but make each one deny every row operation.
ALTER POLICY "allow insert users" ON public.users WITH CHECK (false);
ALTER POLICY "allow select own" ON public.users USING (false);
ALTER POLICY "users can read public view" ON public.users USING (false);
ALTER POLICY "users can register" ON public.users WITH CHECK (false);
ALTER POLICY "users_delete_all" ON public.users USING (false);
ALTER POLICY "users_insert_all" ON public.users WITH CHECK (false);
ALTER POLICY "users_select_all" ON public.users USING (false);
ALTER POLICY "users_update_all" ON public.users USING (false) WITH CHECK (false);

REVOKE ALL PRIVILEGES ON TABLE public.users FROM anon, authenticated, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.public_users FROM anon, authenticated, PUBLIC;

-- Admin/event APIs use a server-side privileged client in the inspected source.
-- With no public policies, RLS blocks direct public access to moderation logs.
ALTER TABLE public.event_moderation_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.event_moderation_logs
  FROM anon, authenticated, PUBLIC;

-- Public rental access is restricted to the fields used by the public listing.
-- In particular, image_path and subscription_expires_at are not granted.
REVOKE ALL PRIVILEGES ON TABLE public.costume_rentals
  FROM anon, authenticated, PUBLIC;

-- Table-level REVOKE does not reliably communicate intent for column ACLs;
-- explicitly clear column grants before restoring only the approved rental fields.
DO $column_acl$
DECLARE
  v_column record;
BEGIN
  FOR v_column IN
    SELECT n.nspname, c.relname, a.attname
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(ARRAY['users','public_users','event_moderation_logs','costume_rentals'])
      AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES (%I) ON TABLE %I.%I FROM anon, authenticated, PUBLIC',
      v_column.attname, v_column.nspname, v_column.relname
    );
  END LOOP;
END;
$column_acl$;

-- Reassert the view's safe SELECT-only interface after clearing column grants.
GRANT SELECT (
  id, username, display_name, bio, avatar_url, created_at
) ON TABLE public.public_users TO anon, authenticated;

GRANT SELECT (
  id, name, region, province, city, instagram_url, image_url,
  display_order, created_at, is_verified, whatsapp_number
) ON TABLE public.costume_rentals TO anon, authenticated;

-- The existing SELECT policy for public rental listings remains unchanged.
-- Public mutation stays disallowed by RLS and by the revoked table privileges.

DO $postflight$
DECLARE
  v_service_role_acl_before jsonb;
  v_service_role_acl_after jsonb;
BEGIN
  v_service_role_acl_before := nullif(
    current_setting('ngipen_remediation.service_role_acl_snapshot', true),
    ''
  )::jsonb;
  IF v_service_role_acl_before IS NULL THEN
    RAISE EXCEPTION 'Postflight failed: service_role ACL snapshot is missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_moderation_logs'::regclass) THEN
    RAISE EXCEPTION 'Postflight failed: event_moderation_logs RLS is not enabled';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.costume_rentals'::regclass) THEN
    RAISE EXCEPTION 'Postflight failed: costume_rentals RLS is not enabled';
  END IF;

  IF EXISTS (
    WITH expected(policyname, permissive, roles, cmd, qual, with_check) AS (
      VALUES (
        'Public can view costume rentals',
        'PERMISSIVE',
        ARRAY['anon','authenticated']::name[],
        'SELECT', 'true'::text, NULL::text
      )
    ),
    actual AS (
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'costume_rentals'
    ),
    differences AS (
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    )
    SELECT 1 FROM differences
  ) THEN
    RAISE EXCEPTION 'Postflight failed: public.costume_rentals policy inventory changed';
  END IF;

  IF has_table_privilege('anon', 'public.users', 'SELECT')
     OR has_table_privilege('authenticated', 'public.users', 'SELECT')
     OR has_table_privilege('anon', 'public.users', 'INSERT')
     OR has_table_privilege('authenticated', 'public.users', 'INSERT')
     OR has_table_privilege('anon', 'public.users', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.users', 'UPDATE')
     OR has_table_privilege('anon', 'public.users', 'DELETE')
     OR has_table_privilege('authenticated', 'public.users', 'DELETE') THEN
    RAISE EXCEPTION 'Postflight failed: public privilege remains on users';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.users'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND (
        has_column_privilege('anon', 'public.users', a.attname, 'SELECT')
        OR has_column_privilege('authenticated', 'public.users', a.attname, 'SELECT')
        OR has_column_privilege('anon', 'public.users', a.attname, 'INSERT')
        OR has_column_privilege('authenticated', 'public.users', a.attname, 'INSERT')
        OR has_column_privilege('anon', 'public.users', a.attname, 'UPDATE')
        OR has_column_privilege('authenticated', 'public.users', a.attname, 'UPDATE')
        OR has_column_privilege('anon', 'public.users', a.attname, 'REFERENCES')
        OR has_column_privilege('authenticated', 'public.users', a.attname, 'REFERENCES')
      )
  ) THEN
    RAISE EXCEPTION 'Postflight failed: public column privilege remains on users';
  END IF;

  IF has_table_privilege('anon', 'public.public_users', 'INSERT')
     OR has_table_privilege('authenticated', 'public.public_users', 'INSERT')
     OR has_table_privilege('anon', 'public.public_users', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.public_users', 'UPDATE')
     OR has_table_privilege('anon', 'public.public_users', 'DELETE')
     OR has_table_privilege('authenticated', 'public.public_users', 'DELETE')
     OR has_table_privilege('anon', 'public.public_users', 'SELECT')
     OR has_table_privilege('authenticated', 'public.public_users', 'SELECT') THEN
    RAISE EXCEPTION 'Postflight failed: public_users must use column-level SELECT only for anon/authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.public_users'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
      AND (
        has_column_privilege('anon', 'public.public_users', a.attname, 'INSERT')
        OR has_column_privilege('authenticated', 'public.public_users', a.attname, 'INSERT')
        OR has_column_privilege('anon', 'public.public_users', a.attname, 'UPDATE')
        OR has_column_privilege('authenticated', 'public.public_users', a.attname, 'UPDATE')
      )
  ) THEN
    RAISE EXCEPTION 'Postflight failed: public_users has public column-level mutation privileges';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.public_users'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attname NOT IN ('id','username','display_name','bio','avatar_url','created_at')
  ) THEN
    RAISE EXCEPTION 'Postflight failed: public_users contains a column outside the approved projection';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY['id','username','display_name','bio','avatar_url','created_at']) AS approved(column_name)
    WHERE NOT has_column_privilege('anon', 'public.public_users', approved.column_name, 'SELECT')
       OR NOT has_column_privilege('authenticated', 'public.public_users', approved.column_name, 'SELECT')
  ) THEN
    RAISE EXCEPTION 'Postflight failed: approved public_users SELECT projection is incomplete';
  END IF;

  IF has_table_privilege('anon', 'public.event_moderation_logs', 'SELECT')
     OR has_table_privilege('authenticated', 'public.event_moderation_logs', 'SELECT')
     OR has_table_privilege('anon', 'public.event_moderation_logs', 'INSERT')
     OR has_table_privilege('authenticated', 'public.event_moderation_logs', 'INSERT')
     OR has_table_privilege('anon', 'public.event_moderation_logs', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.event_moderation_logs', 'UPDATE')
     OR has_table_privilege('anon', 'public.event_moderation_logs', 'DELETE')
     OR has_table_privilege('authenticated', 'public.event_moderation_logs', 'DELETE') THEN
    RAISE EXCEPTION 'Postflight failed: public privilege remains on event_moderation_logs';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.event_moderation_logs'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
      AND (
        has_column_privilege('anon', 'public.event_moderation_logs', a.attname, 'SELECT')
        OR has_column_privilege('authenticated', 'public.event_moderation_logs', a.attname, 'SELECT')
        OR has_column_privilege('anon', 'public.event_moderation_logs', a.attname, 'INSERT')
        OR has_column_privilege('authenticated', 'public.event_moderation_logs', a.attname, 'INSERT')
        OR has_column_privilege('anon', 'public.event_moderation_logs', a.attname, 'UPDATE')
        OR has_column_privilege('authenticated', 'public.event_moderation_logs', a.attname, 'UPDATE')
      )
  ) THEN
    RAISE EXCEPTION 'Postflight failed: public column privilege remains on event_moderation_logs';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.event_moderation_logs', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.event_moderation_logs', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.event_moderation_logs', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.event_moderation_logs', 'DELETE') THEN
    RAISE EXCEPTION 'Postflight failed: service_role moderation-log privileges changed';
  END IF;

  IF has_column_privilege('anon', 'public.costume_rentals', 'image_path', 'SELECT')
     OR has_column_privilege('authenticated', 'public.costume_rentals', 'image_path', 'SELECT')
     OR has_column_privilege('anon', 'public.costume_rentals', 'is_subscription', 'SELECT')
     OR has_column_privilege('authenticated', 'public.costume_rentals', 'is_subscription', 'SELECT')
     OR has_column_privilege('anon', 'public.costume_rentals', 'subscription_expires_at', 'SELECT')
     OR has_column_privilege('authenticated', 'public.costume_rentals', 'subscription_expires_at', 'SELECT') THEN
    RAISE EXCEPTION 'Postflight failed: protected rental column is publicly readable';
  END IF;

  IF has_table_privilege('anon', 'public.costume_rentals', 'SELECT')
     OR has_table_privilege('authenticated', 'public.costume_rentals', 'SELECT') THEN
    RAISE EXCEPTION 'Postflight failed: rental listing must use column-level SELECT only';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    WHERE a.attrelid = 'public.costume_rentals'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
      AND (
        (
          a.attname = ANY(ARRAY[
            'id','name','region','province','city','instagram_url','image_url',
            'display_order','created_at','is_verified','whatsapp_number'
          ]::name[])
          AND (
            NOT has_column_privilege('anon', 'public.costume_rentals', a.attname, 'SELECT')
            OR NOT has_column_privilege('authenticated', 'public.costume_rentals', a.attname, 'SELECT')
          )
        )
        OR (
          a.attname <> ALL(ARRAY[
            'id','name','region','province','city','instagram_url','image_url',
            'display_order','created_at','is_verified','whatsapp_number'
          ]::name[])
          AND (
            has_column_privilege('anon', 'public.costume_rentals', a.attname, 'SELECT')
            OR has_column_privilege('authenticated', 'public.costume_rentals', a.attname, 'SELECT')
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Postflight failed: public rental column SELECT grants differ from the exact listing allowlist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.costume_rentals'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
      AND (
        has_column_privilege('anon', 'public.costume_rentals', a.attname, 'INSERT')
        OR has_column_privilege('authenticated', 'public.costume_rentals', a.attname, 'INSERT')
        OR has_column_privilege('anon', 'public.costume_rentals', a.attname, 'UPDATE')
        OR has_column_privilege('authenticated', 'public.costume_rentals', a.attname, 'UPDATE')
      )
  ) THEN
    RAISE EXCEPTION 'Postflight failed: public column mutation privilege remains on costume_rentals';
  END IF;

  IF has_table_privilege('anon', 'public.costume_rentals', 'INSERT')
     OR has_table_privilege('authenticated', 'public.costume_rentals', 'INSERT')
     OR has_table_privilege('anon', 'public.costume_rentals', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.costume_rentals', 'UPDATE')
     OR has_table_privilege('anon', 'public.costume_rentals', 'DELETE')
     OR has_table_privilege('authenticated', 'public.costume_rentals', 'DELETE') THEN
    RAISE EXCEPTION 'Postflight failed: public mutation privilege remains on costume_rentals';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES ('anon'::text), ('authenticated'::text)) AS roles(role_name)
    CROSS JOIN (VALUES
      ('public.users'::text),
      ('public.public_users'::text),
      ('public.event_moderation_logs'::text),
      ('public.costume_rentals'::text)
    ) AS objects(object_name)
    CROSS JOIN (VALUES
      ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('DELETE'::text),
      ('TRUNCATE'::text), ('REFERENCES'::text), ('TRIGGER'::text)
    ) AS privileges(privilege_name)
    WHERE has_table_privilege(roles.role_name, objects.object_name, privileges.privilege_name)
  ) THEN
    RAISE EXCEPTION 'Postflight failed: a public table-level privilege remains on a protected object';
  END IF;
  IF current_setting('server_version_num')::integer >= 170000 THEN
    IF EXISTS (
      SELECT 1
      FROM (VALUES ('anon'::text), ('authenticated'::text)) AS roles(role_name)
      CROSS JOIN (VALUES
        ('public.users'::text),
        ('public.public_users'::text),
        ('public.event_moderation_logs'::text),
        ('public.costume_rentals'::text)
      ) AS objects(object_name)
      WHERE has_table_privilege(roles.role_name, objects.object_name, 'MAINTAIN')
    ) THEN
      RAISE EXCEPTION 'Postflight failed: a public MAINTAIN privilege remains on a protected object';
    END IF;
  END IF;

  IF EXISTS (
    WITH targets(object_name, relation_oid) AS (
      VALUES
        ('public.users'::text, 'public.users'::regclass),
        ('public.public_users'::text, 'public.public_users'::regclass),
        ('public.event_moderation_logs'::text, 'public.event_moderation_logs'::regclass),
        ('public.costume_rentals'::text, 'public.costume_rentals'::regclass)
    )
    SELECT 1
    FROM targets t
    JOIN pg_attribute a ON a.attrelid = t.relation_oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('anon'::text), ('authenticated'::text)) AS roles(role_name)
    CROSS JOIN (VALUES
      ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('REFERENCES'::text)
    ) AS privileges(privilege_name)
    WHERE has_column_privilege(roles.role_name, t.object_name, a.attname, privileges.privilege_name)
      AND NOT (
        (
          t.object_name = 'public.public_users'
          AND privileges.privilege_name = 'SELECT'
          AND a.attname = ANY(ARRAY[
            'id','username','display_name','bio','avatar_url','created_at'
          ]::name[])
        )
        OR (
          t.object_name = 'public.costume_rentals'
          AND privileges.privilege_name = 'SELECT'
          AND a.attname = ANY(ARRAY[
            'id','name','region','province','city','instagram_url','image_url',
            'display_order','created_at','is_verified','whatsapp_number'
          ]::name[])
        )
      )
  ) THEN
    RAISE EXCEPTION 'Postflight failed: a public column-level privilege remains outside the approved projections';
  END IF;

  IF EXISTS (
    WITH expected(policyname, permissive, roles, cmd, qual, with_check) AS (
      VALUES
        ('allow insert users', 'PERMISSIVE', ARRAY['anon']::name[], 'INSERT', NULL::text, 'false'::text),
        ('allow select own', 'PERMISSIVE', ARRAY['anon']::name[], 'SELECT', 'false'::text, NULL::text),
        ('users can read public view', 'PERMISSIVE', ARRAY['anon','authenticated']::name[], 'SELECT', 'false'::text, NULL::text),
        ('users can register', 'PERMISSIVE', ARRAY['anon','authenticated']::name[], 'INSERT', NULL::text, 'false'::text),
        ('users_delete_all', 'PERMISSIVE', ARRAY['public']::name[], 'DELETE', 'false'::text, NULL::text),
        ('users_insert_all', 'PERMISSIVE', ARRAY['public']::name[], 'INSERT', NULL::text, 'false'::text),
        ('users_select_all', 'PERMISSIVE', ARRAY['public']::name[], 'SELECT', 'false'::text, NULL::text),
        ('users_update_all', 'PERMISSIVE', ARRAY['public']::name[], 'UPDATE', 'false'::text, 'false'::text)
    ),
    actual AS (
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'users'
    ),
    differences AS (
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    )
    SELECT 1 FROM differences
  ) THEN
    RAISE EXCEPTION 'Postflight failed: users policy inventory is not the audited eight deny-only policies';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.check_admin_login_limit(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.check_admin_login_limit(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.check_admin_login_limit(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight failed: admin limiter RPC privileges differ from expected';
  END IF;

  WITH targets(object_name) AS (
    VALUES
      ('public.users'::text),
      ('public.public_users'::text),
      ('public.event_moderation_logs'::text),
      ('public.costume_rentals'::text)
  ), table_snapshot AS (
    SELECT 'table:' || t.object_name AS object_name,
           coalesce(
             array_agg(p.privilege_name ORDER BY p.privilege_name)
               FILTER (WHERE has_table_privilege('service_role', t.object_name, p.privilege_name)),
             ARRAY[]::text[]
           ) AS privileges
    FROM targets t
    CROSS JOIN LATERAL (
      SELECT unnest(ARRAY[
        'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
      ]::text[]) AS privilege_name
      UNION ALL
      SELECT 'MAINTAIN'::text
      WHERE current_setting('server_version_num')::integer >= 170000
    ) AS p
    GROUP BY t.object_name
  ), column_snapshot AS (
    SELECT 'column:' || t.object_name || '.' || a.attname::text AS object_name,
           coalesce(
             array_agg(p.privilege_name ORDER BY p.privilege_name)
               FILTER (WHERE has_column_privilege('service_role', t.object_name, a.attname, p.privilege_name)),
             ARRAY[]::text[]
           ) AS privileges
    FROM targets t
    JOIN pg_class c ON c.oid = to_regclass(t.object_name)
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('REFERENCES'::text)) AS p(privilege_name)
    GROUP BY t.object_name, a.attname
  ), snapshot AS (
    SELECT * FROM table_snapshot
    UNION ALL
    SELECT * FROM column_snapshot
  )
  SELECT jsonb_object_agg(snapshot.object_name, to_jsonb(snapshot.privileges))
    INTO v_service_role_acl_after
  FROM snapshot;
  IF v_service_role_acl_after IS DISTINCT FROM v_service_role_acl_before THEN
    RAISE EXCEPTION 'Postflight failed: service_role privileges changed on a protected object';
  END IF;
END;
$postflight$;

COMMIT;
