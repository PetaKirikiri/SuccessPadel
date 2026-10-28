import assert from 'node:assert/strict';
import {games,transition,waiting,playerTime,timing,roundTime,scheduledEnd} from '../public/tests/rain-rotation/rotation.mjs';

assert.equal(games.length,8);
assert.deepEqual(roundTime(0),{start:1090,end:1100});
assert.deepEqual(roundTime(7),{start:1181,end:1191});
assert.equal(timing.cutoff-scheduledEnd,9);
assert.ok(roundTime(8).end>timing.cutoff);
for(let i=1;i<games.length;i++)assert.equal(roundTime(i).start-roundTime(i-1).end,3);

const partnerships=new Set();
const partners=Array.from({length:17},()=>new Set());
for(const [round,game] of games.entries()){
 const playing=game.flat(2);
 assert.equal(playing.length,8);
 assert.equal(new Set(playing).size,8);
 assert.equal(waiting(round).length,8);
 for(const [court,teams] of game.entries()){
  const change=transition(round,court);
  if(round){
   assert.equal(change.on.length,2);
   assert.equal(change.off.length,2);
   assert.equal(change.stay.length,2);
  }
  for(const [a,b] of teams){
   const key=[a,b].sort((x,y)=>x-y).join(':');
   assert.ok(!partnerships.has(key),`Repeated partners ${key} in game ${round+1}`);
   partnerships.add(key);partners[a].add(b);partners[b].add(a);
   if(round)assert.equal([a,b].filter(n=>change.on.includes(n)).length,1);
  }
 }
}
for(let player=1;player<=16;player++){
 assert.equal(new Set(games.flatMap(game=>game.flatMap((court,i)=>court.flat().includes(player)?[i]:[]))).size,1,`Player ${player} stays on one court`);
 assert.deepEqual(playerTime(player),{game:40,wait:61});
 assert.equal(partners[player].size,4,`Player ${player} must have four different partners`);
 for(let round=2;round<games.length;round++){
  assert.ok(!games.slice(round-2,round+1).every(g=>g.flat(2).includes(player)),`Player ${player} plays three consecutive games`);
 }
}
assert.deepEqual(games[0],[[[1,2],[3,4]],[[5,6],[7,8]]]);
console.log('PASS: 8 rounds, 18:10–19:51, seven 3-minute changeovers, 9-minute buffer; four on/four off; four unique partners each; 40 min play/61 min off including changeovers.');
