
export type Phase =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error'

export type Intent =
  | 'payment_status'
  | 'payment_help'
  | 'dispute'
  | 'refund'
  | 'account_help'
  | 'technical_support'
  | 'order_status'
  | 'cancellation'
  | 'greeting'
  | 'farewell'
  | 'general_query'
  | 'complaint'
  | 'unknown'

export type EventKind = 'user' | 'assistant' | 'system'

export interface Turn {
  id: string
  role: EventKind
  text: string
  at: number
  intent?: Intent
  latencyMs?: number
}

export interface EngineState {
  phase: Phase
  intent: Intent
  previousIntent: Intent | null
  turns: Turn[]
  pendingClarification: boolean
  lastActivityAt: number
  error: string | null
}

export type EngineEvent =
  | { type: 'START_LISTENING'; at?: number }
  | { type: 'USER_UTTERANCE'; text: string; at?: number }
  | { type: 'AI_INTENT_DETECTED'; intent: Intent; at?: number }
  | { type: 'START_SPEAKING'; text: string; at?: number }
  | { type: 'INTERRUPT'; at?: number }
  | { type: 'SPEECH_ENDED'; at?: number }
  | { type: 'SILENCE_TIMEOUT'; at?: number }
  | { type: 'RECOGNITION_FAILED'; reason?: string; at?: number }
  | { type: 'RESET'; at?: number }

export const initialState = (): EngineState => ({
  phase: 'idle',
  intent: 'unknown',
  previousIntent: null,
  turns: [],
  pendingClarification: false,
  lastActivityAt: Date.now(),
  error: null
})

const patterns: { intent: Intent; keywords: string[] }[] = [
  {
    intent: 'greeting',
    keywords: ['hello', 'hi', 'hey', 'namaste', 'good morning', 'good evening']
  },
  {
    intent: 'farewell',
    keywords: ['goodbye', 'bye', 'see you', 'talk later', 'have a nice day']
  },
  {
    intent: 'dispute',
    keywords: [
      'charged twice', 'double charged', 'duplicate charge',
      'wrong charge', 'fraud', 'not my transaction',
      'incorrect amount', 'unauthorized transaction'
    ]
  },
  {
    intent: 'refund',
    keywords: [
      'refund', 'money back', 'return my money',
      'refund status', 'refund not received', 'reimbursement'
    ]
  },
  {
    intent: 'payment_status',
    keywords: [
      'already paid', 'payment status', 'paid yesterday',
      'check payment', 'payment received', 'payment went through',
      'transaction status', 'amount deducted'
    ]
  },
  {
    intent: 'payment_help',
    keywords: [
      'payment', 'pay', 'upi', 'bill', 'due amount',
      'transaction failed', 'payment failed'
    ]
  },
  {
    intent: 'account_help',
    keywords: [
      'login', 'log in', 'sign in', 'password',
      'forgot password', 'account locked', 'my account',
      'cannot access account'
    ]
  },
  {
    intent: 'technical_support',
    keywords: [
      'app crashing', 'application not working',
      'technical issue', 'bug', 'error message',
      'not loading', 'website not working', 'server down'
    ]
  },
  {
    intent: 'order_status',
    keywords: [
      'track order', 'order status', 'where is my order',
      'delivery status', 'package', 'shipment'
    ]
  },
  {
    intent: 'cancellation',
    keywords: [
      'cancel order', 'cancel my order', 'cancel subscription',
      'stop subscription', 'cancel booking'
    ]
  },
  {
    intent: 'complaint',
    keywords: [
      'complaint', 'unhappy', 'bad service',
      'poor service', 'not satisfied', 'disappointed'
    ]
  },
  {
    intent: 'general_query',
    keywords: [
      'what services', 'what can you do',
      'help me', 'tell me about', 'how does this work'
    ]
  }
]

export function detectIntent(input: string): Intent {
  const s = input.toLowerCase().trim()

  // More specific intents are checked before general ones.
  for (const item of patterns) {
    if (
      item.keywords.some(keyword =>
        new RegExp(
          `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i'
        ).test(s)
      )
    ) {
      return item.intent
    }
  }

  return 'unknown'
}

function answerFor(
  intent: Intent,
  previous: Intent | null
): { text: string; clarify: boolean } {
  const responses: Partial<Record<Intent, { text: string; clarify: boolean }>> = {
    greeting: {
      text: 'Hello! I am Vaani. I can help with payments, refunds, accounts, orders and technical issues. What do you need help with?',
      clarify: false
    },
    farewell: {
      text: 'Thank you for speaking with Vaani. Have a great day!',
      clarify: false
    },
    payment_status: {
      text: 'I can help you check your payment status. Do you have the transaction reference number?',
      clarify: true
    },
    payment_help: {
      text: 'I can help with your payment. Are you trying to make a payment, resolve a failed transaction, or understand a bill?',
      clarify: true
    },
    dispute: {
      text: 'I can help you review a disputed transaction. Was the transaction unfamiliar, or was the amount incorrect?',
      clarify: true
    },
    refund: {
      text: 'I can help with your refund. When was the refund initiated, and what is its current status?',
      clarify: true
    },
    account_help: {
      text: 'I can help with your account. Are you having trouble logging in, resetting your password, or accessing your account?',
      clarify: true
    },
    technical_support: {
      text: 'I can help troubleshoot that technical issue. Which application or feature is causing the problem?',
      clarify: true
    },
    order_status: {
      text: 'I can help you track your order. Do you have your order ID?',
      clarify: true
    },
    cancellation: {
      text: 'I can guide you through cancellation. Are you cancelling an order, subscription, or booking?',
      clarify: true
    },
    complaint: {
      text: 'I am sorry about your experience. Please tell me what happened so I can understand your concern.',
      clarify: true
    },
    general_query: {
      text: 'Of course! Tell me what you would like to know, and I will do my best to help.',
      clarify: false
    }
  }

  if (responses[intent]) return responses[intent]!

  if (previous && previous !== 'unknown') {
    return {
      text: `I may have missed that. Are we still discussing ${previous.replace('_', ' ')}, or is this a new issue?`,
      clarify: true
    }
  }

  return {
    text: 'I did not understand that clearly. Could you explain what you need help with?',
    clarify: true
  }
}

export function transition(
  state: EngineState,
  event: EngineEvent
): EngineState {
  const at = event.at ?? Date.now()

  switch (event.type) {
    case 'START_LISTENING':
      return {
        ...state,
        phase: 'listening',
        error: null,
        lastActivityAt: at
      }

    case 'USER_UTTERANCE': {
      const text = event.text.trim()

      if (!text) {
        return { ...state, phase: 'listening', lastActivityAt: at }
      }

      const intent = detectIntent(text)

      const changed =
        state.intent !== 'unknown' &&
        intent !== 'unknown' &&
        intent !== state.intent

      const response = answerFor(intent, state.intent)

      const turns: Turn[] = [
        ...state.turns,
        {
          id: crypto.randomUUID(),
          role: 'user',
          text,
          at,
          intent
        },
        ...(changed
          ? [{
              id: crypto.randomUUID(),
              role: 'system' as const,
              text: `Intent changed: ${state.intent} → ${intent}`,
              at
            }]
          : [])
      ]

      return {
        ...state,
        phase: 'thinking',
        previousIntent: changed ? state.intent : state.previousIntent,
        intent,
        turns,
        pendingClarification: response.clarify,
        lastActivityAt: at,
        error: null
      }
    }
        case 'AI_INTENT_DETECTED': {
      const intent = event.intent

      const changed =
        state.intent !== 'unknown' &&
        intent !== 'unknown' &&
        intent !== state.intent

      return {
        ...state,
        intent,
        previousIntent: changed ? state.intent : state.previousIntent,
        pendingClarification: answerFor(intent, state.intent).clarify,
        turns: [
          ...state.turns.map((turn, index) => {
            const lastUserTurnIndex = state.turns
              .map((item, i) => item.role === 'user' ? i : -1)
              .filter(i => i !== -1)
              .pop()

            if (index === lastUserTurnIndex) {
              return { ...turn, intent }
            }

            return turn
          }),
          ...(changed
            ? [{
                id: crypto.randomUUID(),
                role: 'system' as const,
                text: `Intent changed: ${state.intent} → ${intent}`,
                at
              }]
            : [])
        ],
        lastActivityAt: at
      }
    }

    case 'START_SPEAKING':
      return {
        ...state,
        phase: 'speaking',
        turns: [
          ...state.turns,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: event.text,
            at
          }
        ],
        lastActivityAt: at
      }

    case 'INTERRUPT':
      return {
        ...state,
        phase: 'interrupted',
        lastActivityAt: at,
        turns: [
          ...state.turns,
          {
            id: crypto.randomUUID(),
            role: 'system',
            text: 'Assistant speech interrupted by user.',
            at
          }
        ]
      }

    case 'SPEECH_ENDED':
      return { ...state, phase: 'listening', lastActivityAt: at }

    case 'SILENCE_TIMEOUT':
      return {
        ...state,
        phase: 'thinking',
        pendingClarification: true,
        lastActivityAt: at,
        turns: [
          ...state.turns,
          {
            id: crypto.randomUUID(),
            role: 'system',
            text: 'Silence timeout detected; prompting user gently.',
            at
          }
        ]
      }

    case 'RECOGNITION_FAILED':
      return {
        ...state,
        phase: 'error',
        error: event.reason ?? 'Speech recognition failed',
        lastActivityAt: at,
        turns: [
          ...state.turns,
          {
            id: crypto.randomUUID(),
            role: 'system',
            text: `Recognition fallback: ${event.reason ?? 'No speech detected'}. Ask user to retry or type instead.`,
            at
          }
        ]
      }

    case 'RESET':
      return initialState()
  }
}

export function buildReply(
  state: EngineState,
  utterance: string
): string {
  return answerFor(detectIntent(utterance), state.intent).text
}
