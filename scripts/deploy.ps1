# deploy.ps1 — نشر جميع التغييرات على Supabase + n8n
# استخدم PowerShell 7+ (pwsh)

# ============================================================
# المتطلبات
# ============================================================
# 1. قم بتثبيت Supabase CLI: npm install -g supabase
# 2. سجل الدخول: supabase login
# 3. اربط المشروع: supabase link --project-ref rvjsnkolroaakskvvwnv
# 4. تأكد من وجود .env مع المتغيرات الصحيحة

Write-Host "=== نشر RahSahl v5 ===" -ForegroundColor Cyan

# ============================================================
# 1. نشر الترحيل (Migration)
# ============================================================
Write-Host "`n[1/4] نشر الترحيل 019..." -ForegroundColor Yellow
# الخيار 1: عبر CLI
# supabase db push

# الخيار 2: نسخ SQL ولصقه في Dashboard SQL Editor
Write-Host "افتح: https://supabase.com/dashboard/project/rvjsnkolroaakskvvwnv/sql/new" -ForegroundColor Magenta
Write-Host "والصق محتوى: supabase/migrations/019_billing_outbox_schema.sql" -ForegroundColor Magenta

# ============================================================
# 2. نشر Edge Functions
# ============================================================
Write-Host "`n[2/4] نشر Edge Functions..." -ForegroundColor Yellow

$functions = @(
    "outbox-processor",
    "coin-deduct",
    "create-checkout",
    "chargily-webhook"
)

foreach ($fn in $functions) {
    Write-Host "  → نشر $fn ..." -ForegroundColor Yellow
    supabase functions deploy $fn --project-ref rvjsnkolroaakskvvwnv
}

# تعيين المتغيرات السرية لكل الوظائف
Write-Host "`n  تعيين المتغيرات السرية..." -ForegroundColor Yellow
supabase secrets set --project-ref rvjsnkolroaakskvvwnv `
    SERVICE_KEY=your_supabase_service_role_key `
    HMAC_MASTER_KEY=o9ZaZ3jIYP81jCxq6pQl48xQO6ESJWxeVe50QbDxExg= `
    CHARGILY_API_KEY=charge_test_xxx `
    CHARGILY_BASE_URL=https://pay.chargily.net/test/api/v2 `
    SUPABASE_URL=https://rvjsnkolroaakskvvwnv.supabase.co `
    SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2anNua29scm9hYXNrc3Z2d252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyOTQ5NTgsImV4cCI6MjA2MDg3MDk1OH0.ujIk6lTLh3EeKqkOLvFVMx6w1rWzzmNiBKfVqF2I9rE `
    SUCCESS_URL=https://rahsahl.com/dashboard/billing.html?status=success `
    FAILURE_URL=https://rahsahl.com/dashboard/billing.html?status=failed

# ============================================================
# 3. رفع n8n workflow v5
# ============================================================
Write-Host "`n[3/4] رفع n8n workflow v5..." -ForegroundColor Yellow
Write-Host "افتح n8n UI: http://ec2-34-228-227-112.compute-1.amazonaws.com:80" -ForegroundColor Magenta
Write-Host "قم باستيراد: scripts/n8n/workflows/ai-sales-agent-v5.json" -ForegroundColor Magenta
Write-Host "فعّل workflow v5 وعلّق v4" -ForegroundColor Magenta

# ============================================================
# 4. اختبار
# ============================================================
Write-Host "`n[4/4] اختبار..." -ForegroundColor Yellow
Write-Host "1. تحقق من الجداول: supabase/dashboard/project/rvjsnkolroaakskvvwnv/editor" -ForegroundColor Magenta
Write-Host "2. اختبر دالة السعر المخصص: SELECT * FROM fn_calculate_custom_price(5000);" -ForegroundColor Magenta
Write-Host "3. اختبر دالة الخصم: SELECT fn_deduct_coin('<shop_uuid>', 'test', 'instagram');" -ForegroundColor Magenta
Write-Host "4. اختبر شراء باقة عبر: /dashboard/billing.html" -ForegroundColor Magenta

Write-Host "`n=== تم ===" -ForegroundColor Green
