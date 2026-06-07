/**
 * Set the error workflow for a given workflow.
 * Usage: node scripts/set-error-workflow.js <main-workflow-id> <error-workflow-id>
 */

require('./load-env');

async function setError() {
    const mainId  = process.argv[2];
    const errId   = process.argv[3];
    if (!mainId || !errId) {
        console.error('Usage: node scripts/set-error-workflow.js <main-id> <error-id>');
        process.exit(1);
    }

    const N8N_HOST = process.env.N8N_HOST.replace(/\/$/, '');
    const API_KEY  = process.env.N8N_API_KEY;

    // 1. Get current main workflow
    const getRes = await fetch(`${N8N_HOST}/api/v1/workflows/${mainId}`, {
        headers: { 'X-N8N-API-KEY': API_KEY }
    });
    if (!getRes.ok) {
        console.error('Failed to fetch:', getRes.status, await getRes.text());
        process.exit(1);
    }
    const wf = await getRes.json();

    // 2. Update settings with error workflow
    wf.settings = wf.settings || {};
    wf.settings.errorWorkflow = errId;

    // 3. PUT back (only allowed fields)
    const updateBody = {
        name: wf.name,
        nodes: wf.nodes,
        connections: wf.connections,
        settings: wf.settings
    };

    const putRes = await fetch(`${N8N_HOST}/api/v1/workflows/${mainId}`, {
        method: 'PUT',
        headers: {
            'X-N8N-API-KEY': API_KEY,
            'Content-Type':  'application/json'
        },
        body: JSON.stringify(updateBody)
    });
    if (!putRes.ok) {
        console.error('Failed to update:', putRes.status, await putRes.text());
        process.exit(1);
    }

    const updated = await putRes.json();
    console.log(`✅ Error workflow set`);
    console.log(`   Main:    ${updated.name} (${updated.id})`);
    console.log(`   Error:   ${errId}`);
    console.log(`   Settings: ${JSON.stringify(updated.settings)}`);
}

setError().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
