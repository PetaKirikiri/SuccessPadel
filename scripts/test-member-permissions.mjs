import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { canManageMembers } from '../src/lib/memberPermissions.ts'

test('member management requires a loaded admin profile matching the signed-in user', () => {
  const admin = { id: 'admin-a', is_admin: true }
  assert.equal(canManageMembers(false, 'admin-a', admin), true)
  assert.equal(canManageMembers(true, 'admin-a', admin), false)
  assert.equal(canManageMembers(false, null, admin), false)
  assert.equal(canManageMembers(false, 'admin-b', admin), false)
  assert.equal(canManageMembers(false, 'admin-a', null), false)
  assert.equal(canManageMembers(false, 'member-a', { id: 'member-a', is_admin: false }), false)
})
test('profile action is own-profile only and opens the existing creation form', () => {
  const profile = fs.readFileSync('src/foundation/profile/PlayerProfileSurface.tsx', 'utf8')
  const action = fs.readFileSync('src/foundation/profile/AdminAddMemberAction.tsx', 'utf8')
  const members = fs.readFileSync('src/foundation/MembersPage.tsx', 'utf8')
  assert.ok(profile.includes('isOwnProfile && canManageMembers(authLoading, user?.id, authProfile)'))
  assert.ok(action.includes('/members?add=1#add-member'))
  assert.ok(members.includes('id="add-member"'))
  assert.ok(members.includes("new URLSearchParams(location.search).get('add') !== '1'"))
  assert.ok(members.includes('if (!isAdmin || createBusy || !name) return'))
})
