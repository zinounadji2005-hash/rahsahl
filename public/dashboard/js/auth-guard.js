// public/dashboard/js/auth-guard.js
// Guards dashboard pages: redirects to login if no session.
// Also resolves the current shop_id and exposes it for downstream JS.

(function () {
  'use strict';

  var REDIRECT_KEY = 'rahsahl-guard-redirects';
  var MAX_REDIRECTS = 2;

  function redirectToLogin() {
    var count = parseInt(sessionStorage.getItem(REDIRECT_KEY) || '0', 10);
    if (count >= MAX_REDIRECTS) {
      sessionStorage.removeItem(REDIRECT_KEY);
      return;
    }
    sessionStorage.setItem(REDIRECT_KEY, String(count + 1));
    var path = window.location.pathname;
    var dashboardIdx = path.indexOf('/dashboard/');
    var base = dashboardIdx >= 0 ? path.substring(0, dashboardIdx) : path.substring(0, path.lastIndexOf('/'));
    window.location.href = base + '/login.html?next=' + encodeURIComponent(window.location.pathname);
  }

  async function guard() {
    var supabase = window.RahSahl && window.RahSahl.supabase && window.RahSahl.supabase.getClient();
    if (!supabase) {
      redirectToLogin();
      return null;
    }

    var sessionRes = await supabase.auth.getSession();
    var session = sessionRes && sessionRes.data && sessionRes.data.session;
    if (!session) {
      redirectToLogin();
      return null;
    }

    var userRes = await supabase.auth.getUser();
    var user = userRes && userRes.data && userRes.data.user;
    if (!user) {
      await supabase.auth.signOut().catch(function () {});
      sessionStorage.removeItem(REDIRECT_KEY);
      redirectToLogin();
      return null;
    }

    sessionStorage.removeItem(REDIRECT_KEY);

    var shopRes = await supabase
      .from('clients_shops')
      .select('id, shop_name, owner_name, phone_number, subscription_tier, is_active, onboarded_at, api_secret_prefix, api_secret_last_used, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (shopRes.error) {
      console.error('Failed to load shop:', shopRes.error.message);
    }

    var ctx = {
      supabase: supabase,
      session: session,
      user: user,
      shop: shopRes.data || null
    };

    window.__rahsahlCtx = ctx;
    return ctx;
  }

  window.RahSahl = window.RahSahl || {};
  window.RahSahl.authGuard = { guard: guard, requireAuth: guard };
})();
