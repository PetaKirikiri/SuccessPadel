import assert from 'node:assert/strict';
import {games,transition,waiting,playerTime,timing,roundTime,scheduledEnd} from '../public/tests/rain-rotation/rotation.mjs';

assert.equal(games.length,10);
assert.deepEqual(roundTime(0),{start:1090,end:1100});
assert.deepEqual(roundTime(9),{start:1189,end:1199});
assert.equal(timing.cutoff-scheduledEnd,1);
assert.ok(roundTime(10).end>timing.cutoff);
for(let i=1;i<games.length;i++)assert.equal(roundTime(i).start-roundTime(i-1).end,1);

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
   assert.equal(change.on.length,round===9?4:2);
   assert.equal(change.off.length,round===9?4:2);
   assert.equal(change.stay.length,round===9?0:2);
  }
  for(const [a,b] of teams){
   const key=[a,b].sort((x,y)=>x-y).join(':');
   assert.ok(!partnerships.has(key),`Repeated partners ${key} in game ${round+1}`);
   partnerships.add(key);partners[a].add(b);partners[b].add(a);
   if(round)assert.equal([a,b].filter(n=>change.on.includes(n)).length,round===9?2:1);
  }
 }
}
for(let player=1;player<=16;player++){
 assert.equal(new Set(games.flatMap(game=>game.flatMap((court,i)=>court.flat().includes(player)?[i]:[]))).size,1,`Player ${player} stays on one court`);
 assert.deepEqual(playerTime(player),{game:50,wait:59});
 assert.equal(partners[player].size,5,`Player ${player} must have five different partners`);
 for(let round=2;round<games.length;round++){
  assert.ok(!games.slice(round-2,round+1).every(g=>g.flat(2).includes(player)),`Player ${player} plays three consecutive games`);
  assert.ok(!games.slice(round-2,round+1).every(g=>!g.flat(2).includes(player)),`Player ${player} waits three consecutive games`);
 }
}
assert.deepEqual(games[0],[[[1,2],[3,4]],[[5,6],[7,8]]]);
console.log('PASS: 10 rounds, 18:10–19:59, nine 1-minute changeovers, 1-minute buffer; final full swap; five unique partners each; 50 min play/59 min off including changeovers.');
