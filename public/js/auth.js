// public/js/auth.js
// Auth helpers for login/signup pages.
// Wraps Supabase Auth API and shares the same localStorage key
// as the dashboard so the session is visible across the app.

(function () {
  'use strict';

  var SUPABASE_URL = 'https://rvjsnkolroaakskvvwnv.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_3Hc5H4lJdemDnuSv3bG-Cw_TXViKcuT';
  var AUTH_KEY = 'rahsahl-auth';

  var client = null;

  function getClient() {
    if (client) return client;
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('Supabase SDK not loaded');
      return null;
    }
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storage: localStorage, storageKey: AUTH_KEY },
    });
    return client;
  }

  var RahSahlAuth = {
    init: function () { return getClient(); },

    session: function () {
      var c = getClient();
      return c ? c.auth.getSession().then(function (r) { return r.data.session; }) : Promise.resolve(null);
    },

    requireAuth: function (to) {
      to = to || 'login.html';
      var c = getClient();
      if (!c) { window.location.href = to; return Promise.resolve(null); }
      return c.auth.getSession().then(function (r) {
        if (!r.data.session) { window.location.href = to; return null; }
        return c.auth.getUser().then(function (u) { return { client: c, session: r.data.session, user: u.data.user }; });
      });
    },

    login: function (email, password) {
      var c = getClient();
      if (!c) return Promise.reject(new Error('Not initialized'));
      return c.auth.signInWithPassword({ email: email, password: password });
    },

    signup: function (email, password, ownerName, phone, shopName) {
      var c = getClient();
      if (!c) return Promise.reject(new Error('Not initialized'));
      var meta = { owner_name: ownerName, phone: phone };
      if (shopName) meta.shop_name = shopName;
      return c.auth.signUp({
        email: email, password: password,
        options: { data: meta },
      });
    },

    logout: function () {
      var c = getClient();
      if (c) c.auth.signOut().then(function () { window.location.href = 'login.html'; });
    },

    onChange: function (cb) {
      var c = getClient();
      return c ? c.auth.onAuthStateChange(cb) : { data: { subscription: { unsubscribe: function () {} } } };
    },
  };

  window.RahSahlAuth = RahSahlAuth;
  window.RahSahl = window.RahSahl || {};
  window.RahSahl.supabase = window.RahSahl.supabase || { getClient: getClient };
})();
