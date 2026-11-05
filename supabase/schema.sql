-- ABBUFX Rate Board — Supabase schema
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

create table if not exists public.currencies (
  code        text primary key,               -- e.g. 'USD'
  name        text not null,                  -- e.g. 'US Dollar'
  symbol      text not null,                  -- e.g. '$'
  buy         numeric(12,2) not null default 0,
  sell        numeric(12,2) not null default 0,
  sort_order  int not null default 0,
  featured    boolean not null default false, -- shown on TV screen 1
  updated_at  timestamptz not null default now()
);

-- Single-row table for board-wide settings.
create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  auto_rotate      boolean not null default false,
  rotate_seconds   int not null default 15 check (rotate_seconds between 5 and 600),
  rates_updated_at timestamptz not null default now()
);

create table if not exists public.access_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[0-9]{6}$'),
  label       text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Seed data (from the Figma design)
-- ─────────────────────────────────────────────

insert into public.currencies (code, name, symbol, buy, sell, sort_order, featured) values
  ('USD', 'US Dollar',       '$',   1373, 1383, 1, true),
  ('GBP', 'British Pound',   '£',   1830, 1850, 2, true),
  ('EUR', 'Euro',            '€',   1560, 1575, 3, true),
  ('CAD', 'Canadian Dollar', 'C$',   985, 1005, 4, false),
  ('AED', 'UAE Dirham',      'د.إ',  372,  380, 5, false),
  ('CNY', 'Chinese Yuan',    '¥',    186,  193, 6, false)
on conflict (code) do nothing;

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- Admins: only accounts listed here can change anything.
-- Logging in is not enough — a stranger who signs up gets no access.
-- ─────────────────────────────────────────────

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ─────────────────────────────────────────────
-- Row Level Security
--   anon (TV, browser) → can read NOTHING directly; rates come only through get_board()
--   admins             → full access
-- ─────────────────────────────────────────────

alter table public.currencies   enable row level security;
alter table public.settings     enable row level security;
alter table public.access_codes enable row level security;
alter table public.admins       enable row level security;

-- Policies from the first version of this script (rates were public then).
drop policy if exists "public read currencies" on public.currencies;
drop policy if exists "public read settings" on public.settings;
drop policy if exists "admin write currencies" on public.currencies;
drop policy if exists "admin write settings" on public.settings;
drop policy if exists "admin manage codes" on public.access_codes;

drop policy if exists "admins manage currencies" on public.currencies;
create policy "admins manage currencies" on public.currencies
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins manage settings" on public.settings;
create policy "admins manage settings" on public.settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins manage codes" on public.access_codes;
create policy "admins manage codes" on public.access_codes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins see themselves" on public.admins;
create policy "admins see themselves" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- TV access: a TV gets rates only by sending a valid code.
-- Wrong codes are counted per IP; 10 wrong tries in 15 minutes blocks that IP
-- for the rest of the window, so the 1,000,000 possible codes can't be guessed.
-- ─────────────────────────────────────────────

create table if not exists public.code_attempts (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists code_attempts_ip_at on public.code_attempts (ip, at);
alter table public.code_attempts enable row level security; -- no policies: API can't touch it

create or replace function public.check_tv_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := coalesce(
    nullif(trim(split_part(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown');
begin
  if (select count(*) from public.code_attempts
      where ip = v_ip and at > now() - interval '15 minutes') >= 10 then
    raise exception 'too_many_attempts';
  end if;

  if exists (select 1 from public.access_codes where code = p_code) then
    return true;
  end if;

  insert into public.code_attempts (ip) values (v_ip);
  delete from public.code_attempts where at < now() - interval '1 day';
  return false;
end;
$$;

-- Internal only: callable from get_board(), not from the API.
revoke all on function public.check_tv_code(text) from public, anon, authenticated;

-- Returns null for a wrong code, otherwise the rates and display settings.
create or replace function public.get_board(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_tv_code(p_code) then
    return null;
  end if;

  return jsonb_build_object(
    'currencies', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb)
      from (select code, name, symbol, buy, sell, sort_order, featured from public.currencies) c
    ),
    'settings', (
      select to_jsonb(s)
      from (select auto_rotate, rotate_seconds, rates_updated_at from public.settings where id = 1) s
    )
  );
end;
$$;

revoke all on function public.get_board(text) from public;
grant execute on function public.get_board(text) to anon, authenticated;

drop function if exists public.verify_access_code(text);

-- ─────────────────────────────────────────────
-- Realtime: TVs listen to this one-row table. It holds only a timestamp — no rates —
-- and is bumped whenever rates, settings or codes change. The TV then calls get_board().
-- ─────────────────────────────────────────────

create table if not exists public.board_signal (
  id         int primary key default 1 check (id = 1),
  changed_at timestamptz not null default now()
);
insert into public.board_signal (id) values (1) on conflict (id) do nothing;

alter table public.board_signal enable row level security;
drop policy if exists "anyone reads signal" on public.board_signal;
create policy "anyone reads signal" on public.board_signal for select using (true);

create or replace function public.bump_board_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.board_signal set changed_at = now() where id = 1;
  return null;
end;
$$;

drop trigger if exists bump_signal on public.currencies;
create trigger bump_signal after insert or update or delete on public.currencies
  for each statement execute function public.bump_board_signal();

drop trigger if exists bump_signal on public.settings;
create trigger bump_signal after insert or update or delete on public.settings
  for each statement execute function public.bump_board_signal();

drop trigger if exists bump_signal on public.access_codes;
create trigger bump_signal after delete on public.access_codes
  for each statement execute function public.bump_board_signal();

do $$
begin
  -- Rates are no longer broadcast directly.
  begin
    alter publication supabase_realtime drop table public.currencies;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime drop table public.settings;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.board_signal;
  exception when duplicate_object then null;
  end;
end $$;

-- ─────────────────────────────────────────────
-- LAST STEP — make the owner an admin.
-- 1. Authentication → Users → Add user (owner's email + password, Auto confirm).
-- 2. Change the email below and run this line:
--
-- insert into public.admins (user_id) select id from auth.users where email = 'owner@abbufx.com';
-- ─────────────────────────────────────────────
