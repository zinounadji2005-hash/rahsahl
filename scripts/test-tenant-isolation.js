/**
 * Tenant Isolation Test
 * ---------------------
 * Verifies that RLS policies correctly isolate data between shops.
 *
 * Strategy:
 * 1. Use service role to create 2 test shops + their auth users
 * 2. Sign in as user A and B (using anon key)
 * 3. Each user creates an order via the workflow
 * 4. Each user tries to read the other's data → should get 0 rows
 * 5. Each user reads their own data → should succeed
 * 6. Cleanup
 *
 * Usage: node scripts/test-tenant-isolation.js
 */

require('./load-env');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const N8N_WEBHOOK = process.env.N8N_HOST + '/webhook/v1/social-inbound';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function createTestUser(email, password) {
    // Use admin API to create user
    const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { shop_name: 'Test ' + email, owner_name: 'Test', phone: '0555000000' }
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    return data.user;
}

async function deleteUser(userId) {
    await admin.auth.admin.deleteUser(userId);
}

async function runTest(name, fn) {
    try {
        const result = await fn();
        if (result === true) {
            console.log(`  ✅ ${name}`);
        } else {
            console.log(`  ❌ ${name} — expected true, got ${result}`);
            process.exitCode = 1;
        }
    } catch (err) {
        console.log(`  ❌ ${name} — ${err.message}`);
        process.exitCode = 1;
    }
}

async function main() {
    console.log('=== Tenant Isolation Test ===\n');
    const stamp = Date.now();
    const emailA = `shop-a-${stamp}@test.local`;
    const emailB = `shop-b-${stamp}@test.local`;

    let userA, userB, cleanup = [];

    try {
        console.log('1. Creating test users...');
        userA = await createTestUser(emailA, 'testpass123');
        userB = await createTestUser(emailB, 'testpass123');
        cleanup.push(() => deleteUser(userA.id));
        cleanup.push(() => deleteUser(userB.id));
        console.log(`   User A: ${userA.id}`);
        console.log(`   User B: ${userB.id}`);

        // Wait for trigger / create-shop edge function to populate clients_shops
        console.log('\n2. Waiting for shop creation...');
        let shopA, shopB;
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            const { data: a } = await admin.from('clients_shops').select('*').eq('id', userA.id).maybeSingle();
            const { data: b } = await admin.from('clients_shops').select('*').eq('id', userB.id).maybeSingle();
            if (a && b) { shopA = a; shopB = b; break; }
        }
        if (!shopA || !shopB) {
            console.log('   ⚠️  Shop rows not created yet (create-shop edge function not deployed?)');
            console.log('   Creating manually via service role...');
            await admin.from('clients_shops').insert([
                { id: userA.id, shop_name: 'Shop A', owner_name: 'A', phone_number: '0555000000' },
                { id: userB.id, shop_name: 'Shop B', owner_name: 'B', phone_number: '0555111111' }
            ]);
            await admin.from('bot_settings').insert([
                { shop_id: userA.id, prompt_context: 'A context', is_active: true },
                { shop_id: userB.id, prompt_context: 'B context', is_active: true }
            ]);
        }
        console.log('   ✓ Shops ready');

        // Sign in as A
        console.log('\n3. Signing in as User A and B...');
        const clientA = createClient(SUPABASE_URL, ANON_KEY, {
            auth: { persistSession: false }
        });
        const clientB = createClient(SUPABASE_URL, ANON_KEY, {
            auth: { persistSession: false }
        });
        const { error: errA } = await clientA.auth.signInWithPassword({ email: emailA, password: 'testpass123' });
        const { error: errB } = await clientB.auth.signInWithPassword({ email: emailB, password: 'testpass123' });
        if (errA || errB) throw new Error('Sign-in failed: ' + (errA?.message || errB?.message));
        console.log('   ✓ Both signed in');

        // Insert test data as service role
        console.log('\n4. Inserting test data (service role)...');
        await admin.from('orders').insert([
            { shop_id: userA.id, sender_id: 'ig_a_1', customer_name: 'Customer A', product_requested: 'A product', quantity: 1, order_status: 'pending' },
            { shop_id: userB.id, sender_id: 'ig_b_1', customer_name: 'Customer B', product_requested: 'B product', quantity: 2, order_status: 'pending' }
        ]);
        await admin.from('products').insert([
            { shop_id: userA.id, name: 'A only product', price: 1000, stock: 5 },
            { shop_id: userB.id, name: 'B only product', price: 2000, stock: 10 }
        ]);
        await admin.from('conversations').insert([
            { shop_id: userA.id, sender_id: 'ig_a_1', role: 'user', message: 'A message' },
            { shop_id: userB.id, sender_id: 'ig_b_1', role: 'user', message: 'B message' }
        ]);
        await admin.from('workflow_logs').insert([
            { execution_id: 'exec-a-1', shop_id: userA.id, stage: 'validation', status: 'success' },
            { execution_id: 'exec-b-1', shop_id: userB.id, stage: 'validation', status: 'success' }
        ]);
        console.log('   ✓ Data inserted');

        // Test isolation
        console.log('\n5. Testing RLS isolation...\n');

        // Orders
        await runTest('User A reads own orders', async () => {
            const { data } = await clientA.from('orders').select('*');
            return data?.length >= 1 && data.every(o => o.shop_id === userA.id);
        });

        await runTest('User A cannot see User B orders', async () => {
            const { data } = await clientA.from('orders').select('*').eq('shop_id', userB.id);
            return data?.length === 0;
        });

        await runTest('User B reads own orders', async () => {
            const { data } = await clientB.from('orders').select('*');
            return data?.length >= 1 && data.every(o => o.shop_id === userB.id);
        });

        // Products
        await runTest('User A sees only A products', async () => {
            const { data } = await clientA.from('products').select('*');
            return data?.length >= 1 && data.every(p => p.shop_id === userA.id);
        });

        await runTest('User B sees only B products', async () => {
            const { data } = await clientB.from('products').select('*');
            return data?.length >= 1 && data.every(p => p.shop_id === userB.id);
        });

        // Conversations
        await runTest('User A cannot see B conversations', async () => {
            const { data } = await clientA.from('conversations').select('*').eq('shop_id', userB.id);
            return data?.length === 0;
        });

        // Workflow logs
        await runTest('User A cannot see B workflow logs', async () => {
            const { data } = await clientA.from('workflow_logs').select('*').eq('shop_id', userB.id);
            return data?.length === 0;
        });

        // Shop profile
        await runTest('User A reads own shop profile', async () => {
            const { data } = await clientA.from('clients_shops').select('*').eq('id', userA.id).maybeSingle();
            return data?.id === userA.id;
        });

        await runTest('User A cannot see B shop profile', async () => {
            const { data } = await clientA.from('clients_shops').select('*').eq('id', userB.id).maybeSingle();
            return data === null;
        });

        // Bot settings
        await runTest('User A sees only A bot_settings', async () => {
            const { data } = await clientA.from('bot_settings').select('*');
            return data?.length >= 1 && data.every(b => b.shop_id === userA.id);
        });

        // Test that user A can update own order status
        await runTest('User A can update own order', async () => {
            const { data: orders } = await clientA.from('orders').select('id').limit(1);
            if (!orders?.length) return false;
            const { error } = await clientA.from('orders').update({ order_status: 'confirmed' }).eq('id', orders[0].id);
            return !error;
        });

        await runTest('User A CANNOT update B order (RLS deny)', async () => {
            // This should silently update 0 rows
            const { data: bOrders } = await clientB.from('orders').select('id').limit(1);
            if (!bOrders?.length) return false;
            // Try via A's client to update B's order
            const { data: updated } = await clientA
                .from('orders')
                .update({ order_status: 'shipped' })
                .eq('id', bOrders[0].id)
                .select();
            return !updated || updated.length === 0;
        });

        console.log('\n=== Cleanup ===');
        for (const fn of cleanup) {
            try { await fn(); } catch (e) { /* ignore */ }
        }
        // Delete test orders/products/conversations/logs
        await admin.from('orders').delete().in('shop_id', [userA.id, userB.id]);
        await admin.from('products').delete().in('shop_id', [userA.id, userB.id]);
        await admin.from('conversations').delete().in('shop_id', [userA.id, userB.id]);
        await admin.from('workflow_logs').delete().in('shop_id', [userA.id, userB.id]);
        await admin.from('bot_settings').delete().in('shop_id', [userA.id, userB.id]);
        await admin.from('clients_shops').delete().in('id', [userA.id, userB.id]);
        console.log('   ✓ Cleaned up');

        if (process.exitCode === 1) {
            console.log('\n❌ Some tests FAILED');
        } else {
            console.log('\n✅ All RLS isolation tests PASSED');
        }
    } catch (err) {
        console.error('\n❌ Test suite error:', err.message);
        for (const fn of cleanup) {
            try { await fn(); } catch (e) { /* ignore */ }
        }
        process.exit(1);
    }
}

main();
