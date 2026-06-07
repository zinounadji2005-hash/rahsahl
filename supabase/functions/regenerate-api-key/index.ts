// supabase/functions/regenerate-api-key/index.ts
// Regenerates the API key for the authenticated shop.
// Returns the new key (raw, ONCE) and prefix.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_MASTER_KEY = Deno.env.get("HMAC_MASTER_KEY")!;

async function encryptSecret(plaintext: string, masterKeyB64: string): Promise<Uint8Array> {
  const masterKey = Uint8Array.from(atob(masterKeyB64), c => c.charCodeAt(0));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw", masterKey,
    { name: "AES-GCM" }, false, ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
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
    // 1. Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no auth" }), {
        status: 401, headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Verify user via user client
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "invalid auth" }), {
        status: 401, headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Service role to update
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 4. Generate new key + encrypt
    const apiSecret = generateApiSecret();
    const encrypted = await encryptSecret(apiSecret, HMAC_MASTER_KEY);
    const apiSecretPrefix = apiSecret.substring(0, 8);

    // 5. Update clients_shops
    const { error: updErr } = await supabase
      .from("clients_shops")
      .update({
        api_secret_encrypted: encrypted,
        api_secret_prefix: apiSecretPrefix
      })
      .eq("id", user.id);

    if (updErr) throw new Error("update failed: " + updErr.message);

    // 6. Log audit
    await supabase.from("api_key_audit").insert({
      shop_id: user.id,
      action: "regenerated",
      success: true,
      metadata: { prefix: apiSecretPrefix }
    });

    await supabase.from("signup_events").insert({
      user_id: user.id,
      event: "key_regenerated",
      metadata: { prefix: apiSecretPrefix }
    });

    return new Response(
      JSON.stringify({
        api_secret: apiSecret,
        api_secret_prefix: apiSecretPrefix
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
});
