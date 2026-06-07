/**
 * Workflow deployer — uploads a workflow JSON to n8n via API
 *
 * Usage:
 *   node scripts/deploy-workflow.js <workflow-json-file> [--activate]
 *
 * The JSON file must match the n8n workflow schema:
 *   {
 *     "name": "...",
 *     "nodes": [...],
 *     "connections": {...},
 *     "settings": { "executionOrder": "v1" }
 *   }
 */

require('./load-env');
const fs = require('fs');
const path = require('path');

async function deploy() {
    const filePath = process.argv[2];
    const activate = process.argv.includes('--activate');

    if (!filePath) {
        console.error('Usage: node scripts/deploy-workflow.js <workflow.json> [--activate]');
        process.exit(1);
    }

    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error('File not found:', absPath);
        process.exit(1);
    }

    const workflow = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    const N8N_HOST = process.env.N8N_HOST.replace(/\/$/, '');
    const API_KEY  = process.env.N8N_API_KEY;

    if (!N8N_HOST || !API_KEY) {
        console.error('N8N_HOST and N8N_API_KEY must be set');
        process.exit(1);
    }

    const headers = {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json'
    };

    console.log(`Deploying: ${workflow.name}`);
    console.log(`  Nodes: ${workflow.nodes.length}`);
    console.log(`  Host:  ${N8N_HOST}`);

    // 1. Find or create the workflow
    const listRes = await fetch(`${N8N_HOST}/api/v1/workflows?limit=200`, { headers });
    if (!listRes.ok) {
        console.error('Failed to list workflows:', listRes.status, await listRes.text());
        process.exit(1);
    }
    const listData = await listRes.json();
    const existing = (listData.data || listData.workflows || []).find(w => w.name === workflow.name);

    let workflowId;
    let method;
    let url;

    if (existing) {
        workflowId = existing.id;
        method = 'PUT';
        url    = `${N8N_HOST}/api/v1/workflows/${workflowId}`;
        console.log(`  ↻  Updating existing workflow: ${workflowId}`);
    } else {
        method = 'POST';
        url    = `${N8N_HOST}/api/v1/workflows`;
        console.log(`  +  Creating new workflow`);
    }

    const body = {
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections || {},
        settings: workflow.settings || { executionOrder: 'v1' },
        staticData: workflow.staticData || null
    };

    const createRes = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body)
    });

    if (!createRes.ok) {
        const errText = await createRes.text();
        console.error('Failed to deploy:', createRes.status, errText);
        process.exit(1);
    }

    const created = await createRes.json();
    workflowId = created.id || created.data?.id;
    console.log(`  ✅ Workflow saved: ${workflowId}`);

    // 2. Activate if requested
    if (activate) {
        console.log('  Activating...');
        const actRes = await fetch(`${N8N_HOST}/api/v1/workflows/${workflowId}/activate`, {
            method: 'POST',
            headers
        });
        if (!actRes.ok) {
            const errText = await actRes.text();
            console.error('  Failed to activate:', actRes.status, errText);
            process.exit(1);
        }
        const actData = await actRes.json();
        console.log(`  ✅ Activated. Active=${actData.active}`);
    }

    console.log('\n🎉 Deployment complete.');
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Webhook URL: ${N8N_HOST}/webhook/v1/social-inbound`);
}

deploy().catch(err => {
    console.error('Deploy error:', err.message);
    process.exit(1);
});
