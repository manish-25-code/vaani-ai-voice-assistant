import { describe, expect, it } from 'vitest'
import { initialState, transition } from './conversation'

describe('conversation state machine', () => {
  it('moves from idle to listening', () => {
    expect(transition(initialState(), { type: 'START_LISTENING', at: 10 }).phase).toBe('listening')
  })
  it('records user turn and classifies payment status', () => {
    const next = transition(initialState(), { type: 'USER_UTTERANCE', text: 'I already paid yesterday', at: 20 })
    expect(next.intent).toBe('payment_status')
    expect(next.turns[0].role).toBe('user')
    expect(next.phase).toBe('thinking')
  })
  it('detects a change of intent and records an event', () => {
    let state = transition(initialState(), { type: 'USER_UTTERANCE', text: 'I need help with my payment', at: 1 })
    state = transition(state, { type: 'USER_UTTERANCE', text: 'Actually, I was charged twice', at: 2 })
    expect(state.intent).toBe('dispute')
    expect(state.previousIntent).toBe('payment_help')
    expect(state.turns.some(t => t.text.includes('Intent changed'))).toBe(true)
  })
  it('handles silence without crashing', () => {
    const next = transition(initialState(), { type: 'SILENCE_TIMEOUT', at: 30 })
    expect(next.pendingClarification).toBe(true)
    expect(next.turns.at(-1)?.text).toContain('Silence timeout')
  })
  it('provides a recognition failure fallback', () => {
    const next = transition(initialState(), { type: 'RECOGNITION_FAILED', reason: 'no-speech', at: 40 })
    expect(next.phase).toBe('error')
    expect(next.error).toBe('no-speech')
  })
  it('records interruption while preserving conversation history', () => {
    let state = transition(initialState(), { type: 'USER_UTTERANCE', text: 'Hello', at: 1 })
    state = transition(state, { type: 'INTERRUPT', at: 2 })
    expect(state.phase).toBe('interrupted')
    expect(state.turns.some(t => t.role === 'user')).toBe(true)
  })
})