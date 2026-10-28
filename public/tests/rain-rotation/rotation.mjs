// Isolated illustration: no app imports, storage, network calls or live event IDs.
export const timing={start:18*60+10,cutoff:20*60,gameMinutes:10,transitionMinutes:3};
export const roundCount=Math.floor((timing.cutoff-timing.start+timing.transitionMinutes)/(timing.gameMinutes+timing.transitionMinutes));
export function roundTime(index){
 const start=timing.start+index*(timing.gameMinutes+timing.transitionMinutes);
 return {start,end:start+timing.gameMinutes};
}
export const scheduledEnd=roundTime(roundCount-1).end;
const clock=minutes=>`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;
// These are rest cohorts, not teams. Partners are rebuilt at every change.
const arrivals=[[9,10,11,12],[13,14,15,16],[1,2,5,6],[3,4,7,8]];
export const courtPlayers=[[1,2,3,4,9,10,13,14],[5,6,7,8,11,12,15,16]];
const pairKey=(a,b)=>[a,b].sort((a,b)=>a-b).join(':');
const permutations=values=>values.length
 ? values.flatMap((value,i)=>permutations(values.filter((_,j)=>j!==i)).map(rest=>[value,...rest]))
 : [[]];

function mixedSchedule(){
 const schedule=[[[[1,2],[3,4]],[[5,6],[7,8]]]];
 const partners=new Map(),opponents=new Map();
 function record(game){
  for(const court of game){
   for(const [a,b] of court){const key=pairKey(a,b);partners.set(key,(partners.get(key)||0)+1)}
   for(const a of court[0])for(const b of court[1]){
    const key=pairKey(a,b);opponents.set(key,(opponents.get(key)||0)+1);
   }
  }
 }
 function cost(game){
  let score=0;
  for(const court of game){
   for(const [a,b] of court)score+=10000*(partners.get(pairKey(a,b))||0);
   for(const a of court[0])for(const b of court[1])score+=(opponents.get(pairKey(a,b))||0)**2;
  }
  return score;
 }
 record(schedule[0]);
 for(let round=1;round<roundCount;round++){
  const entering=arrivals[(round-1)%4];
  const leaving=round===1?[1,2,5,6]:arrivals[(round+1)%4];
  // Keep the continuing players on their court; pair each with a new arrival.
  const staying=schedule.at(-1).map(court=>court.flat().filter(n=>!leaving.includes(n)));
  const candidates=permutations(entering).filter(order=>order.every((player,i)=>courtPlayers[Math.floor(i/2)].includes(player))).map(order=>
   staying.map((players,court)=>players.map((player,i)=>[player,order[court*2+i]])));
  candidates.sort((a,b)=>cost(a)-cost(b));
  schedule.push(candidates[0]);
  record(candidates[0]);
 }
 return schedule;
}
export const games=mixedSchedule();
export function transition(index,court){
 const current=games[index][court].flat();
 const previous=index?games[index-1][court].flat():[];
 return {on:current.filter(n=>!previous.includes(n)),off:previous.filter(n=>!current.includes(n)),stay:current.filter(n=>previous.includes(n))};
}
export function waiting(index){const playing=games[index].flat(2);return Array.from({length:16},(_,i)=>i+1).filter(n=>!playing.includes(n))}
export function appearances(player,through=games.length-1){return games.slice(0,through+1).filter(g=>g.flat(2).includes(player)).length}
export function playerTime(player,through=games.length-1){
 const game=appearances(player,through)*timing.gameMinutes;
 return {game,wait:roundTime(through).end-timing.start-game};
}

if(typeof document!=='undefined'){
 let index=0;
 const chip=(n,entering=false)=>`<span class="player${entering?' entering':''}">${n}</span>`;
 function render(){
  document.querySelector('#game-title').textContent=`Game ${index+1}`;
  const time=roundTime(index);
  document.querySelector('#game-time').textContent=`${clock(time.start)}–${clock(time.end)}`;
  document.querySelector('#change-time').textContent=index<games.length-1
   ? `Changeover ${clock(time.end)}–${clock(roundTime(index+1).start)}`
   : `Overrun buffer ${clock(time.end)}–${clock(timing.cutoff)}`;
  document.querySelector('#event-time').textContent=`${clock(timing.start)}–${clock(scheduledEnd)} · Cutoff ${clock(timing.cutoff)}`;
  document.querySelector('#previous').disabled=index===0;
  document.querySelector('#next').disabled=index===games.length-1;
  document.querySelector('#timeline').innerHTML=games.map((_,i)=>`<button data-game="${i}" aria-label="Game ${i+1}" ${i===index?'aria-current="step"':''}>${i+1}</button>`).join('');
  document.querySelector('#courts').innerHTML=games[index].map((teams,court)=>{
   const change=transition(index,court);
   return `<article class="court-card"><h3>Court ${court+1}</h3><div class="court">${teams.map(pair=>{
    return `<div class="team"><div class="players">${pair.map(n=>chip(n,change.on.includes(n))).join('')}</div></div>`;
   }).join('')}</div><div class="change"><div class="change-group off"><span class="change-label">Off</span>${change.off.length?change.off.map(n=>chip(n)).join(''):'<span class="empty">—</span>'}</div><div class="change-group on"><span class="change-label">On</span>${change.on.map(n=>chip(n)).join('')}</div></div></article>`;
  }).join('');
  document.querySelector('#time-title').textContent=`Whole schedule · ${clock(timing.start)}–${clock(scheduledEnd)}`;
  document.querySelector('#totals').innerHTML=Array.from({length:16},(_,i)=>{
   const time=playerTime(i+1);
   return `<article class="time-card" aria-label="Player ${i+1}">${chip(i+1)}<dl><div class="game-metric"><dt>Game time</dt><dd>${time.game}<span> min</span></dd></div><div class="wait-metric"><dt>Wait time</dt><dd>${time.wait}<span> min</span></dd></div></dl></article>`;
  }).join('');
 }
 document.querySelector('#previous').addEventListener('click',()=>{if(index>0){index--;render()}});
 document.querySelector('#next').addEventListener('click',()=>{if(index<games.length-1){index++;render()}});
 document.querySelector('#timeline').addEventListener('click',event=>{const button=event.target.closest('[data-game]');if(button){index=Number(button.dataset.game);render()}});
 render();
}
