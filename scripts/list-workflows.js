/**
 * List all workflows in n8n
 */

require('./load-env');

async function list() {
    const N8N_HOST = process.env.N8N_HOST.replace(/\/$/, '');
    const API_KEY  = process.env.N8N_API_KEY;

    const res = await fetch(`${N8N_HOST}/api/v1/workflows?limit=200`, {
        headers: { 'X-N8N-API-KEY': API_KEY }
    });

    if (!res.ok) {
        console.error('Failed:', res.status, await res.text());
        process.exit(1);
    }

    const data = await res.json();
    const workflows = data.data || data.workflows || [];

    console.log(`\nFound ${workflows.length} workflows:\n`);
    workflows.forEach(w => {
        const status = w.active ? '🟢 ACTIVE' : '⚪ INACTIVE';
        console.log(`  ${status}  ${w.name}`);
        console.log(`     ID: ${w.id}`);
        console.log(`     Nodes: ${(w.nodes || []).length}`);
        console.log('');
    });
}

list().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
