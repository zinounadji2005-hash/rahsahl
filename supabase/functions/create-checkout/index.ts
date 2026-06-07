import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHARGILY_API_KEY = Deno.env.get("CHARGILY_API_KEY")!;
const CHARGILY_BASE_URL = Deno.env.get("CHARGILY_BASE_URL") ?? "https://pay.chargily.net/test/api/v2";
const SUCCESS_URL = Deno.env.get("SUCCESS_URL") ?? "https://rahsahl.com/dashboard/billing.html?status=success";
const FAILURE_URL = Deno.env.get("FAILURE_URL") ?? "https://rahsahl.com/dashboard/billing.html?status=failed";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "invalid auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { pack_tier, custom_coins }: { pack_tier: string; custom_coins?: number } = await req.json();
    if (!pack_tier) {
      return new Response(JSON.stringify({ error: "pack_tier required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Validate pack & determine coins + price
    let coins: number;
    let amountDzd: number;
    let displayName: string;

    if (pack_tier === "custom") {
      if (!custom_coins || custom_coins < 1000 || custom_coins > 1000000) {
        return new Response(JSON.stringify({ error: "custom_coins must be 1,000 - 1,000,000" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const { data: priceData, error: priceErr } = await supabase.rpc("fn_calculate_custom_price", {
        p_coins: custom_coins,
      });
      if (priceErr || !priceData?.length) throw priceErr || new Error("price calculation failed");
      coins = priceData[0].coins;
      amountDzd = priceData[0].price_dzd;
      displayName = `${custom_coins.toLocaleString("ar-DZ")} نقطة مخصصة`;
    } else {
      const { data: pack } = await supabase
        .from("coin_packs")
        .select("coins, price_dzd, display_name_ar")
        .eq("tier", pack_tier)
        .eq("is_active", true)
        .single();

      if (!pack) {
        return new Response(JSON.stringify({ error: "invalid or inactive pack tier" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      coins = pack.coins!;
      amountDzd = pack.price_dzd!;
      displayName = pack.display_name_ar;
    }

    // Create payment record (pending)
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        shop_id: user.id,
        amount_dzd: amountDzd,
        pack_tier,
        coins_granted: coins,
        status: "pending",
      })
      .select("id")
      .single();

    if (payErr) throw payErr;

    // Create Chargily checkout
    const chargilyBody = {
      amount: amountDzd,
      currency: "dzd",
      success_url: `${SUCCESS_URL}&payment_id=${payment.id}`,
      failure_url: `${FAILURE_URL}&payment_id=${payment.id}`,
      description: `باقة ${displayName} — ${coins.toLocaleString("ar-DZ")} نقطة`,
      locale: "ar",
      metadata: {
        shop_id: user.id,
        pack_tier,
        payment_id: payment.id,
      },
    };

    const chargilyResp = await fetch(`${CHARGILY_BASE_URL}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHARGILY_API_KEY}`,
      },
      body: JSON.stringify(chargilyBody),
    });

    if (!chargilyResp.ok) {
      const errBody = await chargilyResp.text();
      await supabase.from("payments").update({ status: "failed", failure_reason: `Chargily: ${errBody}` }).eq("id", payment.id);
      throw new Error(`Chargily API error: ${chargilyResp.status} ${errBody}`);
    }

    const checkout = await chargilyResp.json();

    // Save checkout ID
    await supabase
      .from("payments")
      .update({ chargily_checkout_id: checkout.id })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        checkout_url: checkout.url,
        payment_id: payment.id,
        amount_dzd: amountDzd,
        coins,
        pack_tier,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
