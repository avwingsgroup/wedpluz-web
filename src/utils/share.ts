export interface SharePayload {
  title: string
  text?: string
  url: string
}

/** Uses the Web Share API when available and falls back to the clipboard. Returns the mechanism used. */
export async function shareLink(payload: SharePayload): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function') {
      await navigator.share(payload)
      return 'shared'
    }
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(payload.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
