/**
 * Generate a master key for HMAC secret encryption (AES-256-GCM).
 * Run once and add the output to .env as HMAC_MASTER_KEY.
 *
 * Usage: node scripts/generate-master-key.js
 */

const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('base64');
console.log('HMAC_MASTER_KEY=' + key);
console.log('\nAdd this to your .env file AND Supabase secrets:');
console.log('  - Local: .env file');
console.log('  - Supabase: npx supabase secrets set HMAC_MASTER_KEY=' + key);
console.log('\n⚠️  NEVER commit this key. NEVER lose it. Lost = all encrypted secrets unrecoverable.');
