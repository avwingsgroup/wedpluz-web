<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Trash2 } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import { useForm } from '@/composables/useForm'
import { vendorsApi } from '@/services/api/vendors.api'
import { useUiStore } from '@/stores/ui.store'
import { workSchema } from '@/validations'
import type { MediaItem } from '@/types'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const workId = computed(() => (route.params.id ? String(route.params.id) : null))
const existingMedia = ref<MediaItem[]>([])
const loading = ref(!!workId.value)

const form = useForm({
  initialValues: { title: '', description: '', mediaUploadIds: [] as string[] },
  schema: workId.value ? workSchema.omit({ mediaUploadIds: true }) : workSchema,
  onSubmit: (v) => (workId.value ? vendorsApi.updateWork(workId.value, { title: v.title, description: v.description }) : vendorsApi.addWork(v)),
  onSuccess: () => {
    ui.success(workId.value ? 'Work updated' : 'Work published')
    router.push({ name: 'business' })
  },
})
onMounted(async () => {
  if (!workId.value) return
  try {
    const w = await vendorsApi.work(workId.value)
    form.setValues({ title: w.title, description: w.description })
    existingMedia.value = w.media
  } finally {
    loading.value = false
  }
})
async function remove() {
  if (!workId.value || !(await ui.confirm({ title: 'Delete this work?', variant: 'danger', confirmLabel: 'Delete' }))) return
  await vendorsApi.deleteWork(workId.value)
  ui.success('Work deleted')
  router.push({ name: 'business' })
}
</script>

<template>
  <div class="container-app max-w-3xl pb-10">
    <UiBackButton />
    <UiSpinner v-if="loading" page />
    <template v-else>
      <div class="mt-8 flex items-center justify-between"><h1 class="text-3xl">{{ workId ? 'Edit work post' : 'Add work' }}</h1><UiButton v-if="workId" variant="ghost" class="text-danger-500" @click="remove"><Trash2 class="h-4 w-4" />Delete</UiButton></div>
      <form class="mt-8 space-y-5" novalidate @submit.prevent="form.submit()">
        <div v-if="workId" class="grid grid-cols-3 gap-3 sm:grid-cols-5"><img v-for="m in existingMedia" :key="m.id" :src="m.thumbnailUrl ?? m.url" alt="" class="aspect-square rounded-xl object-cover" /></div>
        <UiImageUploader v-else purpose="vendor_work" multiple accept="media" :max-mb="50" label="Photos & videos" hint="Up to 10 files. Images up to 5MB, videos up to 50MB." :error="form.fieldError('mediaUploadIds')" @uploaded="(ids) => (form.values.mediaUploadIds = ids)" />
        <UiInput v-model="form.values.title" label="Title" placeholder="Tolu & Femi’s garden wedding" :error="form.fieldError('title')" @blur="form.touch('title')" />
        <UiTextarea v-model="form.values.description" label="Description" :rows="5" :maxlength="1000" placeholder="Tell people about this project" />
        <UiButton type="submit" size="lg" block :loading="form.submitting.value">{{ workId ? 'Save changes' : 'Publish work' }}</UiButton>
      </form>
    </template>
  </div>
</template>
