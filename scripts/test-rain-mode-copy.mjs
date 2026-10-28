import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {translations,renderRounds} from '../public/rain-guide/languages.mjs';
import {players,games,displayGames,playerState,roundDetails,playingTurn,start} from '../public/rain-guide/schedule.mjs';
import {games as approved,transition,roundTime} from '../public/tests/rain-rotation/rotation.mjs';

assert.deepEqual(games,approved,'Both previews must use the same fixed-court draw');
assert.equal(players.length,16);
assert.equal(new Set(players).size,16);
const page=readFileSync(new URL('../public/rain-guide/index.html',import.meta.url),'utf8');
assert.ok(page.includes('<strong>5</strong>'));
for(let i=0;i<games.length;i++)assert.ok(page.includes(`<dt>${i+1}</dt><dd>${roundDetails(i).time}</dd>`),'Static timetable matches the court schedule');
for(const copy of Object.values(translations)){
 assert.deepEqual(Object.keys(copy).sort(),Object.keys(translations.en).sort());
 const html=renderRounds(copy);
 assert.equal((html.match(/class="example-game"/g)||[]).length,10);
 assert.equal((html.match(/class="shared-bench"/g)||[]).length,10);
 assert.equal((html.match(/class="round-swap"/g)||[]).length,9);
 assert.ok(html.includes(copy.finalChange));
 assert.ok(copy.done.includes('50'));
 assert.ok(copy.end.includes('19:59'));
 assert.ok(!html.includes('undefined'));
 assert.ok(!html.includes('{time}'));
}
games.forEach((courts,i)=>{
 const round=roundDetails(i);
 assert.equal(start(i),roundTime(i).start);
 assert.equal(round.resting.length,8);
 assert.equal(new Set([...courts.flat(2),...round.resting.map(p=>p.number)]).size,16);
 for(const key of ['on','off']) assert.deepEqual(round[key].sort((a,b)=>a-b),[0,1].flatMap(c=>transition(i,c)[key]).sort((a,b)=>a-b));
 for(const person of round.resting){
  if(person.next<0){assert.equal(games.slice(0,i).filter(game=>game.flat(2).includes(person.number)).length,5);continue;}
  assert.equal(person.wait,start(person.next)-start(i));
  assert.ok(games.slice(i,person.next).every(game=>!game.flat(2).includes(person.number)));
 }
 for(const number of courts.flat(2)) assert.ok([10,20].includes(playingTurn(i,number).minutes));
 const pairs=teams=>teams.map(pair=>[...pair].sort((a,b)=>a-b).join(':')).sort();
 courts.forEach((teams,c)=>{
  assert.deepEqual(pairs(displayGames[i][c]),pairs(teams),'Orientation must preserve partners');
  const states=displayGames[i][c].flat().map(n=>playerState(i,c,n));
  if(i){
   assert.equal(states.filter(s=>s==='joining').length,i===9?4:2);
   assert.ok(states.filter(s=>s==='switching').length<=1,'At most one continuing player crosses the net');
   const previous=displayGames[i-1][c].flat();
   for(const n of displayGames[i][c].flat())if(playerState(i,c,n)==='staying')assert.equal(displayGames[i][c].flat().indexOf(n),previous.indexOf(n),'Staying players keep their exact position');
  }
 });
});
for(let n=1;n<=16;n++)assert.equal(new Set(games.flatMap(game=>game.flatMap((teams,c)=>teams.flat().includes(n)?[c]:[]))).size,1,'No court transfers');
assert.deepEqual(roundDetails(0).resting.map(p=>p.number),[9,10,11,12,13,14,15,16]);
assert.equal(roundDetails(0).resting[0].wait,11);
assert.equal(roundDetails(0).resting[4].wait,22);
assert.equal(roundDetails(1).resting.find(p=>p.number===1).wait,22);
assert.equal(playingTurn(0,3).minutes,20);
assert.equal(playingTurn(1,3).minutes,10);
console.log('PASS: ten games, fixed courts, minimal side switches, joining/staying states, final full changeover, waits and four languages.');
