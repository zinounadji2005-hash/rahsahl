-- ============================================================
-- 017_fix_pg_net_schema.sql
-- Fix: the trigger calls extensions.http_post, but the function
-- lives in the `net` schema (not `extensions`). The call was
-- failing silently, blocked by the EXCEPTION handler.
-- ============================================================


-- Drop and recreate the trigger function with the correct schema.
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, auth
AS $$
DECLARE
    function_url TEXT := 'https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/create-shop';
    service_key TEXT := 'SUPABASE_SERVICE_ROLE_KEY';
    payload JSONB;
    request_id BIGINT;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'users',
        'record', jsonb_build_object(
            'id', NEW.id,
            'email', NEW.email,
            'phone', NEW.phone,
            'created_at', NEW.created_at,
            'raw_user_meta_data', NEW.raw_user_meta_data,
            'raw_app_meta_data', NEW.raw_app_meta_data
        )
    );

    -- Fire-and-forget HTTP POST to the Edge Function via pg_net.
    -- IMPORTANT: the function lives in schema `net`, not `extensions`.
    SELECT net.http_post(
        url := function_url,
        body := payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        ),
        timeout_milliseconds := 10000
    ) INTO request_id;

    RAISE LOG 'create-shop fired for new auth.users.id=% request_id=%', NEW.id, request_id;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never block signup on hook failures. Log for observability.
    RAISE WARNING 'handle_new_user_signup hook failed for id=% err=%', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


-- ============================================================
-- VERIFICATION
-- ============================================================
-- 1. Trigger still installed:
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created';
--
-- 2. Sign up a new user via the dashboard; clients_shops row should
--    appear within ~1-2s.
--
-- 3. Inspect pg_net results:
--    SELECT status_code, LEFT(content, 200), timed_out, error_msg
--    FROM net._http_response
--    ORDER BY id DESC LIMIT 3;
