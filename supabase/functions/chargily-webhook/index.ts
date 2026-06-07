import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHARGILY_API_KEY = Deno.env.get("CHARGILY_API_KEY")!;

async function verifyChargilyHmac(rawBody: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CHARGILY_API_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(rawBody));
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("signature") || req.headers.get("x-signature") || "";
    const eventId = req.headers.get("x-event-id") || req.headers.get("X-Event-Id") || "";
    const eventType = req.headers.get("x-event-type") || req.headers.get("X-Event-Type") || "";

    // Verify HMAC
    const valid = await verifyChargilyHmac(rawBody, signature);
    if (!valid) {
      return new Response("invalid signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Idempotency check
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id, processed")
      .eq("source", "chargily")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing?.processed) {
      return new Response("already processed", { status: 200 });
    }

    if (existing && !existing.processed) {
      // Previous attempt failed — reuse
      await supabase
        .from("webhook_events")
        .update({ payload, event_type: eventType })
        .eq("id", existing.id);
    } else {
      await supabase.from("webhook_events").insert({
        source: "chargily",
        event_id: eventId,
        event_type: eventType,
        payload,
      });
    }

    const metadata = payload.metadata || {};
    const shopId = metadata.shop_id;
    const packTier = metadata.pack_tier;
    const paymentId = metadata.payment_id;

    if (!shopId || !packTier) {
      return new Response("missing metadata", { status: 200 });
    }

    if (eventType === "checkout.paid") {
      if (!paymentId) return new Response("missing payment_id", { status: 200 });

      // Fetch payment to get coin count
      const { data: payment } = await supabase
        .from("payments")
        .select("coins_granted")
        .eq("id", paymentId)
        .single();

      if (!payment) return new Response("payment not found", { status: 200 });

      const coinsToAdd = payment.coins_granted;

      // Atomic: credit coins via stored procedure
      const { data: creditResult, error: creditErr } = await supabase.rpc("fn_credit_coins", {
        p_shop_id: shopId,
        p_amount: coinsToAdd,
        p_type: "purchase",
        p_reason: `شراء باقة ${packTier}`,
        p_ref_type: "payment",
        p_ref_id: paymentId,
      });

      if (creditErr) throw creditErr;

      // Mark payment paid
      await supabase
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", paymentId);
    } else if (["checkout.failed", "checkout.canceled", "checkout.expired"].includes(eventType)) {
      if (paymentId) {
        const statusMap: Record<string, string> = {
          "checkout.failed": "failed",
          "checkout.canceled": "canceled",
          "checkout.expired": "expired",
        };
        await supabase
          .from("payments")
          .update({ status: statusMap[eventType] || "failed" })
          .eq("id", paymentId);
      }
    }

    // Mark webhook processed
    await supabase
      .from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("source", "chargily")
      .eq("event_id", eventId);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("chargily-webhook error:", err);
    return new Response("ok", { status: 200 });
  }
});
