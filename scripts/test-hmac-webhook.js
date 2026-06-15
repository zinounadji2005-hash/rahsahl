require('./load-env');
const crypto = require('crypto');

// Read existing shop from DB
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const webhookUrl = (process.env.N8N_HOST || 'http://ec2-34-228-227-112.compute-1.amazonaws.com:80').replace(/\/$/, '') + (process.env.N8N_WEBHOOK_PATH || '/webhook/v1/social-inbound');

  // Get first shop with api_secret_encrypted
    const { data: shops } = await admin
      .from('clients_shops')
      .select('id, api_secret_encrypted, api_secret_prefix')
      .not('api_secret_encrypted', 'is', null)
      .limit(1);

  if (shops?.[0]) {
    const v = shops[0].api_secret_encrypted;
    console.log('Type:', typeof v, 'len:', v.length, 'startsWith \\\\x:', v.startsWith('\\x'), 'startsWith x:', v.startsWith('x'));
  }

  if (!shops || shops.length === 0) {
    console.log('No shop with api_secret_encrypted. Seeding one...');

    // Create test shop with encrypted secret
    const masterKey = Buffer.from(process.env.HMAC_MASTER_KEY, 'base64');
    const apiSecret = 'afk_' + crypto.randomBytes(24).toString('hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    const enc = Buffer.concat([cipher.update(apiSecret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encryptedB64 = Buffer.concat([iv, enc, tag]).toString('base64');
    const prefix = apiSecret.substring(0, 8);

    const { data: u, error } = await admin.auth.admin.createUser({
      email: `hmac-test-${Date.now()}@test.local`,
      password: 'testpass123',
      email_confirm: true
    });
    if (error) throw error;

    await admin.from('clients_shops').insert({
      id: u.user.id, shop_name: 'HMAC Test', owner_name: 'T', phone_number: 'T',
      api_secret_encrypted: encryptedB64, api_secret_prefix: prefix,
      api_secret_last_used: null, onboarded_at: new Date().toISOString()
    });
    await admin.from('bot_settings').insert({
      shop_id: u.user.id, prompt_context: 'Test', target_dialect: 'dza',
      is_active: true, currency: 'DZD', shipping_fee: 500
    });

    shops.push({ id: u.user.id, api_secret_encrypted: encryptedB64, api_secret_prefix: prefix });
    console.log('Created test shop:', u.user.id);
  }

  const shop = shops[0];
  console.log('Using shop:', shop.id, 'prefix:', shop.api_secret_prefix);
  console.log('Encrypted length (b64):', shop.api_secret_encrypted.length);
  console.log('First 40 chars:', shop.api_secret_encrypted.substring(0, 40));

  // Decrypt to get raw secret (api_secret_encrypted is now TEXT, base64-encoded)
  const masterKey = Buffer.from(process.env.HMAC_MASTER_KEY, 'base64');
  const encBytes = Buffer.from(shop.api_secret_encrypted, 'base64');
  console.log('Encrypted bytes length:', encBytes.length);
  // Format: iv (12) | ciphertext (N) | tag (16)
  const iv = encBytes.slice(0, 12);
  const tag = encBytes.slice(encBytes.length - 16);
  const ct = encBytes.slice(12, encBytes.length - 16);
  console.log('iv len:', iv.length, 'ct len:', ct.length, 'tag len:', tag.length);
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(tag);
  const secret = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  console.log('Decrypted secret length:', secret.length, 'prefix:', secret.substring(0, 8));

  // Build payload + signature
  const payload = {
    shop_id: shop.id,
    sender_id: 'hmac-test-user',
    message: 'سلام، بغيت نطلب',
    channel: 'instagram'
  };
  const bodyStr = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
  console.log('Computed signature:', sig.substring(0, 16) + '...');

  // Test 1: VALID signature
  console.log('\n--- Test 1: VALID signature ---');
  let r = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': sig
    },
    body: bodyStr
  });
  console.log('Status:', r.status);
  let txt = await r.text();
  console.log('Response:', txt.substring(0, 300));

  // Test 2: INVALID signature
  console.log('\n--- Test 2: INVALID signature ---');
  r = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': 'invalid-signature-12345'
    },
    body: bodyStr
  });
  console.log('Status:', r.status);
  txt = await r.text();
  console.log('Response:', txt.substring(0, 300));

  // Test 3: MISSING signature
  console.log('\n--- Test 3: MISSING signature ---');
  r = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyStr
  });
  console.log('Status:', r.status);
  txt = await r.text();
  console.log('Response:', txt.substring(0, 300));
})().catch(e => console.error('ERR:', e.message, '\n', e.stack));
