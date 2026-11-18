/** Safe wrappers around Web Storage: never throw in private mode or when quota is exceeded. */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  getJSON<T>(key: string, fallback: T): T {
    const raw = safeStorage.get(key)
    if (!raw) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },
  setJSON(key: string, value: unknown): void {
    safeStorage.set(key, JSON.stringify(value))
  },
}

export const sessionStore = {
  get(key: string): string | null {
    try {
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.sessionStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}
