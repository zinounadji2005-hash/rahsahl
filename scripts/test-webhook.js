/**
 * Test the v4 webhook with various scenarios:
 *   1. Complete order
 *   2. Incomplete order (needs more info)
 *   3. Invalid payload (validation fails)
 *   4. Multi-turn conversation (memory)
 */

require('./load-env');

const WEBHOOK_URL = process.env.N8N_HOST.replace(/\/$/, '') + (process.env.N8N_WEBHOOK_PATH || '/webhook/v1/social-inbound');
const TEST_SHOP   = process.env.SHOP_ID || '11111111-1111-1111-1111-111111111111';

async function sendRequest(name, payload, expectStatus = 200) {
    console.log(`\n── Test: ${name} ──`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const t0 = Date.now();
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const latency = Date.now() - t0;

    console.log(`Status: ${res.status} (${latency}ms)`);
    const body = await res.text();
    try {
        const json = JSON.parse(body);
        console.log('Response:', JSON.stringify(json, null, 2));
        return { status: res.status, body: json, latency };
    } catch {
        console.log('Body (raw):', body);
        return { status: res.status, body, latency };
    }
}

async function main() {
    console.log('=== Testing AI Sales Agent v4 — Production ===\n');
    console.log('Webhook URL:', WEBHOOK_URL);
    console.log('Test shop:', TEST_SHOP);

    // 1. Complete order
    await sendRequest('1. Complete Order', {
        shop_id: TEST_SHOP,
        sender_id: 'ig_test_100',
        message: 'سلام، نطلب 2 حذاء رياضي أبيض، اسمي كريم من البليدة، رقمي 0555123456',
        channel: 'instagram'
    });

    // 2. Incomplete order (no phone)
    await sendRequest('2. Incomplete Order (missing phone)', {
        shop_id: TEST_SHOP,
        sender_id: 'ig_test_101',
        message: 'سلام نطلب 1 قميص بولو، اسمي أحمد من وهران',
        channel: 'whatsapp'
    });

    // 3. Memory test (multi-turn)
    await sendRequest('3a. First message in conversation', {
        shop_id: TEST_SHOP,
        sender_id: 'ig_test_102',
        message: 'بكم القميص؟',
        channel: 'instagram'
    });
    await new Promise(r => setTimeout(r, 2000));
    await sendRequest('3b. Follow-up: "same one"', {
        shop_id: TEST_SHOP,
        sender_id: 'ig_test_102',
        message: 'نفسه، أبي 1، اسمي سامي من قسنطينة، رقمي 0661234567',
        channel: 'instagram'
    });

    // 4. Invalid payload (missing shop_id)
    await sendRequest('4. Invalid (missing shop_id)', {
        sender_id: 'ig_test_103',
        message: 'hello',
        channel: 'instagram'
    });

    // 5. Invalid channel
    await sendRequest('5. Invalid channel', {
        shop_id: TEST_SHOP,
        sender_id: 'ig_test_104',
        message: 'hello',
        channel: 'sms'
    });

    console.log('\n=== Tests complete ===');
}

main().catch(err => {
    console.error('Test error:', err.message);
    process.exit(1);
});
