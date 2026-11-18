import { ref } from 'vue'
import { accountApi } from '@/services/api/account.api'
import { useUiStore } from '@/stores/ui.store'
import { IMAGE_MIME_TYPES, readAsDataUrl, validateUpload } from '@/utils/files'
import type { Upload } from '@/types'

export interface LocalUpload {
  localId: string
  file: File
  previewUrl: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  upload: Upload | null
  error: string | null
}

/**
 * Upload orchestration: validate → preview → POST /uploads (multipart) → return upload id.
 * The backend stores the file on Cloudinary/S3 and returns a stable upload id that other
 * endpoints reference (avatarUploadId, coverUploadId, mediaUploadIds …).
 */
export function useUpload(options: { accept?: readonly string[]; maxMb?: number; purpose: string; multiple?: boolean } ) {
  const ui = useUiStore()
  const items = ref<LocalUpload[]>([])
  const busy = ref(false)

  async function add(files: FileList | File[]) {
    const list = Array.from(files)
    if (!options.multiple) items.value = []
    for (const file of list) {
      const check = validateUpload(file, { accept: options.accept ?? IMAGE_MIME_TYPES, maxMb: options.maxMb })
      if (!check.ok) {
        ui.error(check.error ?? 'Invalid file')
        continue
      }
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const previewUrl = file.type.startsWith('image/') ? await readAsDataUrl(file) : ''
      const item: LocalUpload = { localId, file, previewUrl, progress: 0, status: 'pending', upload: null, error: null }
      items.value = [...items.value, item]
      void start(item)
    }
  }

  async function start(item: LocalUpload) {
    busy.value = true
    item.status = 'uploading'
    try {
      const upload = await accountApi.upload(item.file, options.purpose, (p) => {
        item.progress = p
      })
      item.upload = upload
      item.status = 'done'
      item.progress = 100
    } catch (e) {
      item.status = 'error'
      item.error = (e as Error).message
      ui.error('Upload failed', item.error)
    } finally {
      busy.value = items.value.some((i) => i.status === 'uploading')
    }
  }

  function remove(localId: string) {
    items.value = items.value.filter((i) => i.localId !== localId)
  }
  function clear() {
    items.value = []
  }
  const uploadIds = () => items.value.filter((i) => i.upload).map((i) => i.upload!.id)
  const firstUrl = () => items.value.find((i) => i.upload)?.upload?.url ?? items.value[0]?.previewUrl ?? null

  return { items, busy, add, remove, clear, uploadIds, firstUrl }
}
