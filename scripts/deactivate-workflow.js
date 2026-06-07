/**
 * Deactivate a workflow
 * Usage: node scripts/deactivate-workflow.js <id>
 */

require('./load-env');

async function deactivate() {
    const wfId = process.argv[2];
    if (!wfId) {
        console.error('Usage: node scripts/deactivate-workflow.js <id>');
        process.exit(1);
    }

    const N8N_HOST = process.env.N8N_HOST.replace(/\/$/, '');
    const API_KEY  = process.env.N8N_API_KEY;

    const res = await fetch(`${N8N_HOST}/api/v1/workflows/${wfId}/deactivate`, {
        method: 'POST',
        headers: { 'X-N8N-API-KEY': API_KEY }
    });

    if (!res.ok) {
        console.error('Failed:', res.status, await res.text());
        process.exit(1);
    }

    const data = await res.json();
    console.log(`✅ Deactivated: ${data.name}`);
    console.log(`   Active: ${data.active}`);
}

deactivate().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
