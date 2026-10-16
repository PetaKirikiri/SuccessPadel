import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadEnv } from 'vite'
import { memberGender, memberLevel } from '../src/lib/memberDirectory'
assert.equal(memberGender('Female'), 'Women')
assert.equal(memberGender('Male'), 'Men')
assert.equal(memberGender(null), 'Gender not set')
assert.equal(memberLevel({ skill_level: 'Advanced', history_levels: ['Beginner','Beginner'] }).source, 'Assigned')
assert.equal(memberLevel({ skill_level: null, history_levels: ['Beginner','Beginner','Intermediate'] }).label, 'Beginner')
assert.equal(memberLevel({ skill_level: null, history_levels: ['Beginner'] }).label, 'Unrated')
assert.equal(memberLevel({ skill_level: null, history_levels: ['Beginner','Intermediate'] }).label, 'Unrated')
assert.equal(memberLevel({ skill_level: null, history_levels: ['Low Inter','Intermediate'] }).label, 'Intermediate')
const route = fs.readFileSync('src/foundation/routes.tsx','utf8')
assert.match(route, /path="members"\s+element=\{<MembersPage \/>\}/)
const source = fs.readFileSync('src/foundation/PublicMemberDirectory.tsx','utf8')
assert.doesNotMatch(source, /supabase|onDelete|onSkillLevelChange/)
if (process.argv.includes('--live')) {
  const env = loadEnv('development',process.cwd(),'VITE_')
  const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` }
  const base = `${env.VITE_SUPABASE_URL}/rest/v1/public_member_directory`
  const response = await fetch(`${base}?select=*`,{headers})
  assert.equal(response.status,200)
  const rows = await response.json()
  assert.ok(rows.length > 0)
  for (const row of rows) assert.deepEqual(Object.keys(row).sort(),['avatar_url','court_member','display_name','gender','history_levels','id','skill_level'])
  const privateField = await fetch(`${base}?select=line_user_id`,{headers})
  assert.equal(privateField.status,400,'Private identifiers are not part of the public schema')
  console.log(`Anonymous directory verified: ${rows.length} entries; public profile fields only; private LINE identifiers excluded.`)
}
console.log('Public route and read-only controls passed.')
