// public/dashboard/js/supabase.js
// Supabase client initialization shared across dashboard pages.

(function () {
  'use strict';

  var SUPABASE_URL = 'https://rvjsnkolroaakskvvwnv.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_3Hc5H4lJdemDnuSv3bG-Cw_TXViKcuT';
  var AUTH_KEY = 'rahsahl-auth';

  var client = null;

  function getClient() {
    if (client) return client;
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('Supabase SDK not loaded. Include https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js before this file.');
      return null;
    }
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: localStorage,
        storageKey: AUTH_KEY
      }
    });
    return client;
  }

  window.RahSahl = window.RahSahl || {};
  window.RahSahl.supabase = { getClient: getClient };
})();
