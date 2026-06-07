/**
 * Rename a credential in n8n.
 * Usage: node scripts/rename-credential.js <id> <new-name>
 */

require('./load-env');

async function rename() {
    const credId   = process.argv[2];
    const newName  = process.argv[3];
    if (!credId || !newName) {
        console.error('Usage: node scripts/rename-credential.js <id> <new-name>');
        process.exit(1);
    }

    const N8N_HOST = process.env.N8N_HOST.replace(/\/$/, '');
    const API_KEY  = process.env.N8N_API_KEY;

    const res = await fetch(`${N8N_HOST}/api/v1/credentials/${credId}`, {
        method: 'PATCH',
        headers: {
            'X-N8N-API-KEY': API_KEY,
            'Content-Type':  'application/json'
        },
        body: JSON.stringify({ name: newName })
    });

    if (!res.ok) {
        console.error('Rename failed:', res.status, await res.text());
        process.exit(1);
    }

    const data = await res.json();
    console.log(`✅ Renamed to: ${data.name} (id: ${data.id})`);
}

rename().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
