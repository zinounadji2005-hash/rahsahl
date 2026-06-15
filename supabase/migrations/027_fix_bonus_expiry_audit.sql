-- ============================================================
-- 027_fix_bonus_expiry_audit.sql
-- Fix expire-stale-bonus cron: replace inline SQL with a proper
-- function that also records coin_transactions audit entries.
-- ============================================================
-- Problem: The cron job in 019 modifies coin_balances balance
-- without inserting any coin_transactions record. This creates
-- invisible deductions in the audit trail (users see balance drop
-- with no explanation in their transaction history).
-- ============================================================


-- ====================================
-- 1. Create audit-aware expiry function
-- ====================================

CREATE OR REPLACE FUNCTION public.fn_expire_stale_bonus()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    v_deduct INTEGER;
    v_new_balance INTEGER;
BEGIN
    FOR rec IN
        SELECT b.shop_id, b.balance, b.total_bonus
        FROM public.coin_balances b
        WHERE b.total_bonus >= 500
          AND b.last_activity_at < now() - INTERVAL '30 days'
        FOR UPDATE
    LOOP
        v_deduct := LEAST(500, rec.total_bonus);

        -- Update balance
        UPDATE public.coin_balances
        SET balance     = GREATEST(0, balance - v_deduct),
            total_bonus = GREATEST(0, total_bonus - v_deduct),
            updated_at  = now()
        WHERE shop_id = rec.shop_id
        RETURNING balance INTO v_new_balance;

        -- Record audit entry so users can see why balance changed
        INSERT INTO public.coin_transactions
            (shop_id, amount, type, reason, balance_after)
        VALUES
            (rec.shop_id, -v_deduct, 'bonus_expired',
             'انتهت صلاحية مكافأة الترحيب (عدم نشاط 30 يوم)', v_new_balance);
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.fn_expire_stale_bonus IS
    'Expires welcome bonus after 30 days of inactivity. Records audit entry in coin_transactions.';


-- ====================================
-- 2. Drop old bare-SQL cron and replace with function call
-- ====================================

-- Remove the old cron job if it exists
SELECT cron.unschedule('expire-stale-bonus')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-bonus'
);

-- Schedule the new function-based cron
SELECT cron.schedule(
    'expire-stale-bonus',
    '0 2 * * *',
    $$ SELECT public.fn_expire_stale_bonus(); $$
);


-- ============================================================
-- VERIFICATION
-- ============================================================
-- 1. Check cron is registered:
--    SELECT jobname, schedule, command FROM cron.job
--    WHERE jobname = 'expire-stale-bonus';
--    Expected: 1 row, command = 'SELECT public.fn_expire_stale_bonus();'
--
-- 2. Manually invoke to test:
--    SELECT public.fn_expire_stale_bonus();
--    Then check: SELECT * FROM coin_transactions
--    WHERE type = 'bonus_expired' ORDER BY created_at DESC LIMIT 5;
-- ============================================================
