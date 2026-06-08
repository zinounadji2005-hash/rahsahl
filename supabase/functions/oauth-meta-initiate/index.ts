import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID")!;
const OAUTH_CALLBACK_URL = Deno.env.get("OAUTH_CALLBACK_URL") ?? "https://rvjsnkolroaakskvvwnv.supabase.co/functions/v1/oauth-meta-callback";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "no auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "invalid auth" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const state = crypto.randomUUID();
    const { error: stateErr } = await supabase
      .from("oauth_states")
      .insert({ state, user_id: user.id });

    if (stateErr) throw stateErr;

    const scope = "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages";
    const url = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(OAUTH_CALLBACK_URL)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code`;

    return json({ url });
  } catch (err) {
    const msg = (err && typeof err.message === 'string') ? err.message : JSON.stringify(err);
    return json({ error: msg }, 500);
  }
});
