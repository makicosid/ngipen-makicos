
-- NGIPEN Event Cleanup Stage 3 Hardening
-- Target: Production schema compatibility
-- Does not delete or modify event records.
-- Review before applying.

BEGIN;

-- 1. Add resumable processing lease columns.
ALTER TABLE public.event_cleanup_audit
  ADD COLUMN IF NOT EXISTS processing_token uuid,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- 2. Atomic claim function.
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
     );

  RETURN FOUND;
END;
$claim$;

-- 3. Restrict execution to service_role.
REVOKE ALL ON FUNCTION
  public.claim_event_cleanup(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.claim_event_cleanup(uuid, uuid, uuid)
  TO service_role;

-- 4. Keep audit table inaccessible to public application roles.
ALTER TABLE public.event_cleanup_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.event_cleanup_audit
  FROM PUBLIC, anon, authenticated;

-- 5. Restrict service_role to the operations required by the API.
REVOKE ALL PRIVILEGES ON TABLE
  public.event_cleanup_audit
  FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.event_cleanup_audit
  TO service_role;

COMMIT;
