-- Royale: заявки и профили пользователей для Supabase.
-- Вставьте этот код в Supabase: SQL Editor -> New query -> Run.
-- Скрипт можно запускать повторно: он ничего не ломает.

create table if not exists public.requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (char_length(phone) between 7 and 30),
  comment text check (comment is null or char_length(comment) <= 1000),
  items jsonb,
  total numeric,
  status text not null default 'new'
);

-- Привязка заявки к аккаунту (у гостей user_id пустой)
alter table public.requests add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.requests enable row level security;

-- Гость и вошедший пользователь могут ТОЛЬКО добавить заявку. Чужую подставить нельзя.
drop policy if exists "requests_insert_anon" on public.requests;
create policy "requests_insert_anon" on public.requests
  for insert to anon, authenticated
  with check (status = 'new' and (user_id is null or user_id = auth.uid()));

-- Вошедший пользователь видит только свои заявки (раздел «Мои заявки»).
drop policy if exists "requests_select_own" on public.requests;
create policy "requests_select_own" on public.requests
  for select to authenticated
  using (user_id = auth.uid());

-- Профили: по одной строке на пользователя, создаётся автоматически при регистрации.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  nick text,
  name text check (name is null or char_length(name) between 2 and 80),
  phone text check (phone is null or char_length(phone) between 7 and 30)
);
alter table public.profiles add column if not exists nick text;
create unique index if not exists profiles_nick_uniq on public.profiles (lower(nick));
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nick, name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data->>'nick', ''), 20), ''), nullif(left(coalesce(new.raw_user_meta_data->>'name', ''), 80), ''))
  on conflict do nothing;
  return new;
exception when others then
  -- ошибка профиля не должна ломать саму регистрацию (профиль можно досоздать позже)
  raise warning 'handle_new_user: %', sqlerrm;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Заявки смотрите в Supabase: Table Editor -> requests. Пользователи: Authentication -> Users.
