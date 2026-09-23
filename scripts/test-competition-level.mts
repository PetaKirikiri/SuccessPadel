import assert from 'node:assert/strict'
import { competitionLevelLabel, competitionInviteTitle } from '../src/lib/competitionLevel.ts'
assert.equal(competitionLevelLabel({ skill_level: 'Beginner', skill_level_min_rank: 1, skill_level_max_rank: 2 }), 'Beginner–Low Inter')
assert.equal(competitionLevelLabel({ skill_level_min_rank: 3, skill_level_max_rank: 3 }), 'Inter')
assert.equal(competitionLevelLabel({ skill_level_min_rank: 4, skill_level_max_rank: 6 }), 'High Inter–Advanced Plus')
assert.equal(competitionLevelLabel({ skill_level: 'Intermediate' }), 'Inter')
assert.equal(competitionLevelLabel({ skill_level: 'Open' }), 'All levels')
assert.equal(competitionLevelLabel({}), null)
assert.equal(competitionLevelLabel({ skill_level: 'Advanced', skill_level_min_rank: 6, skill_level_max_rank: 2 }), 'Advanced')
assert.equal(competitionLevelLabel({ skill_level_min_rank: 1.5, skill_level_max_rank: 3 }), null)
assert.equal(competitionInviteTitle('Superhero Americano Match !!! · Beginner ~ Low Intermediate', 'Beginner–Low Inter'), 'Superhero Americano Match !!!')
assert.equal(competitionInviteTitle('Mixed · Low Inter', 'Beginner'), 'Mixed · Low Inter')
assert.equal(competitionInviteTitle('Mixed · Low Inter', null), 'Mixed · Low Inter')
console.log('Competition level declaration: 11 checks passed')
