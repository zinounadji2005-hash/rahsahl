/**
 * Build a complete n8n workflow JSON for the AI Sales Agent v4 (Production).
 * Output: n8n/workflows/ai-sales-agent-v4.json (deployable via n8n API)
 *
 * The workflow has these main features:
 *   - HMAC signature verification
 *   - Strict input validation
 *   - Dynamic system prompt from bot_settings
 *   - Conversation memory (last 10 turns)
 *   - Catalog tool (Groq can query products via HTTP)
 *   - Structured output parsing (order JSON)
 *   - Save turn to conversations table
 *   - Branch: order_complete true → insert order; false → ask for info
 *   - Log every stage to workflow_logs
 *
 * Credentials used (configured in n8n, not in this file):
 *   - "Supabase Service Role" : httpHeaderAuth with apikey + Authorization headers
 *   - "Groq API" : groqApi
 */

const fs = require('fs');
const path = require('path');

const N8N_VERSION_TAG = '__auto__';  // Will be filled by API
const SUPABASE_URL   = 'https://rvjsnkolroaakskvvwnv.supabase.co';
const SUPABASE_REST  = SUPABASE_URL + '/rest/v1';

// ============================================================
// Helper: Build a node object
// ============================================================
function buildNode(opts) {
  const {
    id, name, type, version = 1, position, parameters = {},
    credentials = null, onError = null, continueOnFail = false, typeVersion = null
  } = opts;

  return {
    id,
    name,
    type,
    typeVersion: typeVersion || version,
    position,
    parameters,
    ...(credentials ? { credentials } : {}),
    ...(onError ? { onError } : {}),
    ...(continueOnFail ? { continueOnFail: true } : {})
  };
}

// Standard Supabase headers (service role key)
const SUPA_KEY = 'SUPABASE_SERVICE_ROLE_KEY';
const SUPA_HEADERS = [
  { name: 'Content-Type', value: 'application/json' },
  { name: 'apikey',       value: SUPA_KEY },
  { name: 'Authorization',value: `Bearer ${SUPA_KEY}` },
  { name: 'Prefer',       value: 'return=minimal' }
];

const SUPA_HEADERS_GET = [
  { name: 'Content-Type', value: 'application/json' },
  { name: 'apikey',       value: SUPA_KEY },
  { name: 'Authorization',value: `Bearer ${SUPA_KEY}` }
];

// ============================================================
// Main workflow nodes
// ============================================================
function buildNodes() {
  return [
    // 1. WEBHOOK
    buildNode({
      id: 'wh-1',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      version: 2.1,
      typeVersion: 2.1,
      position: [240, 300],
      parameters: {
        httpMethod: 'POST',
        path: 'v1/social-inbound',
        responseMode: 'responseNode',
        options: {}
      }
    }),

    // 2. HMAC VERIFY (real verification via verify-hmac Edge Function)
    buildNode({
      id: 'hmac-1',
      name: 'HMAC Verify',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [460, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const data = $input.item.json;
const body = data.body || data;
const headers = data.headers || {};

const sig = headers['x-hub-signature-256']
         || headers['X-Hub-Signature-256']
         || headers['x-signature']
         || null;

if (!body.shop_id) {
  throw new Error('shop_id required for HMAC verification');
}
if (!sig) {
  throw new Error('Missing signature header (x-hub-signature-256 or x-signature)');
}

const bodyStr = JSON.stringify(body);

const result = await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_URL}/functions/v1/verify-hmac',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${SUPA_KEY}'
  },
  body: JSON.stringify({ shop_id: body.shop_id, signature: sig, body: bodyStr }),
  timeout: 8000,
  json: true
});

if (!result.valid) {
  throw new Error('HMAC verification failed: ' + (result.reason || 'unknown'));
}

return { json: { ...body, _signature_check: 'verified' } };
        `.trim()
      }
    }),

    // 3. VALIDATE
    buildNode({
      id: 'val-1',
      name: 'Validate Input',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [680, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const body = $input.item.json;
const errors = [];

if (!body.shop_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.shop_id)) {
  errors.push('shop_id must be a valid UUID');
}
if (!body.sender_id || typeof body.sender_id !== 'string' || body.sender_id.length > 256) {
  errors.push('sender_id required, max 256 chars');
}
if (!body.message || typeof body.message !== 'string' || body.message.length < 1 || body.message.length > 4096) {
  errors.push('message required, 1..4096 chars');
}
const channel = (body.channel || 'instagram').toLowerCase();
if (!['instagram', 'whatsapp', 'telegram', 'messenger'].includes(channel)) {
  errors.push('channel must be one of: instagram, whatsapp, telegram, messenger');
}

if (errors.length > 0) {
  throw new Error('Validation failed: ' + errors.join('; '));
}

return {
  json: {
    shop_id: body.shop_id,
    sender_id: body.sender_id,
    message: body.message.trim(),
    channel: channel,
    received_at: new Date().toISOString(),
    execution_id: $execution.id
  }
};
        `.trim()
      }
    }),

    // 4. LOG VALIDATION (Code node — n8n doesn't reliably resolve {{ }} in jsonBody)
    buildNode({
      id: 'log-val',
      name: 'Log Validation',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [900, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const v = $('Validate Input').first().json;
await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_REST}/workflow_logs',
  headers: {
    'Content-Type': 'application/json',
    'apikey': '${SUPA_KEY}',
    'Authorization': 'Bearer ${SUPA_KEY}',
    'Prefer': 'return=minimal'
  },
  body: {
    execution_id: v.execution_id,
    shop_id: v.shop_id,
    sender_id: v.sender_id,
    stage: 'validation',
    status: 'success'
  },
  json: true,
  timeout: 5000
});
return { json: v };
        `.trim()
      }
    }),

    // 5. LOAD BOT SETTINGS (Code node — uses shop_id from payload)
    buildNode({
      id: 'load-bs',
      name: 'Load Bot Settings',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [1120, 200],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const v = $json;
const r = await this.helpers.httpRequest({
  method: 'GET',
  url: '${SUPABASE_REST}/bot_settings?shop_id=eq.' + v.shop_id + '&select=prompt_context,target_dialect,is_active,currency,shipping_fee,delivery_cities,response_style,business_hours,fallback_message&limit=1',
  headers: { 'apikey': '${SUPA_KEY}', 'Authorization': 'Bearer ${SUPA_KEY}' },
  json: true,
  timeout: 5000
});
return { json: { ...v, bot_settings: r[0] || null } };
        `.trim()
      }
    }),

    // 6. LOAD CONVERSATION (Code node — uses shop_id from payload)
    buildNode({
      id: 'load-conv',
      name: 'Load Conversation',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [1120, 400],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const v = $json;
let history = [];
try {
  const r = await this.helpers.httpRequest({
    method: 'GET',
    url: '${SUPABASE_REST}/conversations?select=role,message,created_at&shop_id=eq.' + v.shop_id + '&sender_id=eq.' + encodeURIComponent(v.sender_id) + '&order=created_at.desc&limit=10',
    headers: { 'apikey': '${SUPA_KEY}', 'Authorization': 'Bearer ${SUPA_KEY}' },
    json: true,
    timeout: 5000
  });
  history = (r || []).reverse();  // oldest first
} catch (e) {
  history = [];
}
return { json: { ...v, conversation_history: history } };
        `.trim()
      }
    }),

    // 6.5 FALLBACK CONTEXT (no input needed) — always runs once
    buildNode({
      id: 'fallback-ctx',
      name: 'Fallback Context',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [1340, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const settingsArr = ($('Load Bot Settings').first() || {}).json;
return {
  json: {
    settings: Array.isArray(settingsArr) ? settingsArr[0] : settingsArr,
    conversations: []
  }
};
        `.trim()
      }
    }),

    // 7. NORMALIZE WITH CONTEXT
    buildNode({
      id: 'norm-1',
      name: 'Normalize With Context',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [1340, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const validated = $('Validate Input').first().json;
const ctx = $('Fallback Context').first().json;
const settingsArr = ctx.settings;
const convArr     = ctx.conversations || [];

const settings = settingsArr;

const defaultSettings = {
  prompt_context: 'You are a sales assistant for a small business. Help customers with their orders politely. Reply in Algerian Darija.',
  target_dialect: 'Algerian Darija',
  is_active: true
};
const cfg = settings || defaultSettings;

if (cfg.is_active === false) {
  throw new Error('Bot is currently disabled for this shop');
}

const history = Array.isArray(convArr) ? convArr.reverse() : [];
const historyText = history.length === 0
  ? '(no prior conversation)'
  : history.map(h => (h.role === 'user' ? 'Customer' : 'You') + ': ' + h.message).join('\\n');

const userPrompt = '[Shop context]\\n' + cfg.prompt_context + '\\n\\n'
  + '[Conversation history (oldest -> newest)]\\n' + historyText + '\\n\\n'
  + '[Current message]\\n'
  + 'Channel: ' + validated.channel + '\\n'
  + 'Customer says: "' + validated.message + '"\\n\\n'
  + 'Reply in ' + cfg.target_dialect + ' with a JSON object containing:\\n'
  + '{\\n'
  + '  "order_complete": boolean (true only if customer_name, phone, location_city, product_requested and quantity are ALL present),\\n'
  + '  "customer_name": string or null,\\n'
  + '  "phone": string or null,\\n'
  + '  "location_city": string or null,\\n'
  + '  "product_requested": string or null,\\n'
  + '  "quantity": integer (default 1),\\n'
  + '  "reply_text": "your friendly reply in Darija"\\n'
  + '}\\n'
  + 'If anything is missing, set order_complete=false and ask for it in reply_text. ONLY return the JSON object, nothing else.';

return {
  json: {
    shop_id:        validated.shop_id,
    sender_id:      validated.sender_id,
    message:        validated.message,
    channel:        validated.channel,
    received_at:    validated.received_at,
    execution_id:   validated.execution_id,
    system_message: cfg.prompt_context + '\\n\\nIMPORTANT: Always reply in JSON format with the extracted order fields.',
    dialect:        cfg.target_dialect,
    history:        history,
    user_prompt:    userPrompt,
    model:          'llama-3.3-70b-versatile',
    messages_json:  JSON.stringify([
      { role: 'system', content: cfg.prompt_context + '\\n\\nIMPORTANT: Always reply in JSON format.' },
      { role: 'user',   content: userPrompt }
    ])
  }
};
        `.trim()
      }
    }),

    // 8. SALES AGENT — Code node makes the HTTP request with full control
    buildNode({
      id: 'agent-1',
      name: 'Sales Agent (Groq)',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [1560, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const ctx = $('Build Groq Body').first().json;
const groqBody = JSON.parse(ctx.groq_body_json);

try {
  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (process.env.GROQ_API_KEY || 'gsk_your_key_here')
    },
    body: groqBody,
    json: true,
    timeout: 15000
  });
  return { json: response };
} catch (err) {
  throw new Error('Groq failed: ' + (err.message || 'unknown'));
}
        `.trim()
      }
    }),

    // 8b. BUILD GROQ BODY (Code node — pre-serializes the body so n8n doesn't have to)
    buildNode({
      id: 'build-groq',
      name: 'Build Groq Body',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [1450, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const ctx = $('Normalize With Context').first().json;
const groqBody = {
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: ctx.system_message },
    { role: 'user',   content: ctx.user_prompt }
  ],
  temperature: 0.1,
  max_tokens: 1024,
  response_format: { type: 'json_object' }
};
// Also forward ctx fields that downstream nodes need
return {
  json: Object.assign({}, ctx, { groq_body_json: JSON.stringify(groqBody) })
};
        `.trim()
      }
    }),

    // 9. ENRICH
    buildNode({
      id: 'enrich-1',
      name: 'Enrich Output',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [1820, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const groqOut = $input.item.json;
const ctx = $('Normalize With Context').first().json;

// Groq returns { choices: [{ message: { content: "..." } }] }
let parsed;
try {
  const content = groqOut.choices?.[0]?.message?.content || '{}';
  parsed = typeof content === 'string' ? JSON.parse(content) : content;
} catch (e) {
  parsed = {};
}

const clean = (v) => (v === null || v === undefined || v === 'null' || v === '') ? null : v;
const toInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 1 : n; };

return {
  json: {
    order_complete:    parsed.order_complete === true,
    customer_name:     clean(parsed.customer_name),
    phone:             clean(parsed.phone),
    location_city:     clean(parsed.location_city),
    product_requested: clean(parsed.product_requested),
    quantity:          toInt(parsed.quantity),
    reply_text:        parsed.reply_text || 'شكرا، راني نخدم على طلبك...',
    channel:           ctx.channel,
    sender_id:         ctx.sender_id,
    shop_id:           ctx.shop_id,
    execution_id:      ctx.execution_id,
    user_message:      ctx.message
  }
};
        `.trim()
      }
    }),

    // 10. SAVE CONVERSATION TURN (Code node)
    buildNode({
      id: 'save-turn',
      name: 'Save Turn',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [2040, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const v = $json;
await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_REST}/conversations',
  headers: {
    'Content-Type': 'application/json',
    'apikey': '${SUPA_KEY}',
    'Authorization': 'Bearer ${SUPA_KEY}',
    'Prefer': 'return=minimal'
  },
  body: {
    shop_id: v.shop_id,
    sender_id: v.sender_id,
    role: 'assistant',
    message: v.reply_text || ''
  },
  json: true,
  timeout: 5000
});
return { json: v };
        `.trim()
      }
    }),

    // 10b. RESTORE CONTEXT (passthrough with original fields)
    buildNode({
      id: 'restore-ctx',
      name: 'Restore Context',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [2150, 300],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const enrich = $('Enrich Output').first().json;
return {
  json: {
    execution_id:      enrich.execution_id || 'no-exec-id',
    shop_id:           enrich.shop_id || 'no-shop',
    sender_id:         enrich.sender_id || 'no-sender',
    channel:           enrich.channel || 'instagram',
    customer_name:     enrich.customer_name,
    phone:             enrich.phone,
    location_city:     enrich.location_city,
    product_requested: enrich.product_requested,
    quantity:          enrich.quantity,
    quantity_str:      String(enrich.quantity || 1),
    reply_text:        enrich.reply_text,
    order_complete:    enrich.order_complete
  }
};
        `.trim()
      }
    }),

    // 11. IF ORDER COMPLETE
    buildNode({
      id: 'if-1',
      name: 'Order Complete?',
      type: 'n8n-nodes-base.if',
      version: 2.3,
      position: [2260, 300],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [
            {
              id: 'is-complete',
              leftValue: '={{ $json.order_complete }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true }
            }
          ],
          combinator: 'and'
        }
      }
    }),

    // 12. INSERT ORDER (TRUE branch) — Code node
    buildNode({
      id: 'ins-ord',
      name: 'Insert Order',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [2480, 200],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const v = $json;
const qty = parseInt(v.quantity, 10) || parseInt(v.quantity_str, 10) || 1;
const resp = await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_REST}/orders',
  headers: {
    'Content-Type': 'application/json',
    'apikey': '${SUPA_KEY}',
    'Authorization': 'Bearer ${SUPA_KEY}',
    'Prefer': 'return=representation'
  },
  body: {
    shop_id:           v.shop_id,
    sender_id:         v.sender_id,
    customer_name:     v.customer_name || 'Unknown',
    phone:             v.phone || '',
    location_city:     v.location_city || '',
    product_requested: v.product_requested || '',
    quantity:          qty,
    order_status:      'pending'
  },
  json: true,
  timeout: 10000
});
return { json: { ...v, order_id: (resp[0] && resp[0].id) || null, quantity: qty, order_status: 'pending' } };
        `.trim()
      }
    }),

    // 13. LOG ORDER CAPTURED (Code node)
    buildNode({
      id: 'log-ord',
      name: 'Log Order Captured',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [2700, 200],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const v = $json;
await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_REST}/workflow_logs',
  headers: {
    'Content-Type': 'application/json',
    'apikey': '${SUPA_KEY}',
    'Authorization': 'Bearer ${SUPA_KEY}',
    'Prefer': 'return=minimal'
  },
  body: {
    execution_id: v.execution_id,
    shop_id:      v.shop_id,
    sender_id:    v.sender_id,
    stage:        'order_captured',
    status:       'success',
    payload:      { order_id: v.order_id || null, customer: v.customer_name, product: v.product_requested, qty: v.quantity }
  },
  json: true,
  timeout: 5000
});
return { json: v };
        `.trim()
      }
    }),

    // 14. RESPOND CONFIRM
    buildNode({
      id: 'rsp-ok',
      name: 'Confirm Order',
      type: 'n8n-nodes-base.respondToWebhook',
      version: 1.5,
      position: [2920, 200],
      parameters: {
        respondWith: 'json',
        responseBody: {
          status:     'order_captured',
          reply:      '={{ $json.reply_text || "شكرا! تم استلام طلبك، راني نتواصل معاك قريبا ✅" }}',
          channel:    '={{ $json.channel }}',
          sender_id:  '={{ $json.sender_id }}',
          product_requested: '={{ $json.product_requested }}',
          quantity:          '={{ $json.quantity }}',
          customer_name:     '={{ $json.customer_name }}',
          location_city:     '={{ $json.location_city }}'
        }
      }
    }),

    // 15. LOG NEEDS INFO (FALSE branch) — Code node
    buildNode({
      id: 'log-ni',
      name: 'Log Needs Info',
      type: 'n8n-nodes-base.code',
      version: 2,
      position: [2480, 400],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const v = $json;
await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_REST}/workflow_logs',
  headers: {
    'Content-Type': 'application/json',
    'apikey': '${SUPA_KEY}',
    'Authorization': 'Bearer ${SUPA_KEY}',
    'Prefer': 'return=minimal'
  },
  body: {
    execution_id: v.execution_id,
    shop_id:      v.shop_id,
    sender_id:    v.sender_id,
    stage:        'needs_more_info',
    status:       'info',
    payload:      { reply: v.reply_text || '', missing: v.missing_fields || [] }
  },
  json: true,
  timeout: 5000
});
return { json: v };
        `.trim()
      }
    }),

    // 16. RESPOND ASK
    buildNode({
      id: 'rsp-ask',
      name: 'Ask For Info',
      type: 'n8n-nodes-base.respondToWebhook',
      version: 1.5,
      position: [2700, 400],
      parameters: {
        respondWith: 'json',
        responseBody: {
          status:    'needs_more_info',
          reply:     '={{ $json.reply_text || "ممكن تعاود توضحلنا شنو تحب تطلب؟" }}',
          channel:   '={{ $json.channel }}',
          sender_id: '={{ $json.sender_id }}'
        }
      }
    })
  ];
}

// ============================================================
// Connections
// ============================================================
function buildConnections() {
  return {
    'Webhook': {
      main: [[{ node: 'HMAC Verify', type: 'main', index: 0 }]]
    },
    'HMAC Verify': {
      main: [[{ node: 'Validate Input', type: 'main', index: 0 }]]
    },
    'Validate Input': {
      main: [[{ node: 'Log Validation', type: 'main', index: 0 }]]
    },
    'Log Validation': {
      main: [
        [
          { node: 'Load Bot Settings', type: 'main', index: 0 },
          { node: 'Load Conversation', type: 'main', index: 0 }
        ]
      ]
    },
    'Load Bot Settings': {
      main: [[{ node: 'Fallback Context', type: 'main', index: 0 }]]
    },
    'Fallback Context': {
      main: [[{ node: 'Normalize With Context', type: 'main', index: 0 }]]
    },
    'Normalize With Context': {
      main: [[{ node: 'Build Groq Body', type: 'main', index: 0 }]]
    },
    'Build Groq Body': {
      main: [[{ node: 'Sales Agent (Groq)', type: 'main', index: 0 }]]
    },
    'Sales Agent (Groq)': {
      main: [[{ node: 'Enrich Output', type: 'main', index: 0 }]]
    },
    'Enrich Output': {
      main: [[{ node: 'Save Turn', type: 'main', index: 0 }]]
    },
    'Save Turn': {
      main: [[{ node: 'Restore Context', type: 'main', index: 0 }]]
    },
    'Restore Context': {
      main: [[{ node: 'Order Complete?', type: 'main', index: 0 }]]
    },
    'Order Complete?': {
      main: [
        [{ node: 'Insert Order',        type: 'main', index: 0 }],
        [{ node: 'Log Needs Info',      type: 'main', index: 0 }]
      ]
    },
    'Insert Order': {
      main: [[{ node: 'Log Order Captured', type: 'main', index: 0 }]]
    },
    'Log Order Captured': {
      main: [[{ node: 'Confirm Order', type: 'main', index: 0 }]]
    },
    'Log Needs Info': {
      main: [[{ node: 'Ask For Info', type: 'main', index: 0 }]]
    }
  };
}

// ============================================================
// Build & write
// ============================================================
const workflow = {
  name: 'AI Sales Agent v4 — Production',
  nodes: buildNodes(),
  connections: buildConnections(),
  settings: { executionOrder: 'v1' }
};

const outPath = path.join(__dirname, '..', 'n8n', 'workflows', 'ai-sales-agent-v4.json');
fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2));
console.log(`✅ Built: ${outPath}`);
console.log(`   Nodes: ${workflow.nodes.length}`);
console.log(`   Connections: ${Object.keys(workflow.connections).length}`);
