-- Changeist Search Tool — Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database.
-- Dashboard: https://supabase.com → your project → SQL Editor

-- ============================================================
-- Enable UUID generation
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- listings
-- Stores all internal (priority=0) and sponsored (priority=1) opportunities.
-- ============================================================
create table if not exists listings (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  organization text not null,
  description  text,
  type         text check (type in ('job', 'volunteer', 'internship', 'event', 'scholarship')),
  location     text,                       -- e.g. "New York, NY" or "Remote"
  url          text,                       -- link to apply / learn more
  priority     integer not null default 0, -- 0 = internal Changeist, 1 = sponsored
  is_active    boolean not null default true,
  expires_at   timestamptz,               -- null = never expires
  tags         text[] default '{}',       -- e.g. {'environment','youth','education'}
  age_min               integer,           -- minimum age to participate (null = no minimum)
  age_max               integer,           -- maximum age to participate (null = no maximum)
  location_requirement  text,              -- e.g. "In-person", "Remote", "Hybrid"
  experience_required   text,              -- e.g. "No experience needed", "1 year minimum"
  youth_gains           text,              -- what youth get out of it
  participation_cost    text,              -- e.g. "Free", "$50 registration fee"
  created_at            timestamptz not null default now()
);

-- Full-text search index on title + description + organization
create index if not exists listings_fts on listings
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(organization,'')));

-- Index for active listings filter
create index if not exists listings_active on listings (is_active, priority);


-- ============================================================
-- embed_keys
-- One key per partner site that embeds the widget.
-- Changeist.org uses the INTERNAL_EMBED_KEY env var (no DB row needed).
-- ============================================================
create table if not exists embed_keys (
  id           uuid primary key default uuid_generate_v4(),
  key          text unique not null,  -- the secret they embed in their script tag
  org_name     text,                  -- e.g. "Lincoln High School"
  site_url     text,                  -- e.g. "https://lincolnhs.edu"
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);


-- ============================================================
-- search_events
-- Anonymous usage metadata. No personal data stored — IP is never saved.
-- Geo fields (country, region, city) are derived from IP via Vercel headers.
-- ============================================================
create table if not exists search_events (
  id               uuid primary key default uuid_generate_v4(),
  event_type       text not null,       -- 'search' | 'chat_start' | 'session_end'
  query            text,                -- search query (search events only)
  result_count     integer,             -- results returned (search events only)
  opportunity_type text,                -- type filter: job/volunteer/internship/event
  message_count    integer,             -- messages sent in session (session_end only)
  duration_seconds integer,             -- session length in seconds (session_end only)
  country          text,                -- 2-letter country code, e.g. "US"
  region           text,                -- region/state code, e.g. "CA"
  city             text,                -- city name, e.g. "Los Angeles"
  age              integer,                        -- self-reported age from chat (age_mention events only)
  embed_key_id     uuid references embed_keys(id), -- which partner site (null = Changeist internal)
  created_at       timestamptz not null default now()
);

-- Index for time-based queries
create index if not exists search_events_created on search_events (created_at desc);

-- RLS: service role only
alter table search_events enable row level security;
create policy "service only" on search_events for all using (false);


-- ============================================================
-- listing_events
-- Per-listing impression and click tracking, written by lib/search.js
-- (impressions) and /api/listing-click (clicks).
-- ============================================================
create table if not exists listing_events (
  id           uuid primary key default uuid_generate_v4(),
  listing_id   uuid references listings(id) on delete cascade,
  event_type   text not null,       -- 'impression' | 'click'
  query        text,                -- the search that surfaced the listing
  embed_key_id uuid references embed_keys(id),
  created_at   timestamptz not null default now()
);

-- Index for per-listing rollups and time-based queries
create index if not exists listing_events_listing on listing_events (listing_id, event_type);
create index if not exists listing_events_created on listing_events (created_at desc);

alter table listing_events enable row level security;
create policy "service only" on listing_events for all using (false);


-- ============================================================
-- reports
-- Flagged responses submitted by users via the Report button.
-- ============================================================
create table if not exists reports (
  id                uuid primary key default uuid_generate_v4(),
  user_message      text,                -- the message the user sent before the flagged response
  assistant_message text,                -- the flagged response from Link
  embed_key_id      uuid references embed_keys(id),
  country           text,
  region            text,
  city              text,
  created_at        timestamptz not null default now()
);

create index if not exists reports_created on reports (created_at desc);

alter table reports enable row level security;
create policy "service only" on reports for all using (false);


-- ============================================================
-- Row Level Security (optional but recommended)
-- The API uses the service key, which bypasses RLS.
-- These policies prevent direct public access via anon key.
-- ============================================================
alter table listings   enable row level security;
alter table embed_keys enable row level security;

-- Only service role (your backend) can read/write
create policy "service only" on listings   for all using (false);
create policy "service only" on embed_keys for all using (false);


-- ============================================================
-- rate_limits
-- Fixed-window request counters. Serverless functions share no memory, so the
-- counter has to live somewhere both of them can see; Postgres is already here.
-- Rows are short-lived and cleaned up opportunistically.
-- ============================================================
create table if not exists rate_limits (
  id         text primary key,      -- "<scope>:<identifier>"
  count      integer not null default 0,
  expires_at timestamptz not null
);

create index if not exists rate_limits_expires on rate_limits (expires_at);

alter table rate_limits enable row level security;
create policy "service only" on rate_limits for all using (false);

-- Atomically increment a window's counter and report whether the caller is
-- over the limit. Doing this in one statement matters: a read-then-write from
-- the application would let concurrent requests race past the limit.
create or replace function check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
as $$
declare
  v_now     timestamptz := now();
  v_count   integer;
  v_expires timestamptz;
begin
  -- Opportunistic cleanup: sweeping on ~1% of calls keeps the table small
  -- without paying for a delete on every single request.
  if random() < 0.01 then
    delete from rate_limits where expires_at < v_now;
  end if;

  insert into rate_limits (id, count, expires_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (id) do update set
    count = case
      when rate_limits.expires_at < v_now then 1
      else rate_limits.count + 1
    end,
    expires_at = case
      when rate_limits.expires_at < v_now then v_now + make_interval(secs => p_window_seconds)
      else rate_limits.expires_at
    end
  returning count, expires_at into v_count, v_expires;

  return jsonb_build_object(
    'allowed',     v_count <= p_limit,
    'count',       v_count,
    'limit',       p_limit,
    'retry_after', greatest(1, ceil(extract(epoch from (v_expires - v_now))))::int
  );
end;
$$;


-- ============================================================
-- Migrations for databases created before this file was updated
-- Safe to re-run. New projects can skip this block — the definitions
-- above already include these changes.
-- ============================================================

-- Allow 'scholarship' as a listing type (the chat tool already accepts it)
alter table listings drop constraint if exists listings_type_check;
alter table listings add constraint listings_type_check
  check (type in ('job', 'volunteer', 'internship', 'event', 'scholarship'));


-- ============================================================
-- Sample data — delete before going to production
-- ============================================================
insert into listings (title, organization, description, type, location, url, priority, tags)
values
  (
    'Community Garden Volunteer',
    'Changeist',
    'Help maintain our community garden every Saturday morning. No experience needed!',
    'volunteer',
    'Brooklyn, NY',
    'https://changeist.org/garden',
    0,  -- internal
    array['environment','community','outdoor']
  ),
  (
    'Youth Mentorship Coordinator',
    'Changeist',
    'Lead weekly mentorship sessions for high school students interested in civic engagement.',
    'job',
    'Remote',
    'https://changeist.org/jobs/mentorship',
    0,  -- internal
    array['youth','education','mentorship']
  ),
  (
    'Environmental Justice Intern',
    'Green Future Network',
    'Paid summer internship researching local environmental policy. Open to undergraduates.',
    'internship',
    'Washington, DC',
    'https://greenfuture.example.com/intern',
    1,  -- sponsored
    array['environment','policy','research']
  );
