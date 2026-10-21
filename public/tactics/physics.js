// SI units throughout. See PHYSICS.md for sources, assumptions and calibration.
export const BALL = Object.freeze({ mass: .0577, radius: .0328, inertiaFactor: 2/3 });
export const AIR = Object.freeze({ density: 1.18, dragCoefficient: .507, liftSlope: .6, maxLift: .35, spinDecay: .12, wind: [0,0,0] });
export const SURFACES = Object.freeze({
  hard: { restitution: .77, friction: .45 },
  // Provisional sand-filled turf grip. The previous .55 scrubbed ~36% of
  // horizontal speed from the user's shallow shot; .35 permits more sliding.
  // This is preview calibration from feedback, not a measured court value.
  // Use the calibrated firm-surface bounce as the provisional court baseline.
  // The former .72 added unmeasured vertical damping; turf grip stays separate.
  turf: { restitution: .77, friction: .35 },
  glass: { restitution: .75, friction: .15 },
  mesh: { restitution: .40, friction: .50 },
  net: { restitution: .08, friction: .65 },
});
export const STEP = 1/240;
export const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const plus=(a,b,k)=>a.map((n,i)=>n+k*b[i]);
export function acceleration(v,w,{ball=BALL,air=AIR,gravity=9.81}={}){
  const relative=v.map((n,i)=>n-air.wind[i]),speed=Math.hypot(...relative);
  const forceScale=.5*air.density*Math.PI*ball.radius**2/ball.mass;
  const liftDirection=cross(w,relative),liftLength=Math.hypot(...liftDirection);
  // Only spin perpendicular to travel creates Magnus lift. Bounded linear
  // spin-ratio approximation; not a fitted padel-ball wind-tunnel curve.
  const spinRatio=ball.radius*liftLength/Math.max(speed*speed,1e-12);
  const cl=Math.min(air.maxLift,air.liftSlope*spinRatio);
  return relative.map((n,i)=>-forceScale*air.dragCoefficient*speed*n
    +(liftLength>1e-12?forceScale*speed*speed*cl*liftDirection[i]/liftLength:0)
    -(i===1?gravity:0));
}
// RK4 integrates forces rather than drawing a spline between keyframes.
export function advance(state,dt,options={}){
  const {p,v,w}=state,air=options.air??AIR;
  const wh=w.map(n=>n*Math.exp(-air.spinDecay*dt/2)),wn=w.map(n=>n*Math.exp(-air.spinDecay*dt));
  const a=acceleration(v,w,options),v2=plus(v,a,dt/2),b=acceleration(v2,wh,options);
  const v3=plus(v,b,dt/2),c=acceleration(v3,wh,options),v4=plus(v,c,dt),d=acceleration(v4,wn,options);
  return {p:p.map((n,i)=>n+dt/6*(v[i]+2*v2[i]+2*v3[i]+v4[i])),
    v:v.map((n,i)=>n+dt/6*(a[i]+2*b[i]+2*c[i]+d[i])),w:wn};
}
export function reboundBall(velocity,angular,normal,surface,ball=BALL){
  const incoming=dot(velocity,normal);
  if(incoming>=0)return {velocity:[...velocity],angular:[...angular]};
  const rim=cross(angular,normal);
  const slip=velocity.map((n,i)=>n-incoming*normal[i]-ball.radius*rim[i]);
  const slipSpeed=Math.hypot(...slip),inertia=ball.inertiaFactor;
  const scale=Math.min(inertia/(1+inertia),surface.friction*(1+surface.restitution)*-incoming/(slipSpeed||1));
  const impulse=slip.map(n=>-n*scale),torque=cross(normal,impulse);
  return {velocity:velocity.map((n,i)=>n-(1+surface.restitution)*incoming*normal[i]+impulse[i]),
    angular:angular.map((n,i)=>n-torque[i]/(inertia*ball.radius))};
}
export function energy({v,w},ball=BALL){return .5*ball.mass*(dot(v,v)+ball.inertiaFactor*ball.radius**2*dot(w,w));}
export const netTop=x=>.88+.04*x*x/25;
// Same stepped enclosure as court.js, not infinite glass planes.
export function wallMaterial(axis,p,r=BALL.radius){
  if(axis===2)return p[1]-r<3?'glass':p[1]-r<4?'mesh':null;
  const z=Math.abs(p[2]);
  if(z>=8)return p[1]-r<3?'glass':p[1]-r<4?'mesh':null;
  if(z>=6)return p[1]-r<3?'glass':null;
  if(z>=2)return p[1]-r<3?'mesh':null;
  return p[1]+r>=2.3&&p[1]-r<3?'mesh':null;
}
// Accurate time of contact within a step avoids penetration-dependent bounces.
function contactTime(state,dt,axis,coordinate,options){
  let lo=0,hi=dt;const sign=Math.sign(state.p[axis]-coordinate);
  for(let i=0;i<25;i++){const mid=(lo+hi)/2;
    if((advance(state,mid,options).p[axis]-coordinate)*sign>0)lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
}
export function simulateFree(origin,velocity,angular,duration,options={}){
  let state={p:[...origin],v:[...velocity],w:[...angular]},netHeight=null;
  const step=options.step??STEP;
  for(let t=0;t<duration-1e-12;){
    const dt=Math.min(step,duration-t),next=advance(state,dt,options);
    if(netHeight===null&&state.p[2]*next.p[2]<=0){
      const time=contactTime(state,dt,2,0,options);netHeight=advance(state,time,options).p[1];
    }
    state=next;t+=dt;
  }
  return {...state,netHeight};
}
export function simulateFlight(origin,velocity,angular,options={}){
  const ball=options.ball??BALL,r=ball.radius,step=options.step??STEP,duration=options.duration??10;
  let state={p:[...origin],v:[...velocity],w:[...angular]},t=0,bounces=0,escaped=false;
  const sample=()=>({t,p:[...state.p],v:[...state.v],omega:[...state.w]});
  const samples=[sample()],impacts=[];
  let exit=null;
  while(t<duration-1e-10&&bounces<(options.maxBounces??2)){
    let remaining=Math.min(step,duration-t);
    for(let contacts=0;remaining>1e-10&&contacts<8;contacts++){
      const end=advance(state,remaining,options),candidates=[];
      const add=(axis,coordinate,normal,kind)=>{
        const time=contactTime(state,remaining,axis,coordinate,options),at=advance(state,time,options);
        let material=kind;
        if(kind==='wall')material=wallMaterial(axis,at.p,r);
        if(kind==='net'&&(Math.abs(at.p[0])>5+r||at.p[1]-r>netTop(at.p[0])))return;
        candidates.push({time,at,normal,kind,material});
      };
      if(state.p[1]>=r-1e-9&&end.p[1]<r&&end.v[1]<0)add(1,r,[0,1,0],'turf');
      if(!escaped){
        for(const axis of [0,2])for(const sign of [-1,1]){
          const limit=sign*((axis===0?5:10)-r);
          if(sign*state.p[axis]<=sign*limit+1e-10&&sign*end.p[axis]>sign*limit){
            const normal=[0,0,0];normal[axis]=-sign;add(axis,limit,normal,'wall');
          }
        }
      }
      for(const sign of [-1,1])if(sign*state.p[2]>r&&sign*end.p[2]<=r)add(2,sign*r,[0,0,sign],'net');
      candidates.sort((a,b)=>a.time-b.time);
      const hit=candidates[0];
      if(!hit){state=end;t+=remaining;remaining=0;break;}
      state=hit.at;t+=hit.time;remaining-=hit.time;
      if(!hit.material){escaped=true;exit={t,p:[...state.p]};samples.push(sample());continue;}
      const incoming={v:[...state.v],w:[...state.w]};
      const materials=options.surfaces??SURFACES;
      const material=hit.material==='turf'?(options.floor??materials.turf):materials[hit.material];
      const result=reboundBall(state.v,state.w,hit.normal,material,ball);
      state.v=result.velocity;state.w=result.angular;
      impacts.push({t,p:[...state.p],kind:hit.material==='turf'?'floor':hit.material,
        incomingVelocity:incoming.v,outgoingVelocity:[...state.v],incomingSpin:incoming.w,outgoingSpin:[...state.w],
        energyBefore:energy(incoming,ball),energyAfter:energy(state,ball)});
      if(hit.material==='turf')bounces++;
      samples.push(sample());
      // Numerical separation, not a position correction to the target.
      state.p=plus(state.p,hit.normal,1e-9);
      if(bounces>=(options.maxBounces??2))break;
    }
    samples.push(sample());
  }
  return {samples,impacts,duration:t,exit};
}
