import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

// Real pointer input against the production hook/roster, with a fixture-only
// in-memory RPC. Never rearranges a real competition to exercise the UI.
const browser = process.env.AGENT_BROWSER_BIN || 'agent-browser'
const base = process.env.FORMAT_PREVIEW_URL || 'http://127.0.0.1:5173'
const run = (...args) => execFileSync(browser, ['--session', 'lineup-drag', ...args], { encoding: 'utf8', timeout: 30000 }).trim()
const evaluate = expression => JSON.parse(JSON.parse(run('eval', `JSON.stringify(${expression})`)))
const names = () => evaluate('[...document.querySelectorAll(".competition-pregame__name")].map(e=>e.textContent)')
let socket, sessionId, sequence = 0
const callbacks = new Map()
const send = (method, params = {}, target = sessionId) => new Promise((resolve, reject) => {
  const id = ++sequence
  callbacks.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }))
})
try {
  run('open', `${base}/tests/competition-formats/lineup.html`)
  socket = new WebSocket(run('get', 'cdp-url'))
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
  socket.addEventListener('message', event => {
    const result = JSON.parse(event.data)
    const callback = callbacks.get(result.id)
    if (callback) { callbacks.delete(result.id); result.error ? callback.reject(result.error) : callback.resolve(result.result) }
  })
  const targets = await send('Target.getTargets')
  const target = targets.targetInfos.find(t => t.type === 'page' && t.url.includes('/lineup.html'))
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId
  for (const [mode, width, height, touch] of [['mobile',390,844,true], ['tablet',834,1112,true], ['web',1280,900,false], ['tv',1920,1080,false]]) {
    run('set', 'viewport', String(width), String(height))
    await send('Emulation.setTouchEmulationEnabled', { enabled: touch })
    run('eval', 'localStorage.removeItem("lineup-regression-only")')
    run('open', `${base}/tests/competition-formats/lineup.html`)
    run('wait', '[data-reorder-enabled="true"]')
    const slots = evaluate('[...document.querySelectorAll("[data-lineup-player]")].map(e=>e.dataset.lineupPlayer)')
    const drag = async (from, to, pickup = 'avatar', quick = false) => {
      const before = names()
      const points = evaluate(`[${from},${to}].map(i=>{const r=document.querySelectorAll('.competition-pregame__avatar')[i].getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})`)
      if (pickup !== 'avatar') {
        points[0] = evaluate(`(()=>{
          const card=document.querySelectorAll('[data-lineup-player]')[${from}];
          const r=card.getBoundingClientRect();
          const name=card.querySelector('.competition-pregame__name');
          const n=name.getBoundingClientRect();
          const range=document.createRange(); range.selectNodeContents(name);
          if(n.width>range.getBoundingClientRect().width+2) throw new Error('Invisible name button still fills blank space');
          const candidate={x:n.right+3,y:n.top+n.height/2};
          const hit=document.elementFromPoint(candidate.x,candidate.y);
          const blank=hit?.closest('[data-lineup-player]')===card && !hit.closest('button,a,input');
          return ${JSON.stringify(pickup)}==='space' && blank ? candidate : {x:r.left+5,y:r.top+r.height/2};
        })()`)
      }
      const [a,b] = points
      if (touch) {
        await send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{...a,id:1}] })
        await send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{...b,id:1}] })
      } else {
        await send('Input.dispatchMouseEvent', { type:'mousePressed', ...a, button:'left', buttons:1, clickCount:1 })
        await send('Input.dispatchMouseEvent', { type:'mouseMoved', ...b, button:'left', buttons:1 })
      }
      if (!quick) {
      const floating = evaluate(`(()=>{const e=document.querySelector('[data-dragging="true"]');const s=e&&getComputedStyle(e);return {floating:!!e,transform:s?.transform,z:s?.zIndex,touch:s?.touchAction,target:document.querySelectorAll('[data-lineup-player]')[${to}].dataset.dropTarget}})()`)
      assert.equal(floating.floating, true, `${mode}: ${pickup} drag ${from} to ${to} started at ${JSON.stringify(a)}`)
      assert.notEqual(floating.transform, 'none')
      assert.equal(floating.z, '20')
      assert.equal(floating.touch, 'none')
      assert.equal(floating.target, 'true')
      // Before release, every intervening player must already be sliding into
      // the insertion order, while the underlying slot IDs remain stationary.
      const previewOrder = [...before.keys()]
      previewOrder.splice(to, 0, previewOrder.splice(from, 1)[0])
      const destinations = evaluate(`(()=>{
        const cards=[...document.querySelectorAll('[data-lineup-player]')];
        return cards.map(e=>{
          const effect=e.getAnimations().at(-1)?.effect;
          return effect?.getKeyframes().at(-1)?.transform ?? 'none';
        });
      })()`)
      for (let index=0; index<before.length; index++) {
        if (index===from) continue
        const shifted=previewOrder.indexOf(index)!==index
        assert.equal(destinations[index] !== 'translate(0px, 0px)', shifted, `${mode}: player ${index} previews insertion`)
      }
      }
      if (touch) await send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] })
      else await send('Input.dispatchMouseEvent', { type:'mouseReleased', ...b, button:'left', buttons:0, clickCount:1 })
      const expected = [...before]; expected.splice(to, 0, expected.splice(from,1)[0])
      assert.deepEqual(names(), expected, `${mode}: correct order after drop`)
      assert.deepEqual(evaluate('[...document.querySelectorAll("[data-lineup-player]")].map(e=>e.dataset.lineupPlayer)'),slots)
      return before
    }
    // Forward/backward, across columns and between first/last slots.
    await drag(0, 3, 'padding', true)
    await drag(3, 0, 'space', true)
    for (const [from,to,pickup] of [[0,15,'padding'],[15,0,'space'],[1,10,'avatar'],[10,1,'padding']]) await drag(from,to,pickup)
    assert.equal(evaluate('window.lineupTest.calls.length'),6)
    assert.equal(evaluate('window.lineupTest.attendance'),0, 'Dragging blank space never clicks attendance')
    const acknowledged = names()
    run('reload'); run('wait','[data-lineup-player]')
    assert.deepEqual(names(), acknowledged, 'Saved fixture order survives reload')
    // Two moves before acknowledgement: serialized requests, no remount/refresh.
    run('eval','window.lineupTest.hold=true; window.originalRoster=document.querySelector(".competition-pregame__roster"); true')
    await drag(0,3); await drag(2,5)
    assert.equal(evaluate('window.lineupTest.calls.length'),1)
    run('eval','window.lineupTest.hold=false; window.lineupTest.pending.shift()()')
    run('wait','[aria-busy="false"].competition-pregame__roster')
    assert.equal(evaluate('window.lineupTest.calls.length'),2)
    assert.equal(evaluate('window.originalRoster===document.querySelector(".competition-pregame__roster")'),true)
    assert.equal(evaluate('document.querySelector("[role=status]").textContent'),'')
    // Failed background save restores the last acknowledged order.
    const saved = names()
    run('eval','window.lineupTest.fail=true')
    run('focus','[data-lineup-player="fixture-slot-0"]'); run('press','ArrowRight')
    assert.deepEqual(names(),saved)
    assert.match(evaluate('document.querySelector("[role=status]").textContent'),/Order was not saved/)
    console.log(`PASS ${mode}: ${touch ? 'touch' : 'mouse'} drag, floating feedback, all slots, queued saves, rollback`)
  }
  run('open',`${base}/tests/competition-formats/lineup.html?readonly`); run('wait','[data-lineup-player]')
  assert.equal(evaluate('document.querySelectorAll("[data-reorder-enabled=true]").length'),0)
  run('find','role','button','click','--name',`${names()[0]}: confirm attendance`,'--exact')
  assert.equal(evaluate('window.lineupTest.attendance'),1)
  assert.equal(evaluate('window.lineupTest.calls.length'),0)
  run('open',`${base}/competitive`); run('wait','[data-lineup-player]')
  assert.equal(evaluate('document.querySelectorAll("[data-reorder-enabled=true]").length'),0)
  console.log('PASS public overview: no admin drag controls; attendance remains separate')
} finally { socket?.close(); run('close') }
