-- ============================================================
-- 008_bot_settings_extended.sql
-- P1.1: Extend bot_settings with per-shop customization
-- ============================================================
-- Adds: currency, timezone, business_hours, delivery_cities,
--       shipping_fee, response_style, auto_confirm, fallback_message
-- ============================================================

ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'DZD';
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS shop_timezone TEXT NOT NULL DEFAULT 'Africa/Algiers';
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS business_hours JSONB;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS delivery_cities TEXT[] NOT NULL DEFAULT ARRAY['الجزائر العاصمة','البليدة','وهران','قسنطينة','سطيف','عنابة','تلمسان','بجاية'];
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 700;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS response_style TEXT NOT NULL DEFAULT 'casual' CHECK (response_style IN ('casual','formal','friendly'));
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS auto_confirm BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS fallback_message TEXT DEFAULT 'عذراً، حاول مرة أخرى بعد قليل 🙏';

COMMENT ON COLUMN public.bot_settings.currency IS 'ISO 4217 currency code (DZD, EUR, USD)';
COMMENT ON COLUMN public.bot_settings.shop_timezone IS 'IANA timezone identifier';
COMMENT ON COLUMN public.bot_settings.business_hours IS 'JSON: {mon:"09:00-18:00", tue:"09:00-18:00", ...}';
COMMENT ON COLUMN public.bot_settings.delivery_cities IS 'Array of cities the shop delivers to';
COMMENT ON COLUMN public.bot_settings.shipping_fee IS 'Default shipping fee in shop currency';
COMMENT ON COLUMN public.bot_settings.response_style IS 'Tone: casual|formal|friendly';
COMMENT ON COLUMN public.bot_settings.auto_confirm IS 'If true, orders auto-confirm instead of pending';
COMMENT ON COLUMN public.bot_settings.fallback_message IS 'Message sent on system errors';

-- Update default business hours for existing rows
UPDATE public.bot_settings
SET business_hours = '{"mon":"09:00-18:00","tue":"09:00-18:00","wed":"09:00-18:00","thu":"09:00-18:00","fri":"09:00-13:00","sat":"10:00-16:00","sun":"closed"}'::jsonb
WHERE business_hours IS NULL;
