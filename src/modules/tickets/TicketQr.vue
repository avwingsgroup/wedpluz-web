<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'

const props = withDefaults(defineProps<{ value: string; size?: number }>(), { size: 160 })
const dataUrl = ref<string | null>(null)
async function render() {
  try {
    dataUrl.value = await QRCode.toDataURL(props.value, { width: props.size * 2, margin: 1, color: { dark: '#21242a', light: '#ffffff' }, errorCorrectionLevel: 'M' })
  } catch {
    dataUrl.value = null
  }
}
onMounted(render)
watch(() => props.value, render)
</script>

<template>
  <div class="inline-flex rounded-2xl bg-ink-50 p-3">
    <img v-if="dataUrl" :src="dataUrl" :width="size" :height="size" alt="Ticket QR code" class="rounded-lg bg-white p-2" />
    <div v-else class="skeleton" :style="{ width: `${size}px`, height: `${size}px` }" />
  </div>
</template>
