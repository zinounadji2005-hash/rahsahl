-- ============================================================
-- 006_conversations_products.sql
-- Production: Conversation Memory + Product Catalog
-- ============================================================

-- Required for fuzzy product name matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =========================
-- TABLE: conversations
-- =========================
-- Rolling message history per (shop, sender). Used as context
-- for multi-turn conversations, fed to the LLM as prior turns.

CREATE TABLE IF NOT EXISTS public.conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    sender_id       TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    message         TEXT NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_lookup
    ON public.conversations(shop_id, sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conv_recent
    ON public.conversations(shop_id, sender_id, id DESC);

COMMENT ON TABLE  public.conversations IS 'Per-customer message history for multi-turn context';
COMMENT ON COLUMN public.conversations.role IS 'user (customer), assistant (bot), system (notes)';
COMMENT ON COLUMN public.conversations.metadata IS 'Optional structured data extracted with this turn';


-- =========================
-- TABLE: products (catalog)
-- =========================
-- Shop product catalog. The AI agent can query this via a tool
-- to give accurate, real pricing/availability answers.

CREATE TABLE IF NOT EXISTS public.products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    sku             TEXT,
    name            TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'DZD',
    stock           INTEGER NOT NULL DEFAULT 0,
    variants        JSONB,
    tags            TEXT[],
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_per_shop
    ON public.products(shop_id, sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_shop_active
    ON public.products(shop_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_tags
    ON public.products USING gin (tags);

-- Reuse existing updated_at trigger
CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.products IS 'Per-shop product catalog — AI queries this for prices/stock';
COMMENT ON COLUMN public.products.sku IS 'Shop-defined SKU (unique per shop)';
COMMENT ON COLUMN public.products.variants IS 'JSON: sizes, colors, etc.';
COMMENT ON COLUMN public.products.tags IS 'Search tags for fuzzy matching';


-- =========================
-- RLS
-- =========================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "service_role_all_conversations" ON public.conversations;
CREATE POLICY "service_role_all_conversations"
    ON public.conversations FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_products" ON public.products;
CREATE POLICY "service_role_all_products"
    ON public.products FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Shop owners manage their own catalog
DROP POLICY IF EXISTS "shop_manage_own_products" ON public.products;
CREATE POLICY "shop_manage_own_products"
    ON public.products FOR ALL TO authenticated
    USING (auth.uid() = shop_id) WITH CHECK (auth.uid() = shop_id);

-- Shop owners read their own conversations
DROP POLICY IF EXISTS "shop_read_own_conversations" ON public.conversations;
CREATE POLICY "shop_read_own_conversations"
    ON public.conversations FOR SELECT TO authenticated
    USING (auth.uid() = shop_id);

GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.products       TO service_role;
