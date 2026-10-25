import assert from 'node:assert/strict'
import { directoryOwnerToken, rememberDirectoryOwner } from '../src/lib/memberDirectoryAccess'

const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
}
assert.equal(directoryOwnerToken('', storage), null)
assert.equal(directoryOwnerToken('#owner=first', storage), 'first')
assert.equal(directoryOwnerToken('', storage), null, 'Reading a URL must not persist unverified access')
rememberDirectoryOwner('verified', storage)
assert.equal(directoryOwnerToken('', storage), 'verified', 'Plain routes retain verified owner access')
assert.equal(directoryOwnerToken('#owner=replacement', storage), 'replacement', 'Explicit links take precedence')
rememberDirectoryOwner(null, storage)
assert.equal(directoryOwnerToken('', storage), null, 'Rejected access is cleared')
const blocked = {
  getItem: () => { throw new Error('Blocked') },
  setItem: () => { throw new Error('Blocked') },
  removeItem: () => { throw new Error('Blocked') },
}
assert.equal(directoryOwnerToken('', blocked), null)
assert.equal(directoryOwnerToken('#owner=link', blocked), 'link')
assert.doesNotThrow(() => rememberDirectoryOwner('link', blocked))
console.log('Directory owner access persistence passed')
