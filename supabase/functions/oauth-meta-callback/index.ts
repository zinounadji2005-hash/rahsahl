import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;
const OAUTH_CALLBACK_URL = Deno.env.get("OAUTH_CALLBACK_URL")!;
const SUCCESS_REDIRECT = Deno.env.get("SUCCESS_REDIRECT") ?? "https://rahsahl.pages.dev/dashboard/settings";

const GRAPH = "https://graph.facebook.com/v22.0";

function errRedirect(reason: string): Response {
  return Response.redirect(`${SUCCESS_REDIRECT}?oauth=error&reason=${encodeURIComponent(reason)}`, 302);
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) return errRedirect(`user_denied:${error}`);
    if (!code || !state) return errRedirect("missing_code_or_state");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Validate state
    const { data: stateRow, error: stateErr } = await supabase
      .from("oauth_states")
      .select("user_id")
      .eq("state", state)
      .single();

    if (stateErr || !stateRow) return errRedirect("invalid_state");

    // Consume state
    await supabase.from("oauth_states").delete().eq("state", state);

    const userId = stateRow.user_id;

    // 1 — Exchange code for short-lived access token
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

    // 2 — Exchange short-lived for long-lived (60 day)
    const longUrl = new URL(`${GRAPH}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", META_APP_ID);
    longUrl.searchParams.set("client_secret", META_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

    const longResp = await fetch(longUrl.toString());
    const longData = await longResp.json();
    if (!longData.access_token) return errRedirect("long_token_failed");

    const userToken = longData.access_token;
    const expiresIn = longData.expires_in ?? 5184000;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3 — Get Facebook Pages for this user
    const pagesResp = await fetch(`${GRAPH}/me/accounts?access_token=${userToken}&fields=id,name,access_token,picture`);
    const pagesData = await pagesResp.json();
    const pages = pagesData.data ?? [];

    if (pages.length === 0) return errRedirect("no_pages");

    let connected = 0;

    for (const page of pages) {
      // Upsert platform_credentials for Messenger
      const { data: msgCred } = await supabase
        .from("platform_credentials")
        .upsert({
          shop_id: userId,
          channel: "messenger",
          external_id: page.id,
          access_token: page.access_token,
          token_expires_at: expiresAt,
          is_active: true,
          metadata: { user_access_token: userToken, user_token_expires_at: expiresAt, page_name: page.name },
        }, { onConflict: "shop_id,channel,external_id", ignoreDuplicates: false })
        .select("id")
        .single();

      if (msgCred) {
        await supabase
          .from("linked_social_accounts")
          .upsert({
            shop_id: userId,
            platform: "messenger",
            external_id: page.id,
            external_handle: page.name,
            is_active: true,
            verified_at: new Date().toISOString(),
            credential_id: msgCred.id,
          }, { onConflict: "platform,external_id" });
        connected++;
      }

      // Try to get linked Instagram Business account
      const igResp = await fetch(
        `${GRAPH}/${page.id}/instagram_accounts?access_token=${page.access_token}&fields=id,username,name`,
      );
      const igData = await igResp.json();
      const igAccounts = igData.data ?? [];

      for (const ig of igAccounts) {
        const { data: igCred } = await supabase
          .from("platform_credentials")
          .upsert({
            shop_id: userId,
            channel: "instagram",
            external_id: ig.id,
            access_token: page.access_token,
            token_expires_at: expiresAt,
            is_active: true,
            metadata: { user_access_token: userToken, user_token_expires_at: expiresAt, page_name: page.name, ig_username: ig.username },
          }, { onConflict: "shop_id,channel,external_id", ignoreDuplicates: false })
          .select("id")
          .single();

        if (igCred) {
          await supabase
            .from("linked_social_accounts")
            .upsert({
              shop_id: userId,
              platform: "instagram",
              external_id: ig.id,
              external_handle: ig.username,
              is_active: true,
              verified_at: new Date().toISOString(),
              credential_id: igCred.id,
            }, { onConflict: "platform,external_id" });
          connected++;
        }
      }
    }

    return Response.redirect(`${SUCCESS_REDIRECT}?oauth=success&connected=${connected}`, 302);
  } catch (err) {
    return errRedirect(err instanceof Error ? err.message : String(err));
  }
});
