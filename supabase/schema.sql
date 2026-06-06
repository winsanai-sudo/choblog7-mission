create table if not exists public.choblog7_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

