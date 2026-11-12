-- NGIPEN profile titles: regular user-selected titles and admin-only exclusive titles.
-- Apply manually after reviewing. This file is not executed by this change.

begin;

create table if not exists public.profile_titles (
  id uuid primary key default gen_random_uuid(),
  title_key text not null unique,
  title_name text not null,
  title_type text not null check (title_type in ('regular', 'exclusive')),
  style_variant text not null default 'regular' check (style_variant in ('regular', 'exclusive')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profile_titles_key_format check (title_key ~ '^[a-z0-9_]{2,64}$'),
  constraint profile_titles_name_length check (char_length(title_name) between 1 and 60)
);

create table if not exists public.user_profile_titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title_id uuid not null references public.profile_titles(id) on delete restrict,
  granted_by text,
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_profile_titles_unique unique (user_id, title_id)
);

create table if not exists public.profile_title_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_label text not null default 'admin',
  target_user_id uuid not null references public.users(id) on delete cascade,
  title_id uuid not null references public.profile_titles(id) on delete restrict,
  action text not null check (action in ('granted', 'revoked')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_profile_titles_user_id
  on public.user_profile_titles(user_id);
create index if not exists idx_user_profile_titles_title_id
  on public.user_profile_titles(title_id);
create index if not exists idx_profile_title_audit_target_created
  on public.profile_title_audit_logs(target_user_id, created_at desc);

insert into public.profile_titles
  (title_key, title_name, title_type, style_variant, display_order, is_active)
values
  ('cosplayer', 'Cosplayer', 'regular', 'regular', 1, true),
  ('event_explorer', 'Event Explorer', 'regular', 'regular', 2, true),
  ('competition_hunter', 'Competition Hunter', 'regular', 'regular', 3, true),
  ('non_playable_character', 'Non Playable Character', 'regular', 'regular', 4, true),
  ('waifu_hunter', 'Waifu Hunter', 'regular', 'regular', 5, true),
  ('husbu_hunter', 'Husbu Hunter', 'regular', 'regular', 6, true),
  ('merch_hunter', 'Merch Hunter', 'regular', 'regular', 7, true),
  ('top_supporter', 'Top Supporter', 'exclusive', 'exclusive', 100, true)
on conflict (title_key) do update set
  title_name = excluded.title_name,
  title_type = excluded.title_type,
  style_variant = excluded.style_variant,
  display_order = excluded.display_order,
  is_active = excluded.is_active;

alter table public.profile_titles enable row level security;
alter table public.user_profile_titles enable row level security;
alter table public.profile_title_audit_logs enable row level security;

revoke all on public.profile_titles from anon, authenticated, public;
revoke all on public.user_profile_titles from anon, authenticated, public;
revoke all on public.profile_title_audit_logs from anon, authenticated, public;

grant select, insert, update, delete on public.profile_titles to service_role;
grant select, insert, update, delete on public.user_profile_titles to service_role;
grant select, insert, update, delete on public.profile_title_audit_logs to service_role;

-- Keep the exclusive-title assignment and its audit record in one transaction.
-- This function is callable only by the trusted server-side service_role.
create or replace function public.admin_manage_profile_title(
  p_user_id uuid,
  p_action text,
  p_actor text default 'admin',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title_id uuid;
  v_affected integer := 0;
  v_action text;
begin
  if p_action not in ('grant', 'revoke') then
    raise exception 'PROFILE_TITLE_INVALID_ACTION';
  end if;

  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'PROFILE_TITLE_USER_NOT_FOUND';
  end if;

  select id
    into v_title_id
    from public.profile_titles
   where title_key = 'top_supporter'
     and title_type = 'exclusive'
     and is_active = true;

  if v_title_id is null then
    raise exception 'PROFILE_TITLE_NOT_CONFIGURED';
  end if;

  if p_action = 'grant' then
    insert into public.user_profile_titles
      (user_id, title_id, granted_by, granted_at)
    values
      (p_user_id, v_title_id, coalesce(nullif(trim(p_actor), ''), 'admin'), now())
    on conflict (user_id, title_id) do nothing;

    get diagnostics v_affected = row_count;
    v_action := 'granted';
  else
    delete from public.user_profile_titles
     where user_id = p_user_id
       and title_id = v_title_id;

    get diagnostics v_affected = row_count;
    v_action := 'revoked';
  end if;

  if v_affected > 0 then
    insert into public.profile_title_audit_logs
      (actor_label, target_user_id, title_id, action, reason)
    values
      (coalesce(nullif(trim(p_actor), ''), 'admin'), p_user_id, v_title_id, v_action, nullif(trim(p_reason), ''));
  end if;

  return jsonb_build_object('success', true, 'changed', v_affected > 0);
end;
$$;

revoke all on function public.admin_manage_profile_title(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_manage_profile_title(uuid, text, text, text)
  to service_role;

commit;
