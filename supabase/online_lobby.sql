-- Online duels: run AFTER supabase/player_profiles.sql in Supabase SQL Editor.
-- Private authenticated presence, separate independent player sessions and invitations.
-- No public REST write permissions: all changes go through SECURITY DEFINER RPC.

create table if not exists public.online_players(
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  nickname text not null,
  status text not null default 'available' check(status in ('available','busy')),
  last_seen timestamptz not null default now()
);
create index if not exists online_players_last_seen_idx on public.online_players(last_seen);
alter table public.online_players enable row level security;
revoke all on public.online_players from anon, authenticated;
grant select on public.online_players to authenticated;
drop policy if exists online_players_read on public.online_players;
create policy online_players_read on public.online_players
  for select to authenticated using ((select auth.uid()) is not null);

create table if not exists public.online_invites(
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_nickname text not null,
  room_code text not null check(length(room_code) between 6 and 128),
  status text not null default 'pending'
    check(status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '90 seconds'),
  constraint no_self_invites check(sender_id <> recipient_id)
);
create index if not exists online_invites_recipient_time_idx on public.online_invites(recipient_id,created_at desc);
create index if not exists online_invites_sender_time_idx on public.online_invites(sender_id,created_at desc);
alter table public.online_invites enable row level security;
revoke all on public.online_invites from anon, authenticated;
grant select on public.online_invites to authenticated;
drop policy if exists online_invites_read on public.online_invites;
create policy online_invites_read on public.online_invites
  for select to authenticated
  using ((select auth.uid()) in (sender_id,recipient_id));

create or replace function public.online_heartbeat(p_session_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare
  me uuid := auth.uid();
  player_name text;
begin
  if me is null then raise exception 'Authentification requise'; end if;
  if p_session_id is null or p_status not in ('available','busy')
    then raise exception 'Présence invalide'; end if;
  select nickname into player_name from public.player_profiles where id=me;
  if player_name is null then player_name:='Joueur'; end if;
  insert into public.online_players(user_id,session_id,nickname,status,last_seen)
  values(me,p_session_id,player_name,p_status,now())
  on conflict(user_id) do update
    set session_id=excluded.session_id,nickname=excluded.nickname,status=excluded.status,last_seen=now()
  where online_players.session_id=excluded.session_id
    or online_players.last_seen < now()-interval '45 seconds';
  return found;
end;
$$;
create or replace function public.online_leave(p_session_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  delete from public.online_players where user_id=auth.uid() and session_id=p_session_id;
end;
$$;

create or replace function public.online_send_invite(p_recipient uuid,p_room_code text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  me uuid := auth.uid();
  my_name text;
  new_id uuid;
begin
  if me is null then raise exception 'Authentification requise'; end if;
  if p_recipient is null or p_recipient=me or p_room_code is null
    or p_room_code !~ '^[a-zA-Z0-9_-]{6,128}$'
    then raise exception 'Invitation invalide'; end if;
  select nickname into my_name from public.online_players
    where user_id=me and last_seen>now()-interval '45 seconds';
  if my_name is null then raise exception 'Entre d’abord dans le salon en ligne'; end if;
  perform 1 from public.online_players
    where user_id=p_recipient and status='available'
    and last_seen>now()-interval '45 seconds';
  if not found then raise exception 'Ce joueur n’est plus disponible'; end if;
  -- One outstanding invite; short rate limit prevents trivial flooding.
  perform 1 from public.online_invites
    where sender_id=me and created_at>now()-interval '10 seconds';
  if found then raise exception 'Attends avant de renvoyer une invitation'; end if;
  perform 1 from public.online_invites
    where sender_id=me and status='pending' and expires_at>now();
  if found then raise exception 'Une invitation est déjà en attente'; end if;
  insert into public.online_invites(sender_id,recipient_id,sender_nickname,room_code)
    values(me,p_recipient,my_name,p_room_code)
    returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.online_reply_invite(p_invite_id uuid,p_accept boolean)
returns text language plpgsql security definer set search_path=''
as $$
declare
  me uuid := auth.uid();
  invitation public.online_invites%rowtype;
begin
  if me is null then raise exception 'Authentification requise'; end if;
  select * into invitation from public.online_invites
    where id=p_invite_id and recipient_id=me and status='pending'
      and expires_at>now() for update;
  if not found then raise exception 'Invitation expirée ou déjà traitée'; end if;
  if p_accept is true then
    perform 1 from public.online_players where user_id=me
      and status='available' and last_seen>now()-interval '45 seconds';
    if not found then raise exception 'Tu es déjà occupé'; end if;
    update public.online_players set status='busy' where user_id=me;
    update public.online_invites set status='accepted' where id=p_invite_id;
    return invitation.room_code;
  else
    update public.online_invites set status='declined' where id=p_invite_id;
    return null;
  end if;
end;
$$;

create or replace function public.online_cancel_invites()
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then return; end if;
  update public.online_invites set status='cancelled'
    where sender_id=auth.uid() and status='pending';
end;
$$;

revoke all on function public.online_heartbeat(uuid,text) from public,anon;
revoke all on function public.online_leave(uuid) from public,anon;
revoke all on function public.online_send_invite(uuid,text) from public,anon;
revoke all on function public.online_reply_invite(uuid,boolean) from public,anon;
revoke all on function public.online_cancel_invites() from public,anon;
grant execute on function public.online_heartbeat(uuid,text) to authenticated;
grant execute on function public.online_leave(uuid) to authenticated;
grant execute on function public.online_send_invite(uuid,text) to authenticated;
grant execute on function public.online_reply_invite(uuid,boolean) to authenticated;
grant execute on function public.online_cancel_invites() to authenticated;
