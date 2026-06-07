/**
 * Build Alerts workflow JSON.
 * Runs every 5 minutes. Checks success rate, latency, DLQ.
 * Sends Telegram alert if any threshold violated.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL  = 'https://rvjsnkolroaakskvvwnv.supabase.co';
const SUPABASE_REST = SUPABASE_URL + '/rest/v1';
const SUPA_KEY      = 'SUPABASE_SERVICE_ROLE_KEY';

function buildNode(opts) {
  const { id, name, type, version = 1, position, parameters = {} } = opts;
  return { id, name, type, typeVersion: version, position, parameters };
}

const nodes = [
  // Schedule trigger — every 5 minutes
  buildNode({
    id: 'al-sched',
    name: 'Every 5 minutes',
    type: 'n8n-nodes-base.scheduleTrigger',
    version: 1.2,
    position: [240, 150],
    parameters: {
      rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] }
    }
  }),

  // Webhook trigger — for manual testing
  buildNode({
    id: 'al-wh',
    name: 'Test Webhook',
    type: 'n8n-nodes-base.webhook',
    version: 1.1,
    position: [240, 450],
    parameters: {
      httpMethod: 'POST',
      path: 'v1/alerts-test',
      responseMode: 'onReceived',
      responseData: 'allEntries',
      options: {}
    }
  }),

  // Get success rate (Code node)
  buildNode({
    id: 'al-stats',
    name: 'Get Success Rate',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [460, 150],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const r = await this.helpers.httpRequest({
  method: 'GET',
  url: '${SUPABASE_REST}/v_success_rate?order=hour.desc&limit=3',
  headers: { 'apikey': '${SUPA_KEY}', 'Authorization': 'Bearer ${SUPA_KEY}' },
  json: true,
  timeout: 5000
});
return { json: { type: 'success_rate', data: r } };
      `.trim()
    }
  }),

  // Get latency (Code node)
  buildNode({
    id: 'al-lat',
    name: 'Get Latency',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [460, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const r = await this.helpers.httpRequest({
  method: 'GET',
  url: '${SUPABASE_REST}/v_avg_latency_per_stage',
  headers: { 'apikey': '${SUPA_KEY}', 'Authorization': 'Bearer ${SUPA_KEY}' },
  json: true,
  timeout: 5000
});
return { json: { type: 'latency', data: r } };
      `.trim()
    }
  }),

  // Get DLQ (Code node)
  buildNode({
    id: 'al-dlq',
    name: 'Get DLQ',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [460, 450],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const r = await this.helpers.httpRequest({
  method: 'GET',
  url: '${SUPABASE_REST}/v_dlq_summary',
  headers: { 'apikey': '${SUPA_KEY}', 'Authorization': 'Bearer ${SUPA_KEY}' },
  json: true,
  timeout: 5000
});
return { json: { type: 'dlq', data: r } };
      `.trim()
    }
  }),

  // Analyze
  buildNode({
    id: 'al-analyze',
    name: 'Analyze',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [680, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const items = $input.all();

let stats = [], latency = [], dlq = [];
for (const item of items) {
  const d = item.json;
  if (d && d.type === 'success_rate') stats = d.data || [];
  else if (d && d.type === 'latency') latency = d.data || [];
  else if (d && d.type === 'dlq') dlq = d.data || [];
}

const statsArr   = Array.isArray(stats)   ? stats   : [stats];
const latencyArr = Array.isArray(latency) ? latency : [latency];
const dlqArr     = Array.isArray(dlq)     ? dlq     : [dlq];

const totalSamples = statsArr.reduce((a, b) => a + (b.total_count || 0), 0);
const totalSuccess = statsArr.reduce((a, b) => a + (b.success_count || 0), 0);
const successPct   = totalSamples > 0 ? (totalSuccess / totalSamples) * 100 : 100;
const maxP95       = latencyArr.reduce((m, x) => Math.max(m, x.p95_ms || 0), 0);
const pending      = dlqArr.find(d => d.status === 'pending');
const dlqCount     = pending ? pending.message_count : 0;

const alerts = [];
if (successPct < 90 && totalSamples >= 5) {
  alerts.push({ level: 'high', title: '⚠️ Success rate dropped',
    detail: 'Success rate: ' + successPct.toFixed(1) + '% (' + totalSuccess + '/' + totalSamples + ' in last 3h)' });
}
if (maxP95 > 10000) {
  alerts.push({ level: 'high', title: '🐌 High latency',
    detail: 'P95 latency: ' + maxP95 + 'ms (target: <10000ms)' });
}
if (dlqCount > 10) {
  alerts.push({ level: 'critical', title: '🗑️ DLQ filling up',
    detail: dlqCount + ' failed messages awaiting review' });
}

const message = alerts.length === 0
  ? '✅ All systems healthy'
  : alerts.map(a => a.title + '\\n  ' + a.detail).join('\\n\\n');

return [{ json: { alerts, message, has_alerts: alerts.length > 0, stats: { successPct, totalSamples, maxP95, dlqCount } } }];
      `.trim()
    }
  }),

  // IF should alert
  buildNode({
    id: 'al-if',
    name: 'Should Alert?',
    type: 'n8n-nodes-base.if',
    version: 2.3,
    position: [900, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            id: 'has-alerts',
            leftValue: '={{ $json.has_alerts }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      }
    }
  }),

  // Send Telegram (Code node — placeholder, no real Telegram bot configured)
  buildNode({
    id: 'al-tg',
    name: 'Send Telegram',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [1120, 150],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
// Placeholder: log to workflow_logs instead of real Telegram
const v = $json;
const SUPA_KEY = 'SUPABASE_SERVICE_ROLE_KEY';
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
    execution_id: 'alert-' + Date.now(),
    stage:        'alert_sent',
    status:       'info',
    payload:      { message: v.message, alerts: v.alerts, stats: v.stats }
  },
  json: true,
  timeout: 5000
});
return { json: v };
      `.trim()
    }
  })
];

const connections = {
  'Every 5 minutes': {
    main: [[
      { node: 'Get Success Rate', type: 'main', index: 0 },
      { node: 'Get Latency',      type: 'main', index: 0 },
      { node: 'Get DLQ',          type: 'main', index: 0 }
    ]]
  },
  'Test Webhook': {
    main: [[
      { node: 'Get Success Rate', type: 'main', index: 0 },
      { node: 'Get Latency',      type: 'main', index: 0 },
      { node: 'Get DLQ',          type: 'main', index: 0 }
    ]]
  },
  'Get Success Rate': { main: [[{ node: 'Analyze', type: 'main', index: 0 }]] },
  'Get Latency':      { main: [[{ node: 'Analyze', type: 'main', index: 0 }]] },
  'Get DLQ':          { main: [[{ node: 'Analyze', type: 'main', index: 0 }]] },
  'Analyze':          { main: [[{ node: 'Should Alert?', type: 'main', index: 0 }]] },
  'Should Alert?': {
    main: [
      [{ node: 'Send Telegram', type: 'main', index: 0 }],
      []
    ]
  }
};

const workflow = {
  name: 'Alerts v1 — Health Monitor',
  nodes,
  connections,
  settings: { executionOrder: 'v1' }
};

const outPath = path.join(__dirname, '..', 'n8n', 'workflows', 'alerts.json');
fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2));
console.log(`✅ Built: ${outPath}`);
console.log(`   Nodes: ${workflow.nodes.length}`);
