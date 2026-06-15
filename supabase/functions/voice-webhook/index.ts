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
    const event = body.event;
    const callData = body.data;

    if (event === "call_started") {
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
          message: callData.transcript_summary,
          is_from_shop: false,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
