/**
 * Get recent executions for a workflow
 * Usage: node scripts/check-executions.js [workflow-id] [limit]
 */

require('./load-env');

async function check() {
    const wfId  = process.argv[2];
    const limit = process.argv[3] || '5';
    const N8N_HOST = process.env.N8N_HOST.replace(/\/$/, '');
    const API_KEY  = process.env.N8N_API_KEY;

    let url = `${N8N_HOST}/api/v1/executions?limit=${limit}&includeData=true`;
    if (wfId) url += `&workflowId=${wfId}`;

    const res = await fetch(url, { headers: { 'X-N8N-API-KEY': API_KEY } });
    if (!res.ok) {
        console.error('Failed:', res.status, await res.text());
        process.exit(1);
    }

    const data = await res.json();
    const executions = data.data || data.executions || [];

    console.log(`\nFound ${executions.length} executions\n`);

    for (const e of executions) {
        console.log(`━━━ Execution ${e.id} ━━━`);
        console.log(`  Workflow: ${e.workflowId}  Started: ${e.startedAt}  Status: ${e.status}`);
        console.log(`  Mode: ${e.mode}  Finished: ${e.finished ? 'yes' : 'no'}`);
        if (e.stoppedAt) console.log(`  Duration: ${new Date(e.stoppedAt) - new Date(e.startedAt)}ms`);

        if (e.data?.resultData?.error) {
            console.log(`  ❌ Error:`, e.data.resultData.error.message);
        }

        if (e.data?.resultData?.lastNodeExecuted) {
            console.log(`  Last node: ${e.data.resultData.lastNodeExecuted}`);
        }

        // Show run data summary
        const runData = e.data?.resultData?.runData || {};
        const nodeNames = Object.keys(runData);
        console.log(`  Nodes executed: ${nodeNames.length}`);

        if (nodeNames.length > 0) {
            for (const nodeName of nodeNames) {
                const runs = runData[nodeName];
                if (runs && runs[0]?.error) {
                    console.log(`    ❌ ${nodeName}: ${runs[0].error.message}`);
                } else if (runs && runs[0]?.data) {
                    const main = runs[0].data.main || [];
                    const itemCount = main.reduce((a, items) => a + (items?.length || 0), 0);
                    console.log(`    ✓ ${nodeName}: ${itemCount} item(s)`);
                }
            }
        }
        console.log('');
    }
}

check().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
