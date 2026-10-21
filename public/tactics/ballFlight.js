import {simulateAudited} from './shotAudit.js';
import {BALL,AIR,STEP,simulateFree,simulateFlight} from './physics.js';
export {reboundBall} from './physics.js';
export const SHOTS = {
  backhand: {origin:[-2.6,1,7],landing:[1.6,-7],flight:.70},
  forehand: {origin:[-2.6,1,7],landing:[1.6,-7],flight:.70},
  lob: {origin:[-2.6,1,7],landing:[1.6,-8],flight:2.35},
  smash: {origin:[-2.6,2.7,2.5],landing:[1.2,-4.8],flight:.48},
};
export function normalizeSpin(contact={x:0,y:0}){
  const x=Number.isFinite(contact.x)?contact.x:0,y=Number.isFinite(contact.y)?contact.y:0;
  const scale=Math.max(1,Math.hypot(x,y));return {x:x/scale,y:y/scale};
}
function linearSolve(matrix){
  const n=matrix.length;
  for(let c=0;c<n;c++){
    let pivot=c;for(let r=c+1;r<n;r++)if(Math.abs(matrix[r][c])>Math.abs(matrix[pivot][c]))pivot=r;
    [matrix[c],matrix[pivot]]=[matrix[pivot],matrix[c]];
    const divisor=matrix[c][c];if(Math.abs(divisor)<1e-12)throw new Error('Shot solver singular');
    for(let j=c;j<=n;j++)matrix[c][j]/=divisor;
    for(let r=0;r<n;r++)if(r!==c){const k=matrix[r][c];for(let j=c;j<=n;j++)matrix[r][j]-=k*matrix[c][j];}
  }
  return matrix.map(row=>row[n]);
}
// Nonlinear shooting method: launch velocity + flight time solve the three
// landing coordinates AND selected net height with the real force integrator.
function solveAttempt(origin,target,angular,height,options={},initial=null){
  const f=Math.abs(origin[2])/(Math.abs(origin[2])+Math.abs(target[2]));
  const duration=Math.sqrt(2*Math.max(.02,height-(origin[1]+(target[1]-origin[1])*f))/(9.81*f*(1-f)));
  let x=initial??[(target[0]-origin[0])/duration*1.2,(target[1]-origin[1])/duration+4.905*duration,(target[2]-origin[2])/duration*1.2,duration];
  function residual(candidate){
    const end=simulateFree(origin,candidate.slice(0,3),angular,candidate[3],options);
    return [...end.p.map((n,i)=>n-target[i]),(end.netHeight??-100)-height];
  }
  for(let iteration=0;iteration<18;iteration++){
    const error=residual(x),norm=Math.hypot(...error);
    if(norm<1e-8)return {velocity:x.slice(0,3),time:x[3],error:norm,iterations:iteration};
    const columns=x.map((value,i)=>{const h=i===3?.0001:.001,trial=[...x];trial[i]+=h;return residual(trial).map((n,j)=>(n-error[j])/h);});
    const delta=linearSolve(error.map((n,i)=>[...columns.map(col=>col[i]),-n]));
    let accepted=false;
    for(let scale=1;scale>=1/128;scale/=2){
      const trial=x.map((n,i)=>n+delta[i]*scale);
      if(trial[3]<.08||trial[3]>8||Math.hypot(...trial.slice(0,3))>150)continue;
      if(Math.hypot(...residual(trial))<norm){x=trial;accepted=true;break;}
    }
    if(!accepted)break;
  }
  throw new Error('Unable to solve a physically consistent shot for these settings');
}
export function solveLaunch(origin,target,angular,height,options={}){
  try{return solveAttempt(origin,target,angular,height,options);}
  catch(firstError){
    // Continuation gives difficult high arcs a nearby converged starting point;
    // never invent a curve or silently remove spin when a solve fails.
    let solved=solveAttempt(origin,target,[0,0,0],height,options);
    for(let fraction=.125;fraction<=1;fraction+=.125){
      solved=solveAttempt(origin,target,angular.map(n=>n*fraction),height,options,[...solved.velocity,solved.time]);
    }
    return solved;
  }
}
export function simulateShot(kind,placement,contact,height=null){
  const shot=placement??SHOTS[kind],preset=SHOTS[kind],origin=shot.origin,target=[shot.landing[0],BALL.radius,shot.landing[1]];
  const dx=target[0]-origin[0],dz=target[2]-origin[2],distance=Math.hypot(dx,dz);
  const spin=normalizeSpin(contact),right=[-dz/distance,0,dx/distance];
  const omega=[-right[0]*spin.y*240,spin.x*240,-right[2]*spin.y*240];
  const f=Math.abs(origin[2])/(Math.abs(origin[2])+Math.abs(target[2]));
  const lineHeight=origin[1]+(target[1]-origin[1])*f;
  const minimumHeight=Math.ceil(Math.max(1,lineHeight+.06)*10)/10;
  const nominalTime=preset.flight*Math.sqrt(distance/Math.hypot(preset.landing[0]-preset.origin[0],preset.landing[1]-preset.origin[2]));
  const desired=Number.isFinite(height)?height:lineHeight+4.905*nominalTime**2*f*(1-f);
  const netHeight=Math.max(minimumHeight,Math.min(8,desired));
  const launch=solveLaunch(origin,target,omega,netHeight);
  const flight=simulateAudited(origin,launch.velocity,omega,{landing:[...shot.landing],height:netHeight});
  if(flight.audit.numerical==='fail'){const error=new Error('Shot failed physical consistency checks');error.audit=flight;throw error;}
  return {...flight,netHeight,minimumHeight,launchVelocity:launch.velocity,flightTime:launch.time,solverError:launch.error,
    physics:{mass:BALL.mass,radius:BALL.radius,airDensity:AIR.density,dragCoefficient:AIR.dragCoefficient,step:STEP}};
}
