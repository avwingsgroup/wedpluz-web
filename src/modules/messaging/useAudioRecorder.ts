import { onScopeDispose, ref } from 'vue'

/** MediaRecorder wrapper for voice notes. Falls back gracefully when the API is unavailable. */
export function useAudioRecorder(maxSeconds = 120) {
  const recording = ref(false)
  const seconds = ref(0)
  const levels = ref<number[]>([])
  const error = ref<string | null>(null)
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let timer: number | null = null
  let stream: MediaStream | null = null
  let analyser: AnalyserNode | null = null
  let raf: number | null = null
  let resolveStop: ((b: Blob | null) => void) | null = null

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia

  async function start() {
    error.value = null
    if (!supported) {
      error.value = 'Voice notes are not supported in this browser.'
      return false
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recorder = new MediaRecorder(stream)
      chunks = []
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.onstop = () => {
        const blob = chunks.length ? new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }) : null
        resolveStop?.(blob)
        cleanup()
      }
      const ctx = new AudioContext()
      analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser?.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        levels.value = [...levels.value.slice(-39), Math.max(8, Math.min(100, avg))]
        raf = requestAnimationFrame(tick)
      }
      tick()
      recorder.start()
      recording.value = true
      seconds.value = 0
      levels.value = []
      timer = window.setInterval(() => {
        seconds.value += 1
        if (seconds.value >= maxSeconds) void stop()
      }, 1000)
      return true
    } catch {
      error.value = 'Microphone access was denied.'
      cleanup()
      return false
    }
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') return resolve(null)
      resolveStop = resolve
      recorder.stop()
    })
  }
  function cancel() {
    resolveStop = null
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    cleanup()
  }
  function cleanup() {
    recording.value = false
    if (timer) window.clearInterval(timer)
    if (raf) cancelAnimationFrame(raf)
    stream?.getTracks().forEach((t) => t.stop())
    timer = null
    raf = null
    stream = null
  }
  onScopeDispose(cancel)
  return { supported, recording, seconds, levels, error, start, stop, cancel }
}
