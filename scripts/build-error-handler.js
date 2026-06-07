/**
 * Build Error Handler workflow JSON.
 * Triggered automatically when the main workflow fails.
 * Logs the error, sends to DLQ, responds with a safe fallback.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL  = 'https://rvjsnkolroaakskvvwnv.supabase.co';
const SUPABASE_REST = SUPABASE_URL + '/rest/v1';
const SUPA_KEY      = 'SUPABASE_SERVICE_ROLE_KEY';

function buildNode(opts) {
  const { id, name, type, version = 1, position, parameters = {}, credentials = null } = opts;
  return {
    id, name, type, typeVersion: version, position, parameters,
    ...(credentials ? { credentials } : {})
  };
}

const nodes = [
  // Trigger
  buildNode({
    id: 'err-trig',
    name: 'Workflow Error',
    type: 'n8n-nodes-base.errorTrigger',
    version: 1,
    position: [240, 300],
    parameters: {}
  }),

  // Extract context
  buildNode({
    id: 'err-extract',
    name: 'Extract Error Context',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [460, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const err = $json;
const execution = err.execution || {};
const workflow  = err.workflow  || { name: 'unknown' };

const payload = {
  execution_id:   execution.id || 'unknown',
  workflow_name:  workflow.name || 'unknown',
  error_message:  (execution.error && execution.error.message) || err.message || 'Unknown error',
  error_node:     execution.lastNodeExecuted || 'unknown',
  shop_id:        null,
  sender_id:      null,
  channel:        null,
  message:        null,
  failed_at:      new Date().toISOString()
};

try {
  const runData = execution.data || {};
  const resultData = runData.resultData || {};
  const runData2 = resultData.runData || {};
  for (const nodeName of Object.keys(runData2)) {
    const nodeRuns = runData2[nodeName] || [];
    for (const run of nodeRuns) {
      const data = run.data || {};
      const main = data.main || [];
      for (const items of main) {
        for (const item of items) {
          if (item.json) {
            if (item.json.shop_id)   payload.shop_id   = item.json.shop_id;
            if (item.json.sender_id) payload.sender_id = item.json.sender_id;
            if (item.json.channel)   payload.channel   = item.json.channel;
            if (item.json.message)   payload.message   = item.json.message;
          }
        }
      }
    }
  }
} catch (e) { /* ignore */ }

return { json: payload };
      `.trim()
    }
  }),

  // Log error + Send to DLQ (combined Code node to avoid n8n parallel execution issues)
  buildNode({
    id: 'err-log-dlq',
    name: 'Log Error & Send to DLQ',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [680, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const v = $json;
const SUPA_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

// 1. Log error to workflow_logs
await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_REST}/workflow_logs',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Prefer': 'return=minimal'
  },
  body: {
    execution_id:  v.execution_id,
    shop_id:       v.shop_id,
    sender_id:     v.sender_id,
    stage:         'error',
    status:        'error',
    error_message: v.error_message,
    payload: {
      workflow_name: v.workflow_name,
      error_node:    v.error_node
    }
  },
  json: true,
  timeout: 5000
});

// 2. Send to DLQ
await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_REST}/failed_messages',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Prefer': 'return=minimal'
  },
  body: {
    shop_id:       v.shop_id,
    sender_id:     v.sender_id,
    channel:       v.channel,
    payload: {
      message:       v.message,
      workflow_name: v.workflow_name,
      execution_id:  v.execution_id
    },
    error_message: v.error_message,
    error_stage:   v.error_node,
    retry_count:   0,
    status:        'pending'
  },
  json: true,
  timeout: 5000
});

return { json: v };
      `.trim()
    }
  }),

  // (Safe Fallback Response removed — n8n error workflow has no webhook, so respondToWebhook fails)
];

const connections = {
  'Workflow Error': {
    main: [[{ node: 'Extract Error Context', type: 'main', index: 0 }]]
  },
  'Extract Error Context': {
    main: [[{ node: 'Log Error & Send to DLQ', type: 'main', index: 0 }]]
  }
  // Safe Fallback Response removed — n8n error workflow has no webhook, so respondToWebhook fails
};

const workflow = {
  name: 'Error Handler v1 — Always Respond',
  nodes,
  connections,
  settings: { executionOrder: 'v1' }
};

const outPath = path.join(__dirname, '..', 'n8n', 'workflows', 'error-handler.json');
fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2));
console.log(`✅ Built: ${outPath}`);
console.log(`   Nodes: ${workflow.nodes.length}`);
