/**
 * Copies mapped source GIFs into public/pixel-avatar/showdown/{franchise}/{id}/{pose}.gif
 * and writes a manifest of characters that have all three poses on disk.
 *
 * Usage: npm run showdown:sync
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = join(root, 'public/pixel-avatar')
const showdownRoot = join(publicRoot, 'showdown')
const fighterTest = join(publicRoot, 'fighter-test')
const mapPath = join(root, 'scripts/showdown-asset-map.json')

type PoseMap = Record<string, string>
type FranchiseMap = Record<string, PoseMap>

const POSES = ['stance', 'victory', 'loss'] as const
const assetMap = JSON.parse(readFileSync(mapPath, 'utf8')) as FranchiseMap

function copyMappedAssets() {
  for (const [franchise, characters] of Object.entries(assetMap)) {
    for (const [id, poses] of Object.entries(characters)) {
      const outDir = join(showdownRoot, franchise, id)
      mkdirSync(outDir, { recursive: true })
      for (const pose of POSES) {
        const sourceName = poses[pose]
        if (!sourceName) continue
        const source = join(fighterTest, sourceName)
        const dest = join(outDir, `${pose}.gif`)
        if (!existsSync(source)) {
          console.warn(`skip ${franchise}/${id}/${pose}: missing ${sourceName}`)
          continue
        }
        copyFileSync(source, dest)
        console.log(`copied ${franchise}/${id}/${pose}.gif`)
      }
    }
  }
}

function scanReadyCharacters(): Array<{ franchise: string; id: string }> {
  const ready: Array<{ franchise: string; id: string }> = []
  if (!existsSync(showdownRoot)) return ready

  for (const franchise of readdirSync(showdownRoot, { withFileTypes: true })) {
    if (!franchise.isDirectory() || franchise.name.startsWith('_')) continue
    const franchiseDir = join(showdownRoot, franchise.name)
    for (const character of readdirSync(franchiseDir, { withFileTypes: true })) {
      if (!character.isDirectory()) continue
      const characterDir = join(franchiseDir, character.name)
      const hasAll = POSES.every((pose) => existsSync(join(characterDir, `${pose}.gif`)))
      if (hasAll) ready.push({ franchise: franchise.name, id: character.name })
    }
  }
  return ready.sort((a, b) => a.franchise.localeCompare(b.franchise) || a.id.localeCompare(b.id))
}

copyMappedAssets()
const ready = scanReadyCharacters()
const manifestPath = join(showdownRoot, 'manifest.json')
writeFileSync(manifestPath, `${JSON.stringify({ ready, updatedAt: new Date().toISOString() }, null, 2)}\n`)
console.log(`\n${ready.length} characters ready → ${manifestPath}`)
