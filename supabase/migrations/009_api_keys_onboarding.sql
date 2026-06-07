-- ============================================================
-- 009_api_keys_onboarding.sql
-- P1.5: API key generation + onboarding support
-- ============================================================

ALTER TABLE public.clients_shops ADD COLUMN IF NOT EXISTS api_secret_encrypted BYTEA;
ALTER TABLE public.clients_shops ADD COLUMN IF NOT EXISTS api_secret_prefix TEXT;
ALTER TABLE public.clients_shops ADD COLUMN IF NOT EXISTS api_secret_last_used TIMESTAMPTZ;
ALTER TABLE public.clients_shops ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE public.clients_shops ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','enterprise'));

COMMENT ON COLUMN public.clients_shops.api_secret_encrypted IS 'AES-256-GCM encrypted with master key';
COMMENT ON COLUMN public.clients_shops.api_secret_prefix IS 'First 8 chars of api_secret for display (e.g., afk_a1b2c3)';
COMMENT ON COLUMN public.clients_shops.api_secret_last_used IS 'Last successful HMAC verification';
COMMENT ON COLUMN public.clients_shops.onboarded_at IS 'When the shop completed onboarding';
COMMENT ON COLUMN public.clients_shops.subscription_tier IS 'Plan: free, pro, enterprise';

CREATE INDEX IF NOT EXISTS idx_clients_shops_tier ON public.clients_shops(subscription_tier);


-- =========================
-- TABLE: signup_events
-- =========================

CREATE TABLE IF NOT EXISTS public.signup_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event       TEXT NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_events_user ON public.signup_events(user_id, created_at DESC);

COMMENT ON TABLE  public.signup_events IS 'Audit trail for signup/onboarding/key events';
COMMENT ON COLUMN public.signup_events.event IS 'signup | onboarded | key_created | key_regenerated | key_revoked';


-- =========================
-- TABLE: api_key_audit
-- =========================

CREATE TABLE IF NOT EXISTS public.api_key_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    action          TEXT NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    success         BOOLEAN NOT NULL DEFAULT true,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_key_audit_shop ON public.api_key_audit(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_action ON public.api_key_audit(action, created_at DESC);

COMMENT ON TABLE  public.api_key_audit IS 'Detailed log of every API key event';
COMMENT ON COLUMN public.api_key_audit.action IS 'created | regenerated | revoked | verified | failed_verification';


-- =========================
-- RLS
-- =========================
ALTER TABLE public.signup_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_audit   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_signup_events" ON public.signup_events;
CREATE POLICY "service_role_all_signup_events"
    ON public.signup_events FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_api_key_audit" ON public.api_key_audit;
CREATE POLICY "service_role_all_api_key_audit"
    ON public.api_key_audit FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shop_read_own_signup_events" ON public.signup_events;
CREATE POLICY "shop_read_own_signup_events"
    ON public.signup_events FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shop_read_own_api_key_audit" ON public.api_key_audit;
CREATE POLICY "shop_read_own_api_key_audit"
    ON public.api_key_audit FOR SELECT TO authenticated
    USING (auth.uid() = shop_id);

DROP POLICY IF EXISTS "clients_shops_select_own" ON public.clients_shops;
CREATE POLICY "clients_shops_select_own"
    ON public.clients_shops FOR SELECT TO authenticated
    USING (auth.uid() = id);

GRANT ALL ON public.signup_events  TO service_role;
GRANT ALL ON public.api_key_audit   TO service_role;
