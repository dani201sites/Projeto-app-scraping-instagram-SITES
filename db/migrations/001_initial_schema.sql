create table if not exists scraping_runs (
  id bigserial primary key,
  city text not null,
  keyword text not null default 'barbearias',
  requested_limit integer not null,
  status text not null default 'created',
  dry_run boolean not null default true,
  serper_calls integer not null default 0,
  apify_calls integer not null default 0,
  trello_cards_created integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists instagram_profiles (
  id bigserial primary key,
  handle text not null unique,
  instagram_url text not null,
  display_name text,
  city text,
  source_query text,
  followers_count integer,
  external_url text,
  whatsapp_url text,
  last_non_pinned_post_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_results (
  id bigserial primary key,
  run_id bigint references scraping_runs(id) on delete cascade,
  profile_id bigint references instagram_profiles(id) on delete cascade,
  status text not null,
  has_own_site boolean,
  own_site_url text,
  trello_card_url text,
  screenshot_path text,
  notes text,
  created_at timestamptz not null default now(),
  unique (run_id, profile_id)
);

create table if not exists site_search_results (
  id bigserial primary key,
  profile_id bigint references instagram_profiles(id) on delete cascade,
  query text not null,
  result_url text not null,
  result_title text,
  result_domain text,
  is_rejected_domain boolean not null default false,
  is_own_site_candidate boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_scraping_runs_started_at on scraping_runs (started_at desc);
create index if not exists idx_instagram_profiles_city on instagram_profiles (city);
create index if not exists idx_instagram_profiles_followers on instagram_profiles (followers_count);
create index if not exists idx_lead_results_status on lead_results (status);
create index if not exists idx_site_search_results_profile on site_search_results (profile_id);
