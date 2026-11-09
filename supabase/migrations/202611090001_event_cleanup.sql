-- NGIPEN Event Cleanup
-- Review this migration before applying it to any database.
-- It creates an audit table and a narrowly scoped finalization function.
-- Storage objects are deleted by the server-side Supabase Storage API, not SQL.

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.events') IS NULL
     OR to_regclass('public.event_documentations') IS NULL
     OR to_regclass('public.documentations') IS NULL
     OR to_regclass('public.event_moderation_logs') IS NULL THEN
    RAISE EXCEPTION 'Event Cleanup preflight failed: one or more required event tables are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'documentations'
       AND column_name = 'event_id' AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'documentations'
       AND column_name = 'image_url'
  ) THEN
    RAISE EXCEPTION 'Event Cleanup preflight failed: legacy documentations schema differs from the inspected schema';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'end_date' AND data_type = 'date'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'is_sponsored'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'is_pinned'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_documentations' AND column_name = 'image_url'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_moderation_logs' AND column_name = 'reason'
  ) THEN
    RAISE EXCEPTION 'Event Cleanup preflight failed: one or more required columns differ from the inspected schema';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.event_cleanup_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  event_title text NOT NULL,
  event_start_date date,
  event_end_date date NOT NULL,
  admin_actor text NOT NULL DEFAULT 'admin',
  special_status_confirmed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'storage_deleted', 'completed', 'failed')),
  file_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  preserved_shared_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_storage_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  already_missing_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_file_count integer NOT NULL DEFAULT 0 CHECK (deleted_file_count >= 0),
  record_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  moderation_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  storage_deleted_at timestamptz,
  database_deleted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_cleanup_audit_created_at_idx
  ON public.event_cleanup_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS event_cleanup_audit_event_id_idx
  ON public.event_cleanup_audit (event_id);
CREATE INDEX IF NOT EXISTS event_cleanup_audit_status_idx
  ON public.event_cleanup_audit (status, created_at DESC);
-- Prevent two admins from processing the same event concurrently.
CREATE UNIQUE INDEX IF NOT EXISTS event_cleanup_audit_one_active_per_event_idx
  ON public.event_cleanup_audit (event_id)
  WHERE status IN ('pending', 'storage_deleted');


-- Resumable processing lease and per-batch Storage checkpoints.
ALTER TABLE public.event_cleanup_audit
  ADD COLUMN IF NOT EXISTS processing_token uuid,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_event_cleanup(
  p_event_id uuid,
  p_audit_id uuid,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $claim$
DECLARE
  v_claimed uuid;
BEGIN
  UPDATE public.event_cleanup_audit
     SET processing_token = p_claim_token,
         processing_started_at = now()
   WHERE id = p_audit_id
     AND event_id = p_event_id
     AND status IN ('pending', 'storage_deleted', 'failed')
     AND (
       processing_token IS NULL
       OR processing_started_at IS NULL
       OR processing_started_at < now() - interval '30 minutes'
     )
  RETURNING processing_token INTO v_claimed;
  RETURN v_claimed = p_claim_token;
END;
$claim$;

REVOKE ALL ON FUNCTION public.claim_event_cleanup(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_cleanup(uuid, uuid, uuid) TO service_role;

ALTER TABLE public.event_cleanup_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.event_cleanup_audit FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.event_cleanup_audit TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_event_cleanup(
  p_event_id uuid,
  p_audit_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_status text;
  v_special_status_confirmed boolean;
  v_end_date date;
  v_is_sponsored boolean;
  v_is_pinned boolean;
  v_deleted integer;
BEGIN
  -- Lock and revalidate the event immediately before database deletion.
  SELECT end_date, COALESCE(is_sponsored, false), COALESCE(is_pinned, false)
    INTO v_end_date, v_is_sponsored, v_is_pinned
    FROM public.events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found during cleanup finalization';
  END IF;

  IF v_end_date IS NULL OR v_end_date > ((now() AT TIME ZONE 'Asia/Jakarta')::date - 7) THEN
    RAISE EXCEPTION 'Event no longer meets the seven-day retention rule';
  END IF;

  SELECT status, special_status_confirmed
    INTO v_status, v_special_status_confirmed
    FROM public.event_cleanup_audit
   WHERE id = p_audit_id
     AND event_id = p_event_id
   FOR UPDATE;

  IF v_status IS DISTINCT FROM 'storage_deleted' THEN
    RAISE EXCEPTION 'Cleanup audit is missing or Storage phase is not complete';
  END IF;

  IF (v_is_sponsored OR v_is_pinned) AND NOT COALESCE(v_special_status_confirmed, false) THEN
    RAISE EXCEPTION 'Sponsored or pinned event requires explicit admin confirmation';
  END IF;

  -- Legacy documentation rows do not have an event foreign key.
  DELETE FROM public.documentations
   WHERE event_id = p_event_id::text;

  DELETE FROM public.events
   WHERE id = p_event_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'Event could not be deleted during cleanup finalization';
  END IF;

  -- Event child rows and moderation logs use ON DELETE CASCADE.
  -- Moderation history has already been snapshotted into this audit row.
  UPDATE public.event_cleanup_audit
     SET status = 'completed',
         database_deleted_at = now(),
         completed_at = now(),
         error_message = NULL
   WHERE id = p_audit_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_event_cleanup(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_event_cleanup(uuid, uuid) TO service_role;

COMMIT;
