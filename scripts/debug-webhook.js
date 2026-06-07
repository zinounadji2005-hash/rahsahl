/**
 * Single test that prints full response for debugging
 */
require('./load-env');

const WEBHOOK_URL = process.env.N8N_HOST.replace(/\/$/, '') + '/webhook/v1/social-inbound';

async function main() {
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shop_id: process.env.SHOP_ID || '11111111-1111-1111-1111-111111111111',
            sender_id: 'ig_debug_1',
            message: 'مرحبا',
            channel: 'instagram'
        })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
}

main();
