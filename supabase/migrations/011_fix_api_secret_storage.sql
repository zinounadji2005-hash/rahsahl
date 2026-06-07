-- 011_fix_api_secret_storage.sql
-- Use TEXT for base64-encoded ciphertext (simpler than BYTEA hex encoding)
ALTER TABLE public.clients_shops
  ALTER COLUMN api_secret_encrypted TYPE TEXT USING api_secret_encrypted::TEXT;
