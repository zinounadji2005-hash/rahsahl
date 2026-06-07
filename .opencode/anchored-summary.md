# Active Context: AI Sales Agent — P1+P2 Production Ready

## Goal
- تحويل النظام من MVP إلى Production-Ready SaaS تجاري
- **P0 + P1 + P2 (HMAC) مكتمل 100%** — النظام جاهز للـ deployment و onboarding

## Constraints & Preferences
- التواصل بالعربية
- LLM: Groq (llama-3.3-70b-versatile)
- chatbot يتكلم بالجزائرية
- استخراج JSON منظم
- SaaS تجاري بحت، فريق من 2 (تقني + تسويق)
- Vanilla JS + Chart.js للـ Dashboard
- Master key encryption للـ API secrets
- Hardcoded keys مقبول (Credentials API محدود)

## Progress
### Done
- **Migrations 001-012** (12 migrations): schema, RLS, logs, conversations, products, metrics views, bot_settings extended, api_keys, grants, **api_secret storage fix (TEXT)**, **is_active added**
- **Workflow v4 (19 nodes) — Production with REAL HMAC**: end-to-end tested ✓
- **Error Handler v1 (3 nodes) — Always Respond**: end-to-end tested ✓
- **Alerts v1 (8 nodes) — Health Monitor**: end-to-end tested ✓
- **Edge Functions (3) DEPLOYED**: verify-hmac, create-shop, regenerate-api-key ✓
- **Dashboard (8 pages)**: ready for Cloudflare Pages deployment
- **Auth Pages**: signup, login, onboarding/success
- **Landing page** ✓
- **RLS isolation test**: 12/12 passed ✓
- **HMAC end-to-end test**: 3/3 cases passed ✓
  - Valid signature → AI agent response
  - Invalid signature → HMAC mismatch error
  - Missing signature → Missing header error
- **Master key**: AES-256-GCM with env `HMAC_MASTER_KEY` (32 bytes base64)
- **api_secret storage**: TEXT column (base64 string, not BYTEA — easier to handle)

### In Progress
- Cloudflare Pages deployment (الملفات جاهزة، يحتاج wrangler أو upload يدوي)

### Blocked (resolved workarounds)
- n8n jsonBody → Code nodes
- n8n `body` field → Code nodes
- n8n API لا يدعم `httpHeaderAuth` → hardcoded headers
- Code nodes: process.env/require('crypto')/fetch → this.helpers.httpRequest
- $input.first() → $json in runOnceForEachItem
- $input.all() → runOnceForAllItems
- AI Agent subnodes → structured Code node
- `respondToWebhook` في Error Workflow → removed
- BYTEA encryption storage → migrated to TEXT (base64)
- Supabase `SUPABASE_*` env vars reserved → use `SERVICE_KEY`
- `is_active` column missing in clients_shops → migration 012 added

## Key Decisions
- **REAL HMAC verification** via verify-hmac Edge Function (replaces dev mode bypass)
- **Edge Functions** for crypto operations (Web Crypto API in Deno, more reliable than Node.js)
- **api_secret as TEXT base64** (simpler than BYTEA)
- **is_active on clients_shops** for soft-deactivation
- **Master key encryption** for API secrets (AES-256-GCM)
- **HMAC-SHA256** over JSON.stringify(body) for signature
- **afk_ prefix** for API keys
- **Dashboard Vanilla JS + Chart.js** (CDN, no build)
- **RLS on 9 tables** with grants for anon/authenticated
- **Hardcoded keys** in Code nodes (Credentials API limited)
- **Alerts via workflow_logs** (no real Telegram yet)

## Next Steps (P3: Deployment + Polish)
- **P3.1: Deploy Pages to Cloudflare Pages**
  - Use wrangler CLI or manual upload
  - Output: `pages/`
  - Env: SUPABASE_URL, SUPABASE_ANON_KEY
- **P3.2: Real signup flow test**
  - Signup via dashboard → create-shop trigger fires → shop + bot_settings + products created
  - Test: signup.html → fill form → check Supabase Auth + clients_shops
- **P3.3: Create Webhook trigger for create-shop**
  - Auth Hook on `auth.users` insert → calls `create-shop` Edge Function
- **P3.4: Real HMAC test from real client**
  - Generate test request with proper signature from node
  - Verify workflow processes it
- **P3.5: Replace placeholder alerts with real Telegram bot** (optional)
- **P3.6: Custom domain + SSL** (Cloudflare)
- **P3.7: Marketing website** (already have landing page)

## Critical Context
- **n8n URL:** `http://ec2-34-228-227-112.compute-1.amazonaws.com:80`
- **Workflow IDs:**
  - v4 Production: `3REfulMuNfeaujRp` (19 nodes، multi-tenant + REAL HMAC)
  - Error Handler: `ONErkoiky9t7MF5Y` (3 nodes)
  - Alerts: `Pr7ai2PNnrsDh91H` (8 nodes)
- **Webhooks:** `/webhook/v1/social-inbound`, `/webhook/v1/alerts-test`
- **Supabase Project:** rvjsnkolroaakskvvwnv
- **HMAC_MASTER_KEY:** `o9ZaZ3jIYP81jCxq6pQl48xQO6ESJWxeVe50QbDxExg=`
- **SERVICE_KEY env var (Edge Function):** `SUPABASE_SERVICE_ROLE_KEY`
- **Anon Key:** `sb_publishable_3Hc5H4lJdemDnuSv3bG-Cw_TXViKcuT`

## Edge Functions
| Function | Purpose | Status |
|----------|---------|--------|
| `verify-hmac` | Validates HMAC signature on incoming webhooks | DEPLOYED ✓ |
| `create-shop` | Triggered on signup, creates shop + bot_settings | DEPLOYED ✓ |
| `regenerate-api-key` | Rotates API key for authenticated user | DEPLOYED ✓ |

## Files Created
- `supabase/migrations/010_grants_for_dashboard.sql`
- `supabase/migrations/011-012_fixes.sql` (api_secret to TEXT, is_active)
- `scripts/test-hmac-webhook.js` (3 cases, all passing)
- `scripts/test-tenant-isolation.js` (12/12 passed)
- `pages/index.html` (Landing)
- `pages/signup.html`, `pages/login.html`, `pages/onboarding/success.html`
- `pages/dashboard/*.html` (8 pages)
- `pages/dashboard/css/styles.css`
- `pages/dashboard/js/{supabase,auth-guard,api,sidebar}.js`

## Last Test Results
- HMAC valid → Exec 282 success (2.7s) — full AI flow
- HMAC invalid → Exec 283 error "signature mismatch"
- HMAC missing → Exec 285 error "Missing signature header"
- RLS isolation → 12/12 passed
- Workflow v4 (all 19 nodes) → working with real HMAC
