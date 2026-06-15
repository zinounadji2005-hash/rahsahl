-- ============================================================
-- 026_voice_agent_schema.sql
-- AI Voice Agent via Retell AI + Twilio
-- ============================================================

CREATE TABLE IF NOT EXISTS public.voice_agent_config (
    shop_id             UUID PRIMARY KEY REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    is_active           BOOLEAN NOT NULL DEFAULT false,
    retell_agent_id     TEXT,
    twilio_phone_number TEXT,
    twilio_phone_sid    TEXT,
    language            TEXT NOT NULL DEFAULT 'ar',
    welcome_message     TEXT,
    business_hours      JSONB,
    transfer_phone_number TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.voice_calls (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id             UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    call_id             TEXT NOT NULL,
    direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_number         TEXT NOT NULL,
    to_number           TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'registered'
                        CHECK (status IN ('registered', 'ongoing', 'ended', 'failed')),
    duration_ms         INTEGER,
    transcript          JSONB,
    transcript_summary  TEXT,
    recording_url       TEXT,
    disconnection_reason TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (call_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_shop ON public.voice_calls(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON public.voice_calls(status);

CREATE TRIGGER set_voice_agent_config_updated_at
    BEFORE UPDATE ON public.voice_agent_config
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_voice_calls_updated_at
    BEFORE UPDATE ON public.voice_calls
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.voice_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_all_own_voice_config" ON public.voice_agent_config
    FOR ALL TO authenticated USING (auth.uid() = shop_id) WITH CHECK (auth.uid() = shop_id);

CREATE POLICY "shop_read_own_voice_calls" ON public.voice_calls
    FOR SELECT TO authenticated USING (auth.uid() = shop_id);

CREATE POLICY "service_role_all_voice_config" ON public.voice_agent_config
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_voice_calls" ON public.voice_calls
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.voice_agent_config TO service_role;
GRANT ALL ON public.voice_calls TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.voice_agent_config TO authenticated;
GRANT SELECT ON public.voice_calls TO authenticated;
