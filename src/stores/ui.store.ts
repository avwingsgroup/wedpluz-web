import { defineStore } from 'pinia'
import { ref } from 'vue'
import { uuid } from '@/utils/id'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  durationMs: number
  action?: { label: string; onClick: () => void }
}

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  /** Text the user must type to enable the confirm button (destructive actions). */
  requireText?: string
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

export interface PromptOptions {
  title: string
  description?: string
  label: string
  placeholder?: string
  confirmLabel?: string
  variant?: 'default' | 'danger'
  minLength?: number
  multiline?: boolean
  /** Optional preset choices shown as quick-pick chips. */
  presets?: string[]
}

interface PromptState extends PromptOptions {
  resolve: (value: string | null) => void
}

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const confirmState = ref<ConfirmState | null>(null)
  const promptState = ref<PromptState | null>(null)
  const globalLoading = ref(false)
  const mobileNavOpen = ref(false)
  const notificationsOpen = ref(false)

  function toast(input: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }): string {
    const id = uuid()
    const t: Toast = { id, durationMs: input.durationMs ?? (input.variant === 'error' ? 6000 : 3500), ...input }
    toasts.value = [...toasts.value.slice(-4), t]
    if (t.durationMs > 0) window.setTimeout(() => dismiss(id), t.durationMs)
    return id
  }
  const success = (title: string, description?: string) => toast({ variant: 'success', title, description })
  const error = (title: string, description?: string) => toast({ variant: 'error', title, description })
  const info = (title: string, description?: string) => toast({ variant: 'info', title, description })
  const warning = (title: string, description?: string) => toast({ variant: 'warning', title, description })

  function dismiss(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      confirmState.value = { ...options, resolve }
    })
  }
  function resolveConfirm(ok: boolean) {
    confirmState.value?.resolve(ok)
    confirmState.value = null
  }

  /** Asks for a reason/note (used for moderation, rejections, refunds). Resolves null on cancel. */
  function prompt(options: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      promptState.value = { ...options, resolve }
    })
  }
  function resolvePrompt(value: string | null) {
    promptState.value?.resolve(value)
    promptState.value = null
  }

  return { toasts, toast, success, error, info, warning, dismiss, confirmState, confirm, resolveConfirm, promptState, prompt, resolvePrompt, globalLoading, mobileNavOpen, notificationsOpen }
})
