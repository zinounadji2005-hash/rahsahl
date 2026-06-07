const https = require('https');

const query = `
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test@antifahim.dz',
  crypt('test1234', gen_salt('bf')),
  now(), now(), now(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clients_shops (id, shop_name, owner_name, phone_number)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Shop',
  'Test Owner',
  '+213555000000'
) ON CONFLICT (id) DO NOTHING;

SELECT id, shop_name FROM public.clients_shops WHERE id = '11111111-1111-1111-1111-111111111111';
`;

const data = JSON.stringify({ query });
const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/rvjsnkolroaakskvvwnv/database/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + (process.env.SUPABASE_ACCESS_TOKEN || 'sbp_your_token_here'),
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', d.substring(0, 1500));
  });
});
req.on('error', e => console.error(e.message));
req.write(data);
req.end();
