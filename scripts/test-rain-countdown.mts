import assert from 'node:assert/strict'
import { rainCountdown } from '../src/surfaces/rain-test/rainCountdown'
const at = (time: string) => Date.parse(`2026-10-07T${time}+07:00`)
assert.deepEqual(rainCountdown('2026-10-07', '18:15', '18:25', at('18:14:00')), { live: false, value: '1:00', label: 'Game starts in' })
assert.deepEqual(rainCountdown('2026-10-07', '18:15', '18:25', at('18:15:00')), { live: true, value: '10:00', label: 'Game finishes in' })
assert.equal(rainCountdown('2026-10-07', '18:15', '18:25', at('18:24:59')).value, '0:01')
assert.deepEqual(rainCountdown('2026-10-07', '18:15', '18:25', at('18:25:00')), { live: false, value: '0:00', label: 'Finished' })
assert.equal(rainCountdown('2026-10-07', '18:25', '18:35', at('18:25:00')).value, '10:00')
console.log('Rain countdown: Bangkok timestamps, start/end boundaries and round switching passed.')

assert.deepEqual(rainCountdown('2026-10-07', '18:15', '18:25', at('18:25:00'), '18:26:45'), { live: false, value: '1:45', label: 'Break time' })
assert.equal(rainCountdown('2026-10-07', '18:26:45', '18:36:45', at('18:26:45')).value, '10:00')
