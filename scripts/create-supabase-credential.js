/**
 * Create a Supabase Service Role credential in n8n.
 *
 * Credential type: httpHeaderAuth
 * Required headers:
 *   - apikey: <service_role_key>
 *   - Authorization: Bearer <service_role_key>
 *   - Content-Type: application/json
 *
 * n8n will encrypt the data using its own key.
 */

require('./load-env');

async function create() {
    const N8N_HOST = process.env.N8N_HOST.replace(/\/$/, '');
    const API_KEY  = process.env.N8N_API_KEY;
    const SR_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SR_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is required');
        process.exit(1);
    }

    const headersJson = JSON.stringify({
        apikey:        SR_KEY,
        Authorization: `Bearer ${SR_KEY}`,
        'Content-Type':'application/json'
    });

    const body = {
        name: 'Supabase Service Role',
        type: 'httpHeaderAuth',
        data: {
            allowedDomains: 'rvjsnkolroaakskvvwnv.supabase.co',
            jsonWebToken:   '',
            headers:        headersJson
        }
    };

    console.log('Creating credential: Supabase Service Role');

    // Check if it already exists
    const listRes = await fetch(`${N8N_HOST}/api/v1/credentials?limit=200`, {
        headers: { 'X-N8N-API-KEY': API_KEY }
    });
    const listData = await listRes.json();
    const existing = (listData.credentials || listData.data || []).find(
        c => c.name === 'Supabase Service Role'
    );

    if (existing) {
        console.log(`⚠️  Already exists (id: ${existing.id}). Updating...`);
        const updateRes = await fetch(`${N8N_HOST}/api/v1/credentials/${existing.id}`, {
            method: 'PATCH',
            headers: {
                'X-N8N-API-KEY': API_KEY,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!updateRes.ok) {
            console.error('Update failed:', updateRes.status, await updateRes.text());
            process.exit(1);
        }
        console.log('✅ Updated');
        return;
    }

    const res = await fetch(`${N8N_HOST}/api/v1/credentials`, {
        method: 'POST',
        headers: {
            'X-N8N-API-KEY': API_KEY,
            'Content-Type':  'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const text = await res.text();
        console.error('Create failed:', res.status, text);
        process.exit(1);
    }

    const data = await res.json();
    console.log('✅ Created credential');
    console.log(`   ID:   ${data.id}`);
    console.log(`   Name: ${data.name}`);
    console.log(`   Type: ${data.type}`);
}

create().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
