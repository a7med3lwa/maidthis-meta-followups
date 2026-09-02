create table if not exists meta_connections (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('messenger','instagram')),
  business_account_id text not null,
  page_id text not null,
  account_name text not null,
  username text,
  token_ciphertext text,
  scopes text[] not null default '{}',
  connected_by text,
  connected_by_user_id text,
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, business_account_id)
);

create index if not exists meta_connections_account_idx on meta_connections (business_account_id) where status = 'connected';

alter table meta_connections enable row level security;

comment on table meta_connections is 'Meta Pages and Instagram accounts authorized through OAuth. Tokens are AES-256-GCM encrypted by the application before storage.';
comment on column meta_connections.token_ciphertext is 'Encrypted Page access token. Never store or display plaintext tokens.';
