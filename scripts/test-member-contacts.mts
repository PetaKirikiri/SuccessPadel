import assert from 'node:assert/strict'
import { normalizeWhatsApp, normalizeLineContact, whatsAppContactUrl } from '../src/lib/memberContacts'
assert.equal(normalizeWhatsApp('+66 (81) 234-5678'), '66812345678')
assert.equal(whatsAppContactUrl('66812345678'), 'https://wa.me/66812345678')
for (const value of ['0812345678', '123', '+66hello', 'https://evil.test']) assert.throws(() => normalizeWhatsApp(value))
for (const value of ['https://line.me/ti/p/~player', 'https://line.me/R/ti/p/abc', 'https://lin.ee/abc123']) assert.equal(normalizeLineContact(value), value)
for (const value of ['U123456789', 'javascript:alert(1)', 'https://line.me.evil.test/ti/p/a', 'https://liff.line.me/123']) assert.throws(() => normalizeLineContact(value))
assert.equal(normalizeLineContact(' '), null)
assert.equal(normalizeWhatsApp(' '), null)
assert.equal(whatsAppContactUrl('bad'), null)
console.log('Contact normalization and app links passed')
