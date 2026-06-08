// public/dashboard/js/lang.js
// i18n for RahSahl dashboard — 3 languages, 3 platforms
// Usage: window.RahSahl.lang.t('key') or window.RahSahl.lang.t('key', {param: val})

(function () {
  'use strict';

  var STORAGE_KEY = 'rahsahl-lang';

  var LOCALES = {
    ar: { label: 'العربية', dir: 'rtl', flag: '🇸🇦' },
    fr: { label: 'Français', dir: 'ltr', flag: '🇫🇷' },
    en: { label: 'English', dir: 'ltr', flag: '🇬🇧' },
  };

  var DICT = {
    // ---- Nav / Sidebar ----
    'app.name':           { ar: 'RahSahl', fr: 'RahSahl', en: 'RahSahl' },
    'nav.dashboard':      { ar: 'لوحة التحكم', fr: 'Tableau de bord', en: 'Dashboard' },
    'nav.orders':         { ar: 'الطلبات', fr: 'Commandes', en: 'Orders' },
    'nav.conversations':  { ar: 'المحادثات', fr: 'Conversations', en: 'Conversations' },
    'nav.products':       { ar: 'المنتجات', fr: 'Produits', en: 'Products' },
    'nav.billing':        { ar: 'الفوترة', fr: 'Facturation', en: 'Billing' },
    'nav.accounts':       { ar: 'حساباتي', fr: 'Mes comptes', en: 'My Accounts' },
    'nav.api-keys':       { ar: 'مفاتيح API', fr: 'Clés API', en: 'API Keys' },
    'nav.settings':       { ar: 'الإعدادات', fr: 'Paramètres', en: 'Settings' },
    'nav.logout':         { ar: 'تسجيل الخروج', fr: 'Déconnexion', en: 'Logout' },
    'nav.main-site':      { ar: 'الموقع الرئيسي', fr: 'Site principal', en: 'Main Site' },
    'nav.free':           { ar: 'مجاني', fr: 'Gratuit', en: 'Free' },
    'nav.lang':           { ar: 'اللغة', fr: 'Langue', en: 'Language' },
    'nav.dark-mode':      { ar: 'الوضع الليلي', fr: 'Mode nuit', en: 'Dark Mode' },

    // ---- Billing ----
    'bill.title':         { ar: 'الفوترة', fr: 'Facturation', en: 'Billing' },
    'bill.subtitle':      { ar: 'إدارة الرصيد والمشتريات', fr: 'Gérer le solde et les achats', en: 'Manage balance and purchases' },
    'bill.balance':       { ar: 'الرصيد الحالي', fr: 'Solde actuel', en: 'Current Balance' },
    'bill.coin':          { ar: 'نقطة', fr: 'point', en: 'coin' },
    'bill.purchased':     { ar: 'تم شراؤها', fr: 'Achetés', en: 'Purchased' },
    'bill.spent':         { ar: 'مستعملة', fr: 'Utilisés', en: 'Spent' },
    'bill.bonus':         { ar: 'بونص', fr: 'Bonus', en: 'Bonus' },
    'bill.recharge':      { ar: 'اشحن رصيدك', fr: 'Recharger', en: 'Recharge' },
    'bill.pack-desc':     { ar: 'اختر الباقة المناسبة', fr: 'Choisissez le forfait', en: 'Choose your pack' },
    'bill.most-popular':  { ar: 'الأكثر طلباً', fr: 'Le plus populaire', en: 'Most Popular' },
    'bill.buy-now':       { ar: 'اشتر الآن', fr: 'Acheter', en: 'Buy Now' },
    'bill.custom':        { ar: 'باقة مخصصة', fr: 'Forfait personnalisé', en: 'Custom Pack' },
    'bill.custom-desc':   { ar: 'اختر عدد النقاط (1,000 — 1,000,000)', fr: 'Choisissez le nombre de points', en: 'Choose coins amount' },
    'bill.price':         { ar: 'السعر', fr: 'Prix', en: 'Price' },
    'bill.per-coin':      { ar: 'د.ج/نقطة', fr: 'DZD/point', en: 'DZD/coin' },
    'bill.buy-custom':    { ar: 'شراء مخصص', fr: 'Achat personnalisé', en: 'Custom Purchase' },
    'bill.history':       { ar: 'سجل المعاملات', fr: 'Historique', en: 'Transaction History' },
    'bill.tx':            { ar: 'الحركات', fr: 'Transactions', en: 'Transactions' },
    'bill.payments':      { ar: 'المدفوعات', fr: 'Paiements', en: 'Payments' },
    'bill.loading':       { ar: 'جاري تحميل الباقات...', fr: 'Chargement...', en: 'Loading...' },
    'bill.no-tx':         { ar: 'لا توجد حركات بعد', fr: 'Aucune transaction', en: 'No transactions yet' },
    'bill.no-payments':   { ar: 'لا توجد مدفوعات بعد', fr: 'Aucun paiement', en: 'No payments yet' },
    'th.date':            { ar: 'التاريخ', fr: 'Date', en: 'Date' },
    'th.type':            { ar: 'النوع', fr: 'Type', en: 'Type' },
    'th.reason':          { ar: 'السبب', fr: 'Raison', en: 'Reason' },
    'th.amount':          { ar: 'المبلغ', fr: 'Montant', en: 'Amount' },
    'th.balance':         { ar: 'الرصيد', fr: 'Solde', en: 'Balance' },
    'th.pack':            { ar: 'الباقة', fr: 'Forfait', en: 'Pack' },
    'th.coins':           { ar: 'النقاط', fr: 'Points', en: 'Coins' },
    'th.status':          { ar: 'الحالة', fr: 'Statut', en: 'Status' },
    'tx.deduction':       { ar: 'خصم', fr: 'Déduction', en: 'Deduction' },
    'tx.purchase':        { ar: 'شراء', fr: 'Achat', en: 'Purchase' },
    'tx.bonus':           { ar: 'بونص', fr: 'Bonus', en: 'Bonus' },
    'tx.bonus_expired':   { ar: 'انتهاء بونص', fr: 'Bonus expiré', en: 'Bonus Expired' },
    'tx.refund':          { ar: 'استرجاع', fr: 'Remboursement', en: 'Refund' },
    'tx.expired':         { ar: 'انتهاء', fr: 'Expiré', en: 'Expired' },
    'tx.adjust':          { ar: 'تعديل', fr: 'Ajustement', en: 'Adjustment' },
    'pay.pending':        { ar: 'قيد الانتظار', fr: 'En attente', en: 'Pending' },
    'pay.paid':           { ar: 'مدفوع', fr: 'Payé', en: 'Paid' },
    'pay.failed':         { ar: 'فشل', fr: 'Échoué', en: 'Failed' },
    'pay.canceled':       { ar: 'ملغي', fr: 'Annulé', en: 'Canceled' },
    'pay.expired':        { ar: 'منتهي', fr: 'Expiré', en: 'Expired' },

    // ---- Accounts ----
    'acc.title':          { ar: 'الحسابات', fr: 'Comptes', en: 'Accounts' },
    'acc.subtitle':       { ar: 'إدارة وتنظيم حسابات العملاء', fr: 'Gérer les comptes clients', en: 'Manage client accounts' },
    'acc.total':          { ar: 'إجمالي الحسابات', fr: 'Total des comptes', en: 'Total Accounts' },
    'acc.active':         { ar: 'نشط', fr: 'Actif', en: 'Active' },
    'acc.last-sync':      { ar: 'آخر تحديث', fr: 'Dernière sync', en: 'Last Sync' },
    'acc.expiring':       { ar: 'سينتهي قريباً', fr: 'Expire bientôt', en: 'Expiring' },
    'acc.expired':        { ar: 'منتهي', fr: 'Expiré', en: 'Expired' },
    'acc.suspended':      { ar: 'موقوف', fr: 'Suspendu', en: 'Suspended' },
    'acc.no-expiry':      { ar: 'بدون تاريخ', fr: 'Sans date', en: 'No expiry' },
    'acc.search':         { ar: 'ابحث باسم مستخدم أو ID...', fr: 'Rechercher...', en: 'Search username or ID...' },
    'acc.all-platforms':  { ar: 'كل المنصات', fr: 'Toutes les plateformes', en: 'All Platforms' },
    'acc.all-statuses':   { ar: 'كل الحالات', fr: 'Tous les statuts', en: 'All Statuses' },
    'acc.add':            { ar: 'إضافة حساب', fr: 'Ajouter un compte', en: 'Add Account' },
    'acc.add-title':      { ar: 'إضافة حساب جديد', fr: 'Nouveau compte', en: 'New Account' },
    'acc.platform':       { ar: 'المنصة', fr: 'Plateforme', en: 'Platform' },
    'acc.username':       { ar: 'اسم المستخدم أو البريد', fr: 'Nom d\'utilisateur', en: 'Username or Email' },
    'acc.password':       { ar: 'كلمة المرور', fr: 'Mot de passe', en: 'Password' },
    'acc.expiry':         { ar: 'تاريخ الانتهاء', fr: 'Date d\'expiration', en: 'Expiry Date' },
    'acc.notes':          { ar: 'الملاحظات', fr: 'Notes', en: 'Notes' },
    'acc.save':           { ar: 'حفظ الحساب', fr: 'Enregistrer', en: 'Save Account' },
    'acc.cancel':         { ar: 'إلغاء', fr: 'Annuler', en: 'Cancel' },
    'acc.empty':          { ar: 'لا توجد حسابات بعد', fr: 'Aucun compte', en: 'No accounts yet' },
    'acc.add-first':      { ar: 'أضف أول حساب', fr: 'Ajouter', en: 'Add First Account' },
    'acc.saving':         { ar: 'جاري الحفظ...', fr: 'Enregistrement...', en: 'Saving...' },
    'acc.optional':       { ar: 'اختياري', fr: 'Optionnel', en: 'Optional' },
    'acc.placeholder-un': { ar: 'مثال: user@example.com', fr: 'ex: user@example.com', en: 'e.g. user@example.com' },

    // ---- Orders ----
    'ord.title':          { ar: 'الطلبات', fr: 'Commandes', en: 'Orders' },
    'ord.total':          { ar: 'إجمالي الطلبات', fr: 'Total commandes', en: 'Total Orders' },
    'ord.pending':        { ar: 'قيد الانتظار', fr: 'En attente', en: 'Pending' },
    'ord.confirmed':      { ar: 'مؤكد', fr: 'Confirmé', en: 'Confirmed' },
    'ord.shipped':        { ar: 'تم الشحن', fr: 'Expédié', en: 'Shipped' },
    'ord.delivered':      { ar: 'تم التسليم', fr: 'Livré', en: 'Delivered' },
    'ord.canceled':       { ar: 'ملغي', fr: 'Annulé', en: 'Canceled' },

    // ---- Products ----
    'prd.title':          { ar: 'المنتجات', fr: 'Produits', en: 'Products' },

    // ---- Settings ----
    'set.title':          { ar: 'الإعدادات', fr: 'Paramètres', en: 'Settings' },
    'set.subtitle':       { ar: 'خصّص وكيلك الذكي', fr: 'Personnalisez votre agent', en: 'Customize your agent' },
    'set.shop-data':      { ar: 'بيانات المتجر', fr: 'Infos boutique', en: 'Shop Info' },
    'set.shop-name':      { ar: 'اسم المتجر', fr: 'Nom de la boutique', en: 'Shop Name' },
    'set.owner-name':     { ar: 'اسم المالك', fr: 'Nom du propriétaire', en: 'Owner Name' },
    'set.phone':          { ar: 'هاتف المالك', fr: 'Téléphone', en: 'Phone' },
    'set.save-shop':      { ar: 'حفظ بيانات المتجر', fr: 'Enregistrer', en: 'Save Shop' },
    'set.bot-personality':{ ar: 'شخصية الوكيل', fr: 'Personnalité du bot', en: 'Bot Personality' },
    'set.reply-style':    { ar: 'أسلوب الرد', fr: 'Style de réponse', en: 'Reply Style' },
    'set.friendly':       { ar: 'ودود', fr: 'Amical', en: 'Friendly' },
    'set.professional':   { ar: 'احترافي', fr: 'Professionnel', en: 'Professional' },
    'set.casual':         { ar: 'عفوي', fr: 'Décontracté', en: 'Casual' },
    'set.language':       { ar: 'اللغة', fr: 'Langue', en: 'Language' },
    'set.fusha':          { ar: 'العربية الفصحى', fr: 'Arabe classique', en: 'Classical Arabic' },
    'set.french':         { ar: 'الفرنسية', fr: 'Français', en: 'French' },
    'set.english':        { ar: 'الإنجليزية', fr: 'Anglais', en: 'English' },
    'set.save-bot':       { ar: 'حفظ شخصية الوكيل', fr: 'Enregistrer', en: 'Save Personality' },
    'set.api-key':        { ar: 'مفتاح الـ API', fr: 'Clé API', en: 'API Key' },
    'set.api-desc':       { ar: 'يستخدم هذا المفتاح للربط مع n8n والأنظمة الخارجية', fr: 'Utilisé pour n8n', en: 'Used for n8n integration' },
    'set.api-prefix':     { ar: 'هذا بادئة المفتاح للعرض فقط', fr: 'Préfixe seulement', en: 'Prefix only' },
    'set.regenerate':     { ar: 'إعادة توليد المفتاح', fr: 'Régénérer', en: 'Regenerate Key' },
    'set.save-key-now':   { ar: 'احفظ المفتاح الآن!', fr: 'Sauvegardez la clé!', en: 'Save the Key Now!' },
    'set.key-once':       { ar: 'سيظهر هذا المفتاح مرة واحدة فقط', fr: 'Visible une seule fois', en: 'Shown once only' },
    'set.copy':           { ar: 'نسخ', fr: 'Copier', en: 'Copy' },
    'set.done':           { ar: 'تم', fr: 'Terminé', en: 'Done' },
    'set.link-accounts':  { ar: 'ربط الحسابات', fr: 'Comptes liés', en: 'Linked Accounts' },
    'set.link-desc':      { ar: 'اربط حسابات التواصل الاجتماعي لتفعيل الرد التلقائي', fr: 'Liez vos réseaux sociaux', en: 'Link social accounts for auto-reply' },
    'set.no-linked':      { ar: 'لا توجد حسابات مرتبطة', fr: 'Aucun compte lié', en: 'No linked accounts' },
    'set.loading':        { ar: 'جاري التحميل...', fr: 'Chargement...', en: 'Loading...' },

    // ---- Dashbaord ----
    'dash.title':         { ar: 'لوحة التحكم', fr: 'Tableau de bord', en: 'Dashboard' },

    // ---- General / Shared ----
    'general.saving':     { ar: 'جاري الحفظ...', fr: 'Enregistrement...', en: 'Saving...' },
    'general.error':      { ar: 'خطأ', fr: 'Erreur', en: 'Error' },
    'general.success':    { ar: 'تم بنجاح', fr: 'Succès', en: 'Success' },
    'general.no-data':    { ar: 'لا توجد بيانات', fr: 'Aucune donnée', en: 'No data' },
    'general.copied':     { ar: 'تم النسخ', fr: 'Copié', en: 'Copied' },
    'general.confirm':    { ar: 'هل أنت متأكد؟', fr: 'Êtes-vous sûr?', en: 'Are you sure?' },
    'general.continue':   { ar: 'متابعة', fr: 'Continuer', en: 'Continue' },
  };

  var currentLang = localStorage.getItem(STORAGE_KEY) || 'ar';

  function setLang(code) {
    if (!LOCALES[code]) return;
    currentLang = code;
    localStorage.setItem(STORAGE_KEY, code);
    var html = document.documentElement;
    html.lang = code;
    html.dir = LOCALES[code].dir;
    // Dispatch event so pages can re-render
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: code } }));
  }

  function t(key, params) {
    var entry = DICT[key];
    if (!entry) return key;
    var val = entry[currentLang] || entry.en || key;
    if (params) {
      for (var k in params) {
        val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      }
    }
    return val;
  }

  function current() {
    return currentLang;
  }

  function locales() {
    return LOCALES;
  }

  // Auto-apply saved language on load
  (function init() {
    var code = localStorage.getItem(STORAGE_KEY) || 'ar';
    if (LOCALES[code]) {
      document.documentElement.lang = code;
      document.documentElement.dir = LOCALES[code].dir;
    }
  })();

  window.RahSahl = window.RahSahl || {};
  window.RahSahl.lang = {
    t: t,
    setLang: setLang,
    current: current,
    locales: locales,
    LOCALE_KEYS: Object.keys(LOCALES)
  };
})();
