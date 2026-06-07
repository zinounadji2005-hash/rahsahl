-- 011c_fix_api_secret_storage.sql
-- Drop and re-add as TEXT
ALTER TABLE public.clients_shops
  ALTER COLUMN api_secret_encrypted DROP DEFAULT;
ALTER TABLE public.clients_shops
  ALTER COLUMN api_secret_encrypted TYPE TEXT USING convert_from(api_secret_encrypted, 'UTF8');
