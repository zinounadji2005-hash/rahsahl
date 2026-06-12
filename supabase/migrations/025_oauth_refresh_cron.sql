-- ============================================================
-- 025_oauth_refresh_cron.sql
-- Schedule daily token refresh via pg_cron
-- ============================================================

SELECT cron.schedule(
    'oauth-refresh-daily',
    '0 3 * * *',
    $$SELECT net.http_post(
        url:='https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/oauth-refresh',
        headers:='{"Content-Type":"application/json"}'::jsonb,
        body:='{}'::jsonb
    ) AS request_id;$$
);
