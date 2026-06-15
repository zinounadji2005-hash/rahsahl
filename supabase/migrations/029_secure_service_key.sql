-- ============================================================
-- 029_secure_service_key.sql
-- Move hardcoded service key into a config table so all
-- functions and cron jobs reference it dynamically.
-- Run AFTER 028_fix_cron_jobs.sql has been applied.
-- ============================================================

-- ====================================
-- 1. Create app_config table
-- ====================================
CREATE TABLE IF NOT EXISTS public.app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only the service_role (or superuser) can read/write
CREATE POLICY app_config_service_only ON public.app_config
    FOR ALL
    USING (current_role = 'service_role');

-- ====================================
-- 2. Insert the service role key
--    ⚠️ Replace the placeholder below with the real service key from Supabase Dashboard
--    Settings → API → Project API keys → service_role key
-- ====================================
-- INSERT INTO public.app_config (key, value)
-- VALUES ('service_role_key', 'supabase_service_role_key_here')
-- ON CONFLICT (key) DO NOTHING;

-- ====================================
-- 3. Helper: build auth headers from config
-- ====================================
CREATE OR REPLACE FUNCTION public.auth_headers()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT jsonb_build_object(
        'Authorization',
        'Bearer ' || (SELECT value FROM public.app_config WHERE key = 'service_role_key'),
        'Content-Type',
        'application/json'
    );
$$;

COMMENT ON FUNCTION public.auth_headers IS
    'Returns Authorization + Content-Type headers using the service key from app_config.';

-- ====================================
-- 4. Update fn_create_shop_for_user (016)
-- ====================================
CREATE OR REPLACE FUNCTION public.fn_create_shop_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    function_url TEXT := 'https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/create-shop';
    payload JSONB;
    request_id BIGINT;
BEGIN
    IF NEW.raw_app_meta_data ? 'skip_hook' THEN
        RETURN NEW;
    END IF;

    payload := jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'owner_name', NEW.raw_user_meta_data ->> 'owner_name',
        'phone', NEW.raw_user_meta_data ->> 'phone',
        'shop_name', NEW.raw_user_meta_data ->> 'shop_name'
    );

    SELECT net.http_post(
        url := function_url,
        body := payload,
        headers := public.auth_headers(),
        timeout_milliseconds := 5000
    ) INTO request_id;

    RETURN NEW;
END;
$$;

-- ====================================
-- 5. Update fn_create_shop_net (017 fallback)
-- ====================================
CREATE OR REPLACE FUNCTION public.fn_create_shop_net()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, auth
AS $$
DECLARE
    function_url TEXT := 'https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/create-shop';
    payload JSONB;
    request_id BIGINT;
BEGIN
    IF NEW.raw_app_meta_data ? 'skip_hook' THEN
        RETURN NEW;
    END IF;

    payload := jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'owner_name', NEW.raw_user_meta_data ->> 'owner_name',
        'phone', NEW.raw_user_meta_data ->> 'phone',
        'shop_name', NEW.raw_user_meta_data ->> 'shop_name'
    );

    SELECT net.http_post(
        url := function_url,
        body := payload,
        headers := public.auth_headers(),
        timeout_milliseconds := 5000
    ) INTO request_id;

    RETURN NEW;
END;
$$;

-- ====================================
-- 6. Reschedule crons to use auth_headers()
-- ====================================

-- process-outbox
SELECT cron.unschedule('process-outbox')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-outbox');

SELECT cron.schedule(
    'process-outbox',
    '* * * * *',
    $$SELECT net.http_post(
        url:='https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/outbox-processor',
        body:='{}'::jsonb,
        headers:=public.auth_headers(),
        timeout_milliseconds:=5000
    ) AS request_id;$$
);

-- oauth-refresh-daily
SELECT cron.unschedule('oauth-refresh-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'oauth-refresh-daily');

SELECT cron.schedule(
    'oauth-refresh-daily',
    '0 3 * * *',
    $$SELECT net.http_post(
        url:='https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/oauth-refresh',
        headers:=public.auth_headers(),
        body:='{}'::jsonb
    ) AS request_id;$$
);

-- expire-stale-bonus (keeps fn_expire_stale_bonus, just re-register for consistency)
SELECT cron.unschedule('expire-stale-bonus')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-bonus');

SELECT cron.schedule(
    'expire-stale-bonus',
    '0 2 * * *',
    $$ SELECT public.fn_expire_stale_bonus(); $$
);

-- ====================================
-- VERIFICATION
-- ====================================
-- SELECT * FROM public.app_config WHERE key = 'service_role_key';
-- SELECT public.auth_headers();
-- SELECT jobname, command FROM cron.job ORDER BY jobname;
-- ====================================
