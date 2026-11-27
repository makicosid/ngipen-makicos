-- NGIPEN Advertising: allow permanent brand deletion with dependent campaign cleanup.
-- Existing audit records are retained through ad_audit_logs.campaign_id ON DELETE SET NULL.

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_sponsor_id_fkey;

alter table public.ad_campaigns
  add constraint ad_campaigns_sponsor_id_fkey
  foreign key (sponsor_id)
  references public.ad_sponsors(id)
  on delete cascade;

alter table public.ad_events
  drop constraint if exists ad_events_campaign_id_fkey;

alter table public.ad_events
  add constraint ad_events_campaign_id_fkey
  foreign key (campaign_id)
  references public.ad_campaigns(id)
  on delete cascade;

-- ad_creatives.campaign_id already uses ON DELETE CASCADE.
-- ad_audit_logs.campaign_id remains ON DELETE SET NULL to preserve audit history.
