import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const run = (...args) => execFileSync('agent-browser', ['--session','coach-delete',...args], {encoding:'utf8',timeout:30000}).trim()
const value = js => JSON.parse(JSON.parse(run('eval',`JSON.stringify(${js})`)))
const open = mode => {
  run('open',`http://127.0.0.1:5173/tests/coach-delete/index.html?mode=${mode}`)
  run('wait','.coach-observation')
}
const button = 'button[aria-label="Delete this coach note and its skill observations"]'
try {
  for (const [width,height] of [[390,844],[834,1112],[1280,900],[1920,1080]]) {
    run('set','viewport',String(width),String(height)); open('author')
    assert.equal(value(`document.querySelectorAll(${JSON.stringify(button)}).length`),1)
    // Embedded browsers may suppress native confirm; this flow must not call it.
    run('eval','window.confirm=()=>{throw new Error("Native dialogs unavailable") }'); run('click',button)
    assert.equal(value('window.fixtureDeletes'),0)
    run('wait','button[aria-label="Cancel deleting coach note"]')
    run('click','button[aria-label="Cancel deleting coach note"]')
    assert.equal(value('window.fixtureDeletes'),0)
    assert.equal(value('document.querySelectorAll(".coach-observation").length'),1)
    run('click',button); run('click','button[aria-label="Confirm delete coach note"]')
    assert.equal(value('window.fixtureDeletes'),1)
    assert.equal(value('document.querySelectorAll(".coach-observation").length'),0)
    assert.equal(value('document.querySelector(".padel-skill-sheet").textContent.includes("1 observation")'),false)
    console.log(`PASS ${width}px: cancel preserves note; confirmed delete removes recording and both skill counts`)
  }
  for (const mode of ['other','player']) {
    open(mode); assert.equal(value(`document.querySelectorAll(${JSON.stringify(button)}).length`),0)
    assert.equal(value('window.fixtureDeletes'),0)
  }
  open('failure'); run('click',button); run('click','button[aria-label="Confirm delete coach note"]')
  run('wait','[role="alert"]')
  assert.equal(value('document.querySelectorAll(".coach-observation").length'),1)
  console.log('PASS: other coach/player cannot delete; failed save retains note and displays error')
} finally { run('close') }
