-- Grant base-level privileges on oauth_states to service_role
-- RLS alone is insufficient; the role needs table-level permissions first
grant all privileges on table public.oauth_states to service_role;
