import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;

const GRAPH = "https://graph.facebook.com/v22.0";
const REFRESH_THRESHOLD_DAYS = 7; // Refresh tokens expiring within 7 days
const MIN_REFRESH_INTERVAL_HOURS = 24; // Don't refresh the same token more than once per day

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find credentials with user_access_token in metadata that are near expiry
    const threshold = new Date(Date.now() + REFRESH_THRESHOLD_DAYS * 86400000).toISOString();

    const { data: creds, error: fetchErr } = await supabase
      .from("platform_credentials")
      .select("id, shop_id, channel, external_id, access_token, metadata")
      .eq("is_active", true)
      .lte("expires_at", threshold)
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!creds || creds.length === 0) {
      return new Response(JSON.stringify({ refreshed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let refreshed = 0;

    for (const cred of creds) {
      const userToken = cred.metadata?.user_access_token;
      if (!userToken) continue;

      const lastRefresh = cred.metadata?.last_token_refresh;
      if (lastRefresh) {
        const hoursSince = (Date.now() - new Date(lastRefresh).getTime()) / 3600000;
        if (hoursSince < MIN_REFRESH_INTERVAL_HOURS) continue;
      }

      try {
        const longUrl = new URL(`${GRAPH}/oauth/access_token`);
        longUrl.searchParams.set("grant_type", "fb_exchange_token");
        longUrl.searchParams.set("client_id", META_APP_ID);
        longUrl.searchParams.set("client_secret", META_APP_SECRET);
        longUrl.searchParams.set("fb_exchange_token", userToken);

        const resp = await fetch(longUrl.toString());
        const data = await resp.json();

        if (!data.access_token) {
          console.error(`Token refresh failed for cred ${cred.id}:`, data);
          continue;
        }

        const expiresIn = data.expires_in ?? 5184000; // 60 days default
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Update the credential with new token and expiry
        const updatedMetadata = {
          ...cred.metadata,
          user_access_token: data.access_token,
          user_token_expires_at: newExpiresAt,
          last_token_refresh: new Date().toISOString(),
        };

        await supabase
          .from("platform_credentials")
          .update({
            access_token: data.access_token,
            expires_at: newExpiresAt,
            metadata: updatedMetadata,
          })
          .eq("id", cred.id);

        refreshed++;
      } catch (err) {
        console.error(`Error refreshing token for cred ${cred.id}:`, err);
      }
    }

    return new Response(JSON.stringify({ refreshed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
