import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Exercise emitted JavaScript with Node, not Vite's permissive TS resolver.
const output = await mkdtemp(join(tmpdir(), 'padel-share-runtime-'))
const files = [
  'api/competition-share.ts', 'server/sharing/competitionPage.ts',
  'src/lib/competitionShareDetails.ts', 'src/lib/competitionLevel.ts',
  'src/lib/courtSchedule.ts', 'src/lib/competitionScheduleLayout.ts',
]
await writeFile(join(output, 'package.json'), '{"type":"module"}')
for (const file of files) {
  const target = join(output, file.replace(/\.ts$/, '.js'))
  await mkdir(dirname(target), { recursive: true })
  const emitted = ts.transpileModule(await readFile(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  })
  await writeFile(target, emitted.outputText)
}
await mkdir(join(output, 'dist'))
await cp('dist/index.html', join(output, 'dist/index.html'))
const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import { createServer } from 'node:http';
  import handler from './api/competition-share.js';
  const server = createServer((req, res) => handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/competitive');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('success-padel-chest-preview-v1.jpg'));
    assert.ok(html.includes('/assets/index-'));
    console.log('Compiled share function loads and serves the built app shell');
  } finally { server.closeAllConnections(); server.close(); }
`], { cwd: output, encoding: 'utf8' })
assert.ok(result.includes('Compiled share function'))
console.log(result.trim())
