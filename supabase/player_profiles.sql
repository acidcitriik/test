-- Execute once in the Supabase SQL Editor as an administrator.
-- Passwords/OAuth sessions are managed by Supabase Auth, never by GitHub Pages.
create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Joueur'
    check (char_length(nickname) between 3 and 24),
  avatar_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(avatar_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
revoke all on public.player_profiles from anon;
revoke all on public.player_profiles from authenticated;
grant select, insert, update on public.player_profiles to authenticated;

drop policy if exists "player_profiles_select_self" on public.player_profiles;
create policy "player_profiles_select_self" on public.player_profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "player_profiles_insert_self" on public.player_profiles;
create policy "player_profiles_insert_self" on public.player_profiles
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "player_profiles_update_self" on public.player_profiles;
create policy "player_profiles_update_self" on public.player_profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.player_profile_touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists player_profile_updated_at on public.player_profiles;
create trigger player_profile_updated_at before update on public.player_profiles
  for each row execute function public.player_profile_touch_updated_at();

create or replace function public.create_player_profile_for_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  candidate text;
begin
  candidate := btrim(coalesce(new.raw_user_meta_data ->> 'nickname',''));
  if char_length(candidate) not between 3 and 24
      or candidate !~ '^[[:alnum:] _.-]+$' then
    candidate := 'Joueur';
  end if;
  insert into public.player_profiles (id,nickname,avatar_data)
    values (new.id,candidate,'{}'::jsonb)
    on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists player_auth_user_created on auth.users;
create trigger player_auth_user_created
  after insert on auth.users for each row
  execute function public.create_player_profile_for_user();

-- Existing users if this migration was added after registrations:
insert into public.player_profiles(id,nickname)
select id,'Joueur' from auth.users
on conflict (id) do nothing;
