// public/dashboard/js/api.js
// Thin CRUD wrappers over Supabase tables.
// All calls go through RLS, so the active session implicitly
// scopes queries to the caller's shop_id.

(function () {
  'use strict';

  function client() {
    return window.RahSahl.supabase.getClient();
  }

  function activeShopId() {
    var ctx = window.__rahsahlCtx;
    return (ctx && ctx.shop && ctx.shop.id) || null;
  }

  // -------- Edge function helper --------
  function callFunction(name, body) {
    return client().functions.invoke(name, { body: body || {} });
  }

  var api = {
    // -------- clients_shops --------
    getShop: function () {
      return client().from('clients_shops')
        .select('id, shop_name, owner_name, phone_number, subscription_tier, is_active, onboarded_at, api_secret_prefix, api_secret_last_used, created_at')
        .maybeSingle();
    },
    updateShop: function (patch) {
      var id = activeShopId();
      if (!id) return Promise.resolve({ error: { message: 'no shop_id' }, data: null });
      return client().from('clients_shops').update(patch).eq('id', id);
    },

    // -------- bot_settings --------
    getBotSettings: function () {
      return client().from('bot_settings')
        .select('*')
        .maybeSingle();
    },
    upsertBotSettings: function (patch) {
      var id = activeShopId();
      if (id) patch.shop_id = id;
      return client().from('bot_settings').upsert(patch, { onConflict: 'shop_id' });
    },
    updateBotSettings: function (patch) {
      var id = activeShopId();
      if (!id) return Promise.resolve({ error: { message: 'no shop_id' }, data: null });
      return client().from('bot_settings').update(patch).eq('shop_id', id);
    },

    // -------- orders --------
    listOrders: function (opts) {
      opts = opts || {};
      var q = client().from('orders')
        .select('id, sender_id, customer_name, phone, location_city, product_requested, quantity, order_status, created_at')
        .order('created_at', { ascending: false })
        .limit(opts.limit || 50);
      if (opts.status && opts.status !== 'all') q = q.eq('order_status', opts.status);
      return q;
    },
    countOrdersByStatus: function () {
      return client().from('orders')
        .select('order_status', { count: 'exact', head: false });
    },
    updateOrderStatus: function (orderId, status) {
      return client().from('orders').update({ order_status: status }).eq('id', orderId);
    },

    // -------- conversations --------
    listConversations: function (opts) {
      opts = opts || {};
      return client().from('conversations')
        .select('id, sender_id, role, message, created_at')
        .order('created_at', { ascending: false })
        .limit(opts.limit || 50);
    },
    listConversationsBySender: function (senderId, limit) {
      return client().from('conversations')
        .select('id, sender_id, role, message, created_at')
        .eq('sender_id', senderId)
        .order('created_at', { ascending: true })
        .limit(limit || 200);
    },
    listDistinctSenders: function () {
      return client().from('conversations')
        .select('sender_id, message, role, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
    },

    // -------- products --------
    listProducts: function () {
      return client().from('products')
        .select('id, sku, name, description, price, currency, stock, is_active, created_at')
        .order('created_at', { ascending: false });
    },
    createProduct: function (patch) {
      var id = activeShopId();
      if (id) patch.shop_id = id;
      return client().from('products').insert(patch);
    },
    updateProduct: function (id, patch) {
      return client().from('products').update(patch).eq('id', id);
    },
    deleteProduct: function (id) {
      return client().from('products').delete().eq('id', id);
    },

    // -------- analytics views (security_invoker = true) --------
    shopDailyStats: function () {
      return client().from('v_shop_daily_stats').select('*');
    },
    ordersPerHour: function () {
      return client().from('v_orders_per_hour').select('*');
    },
    topProducts: function () {
      return client().from('v_top_products').select('*').limit(10);
    },
    successRate: function () {
      return client().from('v_success_rate').select('*');
    },

    // -------- api_key_audit --------
    listApiKeyAudit: function () {
      return client().from('api_key_audit')
        .select('id, action, ip_address, user_agent, success, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(50);
    },

    // -------- failed_messages (DLQ) --------
    listFailedMessages: function () {
      return client().from('failed_messages')
        .select('id, sender_id, channel, error_stage, error_message, status, retry_count, created_at, resolved_at')
        .order('created_at', { ascending: false })
        .limit(50);
    },

    // -------- workflow_logs --------
    listWorkflowLogs: function () {
      return client().from('workflow_logs')
        .select('id, execution_id, stage, status, latency_ms, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
    },

    // -------- billing / coins --------
    getCoinBalance: function () {
      return client().from('coin_balances')
        .select('balance, total_purchased, total_bonus, total_spent, last_activity_at')
        .maybeSingle();
    },
    listTransactions: function (limit) {
      return client().from('coin_transactions')
        .select('id, amount, type, reason, ref_type, balance_after, created_at')
        .order('created_at', { ascending: false })
        .limit(limit || 50);
    },
    listPayments: function (limit) {
      return client().from('payments')
        .select('id, amount_dzd, pack_tier, coins_granted, status, created_at, paid_at, failure_reason')
        .order('created_at', { ascending: false })
        .limit(limit || 50);
    },
    listCoinPacks: function () {
      return client().from('coin_packs')
        .select('tier, display_name_ar, coins, price_dzd, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
    },
    createCheckout: function (packTier, customCoins) {
      return callFunction('create-checkout', { pack_tier: packTier, custom_coins: customCoins });
    },
    getCustomPrice: function (coins) {
      return client().rpc('fn_calculate_custom_price', { p_coins: coins }).maybeSingle();
    },

    // -------- linked social accounts --------
    // -------- platform accounts (shared logins) --------
    listAccounts: function () {
      return client().from('platform_credentials')
        .select('id, channel, external_id, access_token, token_expires_at, is_active, metadata, created_at')
        .order('created_at', { ascending: false });
    },
    createAccount: function (payload) {
      var id = activeShopId();
      if (!id) return Promise.resolve({ error: { message: 'no shop_id' }, data: null });
      return client().from('platform_credentials').insert({
        shop_id: id,
        channel: payload.platform,
        external_id: payload.username,
        access_token: payload.password,
        token_expires_at: payload.expiry_date || null,
        metadata: payload.notes ? { notes: payload.notes } : null
      }).select().maybeSingle();
    },

    listLinkedAccounts: function () {
      return client().from('linked_social_accounts')
        .select('id, platform, external_handle, is_active, verified_at, metadata')
        .order('verified_at', { ascending: false });
    },

    // -------- outbox --------
    listOutbox: function (limit) {
      return client().from('outbox')
        .select('id, channel, recipient_id, status, attempt_count, last_error, external_id, created_at, sent_at')
        .order('created_at', { ascending: false })
        .limit(limit || 50);
    },

    // -------- platform_credentials --------
    listPlatformCredentials: function () {
      return client().from('platform_credentials')
        .select('id, channel, external_id, is_active, created_at')
        .order('created_at', { ascending: false });
    },

    // -------- Edge Functions --------
    regenerateApiKey: function () {
      return callFunction('regenerate-api-key', {});
    },
    verifyHmac: function (payload) {
      return callFunction('verify-hmac', payload);
    }
  };

  window.RahSahl = window.RahSahl || {};
  window.RahSahl.api = api;
})();
