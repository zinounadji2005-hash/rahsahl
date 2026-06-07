const fs = require('fs');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  l = l.trim();
  if (!l || l.startsWith('#')) return;
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});
console.log('Loaded keys:', Object.keys(env));
console.log('Key prefix:', env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) : 'NULL');
const r = env.SUPABASE_URL;
const k = env.SUPABASE_SERVICE_ROLE_KEY;
console.log('URL:', r);
console.log('Key length:', k ? k.length : 0);
console.log('Key:', k);
console.log('URL env:', r);

(async () => {
  // Test clients_shops
  const shops = await fetch(r + '/rest/v1/clients_shops?select=id,name,owner_id&limit=3', {
    headers: { apikey: k, Authorization: 'Bearer ' + k }
  });
  console.log('Shops:', shops.status, await shops.text());

  // Test conversations insert
  const conv = await fetch(r + '/rest/v1/conversations', {
    method: 'POST',
    headers: {
      apikey: k,
      Authorization: 'Bearer ' + k,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      shop_id: '11111111-1111-1111-1111-111111111111',
      sender_id: 'test-debug',
      role: 'assistant',
      message: 'test debug'
    })
  });
  console.log('Insert conv:', conv.status, await conv.text());
})();
