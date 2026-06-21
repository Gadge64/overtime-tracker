-- ============================================================
-- Overtime Tracker — Supabase Database Schema
--
-- Run this entire file in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Tables:
--   team_members  — the shift roster
--   ot_offers     — each overtime opportunity posted
--   ot_responses  — each person's yes/no on a given offer
--
-- Functions:
--   close_ot_offer()  — atomically awards a shift and adds +1 to winner
--   reset_all_scores() — zeroes everyone's score (run every quarter)
-- ============================================================


-- ── team_members ─────────────────────────────────────────────
-- One row per person on the roster.
-- score: how many OT shifts they've taken this quarter cycle.
-- last_ot: timestamp of their most recent awarded shift (tiebreaker when scores are equal).

create table public.team_members (
  id       bigserial    primary key,
  name     text         not null,
  score    integer      not null default 0,
  last_ot  timestamptz,                       -- null = never done OT
  created_at timestamptz not null default now()
);


-- ── ot_offers ────────────────────────────────────────────────
-- One row per overtime opportunity posted by a supervisor.
-- status lifecycle: 'open' → 'closed' (shift awarded) or 'cancelled' (pulled).

create table public.ot_offers (
  id           bigserial    primary key,
  description  text         not null,
  immediate    boolean      not null default false,  -- true = emergency, first-come-first-served
  shift_time   timestamptz,                           -- when the shift starts (null for immediate)
  posted_at    timestamptz  not null default now(),
  window_hours integer,                               -- response window length in hours (null for immediate)
  closes_at    timestamptz,                           -- absolute close time (null for immediate)
  status       text         not null default 'open'   -- 'open' | 'closed' | 'cancelled'
                            check (status in ('open', 'closed', 'cancelled')),
  winner_id    bigint       references public.team_members(id),
  closed_at    timestamptz
);


-- ── ot_responses ─────────────────────────────────────────────
-- One row per team member per offer.
-- The UNIQUE constraint means each person can only have one answer
-- per offer (but they can update it via UPSERT before the window closes).

create table public.ot_responses (
  id           bigserial    primary key,
  offer_id     bigint       not null references public.ot_offers(id) on delete cascade,
  member_id    bigint       not null references public.team_members(id),
  answer       text         not null check (answer in ('yes', 'no')),
  responded_at timestamptz  not null default now(),
  unique(offer_id, member_id)   -- one response per person per offer
);


-- ── Helper functions ─────────────────────────────────────────

-- close_ot_offer: awards a shift to the winner.
-- Does two things atomically so they can't get out of sync:
--   1. Marks the offer as closed with a winner
--   2. Adds +1 to the winner's score and records their last_ot time
-- Call this via supabase.rpc('close_ot_offer', { p_offer_id, p_winner_id })

create or replace function public.close_ot_offer(
  p_offer_id  bigint,
  p_winner_id bigint
) returns void language plpgsql security definer as $$
begin
  update public.ot_offers
    set status    = 'closed',
        winner_id = p_winner_id,
        closed_at = now()
    where id = p_offer_id
      and status = 'open';   -- guard: don't double-close

  update public.team_members
    set score   = score + 1,
        last_ot = now()
    where id = p_winner_id;
end;
$$;


-- reset_all_scores: zeroes every member's score and clears last_ot.
-- Intended to be run at the start of each quarter so old history
-- doesn't keep disadvantaging people who did a lot of OT months ago.
-- Call via supabase.rpc('reset_all_scores')

create or replace function public.reset_all_scores()
returns void language plpgsql security definer as $$
begin
  update public.team_members set score = 0, last_ot = null;
end;
$$;


-- ── Row Level Security ───────────────────────────────────────
-- This is an internal team tool with no Supabase Auth, so we allow
-- all operations via the anon key. If you add proper auth later,
-- tighten these policies to restrict who can post/award/delete.

alter table public.team_members  enable row level security;
alter table public.ot_offers     enable row level security;
alter table public.ot_responses  enable row level security;

create policy "Allow all" on public.team_members  for all using (true) with check (true);
create policy "Allow all" on public.ot_offers     for all using (true) with check (true);
create policy "Allow all" on public.ot_responses  for all using (true) with check (true);


-- ── Realtime ─────────────────────────────────────────────────
-- Enable Supabase Realtime on all three tables so every device
-- sees changes instantly without polling.
-- (You also need to enable Realtime in Dashboard → Database → Replication)

alter publication supabase_realtime add table public.team_members;
alter publication supabase_realtime add table public.ot_offers;
alter publication supabase_realtime add table public.ot_responses;


-- ── Seed data ─────────────────────────────────────────────────
-- Default team roster — edit these initials to match your team.
-- PMc is used to disambiguate P. McMahon from PM (P. Murphy).

insert into public.team_members (name) values
  ('GD'), ('BR'), ('PMc'), ('JM'), ('PM'), ('GR'), ('RH'), ('DS'),
  ('MM'), ('BM'), ('AM'), ('AB'), ('PL'), ('SC'), ('SH');
