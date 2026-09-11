import { execFileSync } from 'node:child_process'
import { scopeViolations } from './layout-isolation.mjs'

const args = process.argv.slice(2)
const option = (name) => args[args.indexOf(name) + 1]
const scope = args.includes('--scope') ? option('--scope') : process.env.LAYOUT_SCOPE
const base = args.includes('--base') ? option('--base') : 'HEAD'
const git = (...params) => execFileSync('git', params, { encoding: 'utf8' }).split('\0').filter(Boolean)
// Resolve a ref before using it; no shell interpolation of PR metadata.
const revision = execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { encoding: 'utf8' }).trim()
const staged = args.includes('--staged')
const committed = args.includes('--committed')
const files = git('diff', '--name-only', '--no-renames', '-z', ...(staged ? ['--cached'] : []), revision, ...(committed ? ['HEAD'] : []), '--')
if (!staged && !committed) files.push(...git('ls-files', '--others', '--exclude-standard', '-z'))
const violations = scopeViolations([...new Set(files)], scope)
if (violations.length) {
  console.error(`Layout scope check failed:\n${violations.join('\n')}`)
  process.exit(1)
}
console.log(`Layout scope ${scope}: ${files.length} changed paths checked`)
