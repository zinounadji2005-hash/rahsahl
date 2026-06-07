# نظام الكريديت + بوابة Chargily — وثيقة تصميم

> **الحالة:** تصميم فقط — لم يُكتب أي كود بعد
> **التاريخ:** 2026-06-05
> **الإصدار:** 0.1 (draft)

---

## 1. Executive Summary

نظام SaaS يستخدم نموذج **credits** (نقاط) لاستهلاك الموارد:
- كل رسالة واردة من العميل = خصم 1 coin
- 3 tiers: Free (500) / Pro (5,000) / Enterprise (unlimited)
- التحصيل عبر **Chargily Pay V2** (الجزائر — CIB/EDAHABIA)
- "اشتراك شهري" = manual recurring (العميل يجدد يدوياً كل 30 يوم)

### لماذا "manual recurring" بدل subscriptions تلقائية؟
Chargily Pay V2 يدعم `Checkout` فقط (لا يوجد subscription API). الـ pattern الشائع في SaaS الجزائري:
- العميل يدفع لأول شهر → يستلم coins لـ 30 يوم
- قبل انتهاء الفترة بـ 5 أيام → notification في الـ dashboard
- العميل يضغط "تجديد" → checkout جديد
- إذا لم يجدد → grace 3 أيام → يرجع إلى Free (500/شهر)

---

## 2. Architecture Overview

```
┌─────────────┐  click "اشترك"  ┌──────────────────┐  POST /checkouts  ┌──────────┐
│   Browser   │ ──────────────► │ create-checkout  │ ─────────────────► │ Chargily │
│  dashboard  │ ◄────────────── │ (Edge Function)  │ ◄───────────────── │   Pay    │
└─────────────┘  checkout_url   └──────────────────┘  {checkout_url}   └──────────┘
       │                                                                       │
       │ redirect to Chargily hosted page                                     │
       │                                                                       ▼
       │                                                              user pays CIB/EDAHABIA
       │                                                                       │
       ▼                                                                       ▼
   payment page                                                       ┌──────────────┐
                                                                       │  chargily    │
                                                                       │  webhook     │
                                                                       │ (Edge Func)  │
                                                                       └──────┬───────┘
                                                                              │
                                                                verify HMAC   │
                                                                update DB    │
                                                                              ▼
                                                              ┌──────────────────────┐
                                                              │ coin_balances        │
                                                              │ subscriptions        │
                                                              │ payments             │
                                                              │ webhook_events       │
                                                              └──────────┬───────────┘
                                                                         │
                                                                         │ allocation
                                                                         ▼
                                                              ┌──────────────────────┐
                                                              │  pg_cron (daily)     │
                                                              │  - reset free tier   │
                                                              │  - expire grace      │
                                                              └──────────────────────┘

   ┌─────────────┐  inbound msg  ┌────────┐  call Edge   ┌──────────────────┐
   │  n8n        │ ────────────► │ deduct │ ───────────► │ deduct-coin      │
   │  AI Agent   │               │ check  │              │ (Edge Function)  │
   │             │ ◄──────────── │ node   │ ◄─────────── │ atomic UPDATE    │
   └─────────────┘  200/402      └────────┘  remaining   └──────────────────┘
        │                                          │
        │ if 200                                  │ if 402
        ▼                                          ▼
   proceed to LLM                            send fallback_message
                                             log "insufficient_coins"
```

---

## 3. Database Schema (Migration 019)

### 3.1 جدول جديد: `plans` (static config)

```sql
CREATE TABLE public.plans (
  tier           TEXT PRIMARY KEY CHECK (tier IN ('free','pro','enterprise')),
  display_name   TEXT NOT NULL,
  monthly_price  INTEGER NOT NULL,        -- DZD, no decimals
  monthly_coins  INTEGER,                 -- NULL = unlimited
  max_platforms  INTEGER NOT NULL,        -- 1 / 3 / 3
  features       JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO public.plans VALUES
  ('free',       'بداية',         500,     500,    1, '{"priority_support":false,"analytics":"basic"}'::jsonb),
  ('pro',        'نمو',          8500,    5000,    3, '{"priority_support":false,"analytics":"advanced"}'::jsonb),
  ('enterprise', 'غير محدود',   14500,    NULL,    3, '{"priority_support":true,"analytics":"full","custom_agent":true}'::jsonb);
```

### 3.2 تعديل: `clients_shops`

```sql
-- + عمود: tier_active (الحالي، قد يختلف عن subscription_tier خلال grace)
-- + عمود: current_period_end
ALTER TABLE public.clients_shops
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_in_grace        BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients_shops.current_period_end IS 'When active paid period expires; NULL = never paid';
COMMENT ON COLUMN public.clients_shops.is_in_grace IS 'True if past period end but still has access (3-day grace)';
```

`subscription_tier` (الموجود) يبقى = اسم الـ plan المسجَّل في الفاتورة.
`current_period_end` = آخر يوم يحق له استخدام الـ tier المدفوع.

### 3.3 جدول جديد: `coin_balances` (1:1 with clients_shops)

```sql
CREATE TABLE public.coin_balances (
  shop_id              UUID PRIMARY KEY REFERENCES public.clients_shops(id) ON DELETE CASCADE,
  balance              INTEGER,              -- NULL = unlimited (enterprise)
  last_allocated_at    TIMESTAMPTZ,
  last_deducted_at     TIMESTAMPTZ,
  total_earned         BIGINT NOT NULL DEFAULT 0,
  total_spent          BIGINT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT balance_non_negative CHECK (balance IS NULL OR balance >= 0)
);

COMMENT ON TABLE  public.coin_balances IS 'Current coin balance per shop. NULL = unlimited';
COMMENT ON COLUMN public.coin_balances.balance IS 'Available coins. NULL means unlimited (enterprise tier)';

-- Auto-create row on shop creation
CREATE OR REPLACE FUNCTION public.fn_init_coin_balance() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.coin_balances (shop_id, balance, last_allocated_at)
  VALUES (NEW.id, 500, now())        -- free tier starts with 500
  ON CONFLICT (shop_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_init_coin_balance
  AFTER INSERT ON public.clients_shops
  FOR EACH ROW EXECUTE FUNCTION public.fn_init_coin_balance();

-- RLS
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_read_own_balance"
  ON public.coin_balances FOR SELECT TO authenticated
  USING (auth.uid() = shop_id);
```

### 3.4 جدول جديد: `coin_transactions` (audit)

```sql
CREATE TYPE public.coin_tx_type AS ENUM (
  'allocation',      -- +N من tier renewal
  'deduction',       -- -N من inbound msg
  'refund',          -- +N (failed LLM call، manual، إلخ)
  'adjustment'       -- manual admin (support ticket)
);

CREATE TABLE public.coin_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,                    -- + أو -
  type            public.coin_tx_type NOT NULL,
  reason          TEXT,                                -- "monthly_pro_renewal" | "inbound_whatsapp" | ...
  ref_type        TEXT,                                -- 'payment' | 'conversation' | 'manual'
  ref_id          UUID,
  balance_after   INTEGER,                             -- snapshot بعد العملية
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coin_tx_shop_created ON public.coin_transactions (shop_id, created_at DESC);
CREATE INDEX idx_coin_tx_ref          ON public.coin_transactions (ref_type, ref_id);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_read_own_tx"
  ON public.coin_transactions FOR SELECT TO authenticated
  USING (auth.uid() = shop_id);

CREATE POLICY "service_role_all_tx"
  ON public.coin_transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### 3.5 جدول جديد: `payments`

```sql
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','canceled','expired');

CREATE TABLE public.payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                  UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
  chargily_checkout_id     TEXT UNIQUE,                 -- null حتى يُنشأ
  chargily_invoice_id      TEXT,
  amount                   INTEGER NOT NULL,            -- DZD
  currency                 TEXT NOT NULL DEFAULT 'dzd',
  status                   public.payment_status NOT NULL DEFAULT 'pending',
  plan_tier                TEXT NOT NULL REFERENCES public.plans(tier),
  period_days              INTEGER NOT NULL DEFAULT 30,
  period_start             TIMESTAMPTZ,
  period_end               TIMESTAMPTZ,
  customer_email           TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at                  TIMESTAMPTZ
);

CREATE INDEX idx_payments_shop_created ON public.payments (shop_id, created_at DESC);
CREATE INDEX idx_payments_status       ON public.payments (status) WHERE status = 'pending';

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_read_own_payments"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = shop_id);

CREATE POLICY "service_role_all_payments"
  ON public.payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### 3.6 جدول جديد: `webhook_events` (idempotency)

```sql
CREATE TABLE public.webhook_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source              TEXT NOT NULL,            -- 'chargily'
  event_id            TEXT NOT NULL,            -- chargily event id
  event_type          TEXT NOT NULL,            -- 'checkout.paid', 'checkout.failed', ...
  processed           BOOLEAN NOT NULL DEFAULT false,
  payload             JSONB NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ,
  error_message       TEXT,
  UNIQUE (source, event_id)
);

CREATE INDEX idx_webhook_events_unprocessed
  ON public.webhook_events (received_at) WHERE processed = false;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- لا policy لـ authenticated — service_role فقط
CREATE POLICY "service_role_all_webhooks"
  ON public.webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

---

## 4. Chargily Integration

### 4.1 API Config

```bash
# في .env (root) + supabase secrets
CHARGILY_API_KEY=charge_test_xxx          # من dashboard.chargily.com
CHARGILY_BASE_URL=https://pay.chargily.net/test/api/v2   # test
# CHARGILY_BASE_URL=https://pay.chargily.net/api/v2       # live
CHARGILY_WEBHOOK_URL=https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/chargily-webhook
```

### 4.2 Checkout Creation

**POST /checkouts** body:
```json
{
  "amount": 8500,
  "currency": "dzd",
  "success_url": "https://rahsahl.com/dashboard/billing.html?status=success",
  "failure_url": "https://rahsahl.com/dashboard/billing.html?status=failed",
  "description": "باقة نمو - 5,000 نقطة",
  "locale": "ar",
  "metadata": {
    "shop_id": "uuid",
    "plan_tier": "pro",
    "period_days": "30"
  }
}
```

Response:
```json
{ "id": "01hxxx", "url": "https://pay.chargily.dz/test/checkouts/01hxxx/pay", ... }
```

### 4.3 Webhook Events

| Event | Action |
|---|---|
| `checkout.paid` | create payment record, allocate coins, extend period |
| `checkout.failed` | mark payment failed, log |
| `checkout.canceled` | mark payment canceled, log |
| `checkout.expired` | mark payment expired, log |

**HMAC verification:** `signature` header = HMAC-SHA256(raw_body, CHARGILY_API_KEY).

### 4.4 Chargily V2 Limitations (نقاط مهمة)

- ❌ لا يوجد subscription API حقيقي — recurring = manual
- ✅ Webhooks موثوقة (3 retries) لكن **يجب** idempotency
- ✅ Checkout يدعم metadata (نخزن `shop_id`+`plan_tier`)
- ❌ لا auto-debit — العميل يجب أن يعيد الدفع يدوياً
- ⚠️ الـ amount في cents (smallest unit) — DZD عملياً بدون كسور، نرسل `8500` لـ 8,500 د.ج

---

## 5. Coin Deduction Flow (per inbound message)

```
n8n (webhook from social)
  → Step 1: Parse shop_id, sender_id
  → Step 2: HTTP POST /functions/v1/deduct-coin
              body: { shop_id, sender_id, channel: 'whatsapp' }
  
  deduct-coin Edge Function (atomic):
    BEGIN;
      SELECT balance, current_period_end
        FROM coin_balances b
        JOIN clients_shops s ON s.id = b.shop_id
        WHERE b.shop_id = $1
        FOR UPDATE;                     -- lock row
      
      -- check: enterprise (NULL balance) → allow
      -- check: current_period_end past + not in grace → deny
      -- check: balance >= 1 → allow
      
      UPDATE coin_balances
        SET balance = balance - 1,
            total_spent = total_spent + 1,
            last_deducted_at = now()
        WHERE shop_id = $1
        RETURNING balance;
      
      INSERT INTO coin_transactions (...) VALUES (...);
    COMMIT;
    
    return { ok: true, balance: 234 }   -- or { ok: false, reason: 'insufficient' }

  → Step 3a: if ok → continue to LLM
  → Step 3b: if !ok → send fallback_message, return early
```

### Race Condition Handling
- `FOR UPDATE` row lock → messages متتالية تُسلسل (لا توازي على نفس الـ shop)
- لا deadlock risk (lock على primary key واحد فقط)

### n8n Code (في node "deduct-coin")
```js
const v = $json;
const r = await this.helpers.httpRequest({
  method: 'POST',
  url: 'https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/deduct-coin',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sb_secret_xxx'
  },
  body: { shop_id: v.shop_id, sender_id: v.sender_id, channel: v.channel },
  json: true,
  timeout: 3000
});
if (!r.ok) {
  // send fallback_message via WhatsApp/Insta
  return { json: { ...v, _skip_llm: true, _reason: r.reason } };
}
return { json: { ...v, _coins_remaining: r.balance } };
```

---

## 6. Subscription Lifecycle

```
                  ┌─────────────────────────────────┐
                  │          FREE TIER              │
                  │  (default بعد signup)           │
                  │  500 coins/شهر (auto-reset)     │
                  └────────────┬────────────────────┘
                               │ click "ترقية"
                               ▼
                  ┌─────────────────────────────────┐
                  │       CHECKOUT PENDING          │
                  │  payments.status = 'pending'    │
                  │  لا تغيير على tier              │
                  └────────────┬────────────────────┘
                               │ webhook: checkout.paid
                               ▼
                  ┌─────────────────────────────────┐
                  │          PRO/ENT ACTIVE         │
                  │  subscription_tier = 'pro'      │
                  │  current_period_end = now+30d    │
                  │  coins = +5000 (مع carry-over)  │
                  └────────────┬────────────────────┘
                               │ now >= period_end - 5d
                               ▼
                  ┌─────────────────────────────────┐
                  │         RENEWAL WARNING         │
                  │  banner في dashboard:           │
                  │  "باقتك تنتهي بعد X أيام"      │
                  └────────────┬────────────────────┘
                               │ click "تجديد"
                               ▼
                          [CHECKOUT PENDING]
                               │
                               │ paid → extend period +30d
                               │ not paid → grace
                               ▼
                  ┌─────────────────────────────────┐
                  │         GRACE PERIOD            │
                  │  is_in_grace = true             │
                  │  3 أيام تحذيرات يومية          │
                  │  الخدمة تعمل                    │
                  └────────────┬────────────────────┘
                               │ grace_end exceeded
                               ▼
                  ┌─────────────────────────────────┐
                  │        DOWNGRADE TO FREE        │
                  │  subscription_tier = 'free'     │
                  │  balance = 500                  │
                  │  is_in_grace = false            │
                  │  surplus coins (e.g., 2000)     │
                  │  → preserved (loyalty reward)   │
                  └─────────────────────────────────┘
```

### Free Tier Auto-Reset (pg_cron daily)
```sql
-- كل يوم في 00:00
SELECT cron.schedule(
  'reset-free-tier-coins',
  '0 0 * * *',
  $$
  UPDATE coin_balances b
  SET balance = 500,
      last_allocated_at = now(),
      total_earned = total_earned + 500
  FROM clients_shops s
  WHERE s.id = b.shop_id
    AND s.subscription_tier = 'free'
    AND (b.last_allocated_at IS NULL 
         OR b.last_allocated_at < date_trunc('month', now()));
  $$
);
```

---

## 7. Edge Functions (4 جديدة)

### 7.1 `create-checkout`
- **Auth:** required (JWT)
- **Input:** `{ plan_tier: 'pro'|'enterprise' }`
- **Logic:**
  1. validate plan exists in `plans`
  2. INSERT into `payments` (status=pending, shop_id, amount, plan_tier)
  3. POST to Chargily `/checkouts` with metadata
  4. UPDATE payment with `chargily_checkout_id`
  5. return `{ checkout_url }`
- **Errors:** `400` (invalid plan), `401` (no auth), `502` (Chargily down)

### 7.2 `chargily-webhook`
- **Auth:** HMAC signature header
- **Input:** raw JSON body + `signature` header
- **Logic:**
  1. verify HMAC → 401 if invalid
  2. check `webhook_events (source,event_id)` → 200 if duplicate
  3. INSERT webhook_events (processed=false)
  4. switch on event type:
     - `checkout.paid` → mark payment paid, allocate coins, extend period
     - `checkout.failed/canceled/expired` → mark payment
  5. UPDATE webhook_events processed=true
  6. return 200
- **Errors:** return 200 even on processing error (log only) — to prevent infinite retries

### 7.3 `deduct-coin`
- **Auth:** service_role only (called by n8n)
- **Input:** `{ shop_id, sender_id, channel }`
- **Logic:** see Section 5
- **Returns:** `{ ok: true, balance } | { ok: false, reason }`

### 7.4 `allocate-coins` (optional, for testing/admin)
- **Auth:** service_role only
- **Input:** `{ shop_id, amount, type, reason }`
- **Logic:** direct coin_transactions insert + balance update
- **Use case:** manual top-up from support, refund

---

## 8. Frontend Changes

### 8.1 `public/dashboard/billing.html` (جديد)
- Header: الباقة الحالية + رصيد + تاريخ التجديد القادم
- Plan cards: 3 tiers، الباقة الحالية مع badge "نشط"، أزرار "ترقية/تخفيض"
- Payment history table (آخر 12 شهر)
- Usage chart (chart.js): coins spent/period
- "Top-up" button (top-up packs — Phase 2)

### 8.2 `public/index.html` (تعديل pricing section)
- يستبدل `<a href="signup.html">` بـ `<a href="login.html?next=/dashboard/billing.html?plan=pro">`
- العميل يسجل دخول أولاً ثم يضغط "ترقية"

### 8.3 `public/dashboard/sidebar.js` (إضافة menu item)
- "الفوترة" → `/dashboard/billing.html`
- أيقونة: `credit_card`

### 8.4 `public/dashboard/js/api.js` (إضافة wrappers)
```js
export async function getCoinBalance() { /* SELECT coin_balances */ }
export async function listPayments(limit=12) { /* SELECT payments */ }
export async function createCheckout(planTier) { /* POST create-checkout */ }
export async function getCurrentPlan() { /* SELECT plans WHERE tier = shop.tier */ }
```

### 8.5 Notification Banner (في كل صفحات dashboard)
- إذا `now < current_period_end - 5d`: لا banner
- إذا `now in [period_end-5d, period_end]`: "باقتك تنتهي بعد X أيام — جدد الآن"
- إذا `is_in_grace = true`: "انتهت باقتك. تجديد خلال X يوم وإلا يرجع إلى Free"
- إذا `balance = 0 AND tier = free`: "رصيدك نفد. اشحن أو ارقِ."

---

## 9. n8n Modifications

### 9.1 في `ai-sales-agent-v4.json`:
- **Insert node جديد "deduct-coin"** بعد Parse node وقبل LLM call
- Logic: see Section 5

### 9.2 Workflow جديد (اختياري): `subscription-reminder`
- Cron: daily at 09:00
- query: shops with `current_period_end between now and now+5d`
- لكل واحد: في dashboard نضع banner (لا نحتاج إرسال email)
- (email ممكن في Phase 2 مع Resend/SendGrid)

---

## 10. Edge Cases & Decisions

| الحالة | السلوك |
|---|---|
| Customer pays twice في نفس الفترة | period_end يمتد +30 من الدفع (لا من الدفع الأول) |
| Tier downgrades (pro → free) | surplus coins محفوظة، balance الجديد = max(500, current) |
| Tier upgrades (free → pro) | balance = current + 5000 (carry-over) |
| Enterprise tier | balance = NULL (unlimited، الـ deduction يكون `RETURNING NULL`) |
| Webhook arrives before user | نخصم من `coin_balances` فوراً عند signup (500/0) |
| Chargily down | Edge function يرجع 502، الـ UI يعرض "حاول لاحقاً" |
| Race: 100 رسائل | row lock يُسلسل، 99 تنتظر (acceptable) |
| Bot_settings prompt_context = '' | الـ LLM يستخدم fallback generic |
| Day boundary during cron | idempotent — month boundary check |
| User deletes account | CASCADE يحذف كل شيء (coin_balances, transactions, payments) |
| Failed payment (insufficient funds) | grace 3 days، ثم downgrade |
| Manual refund from support | `allocate-coins` Edge Function |

---

## 11. Migration Plan (الترتيب)

### Phase A: DB only (الآن)
1. `019_billing_schema.sql` — كل الجداول + triggers + RLS
2. اختبار: SELECT من الجداول، verify RLS
3. اختبار: pg_cron schedule

### Phase B: Backend logic
4. Edge Functions: `create-checkout`, `chargily-webhook`, `deduct-coin`
5. Manual tests with curl + Chargily test mode
6. n8n workflow edit: add deduct-coin node

### Phase C: Frontend
7. `billing.html` + `api.js` wrappers + sidebar menu
8. Update pricing CTAs
9. E2E: signup → upgrade → checkout (test) → webhook → balance updated

### Phase D: Hardening
10. Rate limiting على create-checkout (5/hour per shop)
11. Stripe-style webhook signature rotation
12. Admin panel for manual coin adjustments

---

## 12. Open Decisions (تحتاج قرار)

| # | السؤال | الافتراضي المقترح |
|---|---|---|
| 1 | هل الـ Free tier يحتاج payment method عند التسجيل؟ | **لا** — Free tier لا يحتاج بطاقة |
| 2 | الـ Grace period كم يوم؟ | **3 أيام** |
| 3 | عند الـ downgrade (pro→free)، هل surplus coins يبقى؟ | **نعم** (loyalty reward، يبقى رصيده) |
| 4 | عند الـ upgrade (free→pro)، هل surplus 500 coins يضاف لـ 5000؟ | **نعم** (carry-over) |
| 5 | هل نريد Top-up packs (شراء 1000 coins إضافية)؟ | **Phase 2** — بدون الآن |
| 6 | الـ reminder قبل التجديد: 5 أيام، 3 أيام، أم كلاهما؟ | **5 أيام** فقط (banner في dashboard) |
| 7 | متى نحذف Free tier القديم (الـ 500 شهرياً reset)؟ | **كل شهر** في يوم التسجيل anniversary |
| 8 | Currency display في الـ UI: "د.ج" أو "DZD" أو "DA"؟ | **د.ج** (يستخدم في landing) |
| 9 | هل ندعم annual plans (12 شهر بسعر مخفض)؟ | **لا** — Phase 2 |
| 10 | Email للـ receipt؟ Chargily يبعث default email | **نعم** — نستخدم Chargily default |

---

## 13. Cost Estimation (Chargily fees)

Chargily Pay pricing (tested values):
- **Startup plan:** 0% commission (first 300 txn/month)
- **Comfort plan:** 1.25% (min 12.5 DZD, max 1,250 DZD)
- **Supreme plan:** 2.5% (min 25 DZD, max 2,500 DZD)

أمثلة:
- Pro tier (8,500 د.ج): fee = 8,500 × 0.0125 = **106.25 د.ج** per transaction
- Enterprise (14,500 د.ج): fee = 14,500 × 0.0125 = **181.25 د.ج**
- Net revenue Pro: 8,393.75 د.ج
- Net revenue Enterprise: 14,318.75 د.ج

(تأكد من الـ pricing الحالي من https://chargily.com/dz/business/pay/pricing)

---

## 14. Files to Create/Modify

### جديد:
- `supabase/migrations/019_billing_schema.sql`
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/chargily-webhook/index.ts`
- `supabase/functions/deduct-coin/index.ts`
- `supabase/functions/allocate-coins/index.ts`
- `public/dashboard/billing.html`
- `public/dashboard/js/billing.js`

### تعديل:
- `public/index.html` (pricing CTAs)
- `public/dashboard/sidebar.js` (menu item)
- `public/dashboard/js/api.js` (wrappers)
- `scripts/n8n/workflows/ai-sales-agent-v4.json` (deduct-coin node)
- `.env` (CHARGILY_* vars)
- `docs/billing-system.md` (هذا الملف — يُحدّث بعد الـ build)

---

## 15. المراجع

- [Chargily Pay V2 Docs](https://dev.chargily.com/pay-v2/introduction)
- [Chargily Webhooks](https://dev.chargily.com/pay-v2/webhooks)
- [Chargily Pricing](https://chargily.com/dz/business/pay/pricing)
- [Chargily Test Mode](https://dev.chargily.com/pay-v2/test-and-live-mode)

---

> **التالي:** مراجعة الوثيقة + الإجابة على Open Decisions + قرار البدء في Phase A
