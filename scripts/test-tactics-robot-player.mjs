import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../public/tactics/vendor/three.module.js';
import {addRobotPlayer} from '../public/tactics/robotPlayer.js';
import {simulateShot} from '../public/tactics/ballFlight.js';

globalThis.ProgressEvent??=class {constructor(type,init){this.type=type;Object.assign(this,init);}};
const base=new URL('../public/tactics/models/quaternius/',import.meta.url);
const loadSource=async()=>{
 const source=JSON.parse(readFileSync(new URL('Superhero_Male_FullBody.gltf',base)));
 source.buffers[0].uri=`data:application/octet-stream;base64,${readFileSync(new URL('Superhero_Male_FullBody.bin',base)).toString('base64')}`;
 return source;
};
const scene=new T.Scene(),player=await addRobotPlayer(scene,{loadSource});
const {model,modelSpace}=player.getPoseAudit();
const centre=()=>model.racket.localToWorld(new T.Vector3(0,.07,0));
const gripOffsets=Object.fromEntries(['l','r'].map(side=>[side,model.racket.worldToLocal(model.bones[`hand_${side}`].getWorldPosition(new T.Vector3()))]));
const readyFingers=Object.fromEntries(Object.entries(model.bones).filter(([name])=>/^(index|middle|ring|pinky|thumb)_/.test(name)).map(([name,b])=>[name,b.quaternion.clone()]));
for(const kind of ['forehand','backhand','lob','smash']){
 for(const placement of [{position:[-2.5,7.3],landing:[1.6,-7]},{position:[2,-7],landing:[-1,7]}]){
  const shot=player.setShot(kind,placement);
  const actual=player.pose(0);
  assert(actual.distanceTo(new T.Vector3(...shot.origin))<1e-7,`${kind}: ball launch mismatch`);
  assert(actual.distanceTo(centre())<1e-7,`${kind}: racket mismatch`);
  const flight=simulateShot(kind,shot,{x:0,y:0});
  assert(flight.samples.length>0,`${kind}: missing trajectory`);
  for(let time=-.8;time<=1.16;time+=.065){
   const point=player.pose(time);
   assert(point.toArray().every(Number.isFinite));
   for(const side of ['l','r']){
    const wrist=model.bones[`hand_${side}`].getWorldPosition(new T.Vector3());
    assert(model.racket.worldToLocal(wrist).distanceTo(gripOffsets[side])<.001,`${kind}: detached ${side} hand at ${time}`);
   }
   for(const [name,q] of Object.entries(readyFingers))assert(model.bones[name].quaternion.clone().normalize().angleTo(q.clone().normalize())<1e-6,`${name}: finger grip changed`);
  }
  player.ready(...placement.position,0);
  const ready=modelSpace.worldToLocal(centre().clone());
  assert(ready.distanceTo(new T.Vector3(0,1.57,.333))<1e-6,'Ready pose not restored');
 }
}
const second=await addRobotPlayer(scene,{loadSource});
second.ready(2,-7,Math.PI);
const before=second.getPoseAudit().model.bones.hand_r.getWorldPosition(new T.Vector3());
player.setShot('backhand');player.pose(.2);
assert(second.getPoseAudit().model.bones.hand_r.getWorldPosition(new T.Vector3()).distanceTo(before)<1e-8,'Players share pose state');
console.log('PASS: four strokes, both court ends, real GLTF, racket contact, physics, preserved fingers, ready recovery and independent players.');
