// supabase/functions/create-shop/index.ts
// Triggered when a new user signs up via Supabase Auth.
// Creates clients_shops row, generates encrypted API secret, sets default bot_settings + products.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_MASTER_KEY = Deno.env.get("HMAC_MASTER_KEY")!;

// AES-256-GCM encrypt helper
async function encryptSecret(plaintext: string, masterKeyB64: string): Promise<Uint8Array> {
  const masterKey = Uint8Array.from(atob(masterKeyB64), c => c.charCodeAt(0));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw", masterKey,
    { name: "AES-GCM" }, false, ["encrypt"]
  );
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // Return: [iv (12 bytes) | ciphertext]
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);
  return result;
}

function generateApiSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "afk_" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    const payload = await req.json();
    // payload: { type: "INSERT", table: "auth.users", record: { id, email }, ... }
    if (payload.type !== "INSERT" || payload.table !== "users") {
      return new Response("ignored", { status: 200 });
    }
    const user = payload.record;
    if (!user?.id) {
      return new Response("no user id", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Generate API secret + encrypt
    const apiSecret = generateApiSecret();
    const encrypted = await encryptSecret(apiSecret, HMAC_MASTER_KEY);
    const apiSecretPrefix = apiSecret.substring(0, 8);

    // 2. Extract metadata from raw_user_meta_data
    const meta = user.raw_user_meta_data || user.raw_app_meta_data || {};
    const shopName = meta.shop_name || "My Shop";
    const ownerName = meta.owner_name || user.email?.split("@")[0] || "Owner";
    const phone = meta.phone || "";

    // 3. Insert clients_shops
    const { error: shopErr } = await supabase.from("clients_shops").insert({
      id: user.id,
      shop_name: shopName,
      owner_name: ownerName,
      phone_number: phone,
      api_secret_encrypted: encrypted,
      api_secret_prefix: apiSecretPrefix,
      onboarded_at: new Date().toISOString()
    });
    if (shopErr) throw new Error("shop insert: " + shopErr.message);

    // 4. Insert default bot_settings
    const { error: bsErr } = await supabase.from("bot_settings").insert({
      shop_id: user.id,
      prompt_context: `متجر ${shopName}

📦 الكتالوج:
(أضف منتجاتك من Dashboard)

🚚 الشحن: 700 دج
⏰ التوصيل: 24-72 ساعة
💰 الدفع: عند الاستلام

📋 قواعد:
- لا تخترع منتجات أو أسعار غير موجودة
- استخدم اللهجة الجزائرية
- كن ودود ومختصر`,
      target_dialect: "Algerian Darija",
      is_active: true,
      currency: "DZD",
      response_style: "casual",
      shipping_fee: 700,
      delivery_cities: ["الجزائر العاصمة","البليدة","وهران","قسنطينة","سطيف","عنابة","تلمسان","بجاية"]
    });
    if (bsErr) throw new Error("bot_settings insert: " + bsErr.message);

    // 5. Log signup event
    await supabase.from("signup_events").insert({
      user_id: user.id,
      event: "onboarded",
      metadata: { shop_name: shopName, api_secret_prefix: apiSecretPrefix }
    });

    // 6. Log api_key_audit
    await supabase.from("api_key_audit").insert({
      shop_id: user.id,
      action: "created",
      success: true,
      metadata: { prefix: apiSecretPrefix }
    });

    // 7. Return api_secret (raw, ONCE)
    return new Response(
      JSON.stringify({
        user_id: user.id,
        api_secret: apiSecret,
        api_secret_prefix: apiSecretPrefix,
        shop_name: shopName
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
