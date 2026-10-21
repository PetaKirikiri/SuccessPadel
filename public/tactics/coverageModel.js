// A pre-shot reach estimate, not a probability of winning a point.
// Retarget the current flight's time/height/sideways bend across the receiving
// half. The selected lane is exact; other lanes are a positional approximation.
// No post-bounce/glass returns or automatic movement of the figures are implied.
export const REACH={reaction:.22,acceleration:3.8,speed:4.2,racket:1.1,height:2.65};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function movementReach(time){
  const t=Math.max(0,time-REACH.reaction),ramp=REACH.speed/REACH.acceleration;
  return t<ramp?.5*REACH.acceleration*t*t:REACH.speed*(t-ramp/2);
}

export function coverageFrame(setup,trace){
  const source=trace?.samples?.[0]?.p;
  const bounce=trace?.impacts?.find(i=>i.kind==='floor');
  if(!setup.valid||!source||!bounce)return null;
  // A net/fence/glass hit before the first floor bounce is not a playable lane.
  if(trace.impacts.some(i=>i.t<bounce.t&&i.kind!=='floor'))return null;
  const dx=bounce.p[0]-source[0],dz=bounce.p[2]-source[2],distance=Math.hypot(dx,dz);
  if(distance<.1)return null;
  const side=Math.sign(setup.positions[setup.hitterIndex][1]);
  const defenders=setup.positions.filter((p,i)=>i!==setup.hitterIndex&&Math.sign(p[1])!==side);
  const samples=trace.samples.filter(s=>s.t<=bounce.t);
  // Uniform time samples plus the true floor event keep updates cheap while dragging.
  const stride=Math.max(1,Math.floor(samples.length/60));
  const points=samples.filter((_,i)=>i%stride===0||i===samples.length-1).map(s=>{
    const x=s.p[0]-source[0],z=s.p[2]-source[2];
    return {u:(x*dx+z*dz)/(distance*distance),bend:(-x*dz+z*dx)/distance,y:s.p[1],t:s.t};
  });
  return {source:[source[0],source[2]],side,defenders,points};
}

export function coverageAt(frame,x,z){
  if(!frame||z*frame.side>=0||Math.abs(x)>5||Math.abs(z)>10)return null;
  const dx=x-frame.source[0],dz=z-frame.source[1],length=Math.hypot(dx,dz);
  let margin=-10;
  for(const s of frame.points){
    if(s.y>REACH.height||s.y<0)continue;
    const px=frame.source[0]+dx*s.u-dz/length*s.bend;
    const pz=frame.source[1]+dz*s.u+dx/length*s.bend;
    if(pz*frame.side>=0)continue;
    // Less horizontal reach at full overhead extension or very low contact.
    const racket=REACH.racket-.35*clamp((s.y-1.6)/1.05,0,1)-.2*clamp((.45-s.y)/.45,0,1);
    const radius=racket+movementReach(s.t);
    for(const p of frame.defenders)margin=Math.max(margin,radius-Math.hypot(px-p[0],pz-p[1]));
  }
  // A soft boundary communicates uncertainty rather than a hidden exact target.
  const v=clamp((margin+.3)/.6,0,1);
  return v*v*(3-2*v);
}
