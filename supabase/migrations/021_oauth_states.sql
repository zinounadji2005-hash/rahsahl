-- Store OAuth states for CSRF protection during Meta OAuth flows.
-- Rows are short-lived (cleaned up by trigger after 10 minutes).

create table public.oauth_states (
  state   uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Clean up old states after 10 minutes
create index idx_oauth_states_created_at on public.oauth_states(created_at);

create or replace function fn_cleanup_oauth_states() returns trigger as $$
begin
  delete from public.oauth_states where created_at < now() - interval '10 minutes';
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_cleanup_oauth_states
  after insert on public.oauth_states
  execute function fn_cleanup_oauth_states();

-- RLS: service_role only
alter table public.oauth_states enable row level security;
create policy "service_role only" on public.oauth_states
  for all to service_role using (true) with check (true);
