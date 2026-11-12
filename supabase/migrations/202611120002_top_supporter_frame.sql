-- NGIPEN: Top Supporter exclusive profile frame
-- Run this migration in Supabase SQL Editor after uploading:
-- public/profile-frames/exclusive/top-supporter-imperial.png

begin;

-- Permit the new exclusive access level while retaining existing free/member levels.
alter table public.profile_frames
  drop constraint if exists profile_frames_access_level_check;

alter table public.profile_frames
  add constraint profile_frames_access_level_check
  check (access_level in ('free', 'member', 'exclusive'));

-- Register/update the artwork path. The frame is active in the catalog,
-- but only users with an Admin-granted Top Supporter title may select it.
insert into public.profile_frames
  (frame_key, name, access_level, asset_path, is_active, display_order)
values
  ('top_supporter', 'Top Supporter', 'exclusive',
   '/profile-frames/exclusive/top-supporter-imperial.png', true, 5)
on conflict (frame_key) do update
set name = excluded.name,
    access_level = excluded.access_level,
    asset_path = excluded.asset_path,
    is_active = excluded.is_active,
    display_order = excluded.display_order;

-- Keep grant/revoke and audit logging atomic.
-- When Admin revokes Top Supporter, remove the exclusive frame from the
-- user's active profile immediately by reverting to the existing free frame.
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

    update public.users
       set selected_frame_key = 'free_red'
     where id = p_user_id
       and selected_frame_key = 'top_supporter';
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
