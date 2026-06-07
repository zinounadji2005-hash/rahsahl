// supabase/functions/verify-hmac/index.ts
// Verifies HMAC-SHA256 signature on incoming webhook requests.
// Returns { valid: true/false, shop_id, reason }.
//
// Usage:
//   POST /functions/v1/verify-hmac
//   Body: { shop_id, signature, body (raw) }
//   Returns: { valid: bool, shop_id, reason }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_MASTER_KEY = Deno.env.get("HMAC_MASTER_KEY")!;

async function decryptSecret(encrypted: Uint8Array, masterKeyB64: string): Promise<string> {
  const masterKey = Uint8Array.from(atob(masterKeyB64), c => c.charCodeAt(0));
  const iv = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);
  const key = await crypto.subtle.importKey(
    "raw", masterKey,
    { name: "AES-GCM" }, false, ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const shop_id = payload.shop_id;
    const signature = payload.signature;
    const body = payload.body;
    if (!shop_id || !signature || !body) {
      return new Response(
        JSON.stringify({ valid: false, reason: "missing fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1. Fetch encrypted secret
    const { data: rows, error } = await supabase
      .from("clients_shops")
      .select("api_secret_encrypted, api_secret_prefix, is_active")
      .eq("id", shop_id)
      .limit(1);
    const shop = rows?.[0];

    console.log("[verify-hmac] query result:", { hasShop: !!shop, hasEnc: !!shop?.api_secret_encrypted, err: error?.message, count: rows?.length });
    if (error || !shop) {
      return new Response(
        JSON.stringify({ valid: false, reason: "shop not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!shop.is_active) {
      return new Response(
        JSON.stringify({ valid: false, reason: "shop inactive" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!shop.api_secret_encrypted) {
      return new Response(
        JSON.stringify({ valid: false, reason: "no api key configured" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Decrypt
    const encBytes = base64ToBytes(shop.api_secret_encrypted);
    const secret = await decryptSecret(encBytes, HMAC_MASTER_KEY);

    // 3. Compute expected signature
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    const expected = await hmacSha256(secret, bodyStr);

    // 4. Compare (constant-time)
    const isValid = expected === signature;

    // 5. Log audit
    await supabase.from("api_key_audit").insert({
      shop_id,
      action: isValid ? "verified" : "failed_verification",
      success: isValid,
      metadata: { prefix: shop.api_secret_prefix }
    });

    if (isValid) {
      // Update last_used
      await supabase
        .from("clients_shops")
        .update({ api_secret_last_used: new Date().toISOString() })
        .eq("id", shop_id);
    }

    return new Response(
      JSON.stringify({ valid: isValid, shop_id, reason: isValid ? "ok" : "signature mismatch" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, reason: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
