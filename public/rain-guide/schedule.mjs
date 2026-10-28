// Player-facing rain plan for Wednesday 28 October 2026. No live event writes.
// Names follow the supplied Wednesday roster; numbers retain that roster order.
export const players=['Lyri','Kie','Bas','Kevin','Yoan','Martin','Lena','Jansuda',"P’Nart Laemdin",'Puu','Run',"P’Nart Bonkai",'Fabian','Cora','Mathias','Kyle'];
export const games=[
 [[[1,2],[3,4]],[[5,6],[7,8]]],
 [[[3,9],[4,10]],[[7,11],[8,12]]],
 [[[9,13],[10,14]],[[11,15],[12,16]]],
 [[[13,1],[14,2]],[[15,5],[16,6]]],
 [[[1,3],[2,4]],[[5,7],[6,8]]],
 [[[3,10],[4,9]],[[7,12],[8,11]]],
 [[[10,13],[9,14]],[[12,15],[11,16]]],
 [[[13,2],[14,1]],[[15,6],[16,5]]]
];
// Orient the same teams with the least movement by continuing players.
// Prefer keeping their exact spot, then their side; never move between courts.
export const displayGames=[];
for(const [i,courts] of games.entries()){
 displayGames.push(courts.map((teams,c)=>{
  if(!i)return teams;
  const previous=displayGames[i-1][c].flat();
  const variants=[];
  for(const sides of [teams,[teams[1],teams[0]]])for(const a of [sides[0],[...sides[0]].reverse()])for(const b of [sides[1],[...sides[1]].reverse()]) variants.push([a,b]);
  const movement=variant=>variant.flat().reduce((cost,n,slot)=>{
   const before=previous.indexOf(n);if(before<0)return cost;
   return cost+((before===slot?0:(Math.floor(before/2)===Math.floor(slot/2)?1:10))+(before%2===slot%2?0:.3))*(1+(17-n)/100);
  },0);
  variants.sort((a,b)=>movement(a)-movement(b));
  return variants[0];
 }));
}
export function playerState(i,c,n){
 if(!i)return 'starting';
 const before=displayGames[i-1][c].flat().indexOf(n);
 if(before<0)return 'joining';
 const after=displayGames[i][c].flat().indexOf(n);
 return Math.floor(before/2)===Math.floor(after/2)?'staying':'switching';
}
export const clock=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
export const start=i=>18*60+10+i*13;
export const onCourt=i=>games[i].flat(2);
export function roundDetails(i){
 const playing=onCourt(i),previous=i?onCourt(i-1):[];
 return {
  time:`${clock(start(i))}–${clock(start(i)+10)}`,
  on:playing.filter(n=>!previous.includes(n)),
  off:previous.filter(n=>!playing.includes(n)),
  resting:players.flatMap((name,index)=>{
   const number=index+1;if(playing.includes(number))return [];
   const next=games.findIndex((game,j)=>j>i&&game.flat(2).includes(number));
   return [{number,name,next,wait:next<0?0:start(next)-start(i),returnAt:next<0?null:clock(start(next))}];
  })
 };
}
export function playingTurn(i,number){
 let last=i;
 while(last+1<games.length&&onCourt(last+1).includes(number))last++;
 return {minutes:(last-i+1)*10,offAt:clock(start(last)+10)};
}
