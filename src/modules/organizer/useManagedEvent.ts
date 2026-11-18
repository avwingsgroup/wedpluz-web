import { inject, provide, type InjectionKey, type Ref } from 'vue'
import type { ManagedEvent } from '@/services/api/organizer.api'

export interface ManagedEventContext {
  event: Ref<ManagedEvent | null | undefined>
  refresh: () => Promise<unknown>
  isOrganizer: Ref<boolean>
}

const KEY: InjectionKey<ManagedEventContext> = Symbol('managed-event')

export function provideManagedEvent(ctx: ManagedEventContext) {
  provide(KEY, ctx)
}

export function useManagedEvent(): ManagedEventContext {
  const ctx = inject(KEY)
  if (!ctx) throw new Error('useManagedEvent must be used inside ManageEventLayout')
  return ctx
}
