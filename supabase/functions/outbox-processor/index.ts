import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Pick up pending/failed outbox items ready for retry
    const { data: items, error: fetchErr } = await supabase
      .from("outbox")
      .select("*")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const results: { id: string; status: string; external_id?: string; error?: string }[] = [];

    for (const item of items) {
      // 2. Mark processing (atomic claim)
      const { data: claimed, error: claimErr } = await supabase
        .from("outbox")
        .update({ status: "processing", attempt_count: item.attempt_count + 1 })
        .eq("id", item.id)
        .in("status", ["pending", "failed"])
        .select("id")
        .single();

      if (claimErr || !claimed) {
        results.push({ id: item.id, status: "skipped", error: "already claimed" });
        continue;
      }

      try {
        // 3. Look up platform credentials
        const { data: creds } = await supabase
          .from("platform_credentials")
          .select("access_token, external_id")
          .eq("shop_id", item.shop_id)
          .eq("channel", item.channel)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (!creds?.access_token) {
          throw new Error(`No active credentials for shop ${item.shop_id} / ${item.channel}`);
        }

        // 4. Send via appropriate API
        let externalId: string | null = null;

        switch (item.channel) {
          case "instagram":
          case "messenger": {
            const fbResp = await fetch(
              `https://graph.facebook.com/v18.0/me/messages?access_token=${creds.access_token}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: item.recipient_id },
                  message: { text: item.payload.text || "" },
                  messaging_type: "RESPONSE",
                }),
              }
            );
            const fbData = await fbResp.json();
            if (fbData.message_id) externalId = fbData.message_id;
            else if (fbData.error) throw new Error(`Meta API: ${fbData.error.message}`);
            break;
          }
          case "whatsapp": {
            const waResp = await fetch(
              `https://graph.facebook.com/v18.0/${creds.external_id}/messages?access_token=${creds.access_token}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: item.recipient_id,
                  text: { body: item.payload.text || "" },
                }),
              }
            );
            const waData = await waResp.json();
            if (waData.messages?.[0]?.id) externalId = waData.messages[0].id;
            else if (waData.error) throw new Error(`WhatsApp API: ${waData.error.message}`);
            break;
          }
          case "telegram": {
            const tgResp = await fetch(
              `https://api.telegram.org/bot${creds.access_token}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: item.recipient_id,
                  text: item.payload.text || "",
                  parse_mode: "Markdown",
                }),
              }
            );
            const tgData = await tgResp.json();
            if (tgData.result?.message_id) externalId = String(tgData.result.message_id);
            else if (!tgData.ok) throw new Error(`Telegram API: ${tgData.description}`);
            break;
          }
        }

        // 5. Mark sent
        await supabase
          .from("outbox")
          .update({
            status: "sent",
            external_id: externalId,
            sent_at: new Date().toISOString(),
            next_attempt_at: null,
          })
          .eq("id", item.id);

        results.push({ id: item.id, status: "sent", external_id: externalId || undefined });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const newAttemptCount = item.attempt_count + 1;

        if (newAttemptCount >= item.max_attempts) {
          await supabase
            .from("outbox")
            .update({
              status: "dead_letter",
              last_error: errorMessage,
              next_attempt_at: null,
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "dead_letter", error: errorMessage });
        } else {
          const backoffMinutes = Math.pow(2, newAttemptCount);
          await supabase
            .from("outbox")
            .update({
              status: "failed",
              last_error: errorMessage,
              next_attempt_at: new Date(Date.now() + backoffMinutes * 60000).toISOString(),
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "failed", error: errorMessage });
        }
      }
    }

    return new Response(JSON.stringify({ processed: results.length, items: results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
