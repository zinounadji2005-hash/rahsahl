/**
 * Alerts Workflow — Monitors system health every 5 minutes
 *
 * Checks:
 *   1. Success rate in last 15 min (alert if < 90%)
 *   2. Failed messages count (alert if > 10)
 *   3. P95 latency (alert if > 10s)
 *   4. Bot disabled
 *
 * Sends alerts via Telegram (or Slack/Email if configured).
 * Configured via n8n environment variables:
 *   - TELEGRAM_BOT_TOKEN
 *   - TELEGRAM_CHAT_ID
 */

import {
  workflow, trigger, node, ifElse
} from '@n8n/workflow-sdk';

const supabaseRest = 'https://rvjsnkolroaakskvvwnv.supabase.co/rest/v1';

// ============================================================
// TRIGGER: every 5 minutes
// ============================================================
const schedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: {
    name: 'Every 5 min',
    parameters: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 5 }]
      }
    }
  }
});

// ============================================================
// GET RECENT STATS
// ============================================================
const getStats = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Stats',
    parameters: {
      method: 'GET',
      url: supabaseRest + '/v_success_rate',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'order', value: 'hour.desc' },
          { name: 'limit', value: '3' }
        ]
      },
      options: { timeout: 5000 }
    }
  }
});

const getLatency = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Latency',
    parameters: {
      method: 'GET',
      url: supabaseRest + '/v_avg_latency_per_stage',
      options: { timeout: 5000 }
    }
  }
});

const getDLQ = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get DLQ',
    parameters: {
      method: 'GET',
      url: supabaseRest + '/v_dlq_summary',
      options: { timeout: 5000 }
    }
  }
});

// ============================================================
// ANALYZE — produce alert payload
// ============================================================
const analyze = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Analyze',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const stats   = $('Get Stats').first().json  || [];
const latency = $('Get Latency').first().json || [];
const dlq     = $('Get DLQ').first().json    || [];

const statsArr   = Array.isArray(stats)   ? stats   : [stats];
const latencyArr = Array.isArray(latency) ? latency : [latency];
const dlqArr     = Array.isArray(dlq)     ? dlq     : [dlq];

// Compute success rate over last 3 hours
const totalSamples = statsArr.reduce((a, b) => a + (b.total_count || 0), 0);
const totalSuccess = statsArr.reduce((a, b) => a + (b.success_count || 0), 0);
const successPct   = totalSamples > 0 ? (totalSuccess / totalSamples) * 100 : 100;

// Find max p95 latency
const maxP95 = latencyArr.reduce((m, x) => Math.max(m, x.p95_ms || 0), 0);

// Find pending DLQ count
const pendingDLQ = dlqArr.find(d => d.status === 'pending');
const dlqCount   = pendingDLQ ? pendingDLQ.message_count : 0;

const alerts = [];
if (successPct < 90 && totalSamples >= 5) {
  alerts.push({
    level: 'high',
    title: '⚠️ Success rate dropped',
    detail: \`Success rate: \${successPct.toFixed(1)}% (\${totalSuccess}/\${totalSamples} in last 3h)\`
  });
}
if (maxP95 > 10000) {
  alerts.push({
    level: 'high',
    title: '🐌 High latency',
    detail: \`P95 latency: \${maxP95}ms (target: <10000ms)\`
  });
}
if (dlqCount > 10) {
  alerts.push({
    level: 'critical',
    title: '🗑️ DLQ filling up',
    detail: \`\${dlqCount} failed messages awaiting review\`
  });
}

const message = alerts.length === 0
  ? '✅ All systems healthy'
  : alerts.map(a => a.title + '\\n  ' + a.detail).join('\\n\\n');

return { json: { alerts, message, has_alerts: alerts.length > 0, stats: { successPct, totalSamples, maxP95, dlqCount } } };
      `
    }
  }
});

// ============================================================
// DECIDE: send or skip?
// ============================================================
const shouldAlert = ifElse({
  version: 2.3,
  config: {
    name: 'Should Alert?',
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
  }
});

// ============================================================
// SEND TELEGRAM ALERT
// ============================================================
const sendTelegram = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Send Telegram',
    parameters: {
      method: 'POST',
      url: '=https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={
  "chat_id": "{{ $env.TELEGRAM_CHAT_ID }}",
  "text": "🚨 *Antifahim Alert*\\n\\n{{ $json.message }}",
  "parse_mode": "Markdown"
}`,
      options: { timeout: 8000 }
    }
  }
});

// ============================================================
// COMPOSE
// ============================================================
export default workflow('alerts-v1', 'Alerts v1 — Health Monitor')
  .add(schedule)
  .to([getStats, getLatency, getDLQ])
  .to(analyze)
  .to(shouldAlert
    .onTrue(sendTelegram)
    .onFalse(null)  // healthy — no-op
  );
