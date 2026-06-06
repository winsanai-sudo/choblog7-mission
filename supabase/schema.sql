create table if not exists public.choblog7_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.choblog7_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'choblog7_state' and policyname = 'choblog7_state_select'
  ) then
    create policy choblog7_state_select on public.choblog7_state for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'choblog7_state' and policyname = 'choblog7_state_insert'
  ) then
    create policy choblog7_state_insert on public.choblog7_state for insert to anon with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'choblog7_state' and policyname = 'choblog7_state_update'
  ) then
    create policy choblog7_state_update on public.choblog7_state for update to anon using (true) with check (true);
  end if;
end $$;
