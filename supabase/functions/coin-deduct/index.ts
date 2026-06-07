import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const { shop_id, sender_id, channel, skip_n8n_save } = await req.json();
    if (!shop_id || !sender_id || !channel) {
      return new Response(
        JSON.stringify({ ok: false, reason: "shop_id, sender_id, channel required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Atomic: FOR UPDATE row lock via stored procedure
    const { data, error } = await supabase.rpc("fn_deduct_coin", {
      p_shop_id: shop_id,
      p_sender_id: sender_id,
      p_channel: channel,
    });

    if (error) throw error;

    if (!data.ok) {
      // Fetch fallback message for insufficient coins
      const { data: settings } = await supabase
        .from("bot_settings")
        .select("fallback_message, target_dialect")
        .eq("shop_id", shop_id)
        .single();

      return new Response(
        JSON.stringify({
          ok: false,
          reason: data.reason,
          balance: data.balance,
          fallback_message: settings?.fallback_message || "عذراً، الرصيد غير كافٍ. يرجى شحن الرصيد من لوحة التحكم.",
          target_dialect: settings?.target_dialect || "Algerian Darija",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        balance: data.balance,
        remaining: data.balance,
        tx_id: data.tx_id,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
