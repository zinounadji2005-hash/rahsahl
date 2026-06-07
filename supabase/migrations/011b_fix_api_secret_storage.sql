-- 011b_fix_api_secret_storage.sql
-- Re-convert BYTEA to TEXT properly using encode
ALTER TABLE public.clients_shops
  ALTER COLUMN api_secret_encrypted TYPE TEXT USING encode(api_secret_encrypted, 'escape');
