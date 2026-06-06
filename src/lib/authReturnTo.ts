const RETURN_TO_KEY = 'successpadel_return_to'

export function saveReturnTo(path: string) {
  if (path && path !== '/login' && !path.startsWith('/auth/')) {
    sessionStorage.setItem(RETURN_TO_KEY, path)
  }
}

export function consumeReturnTo(fallback = '/'): string {
  const fromState = sessionStorage.getItem(RETURN_TO_KEY)
  sessionStorage.removeItem(RETURN_TO_KEY)
  if (fromState && fromState !== '/login' && !fromState.startsWith('/auth/')) {
    return fromState
  }
  return fallback
}
