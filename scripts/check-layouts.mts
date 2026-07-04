/**
 * Mechanical layout locks:
 * - root viewport metrics belong to ViewportProvider + viewportLock only
 * - viewport CSS files may only target their own bucket
 * - protected surface internals must be scoped by html[data-viewport='…']
 *
 * Run: npm run check:layouts
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'
const layoutsDir = path.join(root, 'src/layouts')
const inviteComponentFiles = [
  'src/components/InviteCard/InviteCard.tsx',
  'src/components/InviteCard/RosterList.tsx',
  'src/components/InviteCard/InviteCardRosterEditor.tsx',
  'src/components/InviteCard/GamesGenderFilterButtons.tsx',
  'src/components/InviteCard/InviteCardHeaderBadges.tsx',
  'src/components/InviteCard/InviteCardHeaderTitle.tsx',
]

const INVITE_ROOT = '.invite-game-card'
const VIEWPORTS = ['mobile', 'tablet', 'web', 'tv'] as const
const BREAKPOINT_CLASS_RE = /\b(?:sm|md|lg|xl|2xl):[\w:[\]()/%.#-]+/g
const ALLOWED_ROOT_PROPS = new Set([
  'display',
  'width',
  'min-width',
])
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css'])
const ROOT_VIEWPORT_AUTHORITY_FILES = new Set([
  'src/contexts/ViewportContext.tsx',
  'src/lib/viewportLock.ts',
  'src/index.css',
])
const ROOT_VIEWPORT_FORBIDDEN_PATTERNS: Array<[RegExp, string]> = [
  [/\bvisualViewport\b/, 'reads visualViewport'],
  [/\bdataset\.viewport\b/, 'mutates data-viewport'],
  [/\bdataset\.orientation\b/, 'mutates data-orientation'],
  [/\bsyncViewportLockDimensions\b/, 'uses viewport lock sync'],
  [/\breadViewportLockMetrics\b/, 'reads viewport lock metrics'],
  [/setProperty\(['"]--app-width['"]/, 'writes --app-width'],
  [/setProperty\(['"]--app-height['"]/, 'writes --app-height'],
]
const UI_LAYOUT_LOCK_COMMENT = 'UI/layout lock:'
const GUARDED_CLASS_ATTR_RE = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|{`([^`]*)`})/g
const GUARDED_LAYOUT_CLASS_RE =
  /(?:^|\s)(?:sm:|md:|lg:|xl:|2xl:|flex|grid|block|inline-flex|relative|absolute|fixed|sticky|h-[\w[\]()/%.#-]+|w-[\w[\]()/%.#-]+|min-h-[\w[\]()/%.#-]+|min-w-[\w[\]()/%.#-]+|max-h-[\w[\]()/%.#-]+|max-w-[\w[\]()/%.#-]+|overflow-[\w-]+|p[trblxy]?-[\w[\]()/%.#-]+|m[trblxy]?-[\w[\]()/%.#-]+|gap-[\w[\]()/%.#-]+|items-[\w-]+|justify-[\w-]+|content-[\w-]+|rounded[\w:[\]()/%.#-]*|border[\w:[\]()/%.#-]*|bg-[\w:[\]()/%.#-]+|text-[\w:[\]()/%.#-]+|shadow[\w:[\]()/%.#-]*|z-[\w[\]()/%.#-]+|inset[\w:[\]()/%.#-]*|top-[\w[\]()/%.#-]+|right-[\w[\]()/%.#-]+|bottom-[\w[\]()/%.#-]+|left-[\w[\]()/%.#-]+)(?=\s|$)/
const SURFACE_CONTRACTS = [
  {
    name: 'invite',
    root: '.invite-game-card',
    childPattern: /\.invite-game-card__/,
    allowedRootProps: ALLOWED_ROOT_PROPS,
  },
  {
    name: 'game-card',
    root: '.game-card-surface',
    childPattern: /\.game-card-(?:shell|fill|courts)/,
    allowedRootProps: new Set(['display', 'width', 'min-width', 'max-width']),
  },
  {
    name: 'court-card',
    root: '.game-card-court-shell',
    childPattern: /\.game-card-court-/,
    allowedRootProps: new Set(['display', 'width', 'min-width', 'max-width']),
  },
]

type Rule = { selector: string; body: string; file: string; line: number }

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function parseRules(css: string, file: string): Rule[] {
  const rules: Rule[] = []
  const clean = stripComments(css)
  const re = /([^{]+)\{([^}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(clean))) {
    const selector = match[1].trim()
    const body = match[2].trim()
    const line = css.slice(0, match.index).split('\n').length
    if (!selector || selector.startsWith('@')) continue
    for (const part of selector.split(',')) {
      rules.push({ selector: part.trim(), body, file, line })
    }
  }
  return rules
}

function isViewportScoped(selector: string): boolean {
  return selector.includes("html[data-viewport='")
}

function parseProps(body: string): Map<string, string> {
  const props = new Map<string, string>()
  for (const chunk of body.split(';')) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    const colon = trimmed.indexOf(':')
    if (colon === -1) continue
    const key = trimmed.slice(0, colon).trim().toLowerCase()
    const value = trimmed.slice(colon + 1).trim().toLowerCase()
    props.set(key, value)
  }
  return props
}

function checkSurfaceRule(rule: Rule): string | null {
  const { selector, body, file, line } = rule
  if (isViewportScoped(selector)) return null

  for (const contract of SURFACE_CONTRACTS) {
    const isRoot = selector === contract.root
    const isChild = contract.childPattern.test(selector)
    if (!isRoot && !isChild) continue

    if (isChild) {
      return `${file}:${line} unscoped ${selector} — move ${contract.name} internals under html[data-viewport='…']`
    }

    const props = parseProps(body)
    for (const key of props.keys()) {
      if (!contract.allowedRootProps.has(key)) {
        return `${file}:${line} ${contract.root} may only set baseline root props unscoped (found ${key})`
      }
    }
    return null
  }

  return null
}

async function findFiles(dir: string, predicate: (entryPath: string) => boolean): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findFiles(entryPath, predicate))
      continue
    }

    if (predicate(entryPath)) {
      files.push(entryPath)
    }
  }

  return files
}

function checkViewportFileRule(rule: Rule): string | null {
  const viewportFile = rule.file.match(/\.([^.]+)\.css$/)?.[1]
  if (!viewportFile) return null

  const expectedViewport = VIEWPORTS.find((viewport) => viewport === viewportFile)
  if (!expectedViewport) return null

  for (const viewport of VIEWPORTS) {
    if (viewport === expectedViewport) continue
    if (rule.selector.includes(`html[data-viewport='${viewport}']`)) {
      return `${rule.file}:${rule.line} ${viewportFile} CSS may not target ${viewport}`
    }
  }

  return null
}

const files = await findFiles(layoutsDir, (entryPath) => entryPath.endsWith('.css'))
const violations: string[] = []

for (const filePath of files) {
  const css = await readFile(filePath, 'utf8')
  const relFile = path.relative(root, filePath)
  for (const rule of parseRules(css, relFile)) {
    const violation = checkSurfaceRule(rule)
    if (violation) violations.push(violation)

    const viewportViolation = checkViewportFileRule(rule)
    if (viewportViolation) violations.push(viewportViolation)
  }
}

const sourceFiles = await findFiles(path.join(root, 'src'), (entryPath) =>
  SOURCE_EXTENSIONS.has(path.extname(entryPath)),
)

for (const filePath of sourceFiles) {
  const relFile = path.relative(root, filePath)
  if (ROOT_VIEWPORT_AUTHORITY_FILES.has(relFile)) continue
  const source = await readFile(filePath, 'utf8')
  for (const [pattern, label] of ROOT_VIEWPORT_FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      violations.push(`${relFile} ${label} — root viewport authority belongs in ViewportProvider/viewportLock`)
    }
  }

  if (path.extname(filePath) === '.tsx' && source.includes(UI_LAYOUT_LOCK_COMMENT)) {
    if (/\bstyle\s*=/.test(source)) {
      violations.push(`${relFile} is UI/layout locked — inline style belongs in layout CSS`)
    }

    let match: RegExpExecArray | null
    while ((match = GUARDED_CLASS_ATTR_RE.exec(source))) {
      const classValue = match[1] ?? match[2] ?? match[3] ?? ''
      const layoutMatch = classValue.match(GUARDED_LAYOUT_CLASS_RE)
      if (layoutMatch) {
        const line = source.slice(0, match.index).split('\n').length
        violations.push(
          `${relFile}:${line} is UI/layout locked — "${layoutMatch[0].trim()}" belongs in layout CSS`,
        )
      }
    }
  }
}

for (const relFile of inviteComponentFiles) {
  const source = await readFile(path.join(root, relFile), 'utf8')
  const matches = source.match(BREAKPOINT_CLASS_RE) ?? []
  if (matches.length > 0) {
    violations.push(
      `${relFile} contains responsive utility classes (${[...new Set(matches)].join(', ')}) — use split invite CSS files`,
    )
  }
}

if (violations.length > 0) {
  console.error('check:layouts failed:\n')
  for (const v of violations) console.error(`  • ${v}`)
  process.exit(1)
}

console.log(`check:layouts ok (${files.length} layout css files)`)
