-- ============================================================
-- 024_conversations_channel.sql
-- Add channel column + indexes to conversations
-- ============================================================

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS channel TEXT;

CREATE INDEX IF NOT EXISTS idx_conv_channel
    ON public.conversations(shop_id, channel, created_at DESC);
