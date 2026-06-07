-- ============================================================
-- 016_auth_hook_create_shop.sql
-- Auth Hook trigger: on signup → invoke create-shop Edge Function
-- ============================================================
-- This migration wires up an AFTER INSERT trigger on
-- auth.users that fires the create-shop Edge Function via
-- pg_net.http_post.
--
-- Flow:
--   1. User signs up in the frontend (Supabase Auth creates a row
--      in auth.users).
--   2. Trigger fires with NEW containing the user record, including
--      raw_user_meta_data which holds the shop_name, owner_name,
--      and phone supplied during signup.
--   3. The trigger function builds the same payload shape the
--      create-shop function expects: { type, table, record }.
--   4. pg_net.http_post is invoked asynchronously against the
--      function URL. The function is not awaited inside the
--      trigger (auth.users INSERTs should not block on HTTP).
--
-- Notes:
--   - Edge Function 'create-shop' is already deployed and reads
--     the same payload shape (see supabase/functions/create-shop/
--     index.ts).
--   - pg_net was installed in a prior step. CREATE EXTENSION
--     IF NOT EXISTS keeps this migration idempotent.
--   - service_role_key is used in the Authorization header so
--     the function has full DB privileges; do not rotate this
--     without updating the trigger.
--   - Errors from http_post are logged via RAISE WARNING but do
--     not block the auth.users insert. The signup succeeds even
--     if create-shop fails; admin can retry from the dashboard.
-- ============================================================


-- ====================================
-- Enable pg_net (idempotent)
-- ====================================
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;


-- ====================================
-- Trigger function
-- ====================================
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
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

    -- Fire-and-forget HTTP POST to the Edge Function.
    -- pg_net returns a request_id; we don't wait on it because
    -- blocking the auth.users insert on a network roundtrip would
    -- degrade signup latency and risk timeouts.
    SELECT extensions.http_post(
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


-- ====================================
-- Trigger
-- ====================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();


-- ============================================================
-- VERIFICATION
-- ============================================================
-- After running this migration:
--
-- 1. Confirm trigger is installed:
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'auth.users'::regclass
--      AND tgname = 'on_auth_user_created';
--    Expected: 1 row, tgenabled = 'O' (origin/enabled)
--
-- 2. End-to-end: sign up a real user via the dashboard, then:
--    SELECT id, shop_name, owner_name FROM clients_shops
--    WHERE id = '<new user id>';
--    Expected: 1 row, populated by create-shop within ~1-2s.
--
-- 3. If hook fails, look for:
--    SELECT * FROM pg_net.http_get_responses
--    ORDER BY created DESC LIMIT 10;
-- ============================================================
