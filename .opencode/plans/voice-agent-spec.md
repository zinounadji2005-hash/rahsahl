# خطة AI Voice Agent — التنفيذ الكامل

## التقنية المختارة: Retell AI + Twilio + n8n + Supabase

### 1. SQL Migration: supabase/migrations/026_voice_agent_schema.sql

CREATE TABLE voice_agent_config (
    shop_id             UUID PK → clients_shops(id) ON DELETE CASCADE,
    is_active           BOOLEAN DEFAULT false,
    retell_agent_id     TEXT,
    twilio_phone_number TEXT,
    twilio_phone_sid    TEXT,
    language            TEXT DEFAULT 'ar',
    welcome_message     TEXT,
    business_hours      JSONB,
    transfer_phone_number TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ
);

CREATE TABLE voice_calls (
    id                  UUID PK,
    shop_id             UUID NOT NULL → clients_shops(id),
    call_id             TEXT NOT NULL UNIQUE,
    direction           TEXT CHECK (inbound/outbound),
    from_number         TEXT NOT NULL,
    to_number           TEXT NOT NULL,
    status              TEXT CHECK (registered/ongoing/ended/failed),
    duration_ms         INTEGER,
    transcript          JSONB,
    transcript_summary  TEXT,
    recording_url       TEXT,
    disconnection_reason TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ
);
+ RLS: owner all on voice_agent_config, owner select on voice_calls
+ service_role all on both
+ updated_at triggers

### 2. Edge Function: supabase/functions/voice-webhook/index.ts

- يستقبل Webhooks من Retell AI:
  - call_started → يسجل في voice_calls، يبحث عن shop_id من twilio_phone_number
  - call_ended → يحدث voice_calls (transcript, recording, summary)
- يستخدم SERVICE_KEY
- CORS headers

### 3. Edge Function: supabase/functions/voice-agent-setup/index.ts

- إنشاء/تحديث Retell AI agent لمتجر
- يأخذ shop_id من auth context
- يقرأ bot_settings
- ينشئ agent في Retell AI API مع system prompt
- يحفظ retell_agent_id في voice_agent_config

### 4. Dashboard: public/dashboard/js/api.js — إضافة

- getVoiceConfig() → select from voice_agent_config
- saveVoiceConfig(config) → upsert voice_agent_config
- listVoiceCalls() → select from voice_calls
- getVoiceCall(id) → select single from voice_calls

### 5. Dashboard: public/dashboard/js/lang.js — إضافة

- 'nav.voice': { ar: 'الاتصال الصوتي', fr: 'Appel vocal', en: 'Voice Call' }
- 'voice.title', 'voice.subtitle', 'voice.activate', 'voice.deactivate',
  'voice.language', 'voice.welcome', 'voice.business-hours', 'voice.transfer-number',
  'voice.phone-number', 'voice.connected', 'voice.not-connected',
  'voice.calls', 'voice.duration', 'voice.status', 'voice.recording'

### 6. Dashboard: public/dashboard/js/sidebar.js — إضافة

إضافة في NAV_ITEMS بعد billing:
    { key: 'voice', href: 'voice.html', icon: 'call', tKey: 'nav.voice' }

### 7. Dashboard: public/dashboard/voice.html — صفحة جديدة

- تبويبين: الإعدادات + سجل المكالمات
- الإعدادات: تفعيل، لغة، رسالة ترحيب، أوقات العمل، رقم التحويل
- سجل المكالمات: جدول بـ status/direction/from/to/duration/recording

### 8. n8n Workflow: scripts/n8n/workflows/voice-agent.js

استخدام @n8n/workflow-sdk (نفس نمط ai-sales-agent.js)
- voice-inbound-handler: Webhook → Get Shop Config → Return Context → Save Call
- voice-outbound-trigger: Webhook → Validate → Call Retell API → Log Call

### 9. متغيرات البيئة المطلوبة

RETELL_API_KEY=...
RETELL_API_URL=https://api.retellai.com
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER_SID=...

### 10. خطوات ما بعد النشر

1. فتح حساب Retell AI + الحصول على API Key
2. فتح حساب Twilio + شراء رقم هاتف + الحصول على SID/Token
3. تعيين المتغيرات السرية في Supabase
4. إنشاء Retell AI agent لكل متجر عبر dashboard
5. ربط Twilio webhook بـ Retell AI
6. نشر Cloudflare Pages للتحديثات
