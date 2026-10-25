import * as T from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { attachRobotArmour } from './robotArmour.js?v=smooth2';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// Artist-authored CC0 hands and bone weights; robot casing is a separate layer.
export async function loadImportedPlayer(scene,{loadSource}={}){
 const base=new URL('./models/quaternius/',import.meta.url);
 const source=loadSource?await loadSource():await (await fetch(new URL('Superhero_Male_FullBody.gltf',base))).json();
 source.images=[];source.textures=[];
 source.materials=[{name:'White mannequin',pbrMetallicRoughness:{baseColorFactor:[.82,.87,.93,1],metallicFactor:0,roughnessFactor:.65}}];
 for(const mesh of source.meshes)for(const primitive of mesh.primitives)primitive.material=0;
 const {scene:root}=await new GLTFLoader().parseAsync(JSON.stringify(source),base.href);
 scene.add(root);root.updateMatrixWorld(true);
 const bones={},rest={};
 root.traverse(o=>{
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(/Eyebrows|Eyes/.test(o.name))o.visible=false;}
  if(o.isBone){bones[o.name]=o;rest[o.name]={q:o.quaternion.clone(),p:o.position.clone(),worldQ:o.getWorldQuaternion(new T.Quaternion()),worldP:o.getWorldPosition(V())};}
 });
 const position=name=>bones[name].getWorldPosition(V());
 const rotateWorld=(bone,q)=>{bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);};
 const aim=(name,child,target)=>{
  const from=rest[child].worldP.clone().sub(rest[name].worldP).normalize();
  const to=target.clone().sub(position(name)).normalize();
  rotateWorld(bones[name],new T.Quaternion().setFromUnitVectors(from,to).multiply(rest[name].worldQ));
 };
 function limb(upper,lower,tip,target,pole){
  const a=position(upper),l1=rest[lower].worldP.distanceTo(rest[upper].worldP),l2=rest[tip].worldP.distanceTo(rest[lower].worldP);
  const dir=target.clone().sub(a),d=T.MathUtils.clamp(dir.length(),Math.abs(l1-l2)+.001,l1+l2-.005);dir.normalize();
  const bend=pole.clone().addScaledVector(dir,-pole.dot(dir)).normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d);
  const joint=a.clone().addScaledVector(dir,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  aim(upper,lower,joint);aim(lower,tip,a.clone().addScaledVector(dir,d));
 }
 const racket=new T.Group();scene.add(racket);
 const dark=new T.MeshStandardMaterial({color:'#122c3d',roughness:.7});
 const paddle=new T.Mesh(new T.CylinderGeometry(.14,.14,.026,48),dark);paddle.rotation.x=Math.PI/2;paddle.scale.z=1.2;paddle.position.y=.07;racket.add(paddle);
 const grip=new T.Mesh(new T.CylinderGeometry(.018,.021,.17,16),new T.MeshStandardMaterial({color:'#475a67'}));grip.position.y=-.27;racket.add(grip);
 const throat=new T.Mesh(new T.CylinderGeometry(.028,.018,.12,16),dark);throat.position.y=-.13;racket.add(throat);
 for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)if(x*x+y*y<7){const dot=new T.Mesh(new T.CircleGeometry(.008,10),new T.MeshBasicMaterial({color:'#080f17',side:T.DoubleSide}));dot.position.set(x*.042,.07+y*.047,.014);racket.add(dot);}
 racket.traverse(o=>{if(o.isMesh)o.castShadow=true;});
 function ready(){
  for(const [name,b] of Object.entries(bones)){b.position.copy(rest[name].p);b.quaternion.copy(rest[name].q);}
  root.updateMatrixWorld(true);
  const hips=rest.pelvis.worldP.clone().add(V(0,-.11,-.035));
  bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(hips));
  bones.spine_01.quaternion.multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),.14));
  root.updateMatrixWorld(true);
  for(const [side,sign] of [['l',1],['r',-1]]){
   limb(`thigh_${side}`,`calf_${side}`,`foot_${side}`,V(sign*.29,.086,-.045),V(0,0,1));
   rotateWorld(bones[`foot_${side}`],new T.Quaternion().setFromAxisAngle(V(0,1,0),sign*.08).multiply(rest[`foot_${side}`].worldQ));
   // Approach the shaft from each elbow, rather than forcing both wrists square
   // to the racket. Rotate the complete grip so finger contact is preserved.
   const gripTurn=new T.Quaternion().setFromAxisAngle(V(0,1,0),side==='r'?.55:-.7);
   const aroundShaft=p=>p.sub(V(0,0,.333)).applyQuaternion(gripTurn).add(V(0,0,.333));
   const wrist=aroundShaft(V(sign*.038,side==='r'?1.20:1.31,.204));
   limb(`upperarm_${side}`,`lowerarm_${side}`,`hand_${side}`,wrist,V(sign*.5,side==='r'?-.65:-.3,0));
   // Fingers run forward; thumbs point up and the palms oppose across the shaft.
   // The rig's finger flexion axis is local X, not Z (which splays them sideways).
   const handQ=gripTurn.clone().multiply(new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(V(-1,0,0),V(0,0,1),V(0,1,0))));
   // The elbow solver controls direction, not forearm roll. Carry the palm's
   // orientation through the forearm instead of putting all pronation at the wrist.
   const forearmY=position(`hand_${side}`).sub(position(`lowerarm_${side}`)).normalize();
   const forearmZ=V(0,0,1).applyQuaternion(handQ);
   forearmZ.addScaledVector(forearmY,-forearmZ.dot(forearmY)).normalize();
   const forearmX=new T.Vector3().crossVectors(forearmY,forearmZ).normalize();
   rotateWorld(bones[`lowerarm_${side}`],new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(forearmX,forearmY,forearmZ)));
   rotateWorld(bones[`hand_${side}`],handQ);
   for(const finger of ['index','middle','ring','pinky'])for(const part of ['01','02','03']){
    const curl=part==='01'?.35:part==='02'?1.4:1.05;
    // Both authored finger rigs flex with positive local X. Their rest rotations
    // already mirror the hands; multiplying by side sign hyperextends the right.
    bones[`${finger}_${part}_${side}`].quaternion.multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),curl));
   }
   root.updateMatrixWorld(true);
   // Oppose the thumb over the index finger, preserving each joint's authored roll.
   const thumbTargets=[V(-sign*.020,wrist.y+.052,.270),V(-sign*.026,wrist.y+.046,.305),V(-sign*.015,wrist.y+.035,.336)].map(aroundShaft);
   for(let i=0;i<3;i++){
    const bone=bones[`thumb_0${i+1}_${side}`],q=bone.getWorldQuaternion(new T.Quaternion());
    const from=V(0,1,0).applyQuaternion(q),to=thumbTargets[i].clone().sub(bone.getWorldPosition(V())).normalize();
    rotateWorld(bone,new T.Quaternion().setFromUnitVectors(from,to).multiply(q));
   }
  }
  racket.position.set(0,1.50,.333);root.updateMatrixWorld(true);
 }
 const armour=attachRobotArmour(root,bones);
 ready();
 const headOffset=V(0,.07,0),neutralCentre=racket.position.clone().add(headOffset);
 const gripPose=Object.fromEntries(['l','r'].map(side=>[side,{
  offset:position(`hand_${side}`).sub(neutralCentre),
  q:bones[`hand_${side}`].getWorldQuaternion(new T.Quaternion()),
 }]));
 const reach=side=>rest[`upperarm_${side}`].worldP.distanceTo(rest[`lowerarm_${side}`].worldP)
  +rest[`lowerarm_${side}`].worldP.distanceTo(rest[`hand_${side}`].worldP)-.012;
 function setRacketPose(requested,rotation){
  ready();
  const centre=requested.clone();
  // Move the complete approved grip, not individual fingers. Keep both wrists
  // within their actual arm reach so the racket never detaches from the hands.
  for(let i=0;i<16;i++)for(const side of ['r','l']){
   const shoulder=position(`upperarm_${side}`);
   const offset=gripPose[side].offset.clone().applyQuaternion(rotation);
   const delta=centre.clone().add(offset).sub(shoulder),limit=reach(side);
   if(delta.length()>limit)centre.addScaledVector(delta,limit/delta.length()-1);
  }
  for(const [side,sign] of [['l',1],['r',-1]]){
   const wrist=centre.clone().add(gripPose[side].offset.clone().applyQuaternion(rotation));
   limb(`upperarm_${side}`,`lowerarm_${side}`,`hand_${side}`,wrist,V(sign*.5,-.65,0));
   const handQ=rotation.clone().multiply(gripPose[side].q);
   const y=position(`hand_${side}`).sub(position(`lowerarm_${side}`)).normalize();
   const z=V(0,0,1).applyQuaternion(handQ);z.addScaledVector(y,-z.dot(y)).normalize();
   const x=new T.Vector3().crossVectors(y,z).normalize();
   rotateWorld(bones[`lowerarm_${side}`],new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)));
   rotateWorld(bones[`hand_${side}`],handQ);
  }
  racket.quaternion.copy(rotation);
  racket.position.copy(centre).sub(headOffset.clone().applyQuaternion(rotation));
  root.updateMatrixWorld(true);racket.updateMatrixWorld(true);
  return centre;
 }
 return {root,ready,bones,racket,armour,setRacketPose};
}
