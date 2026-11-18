<script setup lang="ts">
import { Mail, MessageCircle, Phone } from 'lucide-vue-next'
import SupportForm from '@/modules/support/SupportForm.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { usePublicConfig } from '@/composables/useReferenceData'
import { useAuthStore } from '@/stores/auth.store'
import { useSeo } from '@/composables/useSeo'

useSeo({ title: 'Help center', description: 'Get help with tickets, payments, events and your Wedpluz account.' })
const auth = useAuthStore()
const { data: config } = usePublicConfig()
const faqs = [
  { q: 'How do I get my ticket?', a: 'After checkout your tickets appear under My Tickets and are emailed to you. Show the QR code at the entrance.' },
  { q: 'Can I cancel a ticket and get a refund?', a: 'Open the ticket and tap Cancel Ticket. Refund eligibility depends on the organizer’s policy and the refund window; we confirm the amount before processing.' },
  { q: 'My payment was deducted but I have no ticket', a: 'Payments are confirmed by our payment partner. Most resolve within minutes. If not, contact us with your bank reference and we’ll investigate.' },
  { q: 'How do organizers get paid?', a: 'Ticket revenue is settled to your withdrawal bank 3 days after the event ends, minus the platform commission and gateway fees.' },
  { q: 'How do I become a vendor?', a: 'Go to Settings → Business Account → Become a Vendor, add your details and publish your profile.' },
]
</script>

<template>
  <div class="container-app pb-10">
    <h1 class="text-3xl md:text-4xl">Help center</h1>
    <p class="mt-2 text-ink-500">Answers to common questions, or reach our team directly.</p>
    <div class="mt-8 grid gap-4 md:grid-cols-3">
      <a :href="`mailto:${config?.support.email ?? 'support@wedpluz.com'}`" class="card flex items-center gap-3 p-5 hover:shadow-card"><Mail class="h-5 w-5 text-brand-600" /><div><p class="font-medium">Email</p><p class="text-sm text-ink-500">{{ config?.support.email ?? 'support@wedpluz.com' }}</p></div></a>
      <a :href="`tel:${config?.support.phone ?? ''}`" class="card flex items-center gap-3 p-5 hover:shadow-card"><Phone class="h-5 w-5 text-brand-600" /><div><p class="font-medium">Phone</p><p class="text-sm text-ink-500">{{ config?.support.phone ?? '—' }}</p></div></a>
      <a :href="`https://wa.me/${(config?.support.whatsapp ?? '').replace(/\D/g, '')}`" target="_blank" rel="noopener noreferrer" class="card flex items-center gap-3 p-5 hover:shadow-card"><MessageCircle class="h-5 w-5 text-success-500" /><div><p class="font-medium">WhatsApp</p><p class="text-sm text-ink-500">{{ config?.support.whatsapp ?? '—' }}</p></div></a>
    </div>
    <div class="mt-10 grid gap-10 lg:grid-cols-2">
      <section>
        <h2 class="text-xl">Frequently asked questions</h2>
        <div class="mt-4 divide-y divide-ink-100 rounded-2xl border border-ink-200">
          <details v-for="f in faqs" :key="f.q" class="group p-4"><summary class="cursor-pointer list-none font-medium marker:hidden">{{ f.q }}<span class="float-right text-ink-400 transition-transform group-open:rotate-45">+</span></summary><p class="mt-2 text-sm text-ink-600">{{ f.a }}</p></details>
        </div>
      </section>
      <section>
        <h2 class="text-xl">Contact support</h2>
        <div class="mt-4"><SupportForm v-if="auth.isAuthenticated" /><div v-else class="card p-6 text-center"><p class="text-ink-500">Log in so we can link your request to your account.</p><UiButton class="mt-3" :to="{ name: 'auth.login', query: { redirect: '/help' } }">Log in</UiButton></div></div>
      </section>
    </div>
  </div>
</template>
