import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import postcss from 'postcss'
import ts from 'typescript'
import { checkViewportFile } from './layout-isolation.mjs'

export const rosterHook = /\.competition-pregame__(?:roster|player(?!s)|rank|avatar|name|attendance|confirm|lineup)/

export function formatScope(file) {
  return /\/competition-formats\/(singles|duos)\//.exec(file)?.[1] ?? 'shared'
}
export function checkFormatCss(css, format) {
  const errors = []
  postcss.parse(css).walkRules(rule => {
    for (const selector of postcss.list.comma(rule.selector)) {
      const root = `[data-competition-format='${format}']`
      const prefix = selector.slice(0, selector.indexOf(root))
      const allowedPrefix = /^(?:html\[data-viewport='(?:mobile|tablet|web|tv)'\] )?(?:\.tv-play-view )?(?:\.tv-play-standings )?(?:\.competition-pregame)?$/
      if (!selector.includes(root) || !allowedPrefix.test(prefix) || /\]\s*[+~]/.test(selector) || selector.includes(`[data-competition-format='${format === 'duos' ? 'singles' : 'duos'}']`)) errors.push(selector)
    }
  })
  postcss.parse(css).walkAtRules(rule => { if (['import', 'keyframes', '-webkit-keyframes', 'font-face', 'property', 'page'].includes(rule.name)) errors.push('@' + rule.name) })
  return errors
}

/** Parse import edges, including re-exports and dynamic imports, not source text guesses. */
export function checkFormatModule(source, file) {
  const errors = []
  const format = formatScope(file)
  const presenter = file.startsWith('src/components/competition-formats/')
  const allowedShared = new Set([
    'src/components/competition-formats/rosterContract',
    'src/shared/ProfilePhoto/PlayerNameLink',
    'src/lib/competition-formats/contract',
    'src/lib/leaderboardTypes',
  ])
  const check = specifier => {
    if (!specifier || !ts.isStringLiteralLike(specifier)) { errors.push('computed import cannot be audited'); return }
    const name = specifier.text
    const target = name.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), name)).replace(/\.(tsx?|jsx?)$/, '') : name
    const owner = formatScope(target)
    if (owner !== 'shared' && owner !== format) errors.push(`cross-format import: ${name}`)
    if (owner === 'shared' && name !== 'react' && !allowedShared.has(target)) errors.push(`unreviewed shared dependency: ${name}`)
  }
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) check(node.moduleSpecifier)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) check(node.moduleReference.expression)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) check(node.arguments[0])
    if (presenter && ts.isJsxAttribute(node) && node.name.getText(ast) === 'style') errors.push('presenter contains inline styles')
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return errors
}
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)])
const errors = []
for (const root of ['src/lib/competition-formats', 'src/layouts/competition-formats', 'src/components/competition-formats']) {
  for (const file of walk(root)) {
    const format = formatScope(file)
    if (format === 'shared') continue
    const source = fs.readFileSync(file, 'utf8')
    if (file.endsWith('.css')) errors.push(...checkFormatCss(source, format).map(error => `${file}: ${error}`), ...checkViewportFile(source, file))
    if (/\.tsx?$/.test(file)) errors.push(...checkFormatModule(source, file).map(error => `${file}: ${error}`))
  }
}
// Migrated roster rules must not quietly reappear in a shared stylesheet.
for (const file of walk('src').filter(file => file.endsWith('.css') && formatScope(file) === 'shared')) {
  postcss.parse(fs.readFileSync(file, 'utf8')).walkRules(rule => {
    if (rosterHook.test(rule.selector)) errors.push(`${file}: roster styling belongs to format-owned viewport files`)
  })
}
const args = process.argv.slice(2)
if (args.includes('--scope')) {
  const scope = args[args.indexOf('--scope') + 1]
  if (!['singles', 'duos', 'shared'].includes(scope)) throw Error('Declare singles, duos or shared format scope')
  const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'HEAD'
  const revision = execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { encoding: 'utf8' }).trim()
  const files = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', ...(args.includes('--staged') ? ['--cached'] : []), revision, ...(args.includes('--committed') ? ['HEAD'] : [])], { encoding: 'utf8' }).split('\0').filter(Boolean)
  if (!args.includes('--staged') && !args.includes('--committed')) files.push(...execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))
  if (scope !== 'shared') for (const file of files) if (formatScope(file) !== scope) errors.push(`${file}: not owned by ${scope}; declare and review shared work`)
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 } else console.log('Competition format boundaries passed')
