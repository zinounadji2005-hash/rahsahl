-- ============================================================
-- 020_contact_messages.sql
-- Contact form submissions with RLS for anon inserts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous users) to insert
CREATE POLICY "contact_messages_anon_insert" ON public.contact_messages
    FOR INSERT WITH CHECK (true);

-- Only authenticated admins can select
CREATE POLICY "contact_messages_admin_select" ON public.contact_messages
    FOR SELECT USING (auth.role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC);
