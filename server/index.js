
import 'dotenv/config'
import { createServer } from 'node:http'
import { GoogleGenAI } from '@google/genai'

const PORT = process.env.PORT || 3001
const MODEL = 'gemini-3.1-flash-lite'

const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

const ALLOWED_INTENTS = [
  'payment_status',
  'payment_help',
  'dispute',
  'refund',
  'account_help',
  'technical_support',
  'order_status',
  'cancellation',
  'greeting',
  'farewell',
  'general_query',
  'complaint',
  'unknown',
]

const SYSTEM_INSTRUCTION = `
You are Vaani, an intelligent, natural and context-aware AI voice assistant.

Your job is to understand the user's intent and respond conversationally.

Supported intent categories:
${ALLOWED_INTENTS.join(', ')}

Rules:
- Identify the user's CURRENT primary intent.
- Use conversation history to understand references such as "it", "that payment", or "the same order".
- Detect when the user changes topics and update the intent.
- Distinguish refunds, payment status, payment help and disputed charges.
- Handle account access, technical issues, orders, cancellations and complaints.
- Use general_query for ordinary informational questions.
- Use greeting and farewell for greetings and conversation endings.
- Use unknown only when the intent genuinely cannot be determined.
- Speak naturally, politely and concisely.
- Keep responses suitable for voice playback.
- Ask one clear clarification question when necessary.
- Never claim to access bank accounts or process actual payments.
- Never claim a payment, refund or order has been verified.
- Never invent transaction details or account information.
- Do not expose internal intent labels to the user.

OUTPUT REQUIREMENT:
Return ONLY valid JSON in this exact structure:
{
  "intent": "one_supported_intent",
  "reply": "the natural response to the user"
}

Do not include Markdown, code fences or additional properties.
`

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })

  res.end(JSON.stringify(data))
}

async function readBody(req) {
  let body = ''

  for await (const chunk of req) {
    body += chunk.toString()

    if (body.length > 100_000) {
      throw new Error('Request body too large')
    }
  }

  return JSON.parse(body || '{}')
}

const server = createServer(async (req, res) => {
  const pathname = new URL(
    req.url,
    `http://${req.headers.host || 'localhost'}`
  ).pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, {
      name: 'Vaani API',
      status: 'ready',
      aiConfigured: Boolean(ai),
      model: MODEL,
    })
  }

  if (req.method !== 'POST' || pathname !== '/api/chat') {
    return sendJson(res, 404, { error: 'Route not found' })
  }

  if (!ai) {
    return sendJson(res, 503, {
      error: 'Gemini API key is missing. Check your server .env file.',
    })
  }

  try {
    const { message, history = [] } = await readBody(req)

    if (typeof message !== 'string' || !message.trim()) {
      return sendJson(res, 400, {
        error: 'A non-empty message is required.',
      })
    }

    if (!Array.isArray(history)) {
      return sendJson(res, 400, {
        error: 'Conversation history must be an array.',
      })
    }

    const safeHistory = history
      .filter(item =>
        item &&
        ['user', 'assistant'].includes(item.role) &&
        typeof item.text === 'string' &&
        item.text.trim()
      )
      .slice(-12)
      .map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.text.slice(0, 3000) }],
      }))

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        ...safeHistory,
        {
          role: 'user',
          parts: [{ text: message.trim().slice(0, 3000) }],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 300,
      },
    })

    const rawResponse = response.text?.trim()

    if (!rawResponse) {
      throw new Error('Gemini returned an empty response.')
    }

    let result

    try {
      result = JSON.parse(rawResponse)
    } catch {
      throw new Error('Gemini returned invalid JSON.')
    }

    const intent = ALLOWED_INTENTS.includes(result.intent)
      ? result.intent
      : 'unknown'

    const reply = typeof result.reply === 'string'
      ? result.reply.trim()
      : ''

    if (!reply) {
      throw new Error('Gemini returned an empty reply.')
    }

    return sendJson(res, 200, {
      reply,
      intent,
      model: MODEL,
    })
  } catch (error) {
    console.error('Gemini API error:', {
      message: error instanceof Error ? error.message : String(error),
      status: error?.status,
      code: error?.code,
    })

    return sendJson(res, 502, {
      error: 'Vaani could not generate a response. Please try again.',
    })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Vaani API listening on port ${PORT}`)
  console.log(`Gemini configured: ${Boolean(ai)}`)
})
