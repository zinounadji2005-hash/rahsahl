import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;
const OAUTH_CALLBACK_URL = Deno.env.get("OAUTH_WHATSAPP_CALLBACK_URL") ?? "https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/oauth-whatsapp-callback";
const SUCCESS_REDIRECT = Deno.env.get("SUCCESS_REDIRECT") ?? "https://rahsahl.pages.dev/dashboard/settings";
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "rahsahl_whatsapp_verify";

const GRAPH = "https://graph.facebook.com/v22.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errRedirect(reason: string): Response {
  return Response.redirect(`${SUCCESS_REDIRECT}?oauth=error&reason=${encodeURIComponent(reason)}`, 302);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) return errRedirect(`user_denied:${error}`);
    if (!code || !state) return errRedirect("missing_code_or_state");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: stateRow, error: stateErr } = await supabase
      .from("oauth_states")
      .select("user_id")
      .eq("state", state)
      .single();

    if (stateErr || !stateRow) return errRedirect("invalid_state");

    await supabase.from("oauth_states").delete().eq("state", state);

    const userId = stateRow.user_id;

    const tokenBody = new URLSearchParams();
    tokenBody.set("client_id", META_APP_ID);
    tokenBody.set("client_secret", META_APP_SECRET);
    tokenBody.set("redirect_uri", OAUTH_CALLBACK_URL);
    tokenBody.set("code", code);

    const tokenResp = await fetch(`${GRAPH}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) return errRedirect("token_exchange_failed");

    const longUrl = new URL(`${GRAPH}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", META_APP_ID);
    longUrl.searchParams.set("client_secret", META_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

    const longResp = await fetch(longUrl.toString());
    const longData = await longResp.json();
    if (!longData.access_token) return errRedirect("long_token_failed");

    const userToken = longData.access_token;

    const wabaResp = await fetch(`${GRAPH}/me/whatsapp_business_accounts?access_token=${userToken}&fields=id,name,currency,timezone_id`);
    const wabaData = await wabaResp.json();
    const wabas = wabaData.data ?? [];

    if (wabas.length === 0) return errRedirect("no_waba");

    let connected = 0;

    for (const waba of wabas) {
      const phonesResp = await fetch(`${GRAPH}/${waba.id}/phone_numbers?access_token=${userToken}&fields=id,display_phone_number,verified_name,code_verification_status`);
      const phonesData = await phonesResp.json();
      const phones = phonesData.data ?? [];

      for (const phone of phones) {
        await supabase
          .from("platform_credentials")
          .upsert({
            shop_id: userId,
            channel: "whatsapp",
            external_id: waba.id,
            access_token: userToken,
            is_active: true,
            metadata: {
              waba_id: waba.id,
              waba_name: waba.name,
              phone_number_id: phone.id,
              phone_number: phone.display_phone_number,
              verified_name: phone.verified_name,
            },
          }, { onConflict: "shop_id,channel,external_id", ignoreDuplicates: false })
          .select("id")
          .single();

        const { data: cred } = await supabase
          .from("platform_credentials")
          .select("id")
          .eq("shop_id", userId)
          .eq("channel", "whatsapp")
          .eq("external_id", waba.id)
          .single();

        if (cred) {
          await supabase
            .from("linked_social_accounts")
            .upsert({
              shop_id: userId,
              platform: "whatsapp",
              external_id: waba.id,
              external_handle: phone.display_phone_number || waba.name,
              is_active: true,
              verified_at: new Date().toISOString(),
              credential_id: cred.id,
            }, { onConflict: "platform,external_id" });
          connected++;
        }
      }
    }

    return Response.redirect(`${SUCCESS_REDIRECT}?oauth=success&connected=${connected}`, 302);
  } catch (err) {
    const msg = (err && typeof err.message === 'string') ? err.message : JSON.stringify(err);
    return errRedirect(msg);
  }
});
