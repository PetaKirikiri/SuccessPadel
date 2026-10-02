import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const meta = (name) => {
  const tag = html.match(new RegExp(`<meta\\s+(?:property|name)="${name}"[^>]*>`))?.[0]
  return tag?.match(/content="([^"]*)"/)?.[1]
}
const asset = new URL('../public/brand/success-padel-chest-preview-v1.jpg', import.meta.url)

test('all share-image tags use the approved versioned public asset', () => {
  const url = 'https://successpadel.app/brand/success-padel-chest-preview-v1.jpg'
  for (const tag of ['og:image', 'og:image:secure_url', 'twitter:image']) assert.equal(meta(tag), url)
  assert.equal(meta('og:image:type'), 'image/jpeg')
  assert.ok(meta('og:image:alt').includes('Success Padel'))
})

test('image is square, matches metadata, and stays below WhatsApp size limit', () => {
  const data = readFileSync(asset)
  assert.equal(data.readUInt16BE(0), 0xffd8, 'JPEG magic')
  let dimensions
  for (let offset = 2; offset < data.length;) {
    assert.equal(data[offset], 0xff)
    const marker = data[offset + 1]
    if (marker === 0xda || marker === 0xd9) break
    const length = data.readUInt16BE(offset + 2)
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      dimensions = { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) }
      break
    }
    offset += 2 + length
  }
  assert.ok(dimensions, 'JPEG dimensions found')
  assert.equal(dimensions.width, dimensions.height)
  assert.ok(dimensions.width >= 300)
  assert.equal(String(dimensions.width), meta('og:image:width'))
  assert.equal(String(dimensions.height), meta('og:image:height'))
  assert.ok(statSync(asset).size < 600_000, 'image must remain below 600 KB')
})
