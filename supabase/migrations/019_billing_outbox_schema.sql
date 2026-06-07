-- ============================================================
-- 019_billing_outbox_schema.sql
-- Billing (coins/packs/payments) + Outbox + Platform Credentials
-- ============================================================
-- This migration creates:
--   1. coin_packs       — purchasable coin packs (inc. 'custom')
--   2. linked_social_accounts — social account binding per shop
--   3. coin_balances     — 1:1 balance per shop
--   4. coin_transactions — audit trail
--   5. payments          — Chargily payment records
--   6. webhook_events    — idempotent webhook processing
--   7. outbox            — message delivery queue (outbox pattern)
--   8. platform_credentials — per-shop channel access tokens
--   9. conversations     — add chunk_index, total_chunks, processing_status
-- ============================================================


-- ====================================
-- Extensions
-- ====================================
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;


-- ====================================
-- 1. TABLE: coin_packs (catalog)
-- ====================================

CREATE TABLE IF NOT EXISTS public.coin_packs (
    tier            TEXT PRIMARY KEY CHECK (tier IN ('starter','growth','business','pro','enterprise','custom')),
    display_name_ar TEXT NOT NULL,
    coins           INTEGER,                    -- NULL for 'custom' (variable)
    price_dzd       INTEGER,                    -- NULL for 'custom' (calculated)
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE  public.coin_packs IS 'Purchasable coin packs. Coins/price are NULL for custom tier (calculated dynamically)';
COMMENT ON COLUMN public.coin_packs.coins IS 'Number of coins. NULL for custom (user picks amount)';
COMMENT ON COLUMN public.coin_packs.price_dzd IS 'Price in DZD. NULL for custom (calculated)';

INSERT INTO public.coin_packs (tier, display_name_ar, coins, price_dzd, sort_order) VALUES
    ('starter',    'بداية',      500,    850,   0),
    ('growth',     'نمو',       1200,   1700,  1),
    ('business',   'أعمال',     3000,   3800,  2),
    ('pro',        'احترافي',   7000,   8500,  3),
    ('enterprise', 'مؤسسات',   20000,  22000,  4),
    ('custom',     'مخصص',      NULL,   NULL,  5)
ON CONFLICT (tier) DO NOTHING;


-- ====================================
-- 2. TABLE: linked_social_accounts (Social Identity)
-- ====================================
-- Every shop must link at least one social account.
-- UNIQUE(platform, external_id) prevents re-linking the same account.

CREATE TABLE IF NOT EXISTS public.linked_social_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL CHECK (platform IN ('instagram','whatsapp','messenger','telegram')),
    external_id     TEXT NOT NULL,
    external_handle TEXT,
    account_age_days INTEGER,
    follower_count  INTEGER,
    post_count      INTEGER,
    verified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    metadata        JSONB,
    credential_id   UUID,                        -- FK to platform_credentials (added below)
    UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_linked_social_shop ON public.linked_social_accounts(shop_id);
CREATE INDEX IF NOT EXISTS idx_linked_social_platform ON public.linked_social_accounts(platform, external_id);

COMMENT ON TABLE  public.linked_social_accounts IS 'Bound social accounts per shop. UNIQUE per platform/external_id prevents re-binding';
COMMENT ON COLUMN public.linked_social_accounts.credential_id IS 'FK to platform_credentials for this social account';


-- ====================================
-- 3. TABLE: coin_balances (1:1 per shop)
-- ====================================

CREATE TABLE IF NOT EXISTS public.coin_balances (
    shop_id            UUID PRIMARY KEY REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    balance            INTEGER NOT NULL DEFAULT 0,
    total_purchased    BIGINT NOT NULL DEFAULT 0,
    total_bonus        BIGINT NOT NULL DEFAULT 0,
    total_spent        BIGINT NOT NULL DEFAULT 0,
    last_bonus_at      TIMESTAMPTZ,
    last_activity_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_deducted_at   TIMESTAMPTZ,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

COMMENT ON TABLE  public.coin_balances IS 'Current coin balance per shop. 1:1 with clients_shops';
COMMENT ON COLUMN public.coin_balances.balance IS 'Available coins. Must be >= 0';
COMMENT ON COLUMN public.coin_balances.total_bonus IS 'Lifetime bonus coins earned (for reporting)';


-- ====================================
-- 4. TABLE: coin_transactions (audit)
-- ====================================

CREATE TYPE IF NOT EXISTS public.coin_tx_type AS ENUM (
    'bonus', 'purchase', 'deduction', 'refund', 'bonus_expired', 'admin_adjust'
);

CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,
    type            public.coin_tx_type NOT NULL,
    reason          TEXT,
    ref_type        TEXT,
    ref_id          UUID,
    balance_after   INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_shop_created ON public.coin_transactions (shop_id, created_at DESC);

COMMENT ON TABLE public.coin_transactions IS 'Audit trail for every coin change (bonus, purchase, deduction)';


-- ====================================
-- 5. TABLE: payments (Chargily records)
-- ====================================

CREATE TYPE IF NOT EXISTS public.payment_status AS ENUM ('pending','paid','failed','canceled','expired');

CREATE TABLE IF NOT EXISTS public.payments (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id                  UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    chargily_checkout_id     TEXT UNIQUE,
    amount_dzd               INTEGER NOT NULL,
    pack_tier                TEXT NOT NULL REFERENCES public.coin_packs(tier),
    coins_granted            INTEGER NOT NULL,
    status                   public.payment_status NOT NULL DEFAULT 'pending',
    customer_email           TEXT,
    metadata                 JSONB,
    failure_reason           TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_shop ON public.payments(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_pending ON public.payments(created_at) WHERE status = 'pending';

COMMENT ON TABLE public.payments IS 'Chargily payment records. Each row = one checkout -> one pack purchase';


-- ====================================
-- 6. TABLE: webhook_events (idempotency)
-- ====================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source          TEXT NOT NULL,
    event_id        TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    processed       BOOLEAN NOT NULL DEFAULT false,
    payload         JSONB NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    error_message   TEXT,
    UNIQUE (source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
    ON public.webhook_events (received_at) WHERE processed = false;

COMMENT ON TABLE public.webhook_events IS 'Idempotency log for webhooks (Chargily, Meta, etc.)';


-- ====================================
-- 7. TABLE: outbox (message delivery queue)
-- ====================================

CREATE TYPE IF NOT EXISTS public.outbox_status AS ENUM ('pending','processing','sent','failed','dead_letter');
CREATE TYPE IF NOT EXISTS public.outbox_channel AS ENUM ('instagram','whatsapp','messenger','telegram');

CREATE TABLE IF NOT EXISTS public.outbox (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id           UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    channel           public.outbox_channel NOT NULL,
    recipient_id      TEXT NOT NULL,
    payload           JSONB NOT NULL,
    status            public.outbox_status NOT NULL DEFAULT 'pending',
    attempt_count     INTEGER NOT NULL DEFAULT 0,
    max_attempts      INTEGER NOT NULL DEFAULT 5,
    next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error        TEXT,
    external_id       TEXT,
    sent_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox (next_attempt_at)
    WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_outbox_shop ON public.outbox (shop_id, created_at DESC);

COMMENT ON TABLE public.outbox IS 'Outbound message queue. n8n writes, outbox-processor sends';
COMMENT ON COLUMN public.outbox.payload IS 'JSON: { text, media_url?, quick_replies? }';
COMMENT ON COLUMN public.outbox.next_attempt_at IS 'Time for next retry (used for exponential backoff)';
COMMENT ON COLUMN public.outbox.external_id IS 'Platform message ID (IG message_id, etc.)';


-- ====================================
-- 8. TABLE: platform_credentials (per-shop tokens)
-- ====================================

CREATE TABLE IF NOT EXISTS public.platform_credentials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id             UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    channel             TEXT NOT NULL CHECK (channel IN ('instagram','whatsapp','messenger','telegram')),
    external_id         TEXT NOT NULL,
    access_token        TEXT NOT NULL,
    refresh_token       TEXT,
    expires_at          TIMESTAMPTZ,
    webhook_verify_token TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_creds_shop ON public.platform_credentials(shop_id);

COMMENT ON TABLE public.platform_credentials IS 'Per-shop access tokens for each social platform (IG/WA/FB/TG)';
COMMENT ON COLUMN public.platform_credentials.access_token IS 'Access token (encrypted via PGP in future, plaintext for MVP)';


-- ====================================
-- 9. ALTER: conversations (add chunking + processing fields)
-- ====================================

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS chunk_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS total_chunks INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

COMMENT ON COLUMN public.conversations.chunk_index IS '1-based chunk number (for long multi-part replies)';
COMMENT ON COLUMN public.conversations.total_chunks IS 'Total chunk count (1 = single message)';
COMMENT ON COLUMN public.conversations.processing_status IS 'pending | processing | completed | failed';


-- ====================================
-- 10. ALTER: linked_social_accounts (add FK to platform_credentials)
-- ====================================

-- Add FK constraint (after platform_credentials exists)
ALTER TABLE public.linked_social_accounts
    ADD CONSTRAINT fk_linked_social_credential
    FOREIGN KEY (credential_id) REFERENCES public.platform_credentials(id)
    ON DELETE SET NULL;


-- ====================================
-- 11. AUTO-INIT TRIGGER: coin_balances on shop creation
-- ====================================

CREATE OR REPLACE FUNCTION public.fn_init_coin_balance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.coin_balances (shop_id, balance, total_bonus, last_bonus_at)
    VALUES (NEW.id, 500, 500, now())
    ON CONFLICT (shop_id) DO NOTHING;

    INSERT INTO public.coin_transactions (shop_id, amount, type, reason, balance_after)
    VALUES (NEW.id, 500, 'bonus', 'مرحبًا بك في راه ساهل 🎉', 500);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER trg_init_coin_balance
    AFTER INSERT ON public.clients_shops
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_init_coin_balance();


-- ====================================
-- 12. TRIGGER: updated_at for outbox & platform_credentials
-- ====================================

CREATE TRIGGER set_outbox_updated_at
    BEFORE UPDATE ON public.outbox
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_platform_creds_updated_at
    BEFORE UPDATE ON public.platform_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_coin_balances_updated_at
    BEFORE UPDATE ON public.coin_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ====================================
-- 13. FUNCTION: calculate_custom_pack_price
-- ====================================
-- Returns (coins, price_dzd, per_coin) for custom amounts
-- Uses linear interpolation within each price tier.
-- Range: 1,000 to 1,000,000 coins.

CREATE OR REPLACE FUNCTION public.fn_calculate_custom_price(p_coins INTEGER)
RETURNS TABLE (coins INTEGER, price_dzd INTEGER, per_coin NUMERIC(10,3))
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_unit NUMERIC(10,3);
    v_floor INTEGER;
    v_ceiling INTEGER;
    v_low_price NUMERIC(10,3);
    v_high_price NUMERIC(10,3);
    v_t NUMERIC(10,3);
BEGIN
    IF p_coins < 1000 THEN
        RAISE EXCEPTION 'Minimum custom amount is 1,000 coins' USING HINT = 'min=1000';
    END IF;
    IF p_coins > 1000000 THEN
        RAISE EXCEPTION 'Maximum custom amount is 1,000,000 coins' USING HINT = 'max=1000000';
    END IF;

    -- Tier 1: 1,000 - 1,200 → 1.60 -> 1.42
    IF p_coins BETWEEN 1000 AND 1200 THEN
        v_floor := 1000; v_ceiling := 1200;
        v_low_price := 1.60; v_high_price := 1.42;
    -- Tier 2: 1,201 - 3,000 → 1.42 -> 1.27
    ELSIF p_coins BETWEEN 1201 AND 3000 THEN
        v_floor := 1201; v_ceiling := 3000;
        v_low_price := 1.42; v_high_price := 1.27;
    -- Tier 3: 3,001 - 7,000 → 1.27 -> 1.21
    ELSIF p_coins BETWEEN 3001 AND 7000 THEN
        v_floor := 3001; v_ceiling := 7000;
        v_low_price := 1.27; v_high_price := 1.21;
    -- Tier 4: 7,001 - 20,000 → 1.21 -> 1.10
    ELSIF p_coins BETWEEN 7001 AND 20000 THEN
        v_floor := 7001; v_ceiling := 20000;
        v_low_price := 1.21; v_high_price := 1.10;
    -- Tier 5: 20,001 - 100,000 → 1.10 -> 0.90
    ELSIF p_coins BETWEEN 20001 AND 100000 THEN
        v_floor := 20001; v_ceiling := 100000;
        v_low_price := 1.10; v_high_price := 0.90;
    -- Tier 6: 100,001 - 1,000,000 → 0.90 -> 0.70
    ELSE
        v_floor := 100001; v_ceiling := 1000000;
        v_low_price := 0.90; v_high_price := 0.70;
    END IF;

    v_t := (p_coins - v_floor)::NUMERIC / (v_ceiling - v_floor)::NUMERIC;
    v_unit := v_low_price - v_t * (v_low_price - v_high_price);
    v_unit := ROUND(v_unit, 3);

    RETURN QUERY SELECT
        p_coins AS coins,
        CEIL(p_coins * v_unit)::INTEGER AS price_dzd,
        v_unit AS per_coin;
END;
$$;

COMMENT ON FUNCTION public.fn_calculate_custom_price IS 'Calculates custom coin pack price with volume discount (1,000 - 1,000,000 coins)';


-- ====================================
-- 14. FUNCTION: fn_deduct_coin (atomic deduction)
-- ====================================
-- Called by coin-deduct Edge Function.
-- Uses FOR UPDATE row lock to prevent race conditions.

CREATE OR REPLACE FUNCTION public.fn_deduct_coin(
    p_shop_id UUID,
    p_sender_id TEXT,
    p_channel TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
    v_tx_id UUID;
    v_result JSONB;
BEGIN
    -- Lock the balance row
    SELECT balance INTO v_balance
    FROM public.coin_balances
    WHERE shop_id = p_shop_id
    FOR UPDATE;

    IF v_balance IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'shop_not_found', 'balance', 0);
    END IF;

    IF v_balance < 1 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_coins', 'balance', v_balance);
    END IF;

    -- Deduct
    UPDATE public.coin_balances
    SET balance = balance - 1,
        total_spent = total_spent + 1,
        last_deducted_at = now(),
        last_activity_at = now(),
        updated_at = now()
    WHERE shop_id = p_shop_id
    RETURNING balance INTO v_balance;

    -- Audit
    INSERT INTO public.coin_transactions (shop_id, amount, type, reason, ref_type, ref_id, balance_after)
    VALUES (p_shop_id, -1, 'deduction', 'inbound_' || p_channel, 'conversation', NULL, v_balance)
    RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('ok', true, 'balance', v_balance, 'tx_id', v_tx_id);
END;
$$;

COMMENT ON FUNCTION public.fn_deduct_coin IS 'Atomic coin deduction with row lock. Called by coin-deduct Edge Function';


-- ====================================
-- 15. FUNCTION: fn_credit_coins (atomic credit for purchases)
-- ====================================

CREATE OR REPLACE FUNCTION public.fn_credit_coins(
    p_shop_id UUID,
    p_amount INTEGER,
    p_type TEXT,
    p_reason TEXT DEFAULT NULL,
    p_ref_type TEXT DEFAULT NULL,
    p_ref_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
    v_total_purchased BIGINT;
    v_tx_id UUID;
BEGIN
    SELECT balance, total_purchased INTO v_balance, v_total_purchased
    FROM public.coin_balances
    WHERE shop_id = p_shop_id
    FOR UPDATE;

    IF v_balance IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'shop_not_found');
    END IF;

    v_balance := v_balance + p_amount;
    v_total_purchased := v_total_purchased + p_amount;

    UPDATE public.coin_balances
    SET balance = v_balance,
        total_purchased = v_total_purchased,
        last_activity_at = now(),
        updated_at = now()
    WHERE shop_id = p_shop_id;

    INSERT INTO public.coin_transactions (shop_id, amount, type, reason, ref_type, ref_id, balance_after)
    VALUES (p_shop_id, p_amount, p_type::public.coin_tx_type, p_reason, p_ref_type, p_ref_id, v_balance)
    RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('ok', true, 'balance', v_balance, 'tx_id', v_tx_id);
END;
$$;

COMMENT ON FUNCTION public.fn_credit_coins IS 'Atomic coin credit with row lock. Called by chargily-webhook';


-- ====================================
-- 16. pg_cron: expire 500 bonus if inactive >30 days
-- ====================================

SELECT cron.schedule(
    'expire-stale-bonus',
    '0 2 * * *',
    $$
    UPDATE public.coin_balances b
    SET balance = GREATEST(0, balance - LEAST(500, total_bonus)),
        total_bonus = GREATEST(0, total_bonus - 500)
    FROM public.clients_shops s
    WHERE s.id = b.shop_id
      AND b.total_bonus >= 500
      AND b.last_activity_at < now() - INTERVAL '30 days';
    $$
);


-- ====================================
-- 17. pg_cron: outbox-processor trigger (every minute)
-- ====================================

SELECT cron.schedule(
    'process-outbox',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/outbox-processor',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
            'Authorization', 'Bearer SUPABASE_SERVICE_ROLE_KEY'
        ),
        timeout_milliseconds := 5000
    );
    $$
);


-- ====================================
-- 18. RLS POLICIES
-- ====================================

-- coin_packs: public read (catalog, no secrets)
ALTER TABLE public.coin_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_coin_packs" ON public.coin_packs;
CREATE POLICY "anyone_read_coin_packs"
    ON public.coin_packs FOR SELECT TO anon, authenticated
    USING (true);

-- coin_balances: owner reads own
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_own_balance" ON public.coin_balances;
CREATE POLICY "shop_read_own_balance"
    ON public.coin_balances FOR SELECT TO authenticated
    USING (auth.uid() = shop_id);

-- coin_transactions: owner reads own
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_own_tx" ON public.coin_transactions;
CREATE POLICY "shop_read_own_tx"
    ON public.coin_transactions FOR SELECT TO authenticated
    USING (auth.uid() = shop_id);

-- payments: owner reads own
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_own_payments" ON public.payments;
CREATE POLICY "shop_read_own_payments"
    ON public.payments FOR SELECT TO authenticated
    USING (auth.uid() = shop_id);

-- linked_social_accounts: owner reads own
ALTER TABLE public.linked_social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_own_social" ON public.linked_social_accounts;
CREATE POLICY "shop_read_own_social"
    ON public.linked_social_accounts FOR SELECT TO authenticated
    USING (auth.uid() = shop_id);

DROP POLICY IF EXISTS "shop_insert_own_social" ON public.linked_social_accounts;
CREATE POLICY "shop_insert_own_social"
    ON public.linked_social_accounts FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = shop_id);

-- platform_credentials: owner reads own (access tokens are sensitive!)
ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_own_creds" ON public.platform_credentials;
CREATE POLICY "shop_read_own_creds"
    ON public.platform_credentials FOR SELECT TO authenticated
    USING (auth.uid() = shop_id);

-- outbox: owner reads own, service_role writes
ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_own_outbox" ON public.outbox;
CREATE POLICY "shop_read_own_outbox"
    ON public.outbox FOR SELECT TO authenticated
    USING (auth.uid() = shop_id);

-- webhook_events: service_role only
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_webhooks" ON public.webhook_events;
CREATE POLICY "service_role_all_webhooks"
    ON public.webhook_events FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ====================================
-- 19. SERVICE ROLE GRANTS
-- ====================================

GRANT ALL ON public.coin_packs             TO service_role;
GRANT ALL ON public.coin_balances          TO service_role;
GRANT ALL ON public.coin_transactions       TO service_role;
GRANT ALL ON public.payments               TO service_role;
GRANT ALL ON public.webhook_events          TO service_role;
GRANT ALL ON public.linked_social_accounts  TO service_role;
GRANT ALL ON public.platform_credentials    TO service_role;
GRANT ALL ON public.outbox                  TO service_role;

-- Grants for n8n (uses service_role key)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;


-- ============================================================
-- VERIFICATION
-- ============================================================
-- After running this migration:
--
-- 1. Check tables:
--    SELECT tablename FROM pg_tables
--    WHERE schemaname='public'
--      AND tablename IN ('coin_packs','coin_balances','coin_transactions',
--                        'payments','webhook_events','linked_social_accounts',
--                        'platform_credentials','outbox')
--    ORDER BY tablename;
--    Expected: 8 rows
--
-- 2. Check coin_packs seeded:
--    SELECT tier, display_name_ar, coins, price_dzd FROM coin_packs ORDER BY sort_order;
--    Expected: 6 rows (starter, growth, business, pro, enterprise, custom)
--
-- 3. Check custom pricing:
--    SELECT * FROM fn_calculate_custom_price(5000);
--    Expected: 5000 coins, ~6150 DZD, ~1.23 per_coin
--
-- 4. Test fn_deduct_coin:
--    SELECT fn_deduct_coin('<shop_uuid>', 'test_sender', 'instagram');
--    Expected: { ok: true, balance: 499, tx_id: '<uuid>' }
--    Run twice: first OK, second OK ... until balance hits 0 → { ok: false, reason: 'insufficient_coins' }
--
-- 5. Test fn_credit_coins:
--    SELECT fn_credit_coins('<shop_uuid>', 1000, 'purchase', 'test credit');
--    Expected: { ok: true, balance: 1500, tx_id: '<uuid>' }
--
-- 6. Check RLS policies:
--    SELECT tablename, policyname, roles, cmd
--    FROM pg_policies
--    WHERE schemaname='public'
--      AND tablename IN ('coin_packs','coin_balances','coin_transactions')
--    ORDER BY tablename, policyname;
--    Expected: all roles = {authenticated} or {anon,authenticated}
--
-- 5. Check cron jobs:
--    SELECT jobname, schedule FROM cron.job;
--    Expected: expire-stale-bonus (0 2 * * *), process-outbox (* * * * *)
-- ============================================================
