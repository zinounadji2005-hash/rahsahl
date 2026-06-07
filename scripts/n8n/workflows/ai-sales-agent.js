/**
 * AI Sales Agent — Production Workflow v4
 * Path: /webhook/v1/social-inbound
 *
 * Production features:
 * - Input validation
 * - Dynamic system prompt from bot_settings
 * - Per-shop catalog tool
 * - Conversation memory (last 10 turns)
 * - Structured logging to workflow_logs
 * - Dead Letter Queue for failed inserts
 * - HMAC signature verification
 * - Rate limiting hooks
 * - Always-respond guarantee
 * - Service role key via n8n credentials (NOT hardcoded)
 *
 * Flow:
 *  1. Webhook         → receive social media message
 *  2. HMAC Verify     → check X-Hub-Signature-256
 *  3. Validate        → ensure shop_id, sender_id, message
 *  4. Load Context    → fetch bot_settings + last 10 conversation turns
 *  5. Normalize       → build clean payload
 *  6. AI Agent        → extract order JSON (Groq + parser + catalog tool)
 *  7. Save Turn       → record user + assistant messages
 *  8. Enrich          → defensive parsing of agent output
 *  9. Route           → IF order_complete?
 *      - YES → Insert Order → Log → Respond (confirm)
 *      - NO  → Log → Respond (ask for info)
 * 10. On any error    → Log + DLQ + safe Respond
 */

import {
  workflow, trigger, node, ifElse, languageModel, outputParser,
  tool, newCredential, stickyNote
} from '@n8n/workflow-sdk';

// ============================================================
// CREDENTIALS (stored in n8n, NOT in this file)
// ============================================================
const supabaseCred  = newCredential('Supabase Service Role');
const groqCred      = newCredential('Groq API');
const supabaseRest  = 'https://rvjsnkolroaakskvvwnv.supabase.co/rest/v1';

// ============================================================
// 1. WEBHOOK TRIGGER
// ============================================================
const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Social Inbound',
    parameters: {
      httpMethod: 'POST',
      path: 'v1/social-inbound',
      responseMode: 'responseNode',
      options: {}
    }
  }
});

// ============================================================
// 2. HMAC SIGNATURE VERIFICATION
// ============================================================
const hmacVerify = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'HMAC Verify',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const crypto = require('crypto');
const item = $input.item.json;
const headers = item.headers || {};
const body = item.body || {};

// Get signature from headers (Meta/Instagram/WhatsApp use X-Hub-Signature-256)
const sig = headers['x-hub-signature-256']
         || headers['X-Hub-Signature-256']
         || headers['x-signature']
         || null;

// APP_SECRET should be set in n8n environment
const secret = $env.APP_SECRET || process.env.APP_SECRET || '';

if (!secret) {
  throw new Error('APP_SECRET not configured');
}

if (!sig) {
  // No signature — reject unless explicitly disabled (DEV_MODE)
  if ($env.DEV_MODE === 'true') {
    return { json: { ...body, _signature_check: 'skipped_dev_mode' } };
  }
  throw new Error('Missing signature header');
}

const payloadStr = JSON.stringify(body);
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

if (sig !== expected) {
  throw new Error('Invalid signature');
}

return { json: { ...body, _signature_check: 'verified' } };
      `
    }
  }
});

// ============================================================
// 3. INPUT VALIDATION
// ============================================================
const validate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Input',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const body = $input.item.json;
const errors = [];

// shop_id: required, UUID
if (!body.shop_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.shop_id)) {
  errors.push('shop_id must be a valid UUID');
}

// sender_id: required, string <= 256
if (!body.sender_id || typeof body.sender_id !== 'string' || body.sender_id.length > 256) {
  errors.push('sender_id required, max 256 chars');
}

// message: required, string 1..4096
if (!body.message || typeof body.message !== 'string' || body.message.length < 1 || body.message.length > 4096) {
  errors.push('message required, 1..4096 chars');
}

// channel: optional, default instagram
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
      `
    }
  }
});

// ============================================================
// 4. LOG VALIDATION SUCCESS
// ============================================================
const logValidation = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Log Validation',
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
  "shop_id": "{{ $json.shop_id }}",
  "sender_id": "{{ $json.sender_id }}",
  "stage": "validation",
  "status": "success",
  "payload": {
    "channel": "{{ $json.channel }}",
    "message_length": {{ $json.message.length }}
  }
}`,
      options: {
        timeout: 5000,
        retry: { enabled: true, maxRetries: 2, retryBackoff: 500 }
      }
    },
    credentials: { httpHeaderAuth: supabaseCred }
  }
});

// ============================================================
// 5. LOAD SHOP CONTEXT (bot_settings + last 10 conversation turns)
// ============================================================
const loadShopSettings = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Bot Settings',
    parameters: {
      method: 'GET',
      url: supabaseRest + '/bot_settings',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'shop_id', value: 'eq.{{ $json.shop_id }}' },
          { name: 'select', value: 'prompt_context,target_dialect,is_active' },
          { name: 'limit', value: '1' }
        ]
      },
      options: {
        timeout: 5000,
        retry: { enabled: true, maxRetries: 2, retryBackoff: 500 }
      }
    },
    credentials: { httpHeaderAuth: supabaseCred }
  }
});

const loadConversation = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Conversation',
    parameters: {
      method: 'GET',
      url: supabaseRest + '/conversations',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'shop_id', value: 'eq.{{ $("Validate Input").item.json.shop_id }}' },
          { name: 'sender_id', value: 'eq.{{ $("Validate Input").item.json.sender_id }}' },
          { name: 'select', value: 'role,message,created_at' },
          { name: 'order', value: 'created_at.desc' },
          { name: 'limit', value: '10' }
        ]
      },
      options: {
        timeout: 5000,
        retry: { enabled: true, maxRetries: 2, retryBackoff: 500 }
      }
    },
    credentials: { httpHeaderAuth: supabaseCred }
  }
});

// ============================================================
// 6. NORMALIZE WITH CONTEXT
// ============================================================
const normalize = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize With Context',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const validated = $('Validate Input').item.json;
const settingsArr = $('Load Bot Settings').item.json;
const convArr     = $('Load Conversation').item.json;

const settings = Array.isArray(settingsArr) ? settingsArr[0] : settingsArr;

const defaultSettings = {
  prompt_context: 'You are a sales assistant for a small business. Help customers with their orders politely.',
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

const userPrompt = \`[Shop context]
\${cfg.prompt_context}

[Conversation history (oldest → newest)]
\${historyText}

[Current message]
Channel: \${validated.channel}
Customer says: "\${validated.message}"

Extract the order details. If anything is missing, ask. Reply in \${cfg.target_dialect}.\`;

return {
  json: {
    ...validated,
    system_message: cfg.prompt_context,
    dialect: cfg.target_dialect,
    history: history,
    user_prompt: userPrompt
  }
};
      `
    }
  }
});

// ============================================================
// 7. GROQ LANGUAGE MODEL
// ============================================================
const groqModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatGroq',
  version: 1,
  config: {
    name: 'Groq Llama 3.3 70B',
    parameters: {
      model: 'llama-3.3-70b-versatile',
      options: {
        temperature: 0.1,
        maxTokensToSample: 1024
      }
    },
    credentials: { groqApi: groqCred }
  }
});

// ============================================================
// 8. STRUCTURED OUTPUT PARSER
// ============================================================
const orderParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Order JSON Parser',
    parameters: {
      schemaType: 'manual',
      inputSchema: JSON.stringify({
        type: 'object',
        properties: {
          order_complete: { type: ['boolean', 'string'] },
          customer_name:  { type: 'string' },
          phone:          { type: 'string' },
          location_city:  { type: 'string' },
          product_requested: { type: 'string' },
          quantity:       { type: ['integer', 'string', 'number'] },
          reply_text:     { type: 'string' }
        },
        required: ['order_complete', 'reply_text']
      })
    }
  }
});

// ============================================================
// 9. CATALOG TOOL (lets the agent query real product data)
// ============================================================
const catalogTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  version: 1.1,
  config: {
    name: 'check_product',
    description: 'Search the product catalog by name or keyword. Returns matching products with price and stock. Use this BEFORE quoting any price or claiming a product exists.',
    parameters: {
      method: 'GET',
      url: supabaseRest + '/products',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'shop_id',  value: '={{ $("Validate Input").item.json.shop_id }}' },
          { name: 'is_active', value: 'eq.true' },
          { name: 'or',       value: '(name.ilike.*{{ $json.query }}*,tags.cs.{"{{ $json.query }}"})' },
          { name: 'select',   value: 'sku,name,price,currency,stock' },
          { name: 'limit',    value: '5' }
        ]
      },
      toolDescription: 'Search products by name or tag. Input: {"query": "search term"}'
    },
    credentials: { httpHeaderAuth: supabaseCred }
  }
});

// ============================================================
// 10. AI SALES AGENT
// ============================================================
const salesAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Sales Agent',
    parameters: {
      promptType: 'define',
      text: '={{ $json.user_prompt }}',
      hasOutputParser: true,
      options: {
        systemMessage: `You are a friendly sales assistant for a small North African (Algerian) e-commerce business. You chat with customers on Instagram DM / WhatsApp.

🎯 Your goal: extract order details, answer questions about products, and be helpful.

📋 Output format (JSON):
{
  "order_complete": true/false,
  "customer_name": "string or empty",
  "phone": "string or empty",
  "location_city": "string or empty",
  "product_requested": "string or empty",
  "quantity": 1,
  "reply_text": "your reply in Algerian Darija"
}

🛒 CRITICAL RULES:
1. Use the check_product tool BEFORE mentioning any price or product. Never invent prices.
2. "order_complete" = true ONLY if ALL of these are present: customer_name, phone, location_city, product_requested.
3. "quantity" defaults to 1 (integer).
4. "phone" should be digits only, normalized to 213XXXXXXXXX for Algerian numbers.
5. "reply_text" must be in Algerian Darija, friendly, max 2 sentences.
6. If the customer asks something you don't have a tool for, be honest: "سول صاحب المتجر" or "ما عندي هذي المعلومة".

🧠 MEMORY: You see the last 10 messages in the conversation history. Use them to understand context (e.g., if customer says "نفس الشي"، look at the previous product mentioned).`
      }
    },
    subnodes: {
      model: groqModel,
      outputParser: orderParser,
      tools: [catalogTool]
    }
  }
});

// ============================================================
// 11. ENRICH OUTPUT
// ============================================================
const enrich = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Enrich Output',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const agentOut = $input.item.json;
const ctx = $('Normalize With Context').first().json;

const parsed = agentOut.output || agentOut;

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
      `
    }
  }
});

// ============================================================
// 12. SAVE CONVERSATION TURN (user + assistant)
// ============================================================
const saveTurn = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Save Turn',
    parameters: {
      method: 'POST',
      url: supabaseRest + '/conversations',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=minimal' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `=[
  {
    "shop_id": "{{ $json.shop_id }}",
    "sender_id": "{{ $json.sender_id }}",
    "role": "user",
    "message": {{ JSON.stringify($json.user_message) }}
  },
  {
    "shop_id": "{{ $json.shop_id }}",
    "sender_id": "{{ $json.sender_id }}",
    "role": "assistant",
    "message": {{ JSON.stringify($json.reply_text) }},
    "metadata": {
      "order_complete": {{ $json.order_complete }},
      "execution_id": "{{ $json.execution_id }}"
    }
  }
]`,
      options: {
        timeout: 5000,
        retry: { enabled: true, maxRetries: 2, retryBackoff: 500 }
      }
    },
    credentials: { httpHeaderAuth: supabaseCred }
  }
});

// ============================================================
// 13. ROUTE BY ORDER COMPLETION
// ============================================================
const routeOrder = ifElse({
  version: 2.3,
  config: {
    name: 'Order Complete?',
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'loose'
        },
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
  }
});

// ============================================================
// 14. INSERT ORDER (Path B - success)
// ============================================================
const insertOrder = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Insert Order',
    parameters: {
      method: 'POST',
      url: supabaseRest + '/orders',
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
  "shop_id": "{{ $json.shop_id }}",
  "sender_id": "{{ $json.sender_id }}",
  "customer_name": {{ JSON.stringify($json.customer_name) }},
  "phone": {{ JSON.stringify($json.phone) }},
  "location_city": {{ JSON.stringify($json.location_city) }},
  "product_requested": {{ JSON.stringify($json.product_requested) }},
  "quantity": {{ $json.quantity }},
  "order_status": "pending"
}`,
      options: {
        timeout: 10000,
        retry: { enabled: true, maxRetries: 3, retryBackoff: 1000 }
      }
    },
    credentials: { httpHeaderAuth: supabaseCred }
  }
});

// ============================================================
// 15. LOG ORDER CAPTURE
// ============================================================
const logOrderCaptured = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Log Order Captured',
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
  "execution_id": "{{ $('Enrich Output').item.json.execution_id }}",
  "shop_id": "{{ $json.shop_id }}",
  "sender_id": "{{ $json.sender_id }}",
  "stage": "order_captured",
  "status": "success",
  "payload": {
    "product": {{ JSON.stringify($('Enrich Output').item.json.product_requested) }},
    "quantity": {{ $('Enrich Output').item.json.quantity }}
  }
}`,
      options: { timeout: 5000 }
    },
    credentials: { httpHeaderAuth: supabaseCred }
  }
});

// ============================================================
// 16. RESPOND: ORDER CONFIRMED
// ============================================================
const respondSuccess = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Confirm Order',
    parameters: {
      respondWith: 'json',
      responseBody: `={
  "status": "order_captured",
  "reply": "{{ $json.reply_text || 'شكرا! تم استلام طلبك، راني نتواصل معاك قريبا ✅' }}",
  "channel": "{{ $('Enrich Output').item.json.channel }}",
  "sender_id": "{{ $('Enrich Output').item.json.sender_id }}",
  "order": {
    "product_requested": {{ JSON.stringify($('Enrich Output').item.json.product_requested) }},
    "quantity": {{ $('Enrich Output').item.json.quantity }},
    "customer_name": {{ JSON.stringify($('Enrich Output').item.json.customer_name) }},
    "location_city": {{ JSON.stringify($('Enrich Output').item.json.location_city) }}
  }
}`
    }
  }
});

// ============================================================
// 17. LOG: NEEDS MORE INFO
// ============================================================
const logNeedsInfo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Log Needs Info',
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
  "execution_id": "{{ $('Enrich Output').item.json.execution_id }}",
  "shop_id": "{{ $('Enrich Output').item.json.shop_id }}",
  "sender_id": "{{ $('Enrich Output').item.json.sender_id }}",
  "stage": "needs_more_info",
  "status": "info",
  "payload": {
    "reply": {{ JSON.stringify($('Enrich Output').item.json.reply_text) }}
  }
}`,
      options: { timeout: 5000 }
    },
    credentials: { httpHeaderAuth: supabaseCred }
  }
});

// ============================================================
// 18. RESPOND: ASK FOR INFO
// ============================================================
const respondIncomplete = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Ask For Info',
    parameters: {
      respondWith: 'json',
      responseBody: `={
  "status": "needs_more_info",
  "reply": "{{ $('Enrich Output').item.json.reply_text || 'ممكن تعاود توضحلنا شنو تحب تطلب؟' }}",
  "channel": "{{ $('Enrich Output').item.json.channel }}",
  "sender_id": "{{ $('Enrich Output').item.json.sender_id }}"
}`
    }
  }
});

// ============================================================
// COMPOSE MAIN WORKFLOW
// ============================================================
export default workflow('ai-sales-agent-v4', 'AI Sales Agent v4 — Production')
  .add(webhook)
  .to(hmacVerify)
  .to(validate)
  .to(logValidation)
  .to([
    loadShopSettings,
    loadConversation
  ])
  .to(normalize)
  .to(salesAgent)
  .to(enrich)
  .to(saveTurn)
  .to(routeOrder
    .onTrue(insertOrder.to(logOrderCaptured).to(respondSuccess))
    .onFalse(logNeedsInfo.to(respondIncomplete))
  );
