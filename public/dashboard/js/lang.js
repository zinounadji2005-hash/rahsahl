// public/dashboard/js/lang.js
// i18n for RahSahl dashboard — 4 languages, 3 platforms
// Usage: window.RahSahl.lang.t('key') or window.RahSahl.lang.t('key', {param: val})

(function () {
  'use strict';

  var STORAGE_KEY = 'rahsahl-lang';

  var LOCALES = {
    ar: { label: 'العربية', dir: 'rtl', flag: '🇸🇦' },
    fr: { label: 'Français', dir: 'rtl', flag: '🇫🇷' },
    en: { label: 'English', dir: 'ltr', flag: '🇬🇧' },
    ary: { label: 'الدارجة', dir: 'rtl', flag: '🇩🇿' },
  };

  var DICT = {
    // ---- Nav / Sidebar ----
    'app.name':           { ar: 'RahSahl', fr: 'RahSahl', en: 'RahSahl', ary: 'RahSahl' },
    'nav.dashboard':      { ar: 'لوحة التحكم', fr: 'Tableau de bord', en: 'Dashboard', ary: 'لوحة القيادة' },
    'nav.orders':         { ar: 'الطلبات', fr: 'Commandes', en: 'Orders', ary: 'الطلبات' },
    'nav.conversations':  { ar: 'المحادثات', fr: 'Conversations', en: 'Conversations', ary: 'المحادثات' },
    'nav.products':       { ar: 'المنتجات', fr: 'Produits', en: 'Products', ary: 'المنتجات' },
    'nav.billing':        { ar: 'الفوترة', fr: 'Facturation', en: 'Billing', ary: 'الفوترة' },
    'nav.accounts':       { ar: 'حساباتي', fr: 'Mes comptes', en: 'My Accounts', ary: 'حساباتي' },
    'nav.api-keys':       { ar: 'مفاتيح API', fr: 'Clés API', en: 'API Keys', ary: 'مفاتيح API' },
    'nav.settings':       { ar: 'الإعدادات', fr: 'Paramètres', en: 'Settings', ary: 'الإعدادات' },
    'nav.logout':         { ar: 'تسجيل الخروج', fr: 'Déconnexion', en: 'Logout', ary: 'خرج' },
    'nav.main-site':      { ar: 'الموقع الرئيسي', fr: 'Site principal', en: 'Main Site', ary: 'الموقع الرئيسي' },
    'nav.free':           { ar: 'مجاني', fr: 'Gratuit', en: 'Free', ary: 'مجاني' },
    'nav.lang':           { ar: 'اللغة', fr: 'Langue', en: 'Language', ary: 'اللغة' },

    // ---- Billing ----
    'bill.title':         { ar: 'الفوترة', fr: 'Facturation', en: 'Billing', ary: 'الفوترة' },
    'bill.subtitle':      { ar: 'إدارة الرصيد والمشتريات', fr: 'Gérer le solde et les achats', en: 'Manage balance and purchases', ary: 'تسيير الرصيد والمشتريات' },
    'bill.balance':       { ar: 'الرصيد الحالي', fr: 'Solde actuel', en: 'Current Balance', ary: 'الرصيد الحالي' },
    'bill.coin':          { ar: 'نقطة', fr: 'point', en: 'coin', ary: 'نقطة' },
    'bill.purchased':     { ar: 'تم شراؤها', fr: 'Achetés', en: 'Purchased', ary: 'مشريين' },
    'bill.spent':         { ar: 'مستعملة', fr: 'Utilisés', en: 'Spent', ary: 'مستعملة' },
    'bill.bonus':         { ar: 'بونص', fr: 'Bonus', en: 'Bonus', ary: 'بونص' },
    'bill.recharge':      { ar: 'اشحن رصيدك', fr: 'Recharger', en: 'Recharge', ary: 'شحن رصيدك' },
    'bill.pack-desc':     { ar: 'اختر الباقة المناسبة', fr: 'Choisissez le forfait', en: 'Choose your pack', ary: 'ختار الباقة المناسبة' },
    'bill.most-popular':  { ar: 'الأكثر طلباً', fr: 'Le plus populaire', en: 'Most Popular', ary: 'الأكثر طلباً' },
    'bill.buy-now':       { ar: 'اشتر الآن', fr: 'Acheter', en: 'Buy Now', ary: 'اشري دوك' },
    'bill.custom':        { ar: 'باقة مخصصة', fr: 'Forfait personnalisé', en: 'Custom Pack', ary: 'باقة مخصصة' },
    'bill.custom-desc':   { ar: 'اختر عدد النقاط (1,000 — 1,000,000)', fr: 'Choisissez le nombre de points', en: 'Choose coins amount', ary: 'ختار عدد النقاط' },
    'bill.price':         { ar: 'السعر', fr: 'Prix', en: 'Price', ary: 'الثمن' },
    'bill.per-coin':      { ar: 'د.ج/نقطة', fr: 'DZD/point', en: 'DZD/coin', ary: 'د.ج/نقطة' },
    'bill.buy-custom':    { ar: 'شراء مخصص', fr: 'Achat personnalisé', en: 'Custom Purchase', ary: 'شراء مخصص' },
    'bill.history':       { ar: 'سجل المعاملات', fr: 'Historique', en: 'Transaction History', ary: 'سجل المعاملات' },
    'bill.tx':            { ar: 'الحركات', fr: 'Transactions', en: 'Transactions', ary: 'الحركات' },
    'bill.payments':      { ar: 'المدفوعات', fr: 'Paiements', en: 'Payments', ary: 'المدفوعات' },
    'bill.loading':       { ar: 'جاري تحميل الباقات...', fr: 'Chargement...', en: 'Loading...', ary: 'تحميل...' },
    'bill.no-tx':         { ar: 'لا توجد حركات بعد', fr: 'Aucune transaction', en: 'No transactions yet', ary: 'ما تاش حركات' },
    'bill.no-payments':   { ar: 'لا توجد مدفوعات بعد', fr: 'Aucun paiement', en: 'No payments yet', ary: 'ما تاش مدفوعات' },
    'th.date':            { ar: 'التاريخ', fr: 'Date', en: 'Date', ary: 'التاريخ' },
    'th.type':            { ar: 'النوع', fr: 'Type', en: 'Type', ary: 'النوع' },
    'th.reason':          { ar: 'السبب', fr: 'Raison', en: 'Reason', ary: 'السبب' },
    'th.amount':          { ar: 'المبلغ', fr: 'Montant', en: 'Amount', ary: 'المبلغ' },
    'th.balance':         { ar: 'الرصيد', fr: 'Solde', en: 'Balance', ary: 'الرصيد' },
    'th.pack':            { ar: 'الباقة', fr: 'Forfait', en: 'Pack', ary: 'الباقة' },
    'th.coins':           { ar: 'النقاط', fr: 'Points', en: 'Coins', ary: 'النقاط' },
    'th.status':          { ar: 'الحالة', fr: 'Statut', en: 'Status', ary: 'الحالة' },
    'tx.deduction':       { ar: 'خصم', fr: 'Déduction', en: 'Deduction', ary: 'خصم' },
    'tx.purchase':        { ar: 'شراء', fr: 'Achat', en: 'Purchase', ary: 'شراء' },
    'tx.bonus':           { ar: 'بونص', fr: 'Bonus', en: 'Bonus', ary: 'بونص' },
    'tx.bonus_expired':   { ar: 'انتهاء بونص', fr: 'Bonus expiré', en: 'Bonus Expired', ary: 'خلص البونص' },
    'tx.refund':          { ar: 'استرجاع', fr: 'Remboursement', en: 'Refund', ary: 'استرجاع' },
    'tx.expired':         { ar: 'انتهاء', fr: 'Expiré', en: 'Expired', ary: 'انتهى' },
    'tx.adjust':          { ar: 'تعديل', fr: 'Ajustement', en: 'Adjustment', ary: 'تعديل' },
    'pay.pending':        { ar: 'قيد الانتظار', fr: 'En attente', en: 'Pending', ary: 'في الانتظار' },
    'pay.paid':           { ar: 'مدفوع', fr: 'Payé', en: 'Paid', ary: 'مدفوع' },
    'pay.failed':         { ar: 'فشل', fr: 'Échoué', en: 'Failed', ary: 'فشل' },
    'pay.canceled':       { ar: 'ملغي', fr: 'Annulé', en: 'Canceled', ary: 'ملغي' },
    'pay.expired':        { ar: 'منتهي', fr: 'Expiré', en: 'Expired', ary: 'منتهي' },

    // ---- Accounts ----
    'acc.title':          { ar: 'الحسابات', fr: 'Comptes', en: 'Accounts', ary: 'الحسابات' },
    'acc.subtitle':       { ar: 'إدارة وتنظيم حسابات العملاء', fr: 'Gérer les comptes clients', en: 'Manage client accounts', ary: 'تسيير حسابات العملاء' },
    'acc.total':          { ar: 'إجمالي الحسابات', fr: 'Total des comptes', en: 'Total Accounts', ary: 'مجموع الحسابات' },
    'acc.active':         { ar: 'نشط', fr: 'Actif', en: 'Active', ary: 'نشط' },
    'acc.last-sync':      { ar: 'آخر تحديث', fr: 'Dernière sync', en: 'Last Sync', ary: 'آخر تحديث' },
    'acc.expiring':       { ar: 'سينتهي قريباً', fr: 'Expire bientôt', en: 'Expiring', ary: 'غادي يخلص' },
    'acc.expired':        { ar: 'منتهي', fr: 'Expiré', en: 'Expired', ary: 'خلص' },
    'acc.suspended':      { ar: 'موقوف', fr: 'Suspendu', en: 'Suspended', ary: 'مسكر' },
    'acc.no-expiry':      { ar: 'بدون تاريخ', fr: 'Sans date', en: 'No expiry', ary: 'بلا تاريخ' },
    'acc.search':         { ar: 'ابحث باسم مستخدم أو ID...', fr: 'Rechercher...', en: 'Search username or ID...', ary: 'فتش على مستخدم...' },
    'acc.all-platforms':  { ar: 'كل المنصات', fr: 'Toutes les plateformes', en: 'All Platforms', ary: 'كل المنصات' },
    'acc.all-statuses':   { ar: 'كل الحالات', fr: 'Tous les statuts', en: 'All Statuses', ary: 'كل الحالات' },
    'acc.add':            { ar: 'إضافة حساب', fr: 'Ajouter un compte', en: 'Add Account', ary: 'زد حساب' },
    'acc.add-title':      { ar: 'إضافة حساب جديد', fr: 'Nouveau compte', en: 'New Account', ary: 'حساب جديد' },
    'acc.platform':       { ar: 'المنصة', fr: 'Plateforme', en: 'Platform', ary: 'المنصة' },
    'acc.username':       { ar: 'اسم المستخدم أو البريد', fr: 'Nom d\'utilisateur', en: 'Username or Email', ary: 'الاسم أو الإيميل' },
    'acc.password':       { ar: 'كلمة المرور', fr: 'Mot de passe', en: 'Password', ary: 'كلمة السر' },
    'acc.expiry':         { ar: 'تاريخ الانتهاء', fr: 'Date d\'expiration', en: 'Expiry Date', ary: 'تاريخ الانتهاء' },
    'acc.notes':          { ar: 'الملاحظات', fr: 'Notes', en: 'Notes', ary: 'ملاحظات' },
    'acc.save':           { ar: 'حفظ الحساب', fr: 'Enregistrer', en: 'Save Account', ary: 'حفظ' },
    'acc.cancel':         { ar: 'إلغاء', fr: 'Annuler', en: 'Cancel', ary: 'لغي' },
    'acc.empty':          { ar: 'لا توجد حسابات بعد', fr: 'Aucun compte', en: 'No accounts yet', ary: 'ما تاش حسابات' },
    'acc.add-first':      { ar: 'أضف أول حساب', fr: 'Ajouter', en: 'Add First Account', ary: 'زد أول حساب' },
    'acc.saving':         { ar: 'جاري الحفظ...', fr: 'Enregistrement...', en: 'Saving...', ary: 'تحفظ...' },
    'acc.optional':       { ar: 'اختياري', fr: 'Optionnel', en: 'Optional', ary: 'اختياري' },
    'acc.placeholder-un': { ar: 'مثال: user@example.com', fr: 'ex: user@example.com', en: 'e.g. user@example.com', ary: 'مثال: user@example.com' },

    // ---- Orders ----
    'ord.title':          { ar: 'الطلبات', fr: 'Commandes', en: 'Orders', ary: 'الطلبات' },
    'ord.total':          { ar: 'إجمالي الطلبات', fr: 'Total commandes', en: 'Total Orders', ary: 'مجموع الطلبات' },
    'ord.pending':        { ar: 'قيد الانتظار', fr: 'En attente', en: 'Pending', ary: 'في الانتظار' },
    'ord.confirmed':      { ar: 'مؤكد', fr: 'Confirmé', en: 'Confirmed', ary: 'مؤكد' },
    'ord.shipped':        { ar: 'تم الشحن', fr: 'Expédié', en: 'Shipped', ary: 'مشحون' },
    'ord.delivered':      { ar: 'تم التسليم', fr: 'Livré', en: 'Delivered', ary: 'مسلم' },
    'ord.canceled':       { ar: 'ملغي', fr: 'Annulé', en: 'Canceled', ary: 'ملغي' },

    // ---- Products ----
    'prd.title':          { ar: 'المنتجات', fr: 'Produits', en: 'Products', ary: 'المنتجات' },

    // ---- Settings ----
    'set.title':          { ar: 'الإعدادات', fr: 'Paramètres', en: 'Settings', ary: 'الإعدادات' },
    'set.subtitle':       { ar: 'خصّص وكيلك الذكي', fr: 'Personnalisez votre agent', en: 'Customize your agent', ary: 'خصص وكيلك' },
    'set.shop-data':      { ar: 'بيانات المتجر', fr: 'Infos boutique', en: 'Shop Info', ary: 'معلومات المتجر' },
    'set.shop-name':      { ar: 'اسم المتجر', fr: 'Nom de la boutique', en: 'Shop Name', ary: 'اسم المتجر' },
    'set.owner-name':     { ar: 'اسم المالك', fr: 'Nom du propriétaire', en: 'Owner Name', ary: 'اسم المالك' },
    'set.phone':          { ar: 'هاتف المالك', fr: 'Téléphone', en: 'Phone', ary: 'رقم الهاتف' },
    'set.save-shop':      { ar: 'حفظ بيانات المتجر', fr: 'Enregistrer', en: 'Save Shop', ary: 'حفظ' },
    'set.bot-personality':{ ar: 'شخصية الوكيل', fr: 'Personnalité du bot', en: 'Bot Personality', ary: 'شخصية الوكيل' },
    'set.reply-style':    { ar: 'أسلوب الرد', fr: 'Style de réponse', en: 'Reply Style', ary: 'أسلوب الرد' },
    'set.friendly':       { ar: 'ودود', fr: 'Amical', en: 'Friendly', ary: 'ودود' },
    'set.professional':   { ar: 'احترافي', fr: 'Professionnel', en: 'Professional', ary: 'احترافي' },
    'set.casual':         { ar: 'عفوي (دارجة)', fr: 'Décontracté', en: 'Casual', ary: 'بالدارجة' },
    'set.language':       { ar: 'اللهجة/اللغة', fr: 'Langue/dialecte', en: 'Language/Dialect', ary: 'اللغة/الدارجة' },
    'set.fusha':          { ar: 'العربية الفصحى', fr: 'Arabe classique', en: 'Classical Arabic', ary: 'العربية' },
    'set.darija':         { ar: 'الدارجة الجزائرية', fr: 'Darija algérienne', en: 'Algerian Darija', ary: 'الدارجة' },
    'set.french':         { ar: 'الفرنسية', fr: 'Français', en: 'French', ary: 'الفرنسية' },
    'set.english':        { ar: 'الإنجليزية', fr: 'Anglais', en: 'English', ary: 'الإنجليزية' },
    'set.save-bot':       { ar: 'حفظ شخصية الوكيل', fr: 'Enregistrer', en: 'Save Personality', ary: 'حفظ' },
    'set.api-key':        { ar: 'مفتاح الـ API', fr: 'Clé API', en: 'API Key', ary: 'مفتاح API' },
    'set.api-desc':       { ar: 'يستخدم هذا المفتاح للربط مع n8n والأنظمة الخارجية', fr: 'Utilisé pour n8n', en: 'Used for n8n integration', ary: 'يستخدم للربط مع n8n' },
    'set.api-prefix':     { ar: 'هذا بادئة المفتاح للعرض فقط', fr: 'Préfixe seulement', en: 'Prefix only', ary: 'هاد بادئة فقط' },
    'set.regenerate':     { ar: 'إعادة توليد المفتاح', fr: 'Régénérer', en: 'Regenerate Key', ary: 'جدد المفتاح' },
    'set.save-key-now':   { ar: 'احفظ المفتاح الآن!', fr: 'Sauvegardez la clé!', en: 'Save the Key Now!', ary: 'احفظ المفتاح!' },
    'set.key-once':       { ar: 'سيظهر هذا المفتاح مرة واحدة فقط', fr: 'Visible une seule fois', en: 'Shown once only', ary: 'يظهر مرة وحدة' },
    'set.copy':           { ar: 'نسخ', fr: 'Copier', en: 'Copy', ary: 'انسخ' },
    'set.done':           { ar: 'تم', fr: 'Terminé', en: 'Done', ary: 'تم' },
    'set.link-accounts':  { ar: 'ربط الحسابات', fr: 'Comptes liés', en: 'Linked Accounts', ary: 'الحسابات المرتبطة' },
    'set.link-desc':      { ar: 'اربط حسابات التواصل الاجتماعي لتفعيل الرد التلقائي', fr: 'Liez vos réseaux sociaux', en: 'Link social accounts for auto-reply', ary: 'ربط حساباتك للرد التلقائي' },
    'set.no-linked':      { ar: 'لا توجد حسابات مرتبطة', fr: 'Aucun compte lié', en: 'No linked accounts', ary: 'ما تاش حسابات مرتبطة' },
    'set.loading':        { ar: 'جاري التحميل...', fr: 'Chargement...', en: 'Loading...', ary: 'تحميل...' },

    // ---- Dashbaord ----
    'dash.title':         { ar: 'لوحة التحكم', fr: 'Tableau de bord', en: 'Dashboard', ary: 'لوحة القيادة' },

    // ---- General / Shared ----
    'general.saving':     { ar: 'جاري الحفظ...', fr: 'Enregistrement...', en: 'Saving...', ary: 'تحفظ...' },
    'general.error':      { ar: 'خطأ', fr: 'Erreur', en: 'Error', ary: 'خطأ' },
    'general.success':    { ar: 'تم بنجاح', fr: 'Succès', en: 'Success', ary: 'تم' },
    'general.no-data':    { ar: 'لا توجد بيانات', fr: 'Aucune donnée', en: 'No data', ary: 'ما تاش بيانات' },
    'general.copied':     { ar: 'تم النسخ', fr: 'Copié', en: 'Copied', ary: 'تم النسخ' },
    'general.confirm':    { ar: 'هل أنت متأكد؟', fr: 'Êtes-vous sûr?', en: 'Are you sure?', ary: 'متأكد؟' },
    'general.continue':   { ar: 'متابعة', fr: 'Continuer', en: 'Continue', ary: 'تابع' },
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
