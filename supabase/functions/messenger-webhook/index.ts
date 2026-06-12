import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("MESSENGER_VERIFY_TOKEN") ?? "rahsahl_messenger_verify";
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

    if (body.object !== "page") {
      return new Response("EVENT_RECEIVED", { status: 200, headers: CORS });
    }

    for (const entry of body.entry ?? []) {
      const pageId = entry.id;
      const messagingEvents = entry.messaging ?? [];

      for (const event of messagingEvents) {
        const senderId = event.sender?.id;
        const message = event.message;
        if (!senderId || !message) continue;

        const text = message.text ?? message.nlp?.text ?? "";
        const msgId = message.mid;
        const timestamp = event.timestamp;
        if (!text || !msgId) continue;

        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

        const { data: cred } = await supabase
          .from("platform_credentials")
          .select("shop_id")
          .eq("channel", "messenger")
          .eq("external_id", pageId)
          .eq("is_active", true)
          .single();

        if (!cred) continue;

        await supabase.from("conversations").insert({
          shop_id: cred.shop_id,
          sender_id: senderId,
          role: "user",
          message: text,
          channel: "messenger",
          metadata: { page_id: pageId, fb_message_id: msgId },
        });

        if (N8N_HOST) {
          try {
            await fetch(`${N8N_HOST}${N8N_WEBHOOK_PATH}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                shop_id: cred.shop_id,
                sender_id: senderId,
                page_id: pageId,
                message: text,
                channel: "messenger",
                message_id: msgId,
                timestamp,
              }),
            });
          } catch (_) {}
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200, headers: CORS });
  } catch (err) {
    const msg = (err && typeof err.message === "string") ? err.message : JSON.stringify(err);
    console.error("messenger-webhook error:", msg);
    return new Response("EVENT_RECEIVED", { status: 200, headers: CORS });
  }
});
