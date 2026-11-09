-- NGIPEN Event Cleanup Stage 4 hardening
-- Add lease-bound database finalization and explicit in-flight/uncertain Storage states.
-- Additive schema changes only; this migration does not delete event or Storage data.

BEGIN;

ALTER TABLE public.event_cleanup_audit
  ADD COLUMN IF NOT EXISTS in_flight_storage_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS uncertain_storage_paths jsonb NOT NULL DEFAULT '[]'::jsonb;


-- Serialize documentation and poster-reference mutations with cleanup claims.
CREATE OR REPLACE FUNCTION public.block_new_event_cleanup_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $guard$
DECLARE
  v_event_id uuid;
  v_locked_event_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    v_event_id := OLD.id;
  ELSIF TG_TABLE_NAME = 'documentations' THEN
    BEGIN
      v_event_id := NEW.event_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NEW;
    END;
  ELSE
    v_event_id := NEW.event_id;
  END IF;

  SELECT id INTO v_locked_event_id
    FROM public.events
   WHERE id = v_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.event_cleanup_audit a
     WHERE a.event_id = v_event_id
       AND (a.status IN ('pending', 'storage_deleted') OR a.processing_token IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Event is currently locked for cleanup; new file references are not allowed';
  END IF;

  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS event_documentations_cleanup_guard ON public.event_documentations;
CREATE TRIGGER event_documentations_cleanup_guard
BEFORE INSERT OR UPDATE OF event_id, image_url ON public.event_documentations
FOR EACH ROW EXECUTE FUNCTION public.block_new_event_cleanup_references();

DROP TRIGGER IF EXISTS legacy_documentations_cleanup_guard ON public.documentations;
CREATE TRIGGER legacy_documentations_cleanup_guard
BEFORE INSERT OR UPDATE OF event_id, image_url ON public.documentations
FOR EACH ROW EXECUTE FUNCTION public.block_new_event_cleanup_references();

DROP TRIGGER IF EXISTS events_poster_cleanup_guard ON public.events;
CREATE TRIGGER events_poster_cleanup_guard
BEFORE UPDATE OF poster_url ON public.events
FOR EACH ROW
WHEN (OLD.poster_url IS DISTINCT FROM NEW.poster_url)
EXECUTE FUNCTION public.block_new_event_cleanup_references();

-- Make claim acquisition follow the same event-then-audit lock order.
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
  v_locked_event_id uuid;
BEGIN
  SELECT id INTO v_locked_event_id
    FROM public.events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

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
     );

  RETURN FOUND;
END;
$claim$;

REVOKE ALL ON FUNCTION public.claim_event_cleanup(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_cleanup(uuid, uuid, uuid)
  TO service_role;

-- Remove the old callable signature so finalization cannot bypass lease ownership.
DROP FUNCTION IF EXISTS public.finalize_event_cleanup(uuid, uuid);

CREATE OR REPLACE FUNCTION public.finalize_event_cleanup(
  p_event_id uuid,
  p_audit_id uuid,
  p_claim_token uuid
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
  v_processing_token uuid;
  v_processing_started_at timestamptz;
  v_in_flight jsonb;
  v_deleted integer;
BEGIN
  -- Lock event first, matching the claim/reference-trigger lock order.
  SELECT end_date, COALESCE(is_sponsored, false), COALESCE(is_pinned, false)
    INTO v_end_date, v_is_sponsored, v_is_pinned
    FROM public.events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found during cleanup finalization';
  END IF;

  -- Then lock audit and prove the caller still owns a fresh processing lease.
  SELECT status, special_status_confirmed, processing_token,
         processing_started_at, in_flight_storage_paths
    INTO v_status, v_special_status_confirmed, v_processing_token,
         v_processing_started_at, v_in_flight
    FROM public.event_cleanup_audit
   WHERE id = p_audit_id
     AND event_id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup audit not found';
  END IF;

  IF v_processing_token IS DISTINCT FROM p_claim_token
     OR v_processing_started_at IS NULL
     OR v_processing_started_at < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'Cleanup lease is not owned by this request or has expired';
  END IF;
  IF v_status IS DISTINCT FROM 'storage_deleted' THEN
    RAISE EXCEPTION 'Cleanup audit Storage phase is not complete';
  END IF;

  IF jsonb_typeof(COALESCE(v_in_flight, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(v_in_flight, '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'Storage deletion has unresolved in-flight objects';
  END IF;

  IF v_end_date IS NULL OR v_end_date > ((now() AT TIME ZONE 'Asia/Jakarta')::date - 7) THEN
    RAISE EXCEPTION 'Event no longer meets the seven-day retention rule';
  END IF;

  IF (v_is_sponsored OR v_is_pinned) AND NOT COALESCE(v_special_status_confirmed, false) THEN
    RAISE EXCEPTION 'Sponsored or pinned event requires explicit admin confirmation';
  END IF;

  DELETE FROM public.documentations
   WHERE event_id = p_event_id::text;

  DELETE FROM public.events
   WHERE id = p_event_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'Event could not be deleted during cleanup finalization';
  END IF;

  UPDATE public.event_cleanup_audit
     SET status = 'completed',
         database_deleted_at = now(),
         completed_at = now(),
         error_message = NULL,
         processing_token = NULL,
         processing_started_at = NULL
   WHERE id = p_audit_id
     AND processing_token = p_claim_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup lease changed during finalization';
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.block_new_event_cleanup_references() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_new_event_cleanup_references() TO service_role;

REVOKE ALL ON FUNCTION public.finalize_event_cleanup(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_event_cleanup(uuid, uuid, uuid)
  TO service_role;

COMMIT;
