-- 011d_fix_api_secret_storage.sql
-- Cast to bytea first, then convert
ALTER TABLE public.clients_shops
  ALTER COLUMN api_secret_encrypted TYPE TEXT USING convert_from(api_secret_encrypted::bytea, 'UTF8');
