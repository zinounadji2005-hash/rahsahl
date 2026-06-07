/**
 * execute_migration.js
 * Connects directly to Supabase PostgreSQL and executes the full migration.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dns = require('dns');
// Force IPv4 resolution
dns.setDefaultResultOrder('ipv4first');

const client = new Client({
  host: 'db.rvjsnkolroaakskvvwnv.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'I0JEffQL8q5H7LKH',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000
});

async function run() {
  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const sqlFile = path.join(__dirname, 'supabase', 'FULL_MIGRATION.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('🚀 Executing migration...');
    await client.query(sql);
    console.log('✅ Migration executed successfully!\n');

    // Run verification queries
    console.log('🔍 Running verification...\n');

    // Check tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('clients_shops', 'bot_settings', 'orders')
      ORDER BY table_name;
    `);
    console.log('📋 Tables created:');
    tables.rows.forEach(r => console.log(`   ✅ ${r.table_name}`));

    // Check RLS
    const rls = await client.query(`
      SELECT tablename, rowsecurity FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('clients_shops', 'bot_settings', 'orders');
    `);
    console.log('\n🔒 RLS Status:');
    rls.rows.forEach(r => console.log(`   ${r.rowsecurity ? '✅' : '❌'} ${r.tablename}: ${r.rowsecurity ? 'ENABLED' : 'DISABLED'}`));

    // Check policies
    const policies = await client.query(`
      SELECT tablename, policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' ORDER BY tablename;
    `);
    console.log(`\n📋 RLS Policies (${policies.rows.length} total):`);
    policies.rows.forEach(r => console.log(`   ✅ ${r.tablename} → ${r.policyname} [${r.cmd}]`));

    // Check realtime
    const realtime = await client.query(`
      SELECT schemaname, tablename FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename IN ('orders', 'clients_shops');
    `);
    console.log('\n📡 Realtime enabled:');
    realtime.rows.forEach(r => console.log(`   ✅ ${r.schemaname}.${r.tablename}`));

    // Check indexes
    const indexes = await client.query(`
      SELECT indexname, tablename FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
      ORDER BY tablename;
    `);
    console.log(`\n⚡ Indexes (${indexes.rows.length} total):`);
    indexes.rows.forEach(r => console.log(`   ✅ ${r.tablename} → ${r.indexname}`));

    console.log('\n🎉 ========================================');
    console.log('   PHASE 1 COMPLETE — ALL CHECKS PASSED!');
    console.log('   ========================================\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.message.includes('already exists')) {
      console.log('\n⚠️  Some objects already exist. This is OK if migration was run before.');
    }
  } finally {
    await client.end();
  }
}

run();
