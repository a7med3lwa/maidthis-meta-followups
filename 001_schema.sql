create extension if not exists pgcrypto;

create table if not exists automation_settings (
  id boolean primary key default true check (id),
  auto_enabled boolean not null default false,
  review_mode boolean not null default true,
  timezone text not null default 'America/Los_Angeles',
  business_start time not null default '09:00',
  business_end time not null default '19:00',
  followups_per_day smallint not null default 2 check (followups_per_day between 1 and 10),
  min_gap_minutes integer not null default 240 check (min_gap_minutes between 15 and 10080),
  silence_minutes integer not null default 180 check (silence_minutes between 15 and 43200),
  standard_window_hours integer not null default 24 check (standard_window_hours between 1 and 24),
  batch_size integer not null default 100 check (batch_size between 1 and 1000),
  updated_at timestamptz not null default now()
);
insert into automation_settings (id) values (true) on conflict (id) do nothing;

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('messenger','instagram')),
  business_account_id text not null,
  platform_user_id text not null,
  first_name text,
  last_name text,
  current_stage smallint not null default 0 check (current_stage between 0 and 10),
  status text not null default 'active' check (status in ('active','replied','waiting','paused','booked','opted_out','completed')),
  last_customer_at timestamptz,
  last_page_at timestamptz,
  last_followup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, business_account_id, platform_user_id)
);

create table if not exists followup_templates (
  stage smallint primary key check (stage between 1 and 10),
  label text not null,
  body text not null,
  match_phrase text not null,
  media_file text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  external_message_id text unique,
  body text,
  template_stage smallint references followup_templates(stage),
  attachment_url text,
  occurred_at timestamptz not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists followup_queue (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  stage smallint not null references followup_templates(stage),
  status text not null default 'pending' check (status in ('pending','approved','sending','sent','sent_manual','cancelled','skipped','blocked_policy','failed')),
  scheduled_for timestamptz not null,
  expected_last_customer_at timestamptz,
  text_message_id text,
  media_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, stage)
);

create table if not exists webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  contact_id uuid references contacts(id) on delete set null,
  queue_id uuid references followup_queue(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contacts_schedulable_idx on contacts (status, last_page_at) where current_stage < 10;
create index if not exists queue_due_idx on followup_queue (status, scheduled_for);
create index if not exists messages_contact_time_idx on messages (contact_id, occurred_at desc);
create index if not exists messages_stage_idx on messages (contact_id, template_stage) where template_stage is not null;

alter table automation_settings enable row level security;
alter table contacts enable row level security;
alter table followup_templates enable row level security;
alter table messages enable row level security;
alter table followup_queue enable row level security;
alter table webhook_events enable row level security;
alter table audit_log enable row level security;

comment on table automation_settings is 'Single-row global controls. Starts paused and in review mode.';
comment on column contacts.current_stage is 'Highest deterministic MaidThis follow-up stage confirmed sent.';
comment on column followup_queue.expected_last_customer_at is 'Optimistic safety lock. A newer customer reply cancels the send.';
