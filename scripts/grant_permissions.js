const https = require('https');

const query = `
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON SCHEMA public TO service_role;
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
    console.log('Body:', d.substring(0, 500));
  });
});
req.on('error', e => console.error(e.message));
req.write(data);
req.end();
