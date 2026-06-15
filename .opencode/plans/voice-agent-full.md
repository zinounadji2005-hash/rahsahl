# AI Voice Agent — خطة التنفيذ الكاملة

## 1. SQL Migration: `supabase/migrations/026_voice_agent_schema.sql`

```sql
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

-- Triggers
CREATE TRIGGER set_voice_agent_config_updated_at
    BEFORE UPDATE ON public.voice_agent_config
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_voice_calls_updated_at
    BEFORE UPDATE ON public.voice_calls
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
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

-- Grants
GRANT ALL ON public.voice_agent_config TO service_role;
GRANT ALL ON public.voice_calls TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.voice_agent_config TO authenticated;
GRANT SELECT ON public.voice_calls TO authenticated;
```

## 2. Edge Function: `supabase/functions/voice-webhook/index.ts`

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const event = body.event; // call_started, call_ended
    const callData = body.data;

    if (event === "call_started") {
      // Find shop by the called Twilio number
      const toNumber = callData.to_number;
      const { data: config } = await supabase
        .from("voice_agent_config")
        .select("shop_id")
        .eq("twilio_phone_number", toNumber)
        .single();

      if (!config) {
        return new Response(JSON.stringify({ error: "no_shop_found" }), { status: 404, headers: CORS });
      }

      await supabase.from("voice_calls").insert({
        shop_id: config.shop_id,
        call_id: callData.call_id,
        direction: "inbound",
        from_number: callData.from_number,
        to_number: toNumber,
        status: "ongoing",
        metadata: callData.metadata || {},
      });
    }

    if (event === "call_ended") {
      await supabase.from("voice_calls").update({
        status: "ended",
        duration_ms: callData.duration_ms,
        transcript: callData.transcript,
        transcript_summary: callData.transcript_summary,
        recording_url: callData.recording_url,
        disconnection_reason: callData.disconnection_reason,
        updated_at: new Date().toISOString(),
      }).eq("call_id", callData.call_id);

      // Also log to conversations table for unified history
      const { data: call } = await supabase
        .from("voice_calls")
        .select("shop_id, transcript_summary")
        .eq("call_id", callData.call_id)
        .single();

      if (call && callData.transcript_summary) {
        await supabase.from("conversations").insert({
          shop_id: call.shop_id,
          channel: "voice",
          sender_id: "voice_agent",
          message: "📞 " + callData.transcript_summary,
          is_from_shop: false,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
```

## 3. Dashboard API: إضافات لـ `public/dashboard/js/api.js`

أضف قبل سطر `window.RahSahl = window.RahSahl || {};`:

```js
    // -------- Voice Agent --------
    getVoiceConfig: function () {
      var id = activeShopId();
      if (!id) return Promise.resolve({ error: { message: 'no shop_id' }, data: null });
      return client().from('voice_agent_config')
        .select('*')
        .eq('shop_id', id)
        .maybeSingle();
    },

    saveVoiceConfig: function (config) {
      var id = activeShopId();
      if (!id) return Promise.resolve({ error: { message: 'no shop_id' }, data: null });
      return client().from('voice_agent_config').upsert({
        shop_id: id,
        is_active: config.is_active,
        language: config.language || 'ar',
        welcome_message: config.welcome_message || null,
        business_hours: config.business_hours || null,
        transfer_phone_number: config.transfer_phone_number || null,
        metadata: config.metadata || null,
      }, { onConflict: 'shop_id' }).select().maybeSingle();
    },

    listVoiceCalls: function (opts) {
      var id = activeShopId();
      if (!id) return Promise.resolve({ error: { message: 'no shop_id' }, data: null });
      var q = client().from('voice_calls')
        .select('*')
        .eq('shop_id', id)
        .order('created_at', { ascending: false });
      if (opts && opts.limit) q = q.limit(opts.limit);
      return q;
    },
```

## 4. الترجمات: إضافات لـ `public/dashboard/js/lang.js`

أضف قبل سطر 'wa.setup':

```js
    'nav.voice':        { ar: 'الاتصال الصوتي', fr: 'Appel vocal', en: 'Voice Call' },
```

وأضف قبل آخر `};`:

```js
    // ---- Voice Agent ----
    'voice.title':           { ar: 'الوكيل الصوتي الذكي', fr: 'Agent vocal AI', en: 'AI Voice Agent' },
    'voice.subtitle':        { ar: 'الرد على المكالمات تلقائياً عبر الذكاء الاصطناعي', fr: 'Répondez aux appels automatiquement avec l\'IA', en: 'Answer calls automatically with AI' },
    'voice.activate':        { ar: 'تفعيل الوكيل الصوتي', fr: 'Activer l\'agent vocal', en: 'Activate Voice Agent' },
    'voice.deactivate':      { ar: 'إلغاء التفعيل', fr: 'Désactiver', en: 'Deactivate' },
    'voice.language':        { ar: 'لغة المحادثة', fr: 'Langue de conversation', en: 'Conversation Language' },
    'voice.welcome':         { ar: 'رسالة الترحيب', fr: 'Message d\'accueil', en: 'Welcome Message' },
    'voice.business-hours':  { ar: 'أوقات العمل', fr: 'Heures d\'ouverture', en: 'Business Hours' },
    'voice.transfer-number': { ar: 'رقم التحويل للبشري', fr: 'Numéro de transfert', en: 'Transfer Phone Number' },
    'voice.phone-number':    { ar: 'رقم الهاتف المخصص', fr: 'Numéro attribué', en: 'Assigned Phone Number' },
    'voice.connected':       { ar: 'الوكيل الصوتي نشط', fr: 'Agent vocal actif', en: 'Voice Agent Active' },
    'voice.not-connected':   { ar: 'الوكيل الصوتي غير نشط', fr: 'Agent vocal inactif', en: 'Voice Agent Inactive' },
    'voice.calls':           { ar: 'سجل المكالمات', fr: 'Historique des appels', en: 'Call History' },
    'voice.duration':        { ar: 'المدة', fr: 'Durée', en: 'Duration' },
    'voice.status':          { ar: 'الحالة', fr: 'Statut', en: 'Status' },
    'voice.recording':       { ar: 'تسجيل', fr: 'Enregistrement', en: 'Recording' },
    'voice.inbound':         { ar: 'وارد', fr: 'Entrant', en: 'Inbound' },
    'voice.outbound':        { ar: 'صادر', fr: 'Sortant', en: 'Outbound' },
    'voice.ongoing':         { ar: 'قيد التقدم', fr: 'En cours', en: 'Ongoing' },
    'voice.ended':           { ar: 'منتهية', fr: 'Terminé', en: 'Ended' },
    'voice.failed':          { ar: 'فشلت', fr: 'Échoué', en: 'Failed' },
    'voice.registered':      { ar: 'مسجلة', fr: 'Enregistré', en: 'Registered' },
    'voice.saved':           { ar: 'تم حفظ إعدادات الصوت', fr: 'Paramètres vocaux enregistrés', en: 'Voice settings saved' },
    'voice.saving':          { ar: 'جاري الحفظ...', fr: 'Enregistrement...', en: 'Saving...' },
```

## 5. Sidebar: تعديل `public/dashboard/js/sidebar.js`

في `NAV_ITEMS`، أضف بعد سطر `billing`:

```js
    { key: 'voice', href: 'voice.html', icon: 'call', tKey: 'nav.voice' },
```

## 6. صفحة Dashboard: `public/dashboard/voice.html`

```html
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <meta name="theme-color" content="#f5f0eb">
  <title>الوكيل الصوتي — RahSahl</title>
  <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  <link href="css/styles.css" rel="stylesheet"/>
  <script>tailwind.config={darkMode:'class',theme:{extend:{colors:{navy:'#0b1420',sky:'#0ea5e9',amber:'#f59e0b',teal:'#14b8a6'},fontFamily:{ar:['IBM Plex Sans Arabic','sans-serif'],en:['Inter','sans-serif']},animation:{blob:'blob 7s infinite','fade-up':'fadeUp 0.6s ease-out forwards'},keyframes:{blob:{'0%,100%':{transform:'translate(0,0) scale(1)'},'33%':{transform:'translate(30px,-50px) scale(1.1)'},'66%':{transform:'translate(-20px,20px) scale(0.9)'}},fadeUp:{'0%':{opacity:'0',transform:'translateY(30px)'},'100%':{opacity:'1',transform:'translateY(0)'}}}}}}}</script>
  <style>
    *{scroll-behavior:smooth}
    ::-webkit-scrollbar{width:6px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:var(--card-border);border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:var(--muted)}
    :root{--bg:#f5f0eb;--text:#334155;--heading:#0b1420;--muted:#64748b;--muted-400:#94a3b8;--card:#fff;--card-border:#e2e8f0;--card-hover-border:#cbd5e1;--section-alt:#fff;--nav-bg:rgba(255,255,255,0.85);--nav-border:#e2e8f0;--input-bg:#fff;--input-border:#e2e8f0;--soft-sky:#e0f2fe;--soft-teal:#ccfbf1;--soft-amber:#fef3c7;--chart-grid:#e2e8f0;--social-bg:rgba(0,0,0,0.05);--soft-slate:#f8fafc;--border-light:#e2e8f0;--hover-bg:rgba(14,165,233,0.04)}
    html.dark{--bg:#0b1420;--text:#dbe2f5;--heading:#f1f5f9;--muted:#88929b;--muted-400:#6b7a8a;--card:#18202d;--card-border:#2d3543;--card-hover-border:#3e4850;--section-alt:#0b1420;--nav-bg:rgba(11,20,32,0.85);--nav-border:#2d3543;--input-bg:#141c29;--input-border:#3e4850;--soft-sky:rgba(14,165,233,0.12);--soft-teal:rgba(20,184,166,0.12);--soft-amber:rgba(245,158,11,0.12);--chart-grid:#2d3543;--social-bg:rgba(255,255,255,0.08);--soft-slate:#141c29;--border-light:#2d3543;--hover-bg:rgba(14,165,233,0.08)}
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);transition:background 0.3s,color 0.3s}
    h1,h2,h3,h4{font-family:'IBM Plex Sans Arabic',sans-serif;color:var(--heading)}
    .card{background:var(--card);border:1px solid var(--card-border);border-radius:16px;transition:all 0.3s ease}
    .card:hover{box-shadow:0 12px 40px rgba(0,0,0,0.06);border-color:var(--card-hover-border);transform:translateY(-2px)}
    .btn-primary{background:linear-gradient(135deg,#0ea5e9,#14b8a6);color:#fff;transition:all 0.3s;position:relative;overflow:hidden}
    .btn-primary::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,#14b8a6,#0ea5e9);opacity:0;transition:opacity 0.3s}
    .btn-primary:hover::after{opacity:1}
    .btn-primary:hover{box-shadow:0 8px 25px rgba(14,165,233,0.35);transform:translateY(-2px)}
    .btn-primary:active{transform:translateY(0)}
    .btn-primary > *{position:relative;z-index:1}
    .btn-outline{border:1px solid var(--card-border);color:var(--text);transition:all 0.2s;border-radius:12px}
    .btn-outline:hover{border-color:#0ea5e9;color:#0ea5e9;background:var(--hover-bg);transform:translateY(-1px)}
    .btn-secondary{background:var(--soft-slate);color:var(--text);border:1px solid var(--card-border);transition:all 0.2s;border-radius:12px;display:inline-flex;align-items:center;gap:6px;padding:8px 18px;font-size:13px;font-weight:600}
    .btn-secondary:hover{background:var(--hover-bg);color:#0ea5e9;border-color:#0ea5e9;transform:translateY(-1px)}
    .gradient-text{background:linear-gradient(135deg,#0ea5e9,#14b8a6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .text-muted{color:var(--muted)}.text-heading{color:var(--heading)}
    .tab-btn{padding:10px 20px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.2s;border:none;background:transparent;color:var(--muted)}
    .tab-btn.active{background:var(--soft-sky);color:#0ea5e9}
    .tab-btn:hover{background:var(--hover-bg)}
  </style>
</head>
<body>
  <div class="flex min-h-screen">
    <aside id="sidebar" class="w-64 shrink-0 min-h-screen sticky top-0 flex flex-col border-l" style="background:var(--card);border-color:var(--card-border)"></aside>
    <main id="main" class="flex-1 p-6 md:p-10 overflow-x-hidden" style="background:var(--bg);min-height:100vh"></main>
  </div>
  <script src="js/supabase.js"></script>
  <script src="js/auth-guard.js"></script>
  <script src="js/lang.js"></script>
  <script src="js/sidebar.js"></script>
  <script src="js/api.js"></script>
  <script>
    (async function () {
      try {
        var ctx = await window.RahSahl.authGuard.requireAuth();
        var sid = window.RahSahl.sidebar;
        var L = window.RahSahl.lang;
        var api = window.RahSahl.api;
        var __ = L.t.bind(L);

        window.RahSahl.sidebarCtx = ctx;
        document.getElementById('sidebar').innerHTML = sid.renderSidebar(ctx);
        sid.bindChrome();

        var activeTab = 'config';
        var state = { config: null, calls: [] };

        function renderTopbar() {
          var ownerName = ctx && ctx.shop ? ctx.shop.owner_name : '';
          document.getElementById('main').innerHTML = ''
            + '<header class="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-8">'
            + '  <div>'
            + '    <h1 class="font-ar text-[26px] md:text-[30px] font-bold text-navy mb-1">' + __('voice.title') + '</h1>'
            + '    <p class="text-[15px] md:text-[16px]" style="color:var(--muted)">' + __('voice.subtitle') + '</p>'
            + '  </div>'
            + '  <div class="flex items-center gap-3">'
            + '    <div class="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl" style="background:var(--soft-slate)">'
            + '      <span class="material-symbols-outlined text-[18px]" style="color:var(--muted)">person</span>'
            + '      <span class="text-[13px] font-semibold">' + ownerName + '</span>'
            + '    </div>'
            + '  </div>'
            + '</header>'
            + '<div class="flex gap-2 mb-6">'
            + '  <button class="tab-btn' + (activeTab === 'config' ? ' active' : '') + '" data-tab="config"><span class="material-symbols-outlined text-[18px] align-middle ml-1">settings</span>' + __('nav.settings') + '</button>'
            + '  <button class="tab-btn' + (activeTab === 'calls' ? ' active' : '') + '" data-tab="calls"><span class="material-symbols-outlined text-[18px] align-middle ml-1">history</span>' + __('voice.calls') + '</button>'
            + '</div>'
            + '<div id="tabContent"></div>';
          document.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
              activeTab = this.dataset.tab;
              renderTab();
            });
          });
        }

        function renderTab() {
          if (activeTab === 'config') renderConfig();
          else renderCalls();
        }

        function renderConfig() {
          var c = state.config || {};
          var isActive = c.is_active || false;
          var el = document.getElementById('tabContent');
          el.innerHTML = ''
            + '<div class="card p-6">'
            + '  <div class="flex items-center justify-between mb-6">'
            + '    <div>'
            + '      <h3 class="font-ar text-[18px] font-bold mb-1">' + __('voice.title') + '</h3>'
            + '      <p class="text-[13px]" style="color:var(--muted)">' + (isActive ? __('voice.connected') : __('voice.not-connected')) + '</p>'
            + '    </div>'
            + '    <label class="relative inline-flex items-center cursor-pointer">'
            + '      <input type="checkbox" id="voiceToggle" class="sr-only peer"' + (isActive ? ' checked' : '') + '>'
            + '      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-500"></div>'
            + '    </label>'
            + '  </div>'
            + '  <form id="voiceForm" class="space-y-5">'
            + '    <div>'
            + '      <label class="block text-[13px] font-semibold mb-1.5">' + __('voice.language') + '</label>'
            + '      <select id="voiceLang" class="w-full rounded-xl px-3 py-2.5 text-[14px] border" style="background:var(--input-bg);color:var(--text);border-color:var(--input-border)">'
            + '        <option value="ar"' + (c.language === 'ar' ? ' selected' : '') + '>العربية</option>'
            + '        <option value="fr"' + (c.language === 'fr' ? ' selected' : '') + '>Français</option>'
            + '        <option value="ar+fr"' + (c.language === 'ar+fr' ? ' selected' : '') + '>عربية + فرنسية</option>'
            + '      </select>'
            + '    </div>'
            + '    <div>'
            + '      <label class="block text-[13px] font-semibold mb-1.5">' + __('voice.welcome') + '</label>'
            + '      <textarea id="voiceWelcome" rows="3" class="w-full rounded-xl px-3 py-2.5 text-[14px] border resize-none" style="background:var(--input-bg);color:var(--text);border-color:var(--input-border);font-family:\'IBM Plex Sans Arabic\',sans-serif">' + (c.welcome_message || '') + '</textarea>'
            + '    </div>'
            + '    <div>'
            + '      <label class="block text-[13px] font-semibold mb-1.5">' + __('voice.transfer-number') + '</label>'
            + '      <input id="voiceTransfer" type="text" class="w-full rounded-xl px-3 py-2.5 text-[14px] border" style="background:var(--input-bg);color:var(--text);border-color:var(--input-border)" value="' + (c.transfer_phone_number || '') + '" dir="ltr">'
            + '    </div>'
            + (c.twilio_phone_number ? '<div><label class="block text-[13px] font-semibold mb-1.5">' + __('voice.phone-number') + '</label><p class="text-[16px] font-bold" dir="ltr" style="color:var(--heading)">' + c.twilio_phone_number + '</p></div>' : '')
            + '    <button type="submit" class="btn-primary px-6 py-2.5 rounded-xl font-semibold text-[14px]">' + __('voice.saving') + '</button>'
            + '  </form>'
            + '</div>';

          document.getElementById('voiceForm').addEventListener('submit', saveConfig);
          document.getElementById('voiceToggle').addEventListener('change', toggleVoice);
        }

        async function toggleVoice(e) {
          var active = e.target.checked;
          var { error } = await api.saveVoiceConfig({ is_active: active });
          if (error) { showToast(__('general.error'), 'error'); e.target.checked = !active; return; }
          state.config.is_active = active;
          renderConfig();
          showToast(active ? __('voice.connected') : __('voice.not-connected'), 'success');
        }

        async function saveConfig(e) {
          e.preventDefault();
          var btn = e.target.querySelector('button[type="submit"]');
          btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin align-middle">progress_activity</span> ' + __('voice.saving');
          var { error } = await api.saveVoiceConfig({
            is_active: state.config ? state.config.is_active : false,
            language: document.getElementById('voiceLang').value,
            welcome_message: document.getElementById('voiceWelcome').value,
            transfer_phone_number: document.getElementById('voiceTransfer').value,
          });
          btn.disabled = false; btn.innerHTML = __('nav.settings');
          if (error) { showToast(__('general.error') + ': ' + error.message, 'error'); return; }
          showToast(__('voice.saved'), 'success');
          await loadConfig();
        }

        function renderCalls() {
          var el = document.getElementById('tabContent');
          if (!state.calls || state.calls.length === 0) {
            el.innerHTML = '<div class="card p-8 text-center"><p class="text-[14px]" style="color:var(--muted)">' + __('general.no-data') + '</p></div>';
            return;
          }
          var rows = state.calls.map(function (c) {
            var statusColor = c.status === 'ended' ? 'text-teal-600 bg-teal-50' : c.status === 'failed' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50';
            var dirIcon = c.direction === 'inbound' ? 'call_received' : 'call_made';
            var dur = c.duration_ms ? (c.duration_ms / 1000).toFixed(0) + 's' : '-';
            return '<tr>'
              + '<td class="px-4 py-3 whitespace-nowrap"><span class="material-symbols-outlined text-[18px] align-middle ml-1" style="color:var(--muted)">' + dirIcon + '</span><span class="text-[13px]">' + (c.direction === 'inbound' ? __('voice.inbound') : __('voice.outbound')) + '</span></td>'
              + '<td class="px-4 py-3 whitespace-nowrap text-[13px]" dir="ltr">' + c.from_number + '</td>'
              + '<td class="px-4 py-3 whitespace-nowrap text-[13px]" dir="ltr">' + c.to_number + '</td>'
              + '<td class="px-4 py-3 whitespace-nowrap text-[13px]">' + dur + '</td>'
              + '<td class="px-4 py-3 whitespace-nowrap"><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ' + statusColor + '">' + (__('voice.' + c.status) || c.status) + '</span></td>'
              + (c.recording_url ? '<td class="px-4 py-3 whitespace-nowrap"><a href="' + c.recording_url + '" target="_blank" class="text-sky-600 text-[13px]">' + __('voice.recording') + '</a></td>' : '<td class="px-4 py-3 text-[13px]" style="color:var(--muted)">-</td>')
              + '<td class="px-4 py-3 whitespace-nowrap text-[12px]" style="color:var(--muted)">' + new Date(c.created_at).toLocaleString('ar-DZ') + '</td>'
              + '</tr>';
          }).join('');
          el.innerHTML = ''
            + '<div class="card overflow-hidden">'
            + '  <div class="overflow-x-auto">'
            + '    <table class="w-full text-right">'
            + '      <thead><tr class="border-b" style="border-color:var(--card-border)">'
            + '        <th class="px-4 py-3 text-[12px] font-semibold uppercase" style="color:var(--muted)">' + __('voice.calls') + '</th>'
            + '        <th class="px-4 py-3 text-[12px] font-semibold uppercase" style="color:var(--muted)">من</th>'
            + '        <th class="px-4 py-3 text-[12px] font-semibold uppercase" style="color:var(--muted)">إلى</th>'
            + '        <th class="px-4 py-3 text-[12px] font-semibold uppercase" style="color:var(--muted)">' + __('voice.duration') + '</th>'
            + '        <th class="px-4 py-3 text-[12px] font-semibold uppercase" style="color:var(--muted)">' + __('voice.status') + '</th>'
            + '        <th class="px-4 py-3 text-[12px] font-semibold uppercase" style="color:var(--muted)">' + __('voice.recording') + '</th>'
            + '        <th class="px-4 py-3 text-[12px] font-semibold uppercase" style="color:var(--muted)">التاريخ</th>'
            + '      </tr></thead>'
            + '      <tbody>' + rows + '</tbody>'
            + '    </table>'
            + '  </div>'
            + '</div>';
        }

        async function loadConfig() {
          var { data, error } = await api.getVoiceConfig();
          if (!error && data) state.config = data;
          else state.config = {};
        }

        async function loadCalls() {
          var { data, error } = await api.listVoiceCalls({ limit: 50 });
          if (!error && data) state.calls = data;
        }

        function showToast(msg, type) {
          var t = window.RahSahl && window.RahSahl.sidebar;
          if (t && t.toast) t.toast(msg, type);
          else alert(msg);
        }

        await loadConfig();
        await loadCalls();
        renderTopbar();
        renderConfig();
      } catch (e) { if (window.RahSahl?.sidebar?.toast) window.RahSahl.sidebar.toast(e.message || 'Error', 'error'); else console.error(e); }
    })();
  </script>
</body>
</html>
```

## 7. Environment Variables (Supabase Secrets)

```bash
supabase secrets set --project-ref rvjsnkolroaakskvvwnv \
    RETELL_API_KEY=your_retell_api_key \
    RETELL_API_URL=https://api.retellai.com \
    TWILIO_ACCOUNT_SID=your_twilio_sid \
    TWILIO_AUTH_TOKEN=your_twilio_token
```

## 8. Edge Function for Agent Setup: `supabase/functions/voice-agent-setup/index.ts`

لو حابين نضيف إمكانية إنشاء agent في Retell AI آلياً.

## 9. n8n Workflow (اختياري)

يمكن استخدام n8n كبديل عن Edge Function للـ webhook إذا حبيت.

---

## خطوات التنفيذ

1. تشغيل SQL migration 026 في Supabase
2. نشر Edge Function `voice-webhook`
3. تعيين المتغيرات السرية
4. فتح حساب Retell AI + إنشاء Agent يدوي (أول مرة)
5. ربط Twilio phone number بـ Retell AI
6. ربط Retell AI webhook ← Edge Function URL
7. تحديث Dashboard (sidebar.js + api.js + lang.js + voice.html)
8. نشر Cloudflare Pages
9. اختبار: مكالمة واردة → تسجيل في voice_calls
