import postcss from 'postcss'

export const modes = ['mobile', 'tablet', 'web', 'tv']

// Parse nested @media/@supports rules and selector lists, not CSS with regex.
export function parseLayoutRules(css, file) {
  const rules = []
  postcss.parse(css, { from: file }).walkRules((rule) => {
    // Animation steps are not DOM selectors.
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return
    }
    for (const selector of postcss.list.comma(rule.selector)) {
      rules.push({ selector: selector.trim(), body: rule.nodes.map(String).join(';'), file, line: rule.source.start.line })
    }
  })
  return rules
}

export function selectorViewport(selector) {
  return /^html\[data-viewport\s*=\s*(['"])(mobile|tablet|web|tv)\1\](?=\s|[.:#\[]|$)/.exec(selector)?.[2]
}

export function checkViewportRule(rule) {
  const expected = /\.(mobile|tablet|web|tv)\.css$/.exec(rule.file)?.[1]
  if (!expected) return null
  if (selectorViewport(rule.selector) !== expected) {
    return `${rule.file}:${rule.line} every selector must start with html[data-viewport='${expected}'] (found ${rule.selector})`
  }
  // Sibling combinators can escape the html scope, even with a valid prefix.
  if (/^html\[data-viewport\s*=\s*(['"])(?:mobile|tablet|web|tv)\1\]\s*[+~]/.test(rule.selector)) {
    return `${rule.file}:${rule.line} selector escapes its viewport root`
  }
  return null
}

export function checkViewportFile(css, file) {
  const errors = parseLayoutRules(css, file).map(checkViewportRule).filter(Boolean)
  if (/\.(mobile|tablet|web|tv)\.css$/.test(file)) {
    postcss.parse(css, { from: file }).walkAtRules((rule) => {
      if (['import', 'font-face', 'property', 'page', 'keyframes', '-webkit-keyframes'].includes(rule.name)) {
        errors.push(`${file}:${rule.source.start.line} @${rule.name} is global; put it in separately reviewed shared infrastructure`)
      }
    })
  }
  return errors
}

export function fileScope(file) {
  if (/^(scripts\/(?:check-layouts|layout-isolation|check-layout-scope|test-layout-isolation)|\.github\/|package(?:-lock)?\.json$|AGENTS\.md$|vite\.config\.|src\/lib\/(?:viewBreakpoints|viewportLock)\.|src\/contexts\/ViewportContext\.)/.test(file)) return 'infrastructure'
  // Only the audited, scoped CSS directories qualify as isolated visual edits.
  const mode = /^src\/layouts\/(?:invite|game-card|court-card)\/[^/]+\.(mobile|tablet|web|tv)\.css$/.exec(file)?.[1]
  return mode ?? 'shared'
}

export function scopeViolations(files, requested) {
  if (![...modes, 'shared', 'infrastructure'].includes(requested)) throw new Error('Declare mobile, tablet, web, tv, shared, or infrastructure scope.')
  return files.filter((file) => {
    const actual = fileScope(file)
    return requested === 'infrastructure' ? false : requested === 'shared' ? actual === 'infrastructure' : actual !== requested
  }).map((file) => `${file}: ${fileScope(file)} change is not allowed in a ${requested}-only change`)
}
