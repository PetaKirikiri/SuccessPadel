/**
 * Audits explicit CSS inside TSX.
 *
 * Target architecture:
 * - TSX may use semantic class hooks such as "invite-game-card__roster".
 * - TSX must not contain Tailwind/utility layout tokens or inline style objects.
 * - Visual declarations belong in src/layouts/** or component CSS files.
 *
 * Run:
 *   npm run audit:tsx-css
 *   npm run check:tsx-css -- --strict
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'
const srcDir = path.join(root, 'src')
const strict = process.argv.includes('--strict')

const EXPLICIT_CSS_TOKEN_RE =
  /^(?:!|-)?(?:sm:|md:|lg:|xl:|2xl:|dark:|hover:|active:|disabled:|focus:|focus-visible:|motion-safe:|motion-reduce:)*(?:flex|grid|block|inline|inline-block|inline-flex|hidden|relative|absolute|fixed|sticky|static|inset|inset-x|inset-y|top|right|bottom|left|z|order|col|row|h|min-h|max-h|w|min-w|max-w|size|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|items|justify|content|self|place|overflow|overscroll|object|rounded|border|bg|text|font|leading|tracking|shadow|opacity|ring|outline|transition|duration|ease|scale|rotate|translate|transform|origin|cursor|pointer-events|select|touch|resize|break|truncate|whitespace|sr-only|not-sr-only|antialiased|subpixel-antialiased|tabular-nums|list|appearance|accent|caret|fill|stroke|animate|backdrop|blur|grayscale|basis|grow|shrink|container|columns|float|clear|isolate|isolation|mix-blend|will-change|filter|brightness|contrast|drop-shadow|saturate|sepia|invert|hue-rotate)(?:$|-|\[|:)/

const CLASS_ATTR_RE = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|{`([^`]*)`}|{([^}]+)})/g

type Finding = {
  file: string
  line: number
  kind: 'inline-style' | 'utility-class' | 'dynamic-class'
  detail: string
}

async function findTsxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findTsxFiles(entryPath))
      continue
    }
    if (entry.name.endsWith('.tsx')) files.push(entryPath)
  }

  return files
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function classTokens(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function auditSource(file: string, source: string): Finding[] {
  const findings: Finding[] = []

  const inlineStyleRe = /\bstyle\s*=/g
  let styleMatch: RegExpExecArray | null
  while ((styleMatch = inlineStyleRe.exec(source))) {
    findings.push({
      file,
      line: lineAt(source, styleMatch.index),
      kind: 'inline-style',
      detail: 'style=',
    })
  }

  let classMatch: RegExpExecArray | null
  while ((classMatch = CLASS_ATTR_RE.exec(source))) {
    const literal = classMatch[1] ?? classMatch[2] ?? classMatch[3]
    const dynamic = classMatch[4]
    const line = lineAt(source, classMatch.index)

    if (literal != null) {
      for (const token of classTokens(literal)) {
        if (EXPLICIT_CSS_TOKEN_RE.test(token)) {
          findings.push({
            file,
            line,
            kind: 'utility-class',
            detail: token,
          })
        }
      }
      continue
    }

    if (dynamic != null && /['"`][^'"`]*(?:\s|:|\[)[^'"`]*['"`]/.test(dynamic)) {
      findings.push({
        file,
        line,
        kind: 'dynamic-class',
        detail: dynamic.slice(0, 80).replace(/\s+/g, ' '),
      })
    }
  }

  return findings
}

const files = await findTsxFiles(srcDir)
const findings: Finding[] = []

for (const filePath of files) {
  const source = await readFile(filePath, 'utf8')
  findings.push(...auditSource(path.relative(root, filePath), source))
}

const byFile = new Map<string, Finding[]>()
for (const finding of findings) {
  const list = byFile.get(finding.file) ?? []
  list.push(finding)
  byFile.set(finding.file, list)
}

console.log(`TSX CSS audit: ${findings.length} findings across ${byFile.size}/${files.length} TSX files`)

for (const [file, fileFindings] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
  const examples = fileFindings
    .slice(0, 3)
    .map((finding) => `${finding.line}:${finding.detail}`)
    .join(', ')
  console.log(`  ${file}: ${fileFindings.length} (${examples})`)
}

if (strict && findings.length > 0) {
  console.error('\ncheck:tsx-css failed: explicit CSS remains in TSX.')
  process.exit(1)
}
