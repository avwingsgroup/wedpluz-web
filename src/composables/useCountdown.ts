import { computed, onScopeDispose, ref } from 'vue'

/** Resend-code style countdown. */
export function useCountdown(seconds: number) {
  const remaining = ref(0)
  let timer: number | null = null

  function start(from = seconds) {
    stop()
    remaining.value = from
    timer = window.setInterval(() => {
      remaining.value -= 1
      if (remaining.value <= 0) stop()
    }, 1000)
  }
  function stop() {
    if (timer) window.clearInterval(timer)
    timer = null
    if (remaining.value < 0) remaining.value = 0
  }
  const active = computed(() => remaining.value > 0)
  const label = computed(() => `${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')}`)

  onScopeDispose(stop)
  return { remaining, active, label, start, stop }
}
