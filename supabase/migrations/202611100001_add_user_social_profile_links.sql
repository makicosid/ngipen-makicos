-- Add social profile links for NGIPEN reviewer profile cards.
-- Apply this migration to Supabase only after reviewing and approving it.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
