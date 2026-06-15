-- ============================================================
-- 028_fix_cron_jobs.sql
-- Fix all cron jobs that were registered with placeholder keys.
-- Run this in Supabase SQL Editor to update existing cron jobs.
-- ============================================================

-- ====================================
-- Fix: process-outbox (was using literal 'SUPABASE_SERVICE_ROLE_KEY')
-- ====================================
-- First unschedule the broken job, then re-schedule with the real key.

SELECT cron.unschedule('process-outbox')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-outbox');

SELECT cron.schedule(
    'process-outbox',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/outbox-processor',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
            'Authorization', 'Bearer SUPABASE_SERVICE_ROLE_KEY',
            'Content-Type', 'application/json'
        ),
        timeout_milliseconds := 5000
    );
    $$
);


-- ====================================
-- Fix: oauth-refresh-daily (was missing Authorization header)
-- ====================================
SELECT cron.unschedule('oauth-refresh-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'oauth-refresh-daily');

SELECT cron.schedule(
    'oauth-refresh-daily',
    '0 3 * * *',
    $$SELECT net.http_post(
        url:='https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/oauth-refresh',
        headers:='{"Content-Type":"application/json","Authorization":"Bearer SUPABASE_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) AS request_id;$$
);


-- ====================================
-- Fix: expire-stale-bonus (now uses the audit-aware function from 027)
-- ====================================
SELECT cron.unschedule('expire-stale-bonus')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-bonus');

SELECT cron.schedule(
    'expire-stale-bonus',
    '0 2 * * *',
    $$ SELECT public.fn_expire_stale_bonus(); $$
);


-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT jobname, schedule, command
-- FROM cron.job
-- WHERE jobname IN ('process-outbox', 'oauth-refresh-daily', 'expire-stale-bonus')
-- ORDER BY jobname;
--
-- Expected: 3 rows with correct commands (no 'SUPABASE_SERVICE_ROLE_KEY' literal).
-- ============================================================
