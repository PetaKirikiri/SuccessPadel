import { siteOrigin } from '../siteUrl'

const SAVED_KEY = 'sp-line-bookmark-saved'
const DISMISSED_KEY = 'sp-line-bookmark-dismissed'

export function isLineBookmarkSaved(): boolean {
  try {
    return localStorage.getItem(SAVED_KEY) === '1'
  } catch {
    return false
  }
}

export function isLineBookmarkDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissLineBookmarkPrompt(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function markLineBookmarkSaved(): void {
  try {
    localStorage.setItem(SAVED_KEY, '1')
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function lineBookmarkUrl(path = '/friendly'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${siteOrigin()}${normalized}`
}
