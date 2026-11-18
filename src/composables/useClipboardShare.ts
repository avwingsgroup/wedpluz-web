import { useUiStore } from '@/stores/ui.store'
import { copyText, shareLink } from '@/utils/share'
import { env } from '@/config/env'

export function useShare() {
  const ui = useUiStore()

  async function share(path: string, title: string, text?: string) {
    const url = path.startsWith('http') ? path : `${env.webOrigin}${path}`
    const result = await shareLink({ title, text, url })
    if (result === 'copied') ui.success('Link copied to clipboard')
    else if (result === 'failed') ui.error('Could not share this link')
  }

  async function copy(text: string, label = 'Copied') {
    const ok = await copyText(text)
    if (ok) ui.success(label)
    else ui.error('Could not copy')
  }

  return { share, copy }
}
