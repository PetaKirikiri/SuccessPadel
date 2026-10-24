import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const html = readFileSync('dist/coaching/index.html', 'utf8')
const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
test('readers receive coaching content without running JavaScript', () => {
  for (const phrase of ['Improve your padel.', 'One hour with your coach.', 'A week of support.', 'Priority for our competition players.', 'Your personal tracker', 'Coach Boon', '500', 'Book now']) assert.ok(text.includes(phrase), phrase)
  assert.doesNotMatch(text, /TV browser not supported|too old for Success Padel|superhero/)
  assert.doesNotMatch(text, /4 places left|Your place is booked/)
})
test('public HTML retains interactive app and production styles', () => {
  assert.match(html, /<script type="module"[^>]*src="\/assets\//)
  const css = [...html.matchAll(/href="\/(assets\/[^\"]+\.css)"/g)].map(match => match[1])
  assert.ok(css.some(file => file.includes('CoachingPage')))
  for (const file of css) assert.ok(readFileSync(`dist/${file}`, 'utf8').length)
  assert.match(html, /href="\/coaching\?book=1"/)
})
test('coaching metadata and rewrites cover direct, trailing-slash and query URLs', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/successpadel.app\/coaching"/)
  assert.match(html, /<title>Padel Coaching \| Success Padel Samui<\/title>/)
  const { rewrites } = JSON.parse(readFileSync('vercel.json', 'utf8'))
  for (const source of ['/coaching', '/coaching/']) {
    assert.equal(rewrites.find(rule => rule.source === source)?.destination, '/coaching/index.html')
    assert.ok(rewrites.findIndex(rule => rule.source === source) < rewrites.findIndex(rule => rule.source.includes('(?!api/)')))
  }
})
