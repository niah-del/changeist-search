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
  type         text check (type in ('job', 'volunteer', 'internship', 'event')),
  location     text,                       -- e.g. "New York, NY" or "Remote"
  url          text,                       -- link to apply / learn more
  priority     integer not null default 0, -- 0 = internal Changeist, 1 = sponsored
  is_active    boolean not null default true,
  expires_at   timestamptz,               -- null = never expires
  tags         text[] default '{}',       -- e.g. {'environment','youth','education'}
  created_at   timestamptz not null default now()
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
