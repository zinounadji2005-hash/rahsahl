/**
 * Check existing n8n credentials
 */

require('./load-env');

async function check() {
    const N8N_HOST = process.env.N8N_HOST.replace(/\/$/, '');
    const API_KEY  = process.env.N8N_API_KEY;

    console.log('Listing n8n credentials...');
    const res = await fetch(`${N8N_HOST}/api/v1/credentials?limit=200`, {
        headers: { 'X-N8N-API-KEY': API_KEY }
    });

    if (!res.ok) {
        console.error('Failed:', res.status, await res.text());
        process.exit(1);
    }

    const data = await res.json();
    const creds = data.credentials || data.data || [];

    if (creds.length === 0) {
        console.log('⚠️  No credentials found. You need to create:');
        console.log('   1. "Supabase Service Role" (type: httpHeaderAuth)');
        console.log('   2. "Groq API" (type: groqApi)');
        console.log('\nThese can be created via the n8n UI.');
        return;
    }

    console.log(`\nFound ${creds.length} credentials:`);
    creds.forEach(c => {
        console.log(`  - ${c.name} (id: ${c.id}, type: ${c.type})`);
    });

    const hasSupabase = creds.find(c => c.name === 'Supabase Service Role');
    const hasGroq     = creds.find(c => c.name === 'Groq API');

    console.log('\n=== Status ===');
    console.log(`  Supabase Service Role: ${hasSupabase ? '✅' : '❌ MISSING'}`);
    console.log(`  Groq API:              ${hasGroq ? '✅' : '❌ MISSING'}`);
}

check().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
