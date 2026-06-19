const VERCEL_LIVE = 'vercel.live'
const VERCEL_TOOLBAR = 'vercel.com/_toolbar'

function isAppShell(el: HTMLElement): boolean {
  return (
    el === document.body ||
    el === document.documentElement ||
    el.id === 'root'
  )
}

function pinHidden(el: HTMLElement) {
  if (isAppShell(el)) return
  el.style.setProperty('display', 'none', 'important')
  el.style.setProperty('visibility', 'hidden', 'important')
  el.style.setProperty('pointer-events', 'none', 'important')
  el.style.setProperty('opacity', '0', 'important')
}

function isVercelToolbarNode(node: Node): node is HTMLElement {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const el = node as HTMLElement
  const tag = el.tagName
  if (tag === 'IFRAME') {
    const src = (el as HTMLIFrameElement).src
    return src.includes(VERCEL_LIVE) || src.includes(VERCEL_TOOLBAR)
  }
  if (tag === 'SCRIPT') {
    const src = (el as HTMLScriptElement).src
    return src.includes(VERCEL_LIVE) || src.includes(VERCEL_TOOLBAR)
  }
  if (/^VERCEL-/i.test(tag)) return true
  if (el.id === 'vercel-toolbar' || el.id === '__vercel-toolbar') return true
  return el.hasAttribute('data-vercel-toolbar')
}

function neutralizeVercelToolbar() {
  document
    .querySelectorAll<HTMLElement>(
      'iframe, script[src], [data-vercel-toolbar], #vercel-toolbar, #__vercel-toolbar',
    )
    .forEach((el) => {
      if (isVercelToolbarNode(el)) {
        pinHidden(el)
        const parent = el.parentElement
        if (parent && isVercelToolbarNode(parent)) {
          pinHidden(parent)
        }
      }
    })

  if (!document.body) return
  for (const child of document.body.children) {
    if (child.id === 'root') continue
    const el = child as HTMLElement
    const hasVercelIframe = Boolean(
      el.querySelector('iframe[src*="vercel.live"], iframe[src*="vercel.com/_toolbar"]'),
    )
    if (isVercelToolbarNode(el) || hasVercelIframe) {
      pinHidden(el)
    }
  }
}

/** Vercel injects a floating toolbar for team members; keep it off kiosk / TV scoreboards. */
export function suppressVercelToolbar() {
  if (typeof document === 'undefined') return

  neutralizeVercelToolbar()
  new MutationObserver(neutralizeVercelToolbar).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
  window.setInterval(neutralizeVercelToolbar, 1500)
}

export function setTvKioskMode(enabled: boolean) {
  document.documentElement.toggleAttribute('data-tv-kiosk', enabled)
}
