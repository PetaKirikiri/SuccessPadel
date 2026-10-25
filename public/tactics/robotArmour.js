import * as T from './vendor/three.module.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

// Smooth humanoid casing only. Preserve the imported skin, skeleton and grip.
export function attachRobotArmour(root,bones){
 const white=new T.MeshStandardMaterial({color:'#edf0f2',metalness:.08,roughness:.43});
 const dark=new T.MeshStandardMaterial({color:'#14191e',metalness:.25,roughness:.55});
 const visor=new T.MeshPhysicalMaterial({color:'#090f16',metalness:.35,roughness:.13,clearcoat:1,clearcoatRoughness:.08});
 const pieces=[];
 root.traverse(o=>{
  if(!o.isMesh)return;
  o.material=white;
  if(!o.isSkinnedMesh)return;
  // Keep the original authored hand vertices and weights. The humanoid body is
  // hidden by a render-only triangle mask so it cannot poke through the casing.
  // Clone the geometry; do not modify the source mesh or its skin attributes.
  const geometry=o.geometry,indices=geometry.index;
  const skin=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
  const handJoints=new Set(o.skeleton.bones.flatMap((b,i)=>/^(hand_|thumb_|index_|middle_|ring_|pinky_)/.test(b.name)?[i]:[]));
  const isHand=i=>{
   let weight=0;
   for(let j=0;j<4;j++)if(handJoints.has(skin.getComponent(i,j)))weight+=weights.getComponent(i,j);
   return weight>.45;
  };
  const kept=[];
  for(let i=0;i<(indices?.count??geometry.attributes.position.count);i+=3){
   const triangle=[0,1,2].map(j=>indices?indices.getX(i+j):i+j);
   if(triangle.some(isHand))kept.push(...triangle);
  }
  o.geometry=geometry.clone();o.geometry.setIndex(kept);o.geometry.clearGroups();
 });
 const mount=(name,object,position,rotation)=>{
  object.position.copy(position);if(rotation)object.quaternion.copy(rotation);
  object.name=`robot-${name}-${pieces.length}`;
  root.add(object);root.updateMatrixWorld(true);bones[name].attach(object);
  pieces.push(object);return object;
 };
 const oval=(w,h,d,mat=white)=>{
  const mesh=new T.Mesh(new T.SphereGeometry(1,40,28),mat);
  mesh.scale.set(w/2,h/2,d/2);return mesh;
 };
 const shell=(bone,w,h,d,p,mat=white)=>mount(bone,oval(w,h,d,mat),p);
 const pos=name=>bones[name].getWorldPosition(V());
 // Continuous curved surfaces, rather than faceted armour.
 const contour=(profile,depthRatio,mat)=>{
  const curve=new T.CatmullRomCurve3(profile.map(([r,y])=>V(r,y,0)));
  const points=curve.getPoints(72).map(p=>new T.Vector2(Math.max(0,p.x),p.y));
  const mesh=new T.Mesh(new T.LatheGeometry(points,48),mat);
  mesh.scale.z=depthRatio;return mesh;
 };
 const segment=(bone,child,width,depth,from,to)=>{
  const a=pos(bone),b=pos(child),dir=b.clone().sub(a).normalize();
  const front=V(0,0,1).addScaledVector(dir,-dir.z).normalize();
  const x=new T.Vector3().crossVectors(dir,front).normalize();
  const q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,dir,front));
  const length=a.distanceTo(b)*(to-from),r=width/2;
  // Long tapered shells reach the joints, with only a small rounded end lip.
  // Avoid pill-shaped limbs and separate ball-shaped joints.
  const profile=[[0,-length/2],[r*.76,-length/2],[r*.88,-length*.47],
   [r*.98,-length*.32],[r*.94,0],[r*.84,length*.34],
   [r*.76,length*.47],[r*.64,length/2],[0,length/2]];
  mount(bone,contour(profile,depth/width,white),a.lerp(b,(from+to)/2),q);
 };

 // Overlapping white torso sections keep a continuous silhouette in this pose.
 const chest=contour([[0,-.22],[.10,-.22],[.12,-.19],[.15,-.09],[.18,0],
  [.182,.07],[.165,.125],[.12,.15],[.055,.16],[0,.16]],.67,white);
 mount('spine_03',chest,V(0,1.354,-.035));
 shell('spine_02',.235,.28,.17,V(0,1.135,-.027),white);
 shell('pelvis',.275,.235,.195,V(0,.985,-.037),white);
 shell('neck_01',.083,.13,.085,V(0,1.548,-.035),white);
 shell('Head',.205,.267,.205,V(0,1.704,-.012),white);
 shell('Head',.183,.226,.118,V(0,1.706,.073),visor);

 for(const [side,sign] of [['l',1],['r',-1]]){
  shell(`upperarm_${side}`,.11,.125,.125,V(sign*.212,1.455,-.065),white);
  segment(`upperarm_${side}`,`lowerarm_${side}`,.112,.116,-.08,.98);
  shell(`lowerarm_${side}`,.079,.079,.083,pos(`lowerarm_${side}`),white);
  segment(`lowerarm_${side}`,`hand_${side}`,.105,.11,.015,.97);
  shell(`hand_${side}`,.076,.078,.077,pos(`hand_${side}`),white);
  shell(`thigh_${side}`,.135,.14,.14,pos(`thigh_${side}`),white);
  segment(`thigh_${side}`,`calf_${side}`,.157,.163,-.06,.985);
  shell(`calf_${side}`,.105,.10,.105,pos(`calf_${side}`),white);
  segment(`calf_${side}`,`foot_${side}`,.127,.137,.015,.98);
  shell(`foot_${side}`,.075,.10,.087,pos(`foot_${side}`),white);
  // Low rounded feet, with a dark outsole.
  mount(`foot_${side}`,oval(.127,.018,.245,dark),V(sign*.114,.024,.026));
  shell(`foot_${side}`,.127,.082,.247,V(sign*.114,.061,.022),white);

  // Cosmetic shells follow the existing finger bend. Contact surfaces stay free.
  const back=oval(.007,.072,.058,white);
  back.position.set(-sign*.018,.062,0);bones[`hand_${side}`].add(back);pieces.push(back);
  for(const finger of ['index','middle','ring','pinky'])for(const part of ['01','02','03']){
   const bone=bones[`${finger}_${part}_${side}`];
   const length=bone.children.find(o=>o.isBone)?.position.length()||.025;
   const cover=oval(.013,length*.64,.003,white);
   cover.position.set(0,length*.5,-.008);bone.add(cover);pieces.push(cover);
  }
 }
 for(const piece of pieces)piece.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 root.updateMatrixWorld(true);return {pieces};
}
