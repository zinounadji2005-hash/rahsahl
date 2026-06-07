/**
 * Seed: Create default bot_settings for the test shop,
 * plus a few sample products for testing the catalog.
 */

require('./load-env');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_SHOP_ID = process.env.SHOP_ID || '11111111-1111-1111-1111-111111111111';

async function seed() {
    console.log('Seeding bot_settings for test shop...');

    const { data: existing } = await supabase
        .from('bot_settings')
        .select('id')
        .eq('shop_id', TEST_SHOP_ID)
        .maybeSingle();

    if (!existing) {
        const { error } = await supabase
            .from('bot_settings')
            .insert({
                shop_id: TEST_SHOP_ID,
                prompt_context: `متجر إلكتروني جزائري يبيع الملابس والإكسسوارات.

📦 الكتالوج الحالي:
- قميص قطن (T-Shirt) — 2500 دج
- قميص بولو (Polo) — 3500 دج
- جينز (Jeans) — 4500 دج
- حذاء رياضي (Sneakers) — 8000 دج
- حذاء كلاسيك (Classic Shoes) — 9500 دج
- حقيبة ظهر (Backpack) — 5500 دج

🚚 الشحن:
- الجزائر العاصمة: 400 دج
- الولايات الأخرى: 700 دج
- الدفع عند الاستلام (Cash on Delivery)

⏰ مدة التوصيل: 24-72 ساعة

📋 قواعد:
- لا تخترع منتجات أو أسعار غير موجودة
- إذا سأل العميل عن منتج غير موجود، قل "غير متوفر حالياً" واقترح البديل
- استخدم اللهجة الجزائرية في كل الردود
- كن ودود ومختصر (لا تكثر من الكلام)`,
                target_dialect: 'Algerian Darija',
                is_active: true
            });
        if (error) {
            console.error('Error creating bot_settings:', error.message);
            process.exit(1);
        }
        console.log('✅ bot_settings created');
    } else {
        console.log('ℹ️  bot_settings already exists');
    }

    // Seed products
    const products = [
        { shop_id: TEST_SHOP_ID, sku: 'TS-001', name: 'قميص قطن أزرق', price: 2500, stock: 50, tags: ['قميص', 't-shirt', 'tshirt', 'تيشيرت'] },
        { shop_id: TEST_SHOP_ID, sku: 'PL-001', name: 'قميص بولو أحمر', price: 3500, stock: 30, tags: ['بولو', 'polo'] },
        { shop_id: TEST_SHOP_ID, sku: 'JN-001', name: 'جينز كلاسيك', price: 4500, stock: 25, tags: ['جينز', 'jeans', 'بنطلون'] },
        { shop_id: TEST_SHOP_ID, sku: 'SN-001', name: 'حذاء رياضي أبيض', price: 8000, stock: 15, tags: ['حذاء', 'sneakers', 'سبور', 'رياضي'] },
        { shop_id: TEST_SHOP_ID, sku: 'SH-001', name: 'حذاء كلاسيك أسود', price: 9500, stock: 10, tags: ['حذاء', 'shoes', 'كلاسيك'] },
        { shop_id: TEST_SHOP_ID, sku: 'BP-001', name: 'حقيبة ظهر', price: 5500, stock: 20, tags: ['حقيبة', 'backpack', 'sac'] }
    ];

    for (const product of products) {
        const { data: existing } = await supabase
            .from('products')
            .select('id')
            .eq('shop_id', product.shop_id)
            .eq('sku', product.sku)
            .maybeSingle();

        if (existing) {
            const { error } = await supabase
                .from('products')
                .update(product)
                .eq('id', existing.id);
            if (error) console.error(`Error updating ${product.sku}:`, error.message);
        } else {
            const { error } = await supabase
                .from('products')
                .insert(product);
            if (error) console.error(`Error inserting ${product.sku}:`, error.message);
        }
    }
    console.log('✅ Products seeded');

    // Verify
    const { data: allProducts } = await supabase
        .from('products')
        .select('sku, name, price')
        .eq('shop_id', TEST_SHOP_ID);
    console.log('\n📦 Products in catalog:');
    allProducts?.forEach(p => console.log(`  - ${p.sku}: ${p.name} (${p.price} DZD)`));
}

seed().catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
