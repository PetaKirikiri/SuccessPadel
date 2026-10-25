import * as T from './vendor/three.module.js';
import {loadImportedPlayer} from './importedPlayer.js';
import {SHOTS} from './ballFlight.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0);
const clamp=T.MathUtils.clamp;
const restCentre=V(0,1.57,.333);

// Court-facing adapter: court players face -Z, the imported model faces +Z.
// Position, picking, camera and shot contracts remain the same for all players.
export async function addRobotPlayer(scene,options={}){
 const root=new T.Group();root.name='padel-robot';
 const modelSpace=new T.Group();root.add(modelSpace);
 const model=await loadImportedPlayer(modelSpace,options);
 modelSpace.rotation.y=Math.PI;scene.add(root);
 let kind='forehand',dirty=false;
 const inModelSpace=fn=>{
  const p=root.position.clone(),q=root.quaternion.clone();
  root.position.set(0,0,0);root.quaternion.identity();modelSpace.rotation.y=0;root.updateMatrixWorld(true);
  try{return fn();}
  finally{modelSpace.rotation.y=Math.PI;root.position.copy(p);root.quaternion.copy(q);root.updateMatrixWorld(true);}
 };
 function pose(time){
  if(time<=-.8||time>=1.15){
   if(dirty)inModelSpace(()=>{model.ready();model.racket.quaternion.identity();});
   dirty=false;return modelSpace.localToWorld(restCentre.clone());
  }
  const back=kind==='backhand',smash=kind==='smash',lob=kind==='lob';
  const contact=smash?V(-.22,2.18,.30):V(back?.43:-.52,lob?1.15:1.06,.46);
  const loaded=contact.clone().add(smash?V(-.05,-.20,-.23):V(back?.12:-.10,.06,-.26));
  const finish=contact.clone().add(smash?V(.36,-.70,.24):V(back?-.65:.75,lob?.55:.32,.10));
  const keys=[-.8,-.35,0,.35,1.15],points=[restCentre,loaded,contact,finish,restCentre];
  let index=0;while(time>keys[index+1])index++;
  const u=(time-keys[index])/(keys[index+1]-keys[index]);
  // Catmull interpolation passes exactly through the contact key at t=0.
  const curve=new T.CatmullRomCurve3(points);
  const centre=curve.getPoint((index+u)/4);
  const axis=centre.clone().sub(V(-.21,1.35,-.065)).normalize();
  const orientation=new T.Quaternion().setFromUnitVectors(UP,axis);
  const blend=Math.min(T.MathUtils.smoothstep(time,-.8,-.3),1-T.MathUtils.smoothstep(time,.35,1.15));
  orientation.slerp(new T.Quaternion(),1-blend);
  const actual=inModelSpace(()=>model.setRacketPose(centre,orientation));
  dirty=true;return modelSpace.localToWorld(actual);
 }
 function setShot(next,placement){
  kind=next;const shot={...SHOTS[kind],landing:[...SHOTS[kind].landing]};
  const [x,z]=placement?.position??[-2.5,7.3];
  shot.landing=placement?[...placement.landing]:shot.landing;
  root.position.set(x,0,z);
  root.rotation.y=Math.atan2(-(shot.landing[0]-x),-(shot.landing[1]-z));
  root.updateMatrixWorld(true);
  // Launch from the rendered racket, after reach constraints, not a stale
  // contact point from the old longer-armed procedural player.
  shot.origin=pose(0).toArray();pose(-.8);return shot;
 }
 function ready(x,z,facing){
  if(dirty)inModelSpace(()=>{model.ready();model.racket.quaternion.identity();});
  dirty=false;root.position.set(x,0,z);root.rotation.y=facing;root.updateMatrixWorld(true);
 }
 function faceBall(target,dt,{snap=false}={}){
  const dx=target.x-root.position.x,dz=target.z-root.position.z;
  if(Math.hypot(dx,dz)<.15)return;
  const desired=Math.atan2(-dx,-dz),difference=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));
  const step=snap?difference:clamp(difference*(1-Math.exp(-Math.max(0,dt)*9)),-dt*3,dt*3);
  ready(root.position.x,root.position.z,root.rotation.y+step);
 }
 setShot('forehand');
 return {setShot,pose,ready,faceBall,getObject:()=>root,
  getFrame:()=>({position:root.position.clone(),yaw:root.rotation.y}),
  getPoseAudit:()=>({model,modelSpace})};
}
