import { CalendarDays, RotateCcw, ShieldCheck, Sparkles, Store, Ticket, Wallet } from 'lucide-vue-next'
import type { FaqTopic } from '@/content/faqs'

export const TOPIC_ICONS: Record<FaqTopic['icon'], typeof Sparkles> = {
  sparkles: Sparkles,
  ticket: Ticket,
  refund: RotateCcw,
  calendar: CalendarDays,
  store: Store,
  wallet: Wallet,
  shield: ShieldCheck,
}
