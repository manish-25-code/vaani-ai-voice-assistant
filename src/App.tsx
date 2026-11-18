
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AudioLines,
  Bot,
  CircleStop,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Wifi
} from 'lucide-react'

import {
  buildReply,
  initialState,
  transition,
  type EngineState
} from './engine/conversation'

import { useVoice } from './hooks/useVoice'

export default function App() {
  const [state, setState] = useState<EngineState>(initialState)
  const [input, setInput] = useState('')
  const [latencies, setLatencies] = useState<number[]>([])
  const [events, setEvents] = useState<string[]>([
    'Engine initialized',
    'Waiting for user input'
  ])

  const bottom = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const responseTimer = useRef<number | undefined>(undefined)

  const stateRef = useRef(state)
  stateRef.current = state

  const lastTranscript = useRef({ text: '', at: 0 })
  const silenceFired = useRef(false)

  const voiceRef = useRef<ReturnType<typeof useVoice> | null>(null)

  const addEvent = (message: string) => {
    setEvents(previous =>
      [`${new Date().toLocaleTimeString()} · ${message}`, ...previous].slice(0, 8)
    )
  }

  const speakReply = useCallback((reply: string, started: number) => {
    setState(current =>
      transition(current, {
        type: 'START_SPEAKING',
        text: reply
      })
    )

    const latency = Math.max(0, performance.now() - started)

    setLatencies(previous =>
      [Math.round(latency), ...previous].slice(0, 20)
    )

    addEvent(`Response generated in ${Math.round(latency)} ms`)

    voiceRef.current?.speak(reply, () => {
      setState(current =>
        transition(current, { type: 'SPEECH_ENDED' })
      )
    })
  }, [])

  
const handleTranscript = useCallback(async (text: string) => {
  window.clearTimeout(timer.current)

  const started = performance.now()

  // Send previous conversation turns as context.
  const history = state.turns
    .filter(turn => turn.role === 'user' || turn.role === 'assistant')
    .map(turn => ({
      role: turn.role,
      text: turn.text
    }))

  setState(s =>
    transition(s, { type: 'USER_UTTERANCE', text })
  )

  addEvent(`Recognized: "${text}"`)
  addEvent('Sending message to Gemini')

  try {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        history
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Gemini request failed')
    }

    if (!data.reply) {
      throw new Error('Gemini returned an empty response')
    }
    const validIntents = [
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
  'unknown'
]

if (
  typeof data.intent === 'string' &&
  validIntents.includes(data.intent)
) {
  setState(current =>
    transition(current, {
      type: 'AI_INTENT_DETECTED',
      intent: data.intent as EngineState['intent']
    })
  )

  addEvent(`Gemini intent detected: ${data.intent}`)
}

    addEvent(`Gemini response received (${data.model})`)
    speakReply(data.reply, started)

  } catch (error) {
    console.error('Gemini error:', error)

    addEvent('Gemini unavailable; using local fallback')

    const fallback = buildReply(state, text)
    speakReply(fallback, started)
  }
}, [state, speakReply])


  const handleFailure = useCallback((reason: string) => {
    window.clearTimeout(timer.current)

    setState(current =>
      transition(current, {
        type: 'RECOGNITION_FAILED',
        reason
      })
    )

    addEvent(`Recognition fallback: ${reason}`)
  }, [])

  const voice = useVoice(handleTranscript, handleFailure)
  voiceRef.current = voice

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.turns])

  // Manage silence detection.
  useEffect(() => {
    window.clearTimeout(timer.current)

    if (state.phase !== 'listening') {
      return
    }

    silenceFired.current = false

    timer.current = window.setTimeout(() => {
      if (silenceFired.current) return

      silenceFired.current = true

      setState(current => {
        if (current.phase !== 'listening') return current

        return transition(current, {
          type: 'SILENCE_TIMEOUT'
        })
      })

      addEvent('Silence threshold reached')
    }, 9000)

    return () => {
      window.clearTimeout(timer.current)
    }
  }, [state.phase, state.lastActivityAt])

  // Clean up pending timers on unmount.
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current)
      window.clearTimeout(responseTimer.current)
    }
  }, [])

  const submit = (text: string) => {
    if (!text.trim()) return

    voice.stopSpeaking()
    handleTranscript(text)
    setInput('')
  }

  const startListening = () => {
    window.clearTimeout(responseTimer.current)
    window.clearTimeout(timer.current)

    voice.stopSpeaking()

    setState(current =>
      transition(current, {
        type: 'START_LISTENING'
      })
    )

    addEvent('Microphone listening')
    voice.start()
  }

  const interrupt = () => {
    window.clearTimeout(responseTimer.current)
    window.clearTimeout(timer.current)

    voice.stopSpeaking()

    setState(current =>
      transition(current, {
        type: 'INTERRUPT'
      })
    )

    addEvent('Barge-in: assistant playback stopped')

    startListening()
  }

  const reset = () => {
    window.clearTimeout(timer.current)
    window.clearTimeout(responseTimer.current)

    silenceFired.current = false
    lastTranscript.current = { text: '', at: 0 }

    voice.stopSpeaking()
    voice.stop()

    setState(transition(initialState(), { type: 'RESET' }))
    setLatencies([])
    setEvents(['Conversation reset'])
    setInput('')
  }

  const avg = latencies.length
    ? Math.round(
        latencies.reduce((total, value) => total + value, 0) /
        latencies.length
      )
    : 0

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <AudioLines size={20} />
          </div>
          <div>
            <strong>vaani<span>.</span></strong>
            <small>VOICE CONVERSATION ENGINE</small>
          </div>
        </div>

        <div className="top-right">
          <span className="live-dot" />
          <span>LOCAL DEMO</span>
          <span className="version">v1.0.0</span>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} /> REAL-TIME CONVERSATION SYSTEM
          </div>
          <h1>
            Conversations that<br />
            <em>think, listen &amp; adapt.</em>
          </h1>
          <p>
            An interruptible voice agent with explicit dialogue state,
            intent tracking and graceful recovery.
          </p>
        </div>

        <div className="hero-orb">
          <div className={`orb-core ${
            state.phase === 'speaking' || state.phase === 'listening'
              ? 'active'
              : ''
          }`}>
            <AudioLines size={38} />
          </div>
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
        </div>
      </section>

      <div className="workspace">
        <section className="conversation panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">SESSION / 001</span>
              <h2>Live conversation</h2>
            </div>

            <button
              className="icon-button"
              onClick={reset}
              title="Reset conversation"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="status-row">
            <span className={`status-pill ${state.phase}`}>
              <i />
              {state.phase.toUpperCase()}
            </span>

            <span className="muted">
              Intent: <b>{state.intent.replace('_', ' ')}</b>
            </span>

            <span className="muted">
              Turns: <b>{state.turns.filter(t => t.role !== 'system').length}</b>
            </span>
          </div>

          <div className="transcript">
            {state.turns.length === 0 && (
              <div className="empty">
                <div className="empty-icon">
                  <Bot size={25} />
                </div>
                <b>Your conversation starts here</b>
                <span>
                  Try “I already paid yesterday” or interrupt the
                  assistant while it speaks.
                </span>
              </div>
            )}

            {state.turns.map(turn => (
              <div
                key={turn.id}
                className={`turn ${turn.role}`}
              >
                <div className="avatar">
                  {turn.role === 'assistant'
                    ? <Bot size={15} />
                    : turn.role === 'user'
                      ? 'YOU'
                      : <Activity size={14} />}
                </div>

                <div className="bubble-wrap">
                  <div className="turn-meta">
                    {turn.role === 'system'
                      ? 'ENGINE EVENT'
                      : turn.role.toUpperCase()}

                    {turn.intent && (
                      <span> · {turn.intent.replace('_', ' ')}</span>
                    )}
                  </div>

                  <div className="bubble">{turn.text}</div>
                </div>
              </div>
            ))}

            <div ref={bottom} />
          </div>

          {state.error && (
            <div className="recovery">
              <ShieldCheck size={16} />
              <span>
                Recovery mode: {state.error}. You can retry voice
                or type your message.
              </span>
            </div>
          )}

          <div className="composer">
            <button
              className={`mic-button ${voice.listening ? 'listening' : ''}`}
              onClick={voice.listening ? voice.stop : startListening}
              title="Start or stop microphone"
            >
              {voice.listening ? <MicOff /> : <Mic />}
            </button>

            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event =>
                event.key === 'Enter' && submit(input)
              }
              placeholder="Type a message or use your voice…"
            />

            <button
              className="send-button"
              onClick={() => submit(input)}
              disabled={!input.trim()}
            >
              <Send size={17} />
            </button>
          </div>

          <div className="composer-foot">
            <span>
              {voice.supported
                ? 'Speech recognition available in this browser'
                : 'Voice recognition unavailable · text mode enabled'}
            </span>

            {state.phase === 'speaking' && (
              <button className="interrupt" onClick={interrupt}>
                <CircleStop size={14} /> INTERRUPT AI
              </button>
            )}
          </div>
        </section>

        <aside className="side">
          <section className="panel metrics">
            <div className="panel-head">
              <div>
                <span className="section-kicker">OBSERVABILITY</span>
                <h2>Engine metrics</h2>
              </div>
              <Activity size={17} className="accent" />
            </div>

            <div className="metric-grid">
              <div className="metric">
                <span>AVG. RESPONSE</span>
                <strong>{avg}<small> ms</small></strong>
              </div>

              <div className="metric">
                <span>MEASURED TURNS</span>
                <strong>{latencies.length.toString().padStart(2, '0')}</strong>
              </div>
            </div>

            <div className="metric-line">
              <span>Current phase</span>
              <b>{state.phase}</b>
            </div>

            <div className="metric-line">
              <span>Clarification needed</span>
              <b>{state.pendingClarification ? 'Yes' : 'No'}</b>
            </div>

            <div className="metric-line">
              <span>Previous intent</span>
              <b>{state.previousIntent?.replace('_', ' ') ?? '—'}</b>
            </div>
          </section>

          <section className="panel event-panel">
            <div className="panel-head">
              <div>
                <span className="section-kicker">TRACE / STREAM</span>
                <h2>Event log</h2>
              </div>
              <Wifi size={17} className="accent" />
            </div>

            <div className="event-list">
              {events.map((event, index) => (
                <div className="event" key={index}>
                  <span className="event-dot" />
                  {event}
                </div>
              ))}
            </div>
          </section>

          <section className="panel scenario">
            <span className="section-kicker">QUICK SCENARIOS</span>
            <h2>Test the edge cases</h2>

            <button onClick={() => submit('I need help with my payment')}>
              01 <span>Payment support</span>
            </button>

            <button onClick={() => submit('Actually, I was charged twice')}>
              02 <span>Change of intent</span>
            </button>

            <button onClick={() => submit('I already paid yesterday')}>
              03 <span>Payment status</span>
            </button>

            <button onClick={() => submit('This is not my transaction')}>
              04 <span>Disputed charge</span>
            </button>

            <button onClick={() => {
              setState(current =>
                transition(current, { type: 'SILENCE_TIMEOUT' })
              )
              addEvent('Silence scenario injected')
            }}>
              05 <span>Silence timeout</span>
            </button>

            <button onClick={() => handleFailure('simulated-no-speech')}>
              06 <span>Recognition failure</span>
            </button>
          </section>
        </aside>
      </div>

      <footer>
        <span>VAANI ENGINEERING DEMO</span>
        <span>STATEFUL · INTERRUPTIBLE · TESTABLE</span>
        <span>BUILT FOR REAL-WORLD VOICE UX</span>
      </footer>
    </main>
  )
}
