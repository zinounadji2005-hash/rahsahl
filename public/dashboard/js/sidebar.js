// public/dashboard/js/sidebar.js
// Builds the dashboard sidenav and the page header dynamically so
// every page renders the same chrome. Exposes renderSidebar() and
// renderTopbar() that pages call after auth-guard resolves.

(function () {
  'use strict';

  var NAV_ITEMS = [
    { key: 'dashboard',     href: 'index.html',         icon: 'dashboard',            label: 'لوحة التحكم' },
    { key: 'orders',        href: 'orders.html',        icon: 'shopping_bag',         label: 'الطلبات' },
    { key: 'conversations', href: 'conversations.html', icon: 'forum',                label: 'المحادثات' },
    { key: 'products',      href: 'products.html',      icon: 'inventory_2',          label: 'المنتجات' },
    { key: 'billing',       href: 'billing.html',       icon: 'credit_card',          label: 'الفوترة' },
    { key: 'accounts',      href: 'accounts.html',      icon: 'link',                 label: 'حساباتي' },
    { key: 'api-keys',      href: 'api-keys.html',      icon: 'key',                  label: 'مفاتيح API' },
    { key: 'settings',      href: 'settings.html',      icon: 'settings',             label: 'الإعدادات' }
  ];

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function activeKeyFromPath() {
    var p = window.location.pathname.split('/').pop() || 'index.html';
    p = p.replace(/\.html.*$/, '');
    if (!p || p === 'index') return 'dashboard';
    return p;
  }

  function renderSidebar(ctx) {
    var active = activeKeyFromPath();
    var items = NAV_ITEMS.map(function (it) {
      var cls = 'nav-item' + (it.key === active ? ' active' : '');
      return '<a class="' + cls + '" href="' + it.href + '">' +
             '<span class="material-symbols-outlined">' + it.icon + '</span>' +
             '<span>' + escapeHtml(it.label) + '</span>' +
             '</a>';
    }).join('\n');

    var shopName = ctx && ctx.shop ? ctx.shop.shop_name : 'متجرك';
    var tier = ctx && ctx.shop ? ctx.shop.subscription_tier : 'free';
    var tierBadge = tier === 'free'
      ? '<span class="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">FREE</span>'
      : '<span class="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">' + escapeHtml(tier.toUpperCase()) + '</span>';

    return ''
      + '<div class="px-5 mb-7 flex items-center gap-3">'
      + '  <div class="w-10 h-10 rounded-xl primary-gradient flex items-center justify-center shrink-0">'
      + '    <span class="material-symbols-outlined text-white" style="font-variation-settings:\'FILL\' 1">bolt</span>'
      + '  </div>'
      + '  <div class="flex-1 min-w-0">'
      + '    <h2 class="font-ar text-[18px] font-bold text-sky-600 truncate">RahSahl</h2>'
      + '    <div class="flex items-center gap-1.5 mt-0.5">'
      + '      <p class="text-[12px] truncate" style="color:var(--muted)">' + escapeHtml(shopName) + '</p>'
      + '      ' + tierBadge
      + '    </div>'
      + '  </div>'
      + '  <button id="darkToggle" title="الوضع الليلي">'
      + '    <span class="material-symbols-outlined dark:hidden text-[18px]">dark_mode</span>'
      + '    <span class="material-symbols-outlined hidden dark:inline text-[18px]">light_mode</span>'
      + '  </button>'
      + '</div>'
      + '<div class="flex-1 overflow-y-auto px-2 py-1">' + items + '</div>'
      + '<div class="mt-auto px-2 pt-3 border-t" style="border-color:var(--card-border)">'
      + '  <a class="nav-item" id="btn-logout" href="javascript:void(0)">'
      + '    <span class="material-symbols-outlined">logout</span>'
      + '    <span>تسجيل الخروج</span>'
      + '  </a>'
      + '  <a class="nav-item" href="../index.html">'
      + '    <span class="material-symbols-outlined">arrow_forward</span>'
      + '    <span>الموقع الرئيسي</span>'
      + '  </a>'
      + '</div>';
  }

  function renderTopbar(title, subtitle, ctx) {
    var ownerName = ctx && ctx.shop ? ctx.shop.owner_name : '';
    return ''
      + '<header class="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-8">'
      + '  <div>'
      + '    <h1 class="font-ar text-[26px] md:text-[30px] font-bold text-navy mb-1">' + escapeHtml(title) + '</h1>'
      + (subtitle ? '    <p class="text-[15px] md:text-[16px]" style="color:var(--muted)">' + escapeHtml(subtitle) + '</p>' : '')
      + '  </div>'
      + '  <div class="flex items-center gap-3">'
      + '    <div class="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl" style="background:var(--soft-slate)">'
      + '      <span class="material-symbols-outlined text-[18px]" style="color:var(--muted)">person</span>'
      + '      <span class="text-[13px] font-semibold">' + escapeHtml(ownerName || 'تاجر') + '</span>'
      + '    </div>'
      + '  </div>'
      + '</header>';
  }

  function bindGlobalChrome() {
    var t = document.getElementById('darkToggle');
    var d = document.documentElement;
    if (localStorage.getItem('rahsahl-dark') === 'true') d.classList.add('dark');
    if (t) t.addEventListener('click', function () {
      d.classList.toggle('dark');
      localStorage.setItem('rahsahl-dark', d.classList.contains('dark') ? 'true' : 'false');
    });

    var btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async function () {
        var supabase = window.RahSahl.supabase.getClient();
        if (supabase) await supabase.auth.signOut();
        window.location.href = '../login.html';
      });
    }
  }

  function boot() {
    bindGlobalChrome();
  }

  window.RahSahl = window.RahSahl || {};
  window.RahSahl.sidebar = {
    renderSidebar: renderSidebar,
    renderTopbar: renderTopbar,
    activeKeyFromPath: activeKeyFromPath,
    boot: boot
  };
})();
