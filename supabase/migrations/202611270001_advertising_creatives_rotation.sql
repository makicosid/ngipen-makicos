-- NGIPEN Advertising v2: multiple creatives per campaign and up to 3 brands per slot.
-- Safe to run once in Supabase SQL Editor. Existing campaign columns remain for compatibility.

alter table public.ad_slots
  drop constraint if exists ad_slots_max_visible_check;

alter table public.ad_slots
  add constraint ad_slots_max_visible_check
  check (max_visible between 1 and 3);

update public.ad_slots
set max_visible = 3
where slot_code in ('banner', 'floating', 'popup');

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  image_path text not null check (char_length(image_path) > 0),
  target_url text not null check (target_url ~* '^https://'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_creatives_campaign_order_idx
  on public.ad_creatives (campaign_id, sort_order, created_at);

alter table public.ad_creatives enable row level security;

alter table public.ad_events
  add column if not exists creative_id uuid null
  references public.ad_creatives(id) on delete set null;

create index if not exists ad_events_creative_created_idx
  on public.ad_events (creative_id, created_at);

-- Backfill the existing single-poster campaigns without deleting or changing their data.
insert into public.ad_creatives (campaign_id, image_path, target_url, sort_order, is_active)
select c.id, c.image_path, c.target_url, 0, true
from public.ad_campaigns c
where not exists (
  select 1 from public.ad_creatives cr where cr.campaign_id = c.id
);

-- RLS remains enabled with no browser-facing policies: application access is server-side.
