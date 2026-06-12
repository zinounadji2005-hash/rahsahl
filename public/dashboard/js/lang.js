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
    'ord.subtitle':       { ar: 'إدارة طلباتك وتتبع حالتها.', fr: 'Gérez vos commandes.', en: 'Manage your orders.' },
    'ord.total':          { ar: 'إجمالي الطلبات', fr: 'Total commandes', en: 'Total Orders' },
    'ord.pending':        { ar: 'قيد الانتظار', fr: 'En attente', en: 'Pending' },
    'ord.confirmed':      { ar: 'مؤكد', fr: 'Confirmé', en: 'Confirmed' },
    'ord.shipped':        { ar: 'تم الشحن', fr: 'Expédié', en: 'Shipped' },
    'ord.delivered':      { ar: 'تم التسليم', fr: 'Livré', en: 'Delivered' },
    'ord.canceled':       { ar: 'ملغي', fr: 'Annulé', en: 'Canceled' },
    'ord.all':            { ar: 'الكل', fr: 'Tous', en: 'All' },
    'ord.search':         { ar: 'ابحث بالاسم، المنتج، المدينة...', fr: 'Rechercher...', en: 'Search name, product, city...' },
    'ord.customer':       { ar: 'العميل', fr: 'Client', en: 'Customer' },
    'ord.product':        { ar: 'المنتج', fr: 'Produit', en: 'Product' },
    'ord.city':           { ar: 'المدينة', fr: 'Ville', en: 'City' },
    'ord.status':         { ar: 'الحالة', fr: 'Statut', en: 'Status' },
    'ord.date':           { ar: 'التاريخ', fr: 'Date', en: 'Date' },
    'ord.action':         { ar: 'إجراء', fr: 'Action', en: 'Action' },
    'ord.no-filter':      { ar: 'لا توجد طلبات تطابق الفلاتر', fr: 'Aucune commande trouvée', en: 'No matching orders' },
    'ord.confirm-btn':    { ar: 'تأكيد', fr: 'Confirmer', en: 'Confirm' },
    'ord.ship-btn':       { ar: 'شحن', fr: 'Expédier', en: 'Ship' },
    'ord.quantity':       { ar: 'الكمية', fr: 'Quantité', en: 'Qty' },
    'ord.update-fail':    { ar: 'فشل تحديث الحالة', fr: 'Échec de mise à jour', en: 'Status update failed' },
    'ord.load-fail':      { ar: 'فشل تحميل الطلبات', fr: 'Échec du chargement', en: 'Failed to load orders' },

    // ---- Products ----
    'prd.title':          { ar: 'المنتجات', fr: 'Produits', en: 'Products' },
    'prd.name':           { ar: 'اسم المنتج', fr: 'Nom du produit', en: 'Product Name' },
    'prd.sku':            { ar: 'SKU', fr: 'SKU', en: 'SKU' },
    'prd.optional':       { ar: 'اختياري', fr: 'Optionnel', en: 'Optional' },
    'prd.description':    { ar: 'الوصف', fr: 'Description', en: 'Description' },
    'prd.price':          { ar: 'السعر (د.ج)', fr: 'Prix (DZD)', en: 'Price (DZD)' },
    'prd.stock':          { ar: 'المخزون', fr: 'Stock', en: 'Stock' },
    'prd.active-label':   { ar: 'منتج نشط (يظهر للعميل)', fr: 'Produit actif', en: 'Active product' },
    'prd.save':           { ar: 'حفظ التعديلات', fr: 'Enregistrer', en: 'Save Changes' },
    'prd.add':            { ar: 'إضافة المنتج', fr: 'Ajouter', en: 'Add Product' },
    'prd.cancel':         { ar: 'إلغاء', fr: 'Annuler', en: 'Cancel' },
    'prd.empty':          { ar: 'لا توجد منتجات. أضف أول منتج!', fr: 'Aucun produit.', en: 'No products yet!' },
    'prd.active':         { ar: 'نشط', fr: 'Actif', en: 'Active' },
    'prd.hidden':         { ar: 'مخفي', fr: 'Masqué', en: 'Hidden' },
    'prd.inventory':      { ar: 'المخزون', fr: 'Stock', en: 'Stock' },
    'prd.new':            { ar: 'منتج جديد', fr: 'Nouveau produit', en: 'New Product' },
    'prd.add-new':        { ar: 'إضافة منتج جديد', fr: 'Ajouter un produit', en: 'Add New Product' },
    'prd.edit-title':     { ar: 'تعديل', fr: 'Modifier', en: 'Edit' },
    'prd.delete-confirm': { ar: 'هل أنت متأكد من حذف هذا المنتج؟', fr: 'Confirmer la suppression?', en: 'Delete this product?' },
    'prd.saved':          { ar: 'تم تحديث المنتج', fr: 'Produit mis à jour', en: 'Product updated' },
    'prd.created':        { ar: 'تم إضافة المنتج', fr: 'Produit ajouté', en: 'Product created' },
    'prd.deleted':        { ar: 'تم حذف المنتج', fr: 'Produit supprimé', en: 'Product deleted' },
    'prd.load-fail':      { ar: 'فشل تحميل المنتجات', fr: 'Échec du chargement', en: 'Failed to load products' },

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

    // ---- Dashboard ----
    'dash.title':         { ar: 'لوحة التحكم', fr: 'Tableau de bord', en: 'Dashboard' },
    'dash.subtitle':      { ar: 'إليك ملخص أداء متجرك اليوم.', fr: 'Résumé de votre boutique.', en: 'Your shop summary today.' },
    'dash.greeting':      { ar: 'مرحباً', fr: 'Bonjour', en: 'Hello' },
    'dash.merchant':      { ar: 'تاجر', fr: 'Commerçant', en: 'Merchant' },
    'dash.total-orders':  { ar: 'إجمالي الطلبات', fr: 'Total commandes', en: 'Total Orders' },
    'dash.processing':    { ar: 'قيد المعالجة', fr: 'En traitement', en: 'Processing' },
    'dash.confirmed-orders':{ ar: 'الطلبات المأكّدة', fr: 'Commandes confirmées', en: 'Confirmed Orders' },
    'dash.pending-pct':   { ar: 'معلقة', fr: 'En attente', en: 'Pending' },
    'dash.convs-24h':     { ar: 'المحادثات (24س)', fr: 'Conversations (24h)', en: 'Conversations (24h)' },
    'dash.recent':        { ar: 'حديثاً', fr: 'Récent', en: 'Recent' },
    'dash.success-rate':  { ar: 'معدل النجاح', fr: 'Taux de succès', en: 'Success Rate' },
    'dash.no-data':       { ar: 'لا توجد بيانات', fr: 'Aucune donnée', en: 'No data' },
    'dash.llm-inference': { ar: 'استدلال LLM', fr: 'Inférence LLM', en: 'LLM Inference' },
    'dash.sales-perf':    { ar: 'أداء المبيعات', fr: 'Performance ventes', en: 'Sales Performance' },
    'dash.last-7-days':   { ar: 'آخر 7 أيام', fr: '7 derniers jours', en: 'Last 7 days' },
    'dash.latest-orders': { ar: 'أحدث الطلبات', fr: 'Dernières commandes', en: 'Latest Orders' },
    'dash.view-all':      { ar: 'عرض الكل', fr: 'Voir tout', en: 'View All' },
    'dash.no-orders':     { ar: 'لا توجد طلبات بعد', fr: 'Aucune commande', en: 'No orders yet' },
    'dash.no-name':       { ar: 'بدون اسم', fr: 'Sans nom', en: 'No name' },
    'dash.latest-convs':  { ar: 'آخر نشاط المحادثات', fr: 'Dernières conversations', en: 'Latest Conversations' },
    'dash.no-convs':      { ar: 'لا توجد محادثات بعد', fr: 'Aucune conversation', en: 'No conversations yet' },
    'dash.conversation':  { ar: 'محادثة', fr: 'Conversation', en: 'Conversation' },
    'dash.orders':        { ar: 'الطلبات', fr: 'Commandes', en: 'Orders' },
    'dash.sun':           { ar: 'الأحد', fr: 'Dim', en: 'Sun' },
    'dash.mon':           { ar: 'الإثنين', fr: 'Lun', en: 'Mon' },
    'dash.tue':           { ar: 'الثلاثاء', fr: 'Mar', en: 'Tue' },
    'dash.wed':           { ar: 'الأربعاء', fr: 'Mer', en: 'Wed' },
    'dash.thu':           { ar: 'الخميس', fr: 'Jeu', en: 'Thu' },
    'dash.fri':           { ar: 'الجمعة', fr: 'Ven', en: 'Fri' },
    'dash.sat':           { ar: 'السبت', fr: 'Sam', en: 'Sat' },

    // ---- Conversations ----
    'conv.title':         { ar: 'المحادثات', fr: 'Conversations', en: 'Conversations' },
    'conv.active':        { ar: 'عميل نشط', fr: 'Client actif', en: 'Active client' },
    'conv.msg':           { ar: 'رسالة', fr: 'message', en: 'message' },
    'conv.msgs':          { ar: 'رسائل', fr: 'messages', en: 'messages' },
    'conv.empty':         { ar: 'لا توجد محادثات بعد. ابدأ بإرسال رسالة!', fr: 'Aucune conversation.', en: 'No conversations yet!' },
    'conv.load-fail':     { ar: 'فشل تحميل المحادثات', fr: 'Échec du chargement', en: 'Failed to load conversations' },

    // ---- API Keys ----
    'api.title':          { ar: 'مفاتيح API', fr: 'Clés API', en: 'API Keys' },
    'api.subtitle':       { ar: 'إدارة الوصول البرمجي', fr: 'Gérer l\'accès API', en: 'Manage API access' },
    'api.current-key':    { ar: 'مفتاح API الحالي', fr: 'Clé API actuelle', en: 'Current API Key' },
    'api.desc':           { ar: 'يستخدم للربط مع n8n والأنظمة الخارجية', fr: 'Utilisé pour n8n', en: 'Used for n8n integration' },
    'api.prefix':         { ar: 'البادئة', fr: 'Préfixe', en: 'Prefix' },
    'api.prefix-safe':    { ar: 'البادئة آمنة للعرض. المفتاح الكامل يظهر مرة واحدة عند التوليد.', fr: 'Préfixe visible seulement.', en: 'Prefix is safe to display.' },
    'api.last-used':      { ar: 'آخر استخدام', fr: 'Dernière utilisation', en: 'Last Used' },
    'api.not-generated':  { ar: 'لم يُولّد بعد', fr: 'Pas encore généré', en: 'Not generated yet' },
    'api.not-used':       { ar: 'لم يُستخدم بعد', fr: 'Pas encore utilisé', en: 'Not used yet' },
    'api.regenerate':     { ar: 'إعادة توليد المفتاح', fr: 'Régénérer', en: 'Regenerate Key' },
    'api.webhook':        { ar: 'n8n Webhook', fr: 'Webhook n8n', en: 'n8n Webhook' },
    'api.webhook-desc':   { ar: 'نقطة الاستقبال الرئيسية', fr: 'Point d\'entrée', en: 'Main endpoint' },
    'api.webhook-note':   { ar: 'ملاحظة:', fr: 'Note:', en: 'Note:' },
    'api.webhook-hmac':   { ar: 'يجب إرسال HMAC-SHA256 signature في الـ header', fr: 'HMAC-SHA256 requis', en: 'HMAC-SHA256 required' },
    'api.webhook-secure': { ar: 'لتأمين الطلبات.', fr: 'pour sécuriser les requêtes.', en: 'to secure requests.' },
    'api.audit-log':      { ar: 'سجل النشاط', fr: 'Journal d\'activité', en: 'Activity Log' },
    'api.audit-desc':     { ar: 'آخر 50 عملية على المفتاح', fr: '50 dernières actions', en: 'Last 50 actions' },
    'api.audit-empty':    { ar: 'لا توجد عمليات مسجلة بعد', fr: 'Aucune activité', en: 'No activity yet' },
    'api.col-action':     { ar: 'العملية', fr: 'Action', en: 'Action' },
    'api.col-status':     { ar: 'الحالة', fr: 'Statut', en: 'Status' },
    'api.col-ip':         { ar: 'عنوان IP', fr: 'Adresse IP', en: 'IP Address' },
    'api.col-browser':    { ar: 'المتصفح', fr: 'Navigateur', en: 'Browser' },
    'api.col-date':       { ar: 'التاريخ', fr: 'Date', en: 'Date' },
    'api.success':        { ar: 'نجحت', fr: 'Succès', en: 'Success' },
    'api.failed':         { ar: 'فشلت', fr: 'Échec', en: 'Failed' },
    'api.save-now':       { ar: 'احفظ المفتاح الآن!', fr: 'Sauvegardez la clé!', en: 'Save the Key Now!' },
    'api.show-once':      { ar: 'سيظهر هذا المفتاح مرة واحدة فقط. احفظه في مكان آمن قبل المتابعة.', fr: 'Visible une seule fois.', en: 'Shown once only.' },
    'api.copy':           { ar: 'نسخ', fr: 'Copier', en: 'Copy' },
    'api.done':           { ar: 'تم', fr: 'Terminé', en: 'Done' },
    'api.copied-prefix':  { ar: 'تم نسخ البادئة', fr: 'Préfixe copié', en: 'Prefix copied' },
    'api.regenerate-confirm':{ ar: 'هل أنت متأكد؟ المفتاح القديم سيتوقف عن العمل فوراً.', fr: 'Confirmer?', en: 'Old key will stop working.' },
    'api.generating':     { ar: 'جاري التوليد...', fr: 'Génération...', en: 'Generating...' },
    'api.copied-new':     { ar: 'تم نسخ المفتاح الجديد', fr: 'Nouvelle clé copiée', en: 'New key copied' },
    'api.generated':      { ar: 'تم توليد مفتاح جديد', fr: 'Nouvelle clé générée', en: 'New key generated' },

    // ---- General / Shared ----
    'general.saving':     { ar: 'جاري الحفظ...', fr: 'Enregistrement...', en: 'Saving...' },
    'general.error':      { ar: 'خطأ', fr: 'Erreur', en: 'Error' },
    'general.success':    { ar: 'تم بنجاح', fr: 'Succès', en: 'Success' },
    'general.no-data':    { ar: 'لا توجد بيانات', fr: 'Aucune donnée', en: 'No data' },
    'general.copied':     { ar: 'تم النسخ', fr: 'Copié', en: 'Copied' },
    'general.confirm':    { ar: 'هل أنت متأكد؟', fr: 'Êtes-vous sûr?', en: 'Are you sure?' },
    'general.continue':   { ar: 'متابعة', fr: 'Continuer', en: 'Continue' },
    'general.now':        { ar: 'الآن', fr: 'Maintenant', en: 'Now' },
    'general.ago':        { ar: 'منذ', fr: 'il y a', en: '' },
    'general.min':        { ar: 'د', fr: 'min', en: 'min' },
    'general.hour':       { ar: 'س', fr: 'h', en: 'h' },
    'general.day':        { ar: 'يوم', fr: 'j', en: 'd' },
    'general.orders':     { ar: 'الطلبات', fr: 'Commandes', en: 'Orders' },

    // ---- OAuth ----
    'oauth.connect':      { ar: 'ربط مع Facebook', fr: 'Connecter avec Facebook', en: 'Connect with Facebook' },
    'oauth.disconnect':   { ar: 'إلغاء الربط', fr: 'Déconnecter', en: 'Disconnect' },
    'oauth.success':      { ar: 'تم ربط {count} حساب بنجاح', fr: '{count} compte(s) connecté(s)', en: '{count} account(s) connected' },
    'oauth.error':        { ar: 'فشل الربط: {reason}', fr: 'Échec: {reason}', en: 'Failed: {reason}' },
    'oauth.no-pages':     { ar: 'لا توجد صفحات فيسبوك. أنشئ صفحة أولاً.', fr: 'Aucune page Facebook.', en: 'No Facebook Pages found.' },
    'oauth.disconnected': { ar: 'تم إلغاء ربط الحساب', fr: 'Compte déconnecté', en: 'Account disconnected' },
    'oauth.connecting':   { ar: 'جاري الربط...', fr: 'Connexion...', en: 'Connecting...' },

    // ---- WhatsApp ----
    'wa.setup':           { ar: 'إعداد واتساب', fr: 'Configurer WhatsApp', en: 'Setup WhatsApp' },
    'wa.connected':       { ar: 'متصل بـ WhatsApp', fr: 'WhatsApp connecté', en: 'WhatsApp Connected' },
    'wa.not-connected':   { ar: 'غير متصل بـ WhatsApp', fr: 'WhatsApp non connecté', en: 'WhatsApp Not Connected' },
    'wa.phone':           { ar: 'رقم الهاتف', fr: 'Numéro de téléphone', en: 'Phone Number' },
    'wa.token':           { ar: 'رمز الوصول (Access Token)', fr: 'Token d\'accès', en: 'Access Token' },
    'wa.phone-id':        { ar: 'معرف رقم الهاتف (Phone Number ID)', fr: 'Phone Number ID', en: 'Phone Number ID' },
    'wa.business-id':     { ar: 'معرف حساب الأعمال (WABA ID)', fr: 'WABA ID', en: 'WhatsApp Business Account ID' },
    'wa.save':            { ar: 'حفظ الإعدادات', fr: 'Enregistrer', en: 'Save Settings' },
    'wa.saving':          { ar: 'جاري الحفظ...', fr: 'Enregistrement...', en: 'Saving...' },
    'wa.saved':           { ar: 'تم حفظ إعدادات واتساب', fr: 'Paramètres WhatsApp enregistrés', en: 'WhatsApp settings saved' },
    'wa.disconnect':      { ar: 'إلغاء اتصال واتساب', fr: 'Déconnecter WhatsApp', en: 'Disconnect WhatsApp' },
    'wa.disconnected':    { ar: 'تم إلغاء اتصال واتساب', fr: 'WhatsApp déconnecté', en: 'WhatsApp disconnected' },
    'wa.webhook-hint':   { ar: 'رابط الـ Webhook:', fr: 'URL du Webhook:', en: 'Webhook URL:' },
    'wa.webhook-verify':  { ar: 'رمز التحقق:', fr: 'Token de vérification:', en: 'Verify Token:' },
    'wa.title':           { ar: 'إعداد واتساب كلاود API', fr: 'Configuration WhatsApp Cloud API', en: 'WhatsApp Cloud API Setup' },
    'wa.desc':            { ar: 'أدخل بيانات حساب الأعمال من Meta Business Suite', fr: 'Entrez les identifiants de Meta Business Suite', en: 'Enter your Meta Business Suite credentials' },

    // ---- Instagram ----
    'ig.title':           { ar: 'إنستغرام', fr: 'Instagram', en: 'Instagram' },
    'ig.desc':            { ar: 'اربط حسابات إنستغرام الخاصة بك. يتم الربط عبر صفحة فيسبوك.', fr: 'Connectez vos comptes Instagram via une page Facebook.', en: 'Connect your Instagram accounts via a Facebook Page.' },
    'ig.connect':         { ar: 'ربط إنستغرام', fr: 'Connecter Instagram', en: 'Connect Instagram' },
    'ig.connected':       { ar: '{count} حساب إنستغرام متصل', fr: '{count} compte(s) Instagram connecté(s)', en: '{count} Instagram account(s) connected' },
    'ig.no-accounts':     { ar: 'لا توجد حسابات إنستغرام مرتبطة', fr: 'Aucun compte Instagram lié', en: 'No Instagram accounts linked' },
    'ig.via-facebook':    { ar: 'عبر ربط فيسبوك', fr: 'Via connexion Facebook', en: 'Via Facebook connection' },
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
  // Global shortcut
  window.__ = t;
})();
