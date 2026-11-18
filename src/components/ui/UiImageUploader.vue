<script setup lang="ts">
import { ref } from 'vue'
import { ImagePlus, Trash2, LoaderCircle } from 'lucide-vue-next'
import { cn } from '@/utils/cn'
import { useUpload } from '@/composables/useUpload'
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from '@/utils/files'

const props = withDefaults(
  defineProps<{ modelValue?: string | null; purpose: string; label?: string; hint?: string; error?: string; aspect?: 'banner' | 'square' | 'video'; multiple?: boolean; accept?: 'image' | 'media'; maxMb?: number; shape?: 'rect' | 'circle' }>(),
  { aspect: 'banner', multiple: false, accept: 'image', shape: 'rect' },
)
const emit = defineEmits<{ 'update:modelValue': [url: string | null]; uploaded: [ids: string[], urls: string[]] }>()

const uploader = useUpload({ purpose: props.purpose, multiple: props.multiple, maxMb: props.maxMb, accept: props.accept === 'media' ? [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES] : IMAGE_MIME_TYPES })
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

async function onFiles(files: FileList | null) {
  if (!files?.length) return
  await uploader.add(files)
  const done = () => {
    const ready = uploader.items.value.filter((i) => i.status === 'done')
    if (!uploader.busy.value) {
      emit('uploaded', ready.map((i) => i.upload!.id), ready.map((i) => i.upload!.url))
      if (!props.multiple) emit('update:modelValue', ready[0]?.upload?.url ?? uploader.items.value[0]?.previewUrl ?? null)
    } else setTimeout(done, 150)
  }
  done()
}
function clear() {
  uploader.clear()
  emit('update:modelValue', null)
  emit('uploaded', [], [])
}
defineExpose({ uploadIds: uploader.uploadIds, items: uploader.items, busy: uploader.busy })
</script>

<template>
  <div>
    <span v-if="label" class="label">{{ label }}</span>
    <input ref="fileInput" type="file" class="sr-only" :multiple="multiple" :accept="accept === 'media' ? 'image/*,video/*' : 'image/*'" @change="onFiles(($event.target as HTMLInputElement).files)" />

    <!-- single -->
    <div v-if="!multiple" :class="cn('relative overflow-hidden', shape === 'circle' ? 'h-24 w-24 rounded-full' : cn('w-full rounded-2xl', aspect === 'banner' ? 'aspect-[16/5]' : aspect === 'video' ? 'aspect-video' : 'aspect-square'))">
      <template v-if="modelValue || uploader.items.value[0]?.previewUrl">
        <img :src="modelValue ?? uploader.items.value[0]?.previewUrl" alt="" class="h-full w-full object-cover" />
        <div v-if="uploader.busy.value" class="absolute inset-0 flex items-center justify-center bg-ink-900/40 text-white"><LoaderCircle class="h-6 w-6 animate-spin" /></div>
        <div class="absolute right-2 top-2 flex gap-1">
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70" aria-label="Replace image" @click="fileInput?.click()"><ImagePlus class="h-4 w-4" /></button>
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70" aria-label="Remove image" @click="clear"><Trash2 class="h-4 w-4" /></button>
        </div>
      </template>
      <button
        v-else
        type="button"
        :class="cn('flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed text-ink-500 transition-colors hover:border-brand-400 hover:text-brand-600', shape === 'circle' ? 'rounded-full' : 'rounded-2xl', dragging ? 'border-brand-600 bg-brand-50' : 'border-ink-200 bg-ink-50', error && 'border-danger-500')"
        @click="fileInput?.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="dragging = false; onFiles($event.dataTransfer?.files ?? null)"
      >
        <ImagePlus class="h-6 w-6" />
        <span v-if="shape !== 'circle'" class="text-sm font-medium">Click to upload or drag & drop</span>
        <span v-if="shape !== 'circle'" class="text-xs">PNG, JPG or WEBP · Max {{ maxMb ?? 5 }}MB</span>
      </button>
    </div>

    <!-- multiple -->
    <div v-else class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      <div v-for="item in uploader.items.value" :key="item.localId" class="relative aspect-square overflow-hidden rounded-xl bg-ink-100">
        <img v-if="item.previewUrl" :src="item.previewUrl" alt="" class="h-full w-full object-cover" />
        <div v-else class="flex h-full items-center justify-center text-xs text-ink-500">{{ item.file.name }}</div>
        <div v-if="item.status === 'uploading'" class="absolute inset-x-0 bottom-0 h-1 bg-white/40"><div class="h-full bg-brand-600 transition-all" :style="{ width: `${item.progress}%` }" /></div>
        <div v-if="item.status === 'error'" class="absolute inset-0 flex items-center justify-center bg-danger-500/70 text-xs text-white">Failed</div>
        <button type="button" class="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white" aria-label="Remove" @click="uploader.remove(item.localId); emit('uploaded', uploader.uploadIds(), [])"><Trash2 class="h-3.5 w-3.5" /></button>
      </div>
      <button type="button" :class="cn('flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink-200 bg-ink-50 text-ink-500 hover:border-brand-400 hover:text-brand-600', error && 'border-danger-500')" @click="fileInput?.click()">
        <ImagePlus class="h-5 w-5" /><span class="text-xs">Add</span>
      </button>
    </div>
    <p v-if="error" class="mt-1.5 text-xs text-danger-500" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="mt-1.5 text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
