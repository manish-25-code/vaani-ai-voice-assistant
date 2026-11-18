# Vaani — Interruptible Voice Conversation Engine

A browser-based voice assistant prototype focused on the engineering problems described for Voice India's **AI Conversation Fellow**: dialogue state, turn-taking, interruptions, intent changes, silence and speech-recognition failure.

## What is implemented

- Explicit finite-state conversation model (`idle`, `listening`, `thinking`, `speaking`, `interrupted`, `error`).
- Rule-based intent classification for greeting, payment help, payment status and disputes.
- Intent-change events that preserve the previous intent.
- Browser speech input (Web Speech API) and speech output (SpeechSynthesis).
- Barge-in control: cancel current speech and return to listening.
- Silence timeout and recognition-failure fallback.
- Typed input fallback for browsers without speech recognition.
- Event trace and response-generation timing instrumentation.
- Unit tests for state transitions and edge cases.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For microphone access, use `localhost` or HTTPS and grant microphone permission. Speech recognition support varies by browser; Chrome generally provides the best compatibility.

## Test and build

```bash
npm test
npm run build
```

## Try these scenarios

1. `I need help with my payment`
2. `Actually, I was charged twice` — should detect an intent change.
3. `I already paid yesterday` — payment-status path.
4. Select **Silence timeout** in Quick Scenarios.
5. Select **Recognition failure** in Quick Scenarios.
6. Start the assistant speaking and click **INTERRUPT AI** or speak over it.

## Architecture

```text
Microphone / typed input
        |
        v
Speech adapter (Web Speech API)
        |
        v
Conversation state machine
  - phase / turn-taking
  - intent / previous intent
  - clarification state
  - event history
        |
        v
Response policy (demo rules)
        |
        v
Speech synthesis / transcript
        |
        v
Metrics + event trace
```

The state machine is kept independent of the UI and speech APIs so it can be tested deterministically. The browser speech layer is an adapter, not part of the domain model.

## Current limitations and honest scope

- Responses are deterministic demo policies, not LLM-generated.
- The payment scenario is simulated; no bank, payment gateway or customer data is connected.
- Web Speech API availability and recognition quality depend on browser, locale and network.
- The displayed response latency measures local response generation scheduling, not end-to-end speech latency. It does not include microphone capture, recognition, network or synthesis completion.
- This prototype does not yet implement streaming partial transcripts, echo cancellation, VAD, server-side session persistence or production telephony.

## Next engineering milestones

- Add a pluggable LLM adapter behind a server-side API (never expose provider keys in frontend code).
- Add a VAD/streaming speech adapter and measure end-to-end latency.
- Add deterministic replay fixtures and a larger dialogue regression suite.
- Add structured JSON event export for timing analysis.

## Contribution

This repository is intended as an individual engineering demonstration. Document your own implementation, testing, design decisions and measured results before submitting it.
