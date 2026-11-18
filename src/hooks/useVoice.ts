import { useCallback, useEffect, useRef, useState } from 'react'

type RecognitionResult = { transcript: string }
type RecognitionEvent = { results: ArrayLike<ArrayLike<RecognitionResult>> }
type RecognitionError = { error: string }
type RecognitionInstance = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionError) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void; abort: () => void
}
declare global { interface Window { SpeechRecognition?: new () => RecognitionInstance; webkitSpeechRecognition?: new () => RecognitionInstance } }

export function useVoice(onTranscript: (text: string) => void, onFailure: (reason: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognition = useRef<RecognitionInstance | null>(null)
  const callbacks = useRef({ onTranscript, onFailure })
  callbacks.current = { onTranscript, onFailure }

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    setSupported(Boolean(Ctor))
    if (!Ctor) return
    const instance = new Ctor()
    instance.lang = 'en-IN'
    instance.interimResults = false
    instance.continuous = false
    instance.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const transcript = last?.[0]?.transcript?.trim()
      if (transcript) callbacks.current.onTranscript(transcript)
    }
    instance.onerror = (event) => { setListening(false); callbacks.current.onFailure(event.error) }
    instance.onend = () => setListening(false)
    recognition.current = instance
    return () => { instance.abort(); recognition.current = null }
  }, [])

  const start = useCallback(() => {
    if (!recognition.current) { callbacks.current.onFailure('speech-recognition-unsupported'); return }
    try { recognition.current.start(); setListening(true) } catch { setListening(false) }
  }, [])
  const stop = useCallback(() => { recognition.current?.stop(); setListening(false) }, [])
  const speak = useCallback((text: string, onEnd: () => void) => {
    if (!('speechSynthesis' in window)) { onEnd(); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-IN'
    utterance.rate = 1
    utterance.onend = onEnd
    utterance.onerror = onEnd
    window.speechSynthesis.speak(utterance)
  }, [])
  const stopSpeaking = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel() }, [])
  return { supported, listening, start, stop, speak, stopSpeaking }
}