const https = require('https');
const fs = require('fs');

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error('Usage: node run-migration.js <path-to-sql>');
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

const data = JSON.stringify({ query: sql });

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
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('OK');
      try {
        const parsed = JSON.parse(body);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log(body);
      }
    } else {
      console.log('Error body:', body);
    }
  });
});

req.on('error', (e) => console.error('Request error:', e));
req.write(data);
req.end();
