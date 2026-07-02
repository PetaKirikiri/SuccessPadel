/**
 * Blocks unscoped invite-card layout rules that leak across viewport buckets.
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

function checkInviteRule(rule: Rule): string | null {
  const { selector, body, file, line } = rule
  if (isViewportScoped(selector)) return null

  const isInviteRoot = selector === INVITE_ROOT
  const isInviteChild = /\.invite-game-card__/.test(selector)
  if (!isInviteRoot && !isInviteChild) return null

  if (isInviteChild) {
    return `${file}:${line} unscoped ${selector} — move under html[data-viewport='…']`
  }

  const props = parseProps(body)
  for (const key of props.keys()) {
    if (!ALLOWED_ROOT_PROPS.has(key)) {
      return `${file}:${line} ${INVITE_ROOT} may only set display/width/min-width unscoped (found ${key})`
    }
  }
  return null
}

async function findCssFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findCssFiles(entryPath))
      continue
    }

    if (entry.name.endsWith('.css')) {
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

const files = await findCssFiles(layoutsDir)
const violations: string[] = []

for (const filePath of files) {
  const css = await readFile(filePath, 'utf8')
  const relFile = path.relative(root, filePath)
  for (const rule of parseRules(css, relFile)) {
    const violation = checkInviteRule(rule)
    if (violation) violations.push(violation)

    const viewportViolation = checkViewportFileRule(rule)
    if (viewportViolation) violations.push(viewportViolation)
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
