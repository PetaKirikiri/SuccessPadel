import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { MemberDirectoryCard } from '../src/foundation/PublicMemberDirectory'
import { eligibleForRanking } from '../src/lib/memberRankingBoard'
import { loadEnv } from 'vite'
import { MEMBER_SKILL_LEVELS, memberGender, memberLevel } from '../src/lib/memberDirectory'
assert.equal(memberGender('Female'), 'Women')
assert.equal(memberGender('Male'), 'Men')
assert.equal(memberGender(null), 'Gender not set')
assert.equal(memberLevel({ skill_level: 'Advanced', history_levels: ['Beginner','Beginner'] }).source, 'Assigned')
assert.equal(memberLevel({ skill_level: null, history_levels: ['Beginner','Beginner','Intermediate'] }).label, 'Beginner')
assert.equal(memberLevel({ skill_level: null, history_levels: ['Beginner'] }).label, 'Beginner')
assert.equal(memberLevel({ skill_level: null, history_levels: ['Beginner','Intermediate'] }).label, 'Beginner')
assert.equal(memberLevel({ skill_level: null, history_levels: ['Low Inter','Intermediate'] }).label, 'Beginner')
assert.deepEqual(MEMBER_SKILL_LEVELS, ['Beginner','Low Inter','Intermediate','Advanced'])
assert.equal(memberLevel({ skill_level: 'Open', history_levels: ['Advanced','Advanced'] }).label, 'Beginner')
assert.equal(memberLevel({ skill_level: 'Low Inter', history_levels: [] }).label, 'Low Inter')
const route = fs.readFileSync('src/foundation/routes.tsx','utf8')
assert.match(route, /path="members"\s+element=\{<MembersPage \/>\}/)
const source = fs.readFileSync('src/foundation/PublicMemberDirectory.tsx','utf8')
assert.doesNotMatch(source, /supabase/)
const member = {id:'test',display_name:'Test player',avatar_url:null,gender:'Male',skill_level:'Beginner',history_levels:[],directory_hidden:false,has_line_account:false,court_member:false,residency_status:'local' as const}
const render = (canEdit:boolean) => renderToStaticMarkup(createElement(MemoryRouter,null,createElement(MemberDirectoryCard,{member,canEdit,onSave:async()=>{},onDelete:async()=>{}})))
assert.doesNotMatch(render(false), /Edit name|Edit photo|Delete Test|type="range"/)
assert.match(render(true), /Edit name for Test player/)
assert.match(render(true), /Delete Test player/)
assert.equal(eligibleForRanking(member,'men'),true)
assert.equal(eligibleForRanking(member,'women'),false)
assert.equal(eligibleForRanking({...member,residency_status:'holiday'},'all'),false)
assert.equal(eligibleForRanking({...member,gender:null},'men'),false)
assert.equal(eligibleForRanking({...member,gender:null},'all'),true)
if (process.argv.includes('--live')) {
  const env = loadEnv('development',process.cwd(),'VITE_')
  const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` }
  const base = `${env.VITE_SUPABASE_URL}/rest/v1/public_member_directory`
  const response = await fetch(`${base}?select=*`,{headers})
  assert.equal(response.status,200)
  const rows = await response.json()
  assert.ok(rows.length > 0)
  for (const row of rows) assert.deepEqual(Object.keys(row).sort(),['avatar_url','country','court_member','directory_hidden','display_name','gender','has_line_account','history_levels','id','residency_status','skill_level'])
  for (const row of rows) assert.equal(typeof row.has_line_account, 'boolean')
  for (const row of rows) assert.equal(row.directory_hidden, false)
  const privateField = await fetch(`${base}?select=line_user_id`,{headers})
  assert.equal(privateField.status,400,'Private identifiers are not part of the public schema')
  console.log(`Anonymous directory verified: ${rows.length} entries; public profile fields only; private LINE identifiers excluded.`)
}
console.log('Shared cards: public read-only rendering, owner editing and home/gender ranking eligibility passed.')
