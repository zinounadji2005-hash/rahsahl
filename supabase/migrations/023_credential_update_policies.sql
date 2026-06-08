-- Add UPDATE policies for authenticated users to manage their own platform credentials
-- Needed for disconnectPlatform() in api.js (sets is_active = false)

create policy "shop_update_own_creds" on public.platform_credentials
  for update to authenticated using (auth.uid() = shop_id) with check (auth.uid() = shop_id);

create policy "shop_update_own_social" on public.linked_social_accounts
  for update to authenticated using (auth.uid() = shop_id) with check (auth.uid() = shop_id);
