import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "rahsahl_whatsapp_verify";
const N8N_HOST = Deno.env.get("N8N_HOST") ?? "";
const N8N_WEBHOOK_PATH = Deno.env.get("N8N_WEBHOOK_PATH") ?? "/webhook/v1/social-inbound";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const url = new URL(req.url);

    // GET: webhook verification
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    // POST: incoming message
    const body = await req.json();
    const entries = body.entry ?? [];

    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value ?? {};
        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];
        const phoneNumbers = value.metadata ?? {};

        for (const msg of messages) {
          const senderId = msg.from;
          const text = msg.text?.body ?? "";
          const msgId = msg.id;
          const timestamp = msg.timestamp;

          if (!text || !senderId) continue;

          const contact = contacts.find((c: { wa_id: string }) => c.wa_id === senderId);
          const customerName = contact?.profile?.name ?? senderId;

          const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

          // Find the shop_id from platform_credentials (whatsapp channel)
          const { data: creds } = await supabase
            .from("platform_credentials")
            .select("shop_id, external_id")
            .eq("channel", "whatsapp")
            .eq("is_active", true)
            .limit(1)
            .single();

          if (!creds) continue;

          const shopId = creds.shop_id;

          // Store incoming message in conversations
          await supabase.from("conversations").insert({
            shop_id: shopId,
            sender_id: senderId,
            role: "user",
            message: text,
            channel: "whatsapp",
            metadata: { customer_name: customerName, wa_message_id: msgId },
          });

          // Forward to n8n for AI processing
          if (N8N_HOST) {
            try {
              await fetch(`${N8N_HOST}${N8N_WEBHOOK_PATH}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  shop_id: shopId,
                  sender_id: senderId,
                  message: text,
                  channel: "whatsapp",
                  customer_name: customerName,
                  message_id: msgId,
                  timestamp: timestamp,
                }),
              });
            } catch (e) {
              console.error("n8n forward error:", e);
            }
          }
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200, headers: CORS });
  } catch (err) {
    const msg = (err && typeof err.message === "string") ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
