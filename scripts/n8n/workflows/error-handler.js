/**
 * Error Handler Workflow — Always-Respond Guarantee
 *
 * Triggered automatically when the main workflow fails.
 * Logs the failure to:
 *   1. workflow_logs (stage: 'error', status: 'error')
 *   2. failed_messages (DLQ for replay)
 * Then sends a safe response so the customer is never left hanging.
 *
 * In n8n, set this as: Workflow Settings → Error Workflow → "error-handler-v1"
 */

import {
  workflow, trigger, node
} from '@n8n/workflow-sdk';

const supabaseRest = 'https://rvjsnkolroaakskvvwnv.supabase.co/rest/v1';

// ============================================================
// TRIGGER: receives error context from n8n
// ============================================================
const errorTrigger = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: {
    name: 'Workflow Error',
    parameters: {}
  }
});

// ============================================================
// EXTRACT ERROR CONTEXT
// ============================================================
const extractError = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Error Context',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const err = $input.item.json;

// n8n error trigger payload structure
const execution = err.execution || {};
const workflow  = err.workflow  || { name: 'unknown' };
const trigger   = err.trigger   || {};

const payload = {
  execution_id: execution.id || trigger.executionId || 'unknown',
  workflow_name: workflow.name || 'unknown',
  error_message: execution.error?.message || err.message || 'Unknown error',
  error_node:    execution.lastNodeExecuted || err.node || 'unknown',
  shop_id:       null,
  sender_id:     null,
  channel:       null,
  message:       null,
  failed_at:     new Date().toISOString()
};

// Try to extract original payload from the failed execution
const runData = execution.data || {};
const resultData = runData.resultData || {};

// Best-effort: walk nodes to find our Normalize/Validate input
try {
  const runData2 = resultData.runData || {};
  for (const nodeName of Object.keys(runData2)) {
    const nodeRuns = runData2[nodeName] || [];
    for (const run of nodeRuns) {
      const data = run.data || {};
      const main = data.main || [];
      for (const items of main) {
        for (const item of items) {
          if (item.json) {
            if (item.json.shop_id)    payload.shop_id   = item.json.shop_id;
            if (item.json.sender_id)  payload.sender_id = item.json.sender_id;
            if (item.json.channel)    payload.channel   = item.json.channel;
            if (item.json.message)    payload.message   = item.json.message;
          }
        }
      }
    }
  }
} catch (e) {
  // Ignore — we may not have access to all data
}

return { json: payload };
      `
    }
  }
});

// ============================================================
// LOG ERROR TO workflow_logs
// ============================================================
const logError = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Log Error',
    parameters: {
      method: 'POST',
      url: supabaseRest + '/workflow_logs',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=minimal' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={
  "execution_id": "{{ $json.execution_id }}",
  "shop_id": {{ JSON.stringify($json.shop_id) }},
  "sender_id": {{ JSON.stringify($json.sender_id) }},
  "stage": "error",
  "status": "error",
  "error_message": {{ JSON.stringify($json.error_message) }},
  "payload": {
    "workflow_name": {{ JSON.stringify($json.workflow_name) }},
    "error_node":    {{ JSON.stringify($json.error_node) }}
  }
}`,
      options: { timeout: 5000 }
    }
  }
});

// ============================================================
// INSERT TO DLQ (failed_messages)
// ============================================================
const sendToDLQ = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Send to DLQ',
    parameters: {
      method: 'POST',
      url: supabaseRest + '/failed_messages',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=minimal' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={
  "shop_id": {{ JSON.stringify($json.shop_id) }},
  "sender_id": {{ JSON.stringify($json.sender_id) }},
  "channel": {{ JSON.stringify($json.channel) }},
  "payload": {
    "message": {{ JSON.stringify($json.message) }},
    "workflow_name": {{ JSON.stringify($json.workflow_name) }},
    "execution_id": "{{ $json.execution_id }}"
  },
  "error_message": {{ JSON.stringify($json.error_message) }},
  "error_stage": {{ JSON.stringify($json.error_node) }},
  "retry_count": 0,
  "status": "pending"
}`,
      options: { timeout: 5000 }
    }
  }
});

// ============================================================
// SAFE RESPONSE (no leak of internal details)
// ============================================================
const safeRespond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Safe Fallback Response',
    parameters: {
      respondWith: 'json',
      responseBody: `={
  "status": "error",
  "reply": "عذراً، حدث خطأ مؤقت. حاول مرة أخرى بعد قليل 🙏",
  "channel": {{ JSON.stringify($('Extract Error Context').item.json.channel) }},
  "sender_id": {{ JSON.stringify($('Extract Error Context').item.json.sender_id) }}
}`
    }
  }
});

// ============================================================
// COMPOSE
// ============================================================
export default workflow('error-handler-v1', 'Error Handler v1 — Always Respond')
  .add(errorTrigger)
  .to(extractError)
  .to([logError, sendToDLQ])
  .to(safeRespond);
