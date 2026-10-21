import * as T from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), UP=V(0,1,0);
const smooth=(x,a,b)=>T.MathUtils.smoothstep(x,a,b);
// One connected implicit surface in the bind pose, weighted to a real skeleton.
// Geometry is built once and shared; each player owns bones and shirt colours.
let template;
const bind={hips:V(0,.93,0),spine:V(0,1.15,0),chest:V(0,1.42,0)};
const armDirection=side=>V(side*.86,-.51,0).normalize();
const names=['hips','spine','chest','leftUpper','leftLower','leftHand','rightUpper','rightLower','rightHand','leftThigh','leftShin','leftFoot','rightThigh','rightShin','rightFoot'];
const limbs=[];
for(const side of [-1,1]){
 const prefix=side<0?'left':'right',d=armDirection(side),a=V(side*.22,1.42,0),b=a.clone().addScaledVector(d,.36),c=b.clone().addScaledVector(d,.35);
 limbs.push({type:'arm',prefix,a,b,c,upper:names.indexOf(prefix+'Upper'),lower:names.indexOf(prefix+'Lower'),end:names.indexOf(prefix+'Hand')});
 const h=V(side*.115,.895,0),k=h.clone().add(V(0,-.46,0)),f=k.clone().add(V(0,-.44,0));
 limbs.push({type:'leg',prefix,a:h,b:k,c:f,upper:names.indexOf(prefix+'Thigh'),lower:names.indexOf(prefix+'Shin'),end:names.indexOf(prefix+'Foot')});
}
function ellipsoid(p,c,r){const x=(p.x-c.x)/r.x,y=(p.y-c.y)/r.y,z=(p.z-c.z)/r.z;return (Math.hypot(x,y,z)-1)*Math.min(r.x,r.y,r.z);}
function capsule(p,a,b,r1,r2){const d=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(d,t))-T.MathUtils.lerp(r1,r2,t);}
const blend=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
function field(p){
 let d=blend(ellipsoid(p,V(0,1.16,0),V(.185,.30,.13)),ellipsoid(p,V(0,1.37,0),V(.245,.145,.145)),.065);
 d=blend(d,ellipsoid(p,V(0,.90,0),V(.205,.16,.145)),.05);
 for(const l of limbs){
  const arm=l.type==='arm';
  d=blend(d,capsule(p,l.a,l.b,arm?.085:.108,arm?.061:.073),arm?.07:.035);
  d=blend(d,capsule(p,l.b,l.c,arm?.061:.073,arm?.037:.045),.03);
 }
 return d;
}
function influences(p){
 const nearest=limbs.map(l=>{
  const ab=l.b.clone().sub(l.a),ac=l.c.clone().sub(l.a),length=ac.length(),along=T.MathUtils.clamp(p.clone().sub(l.a).dot(ac)/length,0,length);
  const axis=ac.normalize(),distance=p.distanceTo(l.a.clone().addScaledVector(axis,along));
  return {...l,along,length,distance,first:ab.length()};
 }).sort((a,b)=>a.distance-b.distance)[0];
 const l=nearest, torsoRadius=l.type==='arm'?.14:.06;
 const limbWeight=l.type==='arm'?smooth(Math.abs(p.x),.12,.27):1-smooth(p.y,.82,.96);
 const rootWeights=()=>{
  const chest=smooth(p.y,1.20,1.40),spine=smooth(p.y,.99,1.17)*(1-chest);
  return [[0,1-chest-spine],[1,spine],[2,chest]];
 };
 let entries=rootWeights();
 const shirtPart=smooth(p.y,.975,1.005);
 let region=[shirtPart,0,1-shirtPart];
 if(l.distance<torsoRadius+.09 && limbWeight>0){
  const lower=smooth(l.along,l.first-.08,l.first+.08),hand=smooth(l.along,l.length-.05,l.length+.01);
  entries=entries.map(([id,w])=>[id,w*(1-limbWeight)]);
  entries.push([l.upper,limbWeight*(1-lower)],[l.lower,limbWeight*lower*(1-hand)],[l.end,limbWeight*lower*hand]);
  if(l.type==='arm'){const skinPart=smooth(l.along,.155,.185);region=[1-skinPart,skinPart,0];}
  else {const skinPart=smooth(l.along,.225,.255);region=[0,skinPart,1-skinPart];}
 }
 entries=entries.filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4);
 const total=entries.reduce((s,[,w])=>s+w,0);while(entries.length<4)entries.push([0,0]);
 return {indices:entries.map(([i])=>i),weights:entries.map(([,w])=>w/total),region};
}
function makeTemplate(){
 const positions=[],normals=[],skinIndex=[],skinWeight=[],regions=[];
 const step=.028,lo=V(-.96,-.075,-.23),nx=69,ny=60,nz=17;
 const corner=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],values=new Float32Array((nx+1)*(ny+1)*(nz+1));
 const idx=(x,y,z)=>(x*(ny+1)+y)*(nz+1)+z;
 for(let x=0;x<=nx;x++)for(let y=0;y<=ny;y++)for(let z=0;z<=nz;z++)values[idx(x,y,z)]=field(V(lo.x+x*step,lo.y+y*step,lo.z+z*step));
 const normal=p=>{const e=.001;return V(field(p.clone().add(V(e,0,0)))-field(p.clone().add(V(-e,0,0))),field(p.clone().add(V(0,e,0)))-field(p.clone().add(V(0,-e,0))),field(p.clone().add(V(0,0,e)))-field(p.clone().add(V(0,0,-e)))).normalize();};
 const vertex=p=>{const n=normal(p),w=influences(p);positions.push(...p.toArray());normals.push(...n.toArray());skinIndex.push(...w.indices);skinWeight.push(...w.weights);regions.push(w.region);};
 const triangle=(a,b,c)=>{const n=b.clone().sub(a).cross(c.clone().sub(a));if(n.dot(normal(a))<0)[b,c]=[c,b];vertex(a);vertex(b);vertex(c);};
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++)for(let z=0;z<nz;z++){
  const v=corner.map(([dx,dy,dz])=>values[idx(x+dx,y+dy,z+dz)]);if(v.every(n=>n>0)||v.every(n=>n<=0))continue;
  const p=corner.map(([dx,dy,dz])=>V(lo.x+(x+dx)*step,lo.y+(y+dy)*step,lo.z+(z+dz)*step));
  for(const t of tetra){
   const cuts=[];for(const [ea,eb] of edges){const a=t[ea],b=t[eb];if((v[a]>0)===(v[b]>0))continue;cuts.push(p[a].clone().lerp(p[b],v[a]/(v[a]-v[b])));}
   if(cuts.length===3)triangle(...cuts);
   if(cuts.length===4){const centre=cuts.reduce((a,p)=>a.add(p),V()).multiplyScalar(.25),n=normal(centre),u=cuts[0].clone().sub(centre).normalize(),v=n.clone().cross(u);cuts.sort((a,b)=>Math.atan2(a.clone().sub(centre).dot(v),a.clone().sub(centre).dot(u))-Math.atan2(b.clone().sub(centre).dot(v),b.clone().sub(centre).dot(u)));triangle(cuts[0],cuts[1],cuts[2]);triangle(cuts[0],cuts[2],cuts[3]);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));
 return {geometry,regions};
}
export function createPlayerSkin(body,{shirtColor,skin,shirt,shorts,shoe,sole,hair}){
 if(!template)template=makeTemplate();
 const bones=Object.fromEntries(names.map(n=>{const b=new T.Bone();b.name=n;return [n,b];}));
 const attach=(name,parent,position)=>{bones[parent].add(bones[name]);bones[name].position.copy(position);};
 body.add(bones.hips);bones.hips.position.copy(bind.hips);
 attach('spine','hips',V(0,.22,0));attach('chest','spine',V(0,.27,0));
 for(const l of limbs){const arm=l.type==='arm',upper=names[l.upper],lower=names[l.lower],end=names[l.end];
  attach(upper,arm?'chest':'hips',l.a.clone().sub(arm?bind.chest:bind.hips));
  bones[upper].quaternion.setFromUnitVectors(UP,l.b.clone().sub(l.a).normalize());
  attach(lower,upper,V(0,l.a.distanceTo(l.b),0));attach(end,lower,V(0,l.b.distanceTo(l.c),0));
 }
 body.updateMatrixWorld(true);
 const geometry=template.geometry.clone(),palette=[new T.Color(shirtColor),skin.color,shorts.color],colours=[];
 template.regions.forEach(weights=>{const c=new T.Color(0,0,0);weights.forEach((w,i)=>c.add(palette[i].clone().multiplyScalar(w)));colours.push(...c.toArray());});geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));
 const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.88}));mesh.name='connected-player-skin';body.add(mesh);
 mesh.bind(new T.Skeleton(names.map(n=>bones[n])));mesh.frustumCulled=false;
 mesh.boundingSphere=new T.Sphere(V(0,1.3,0),1.85); // All four clips, including the overhead reach.
 function ellipsoid(parent,r,material,position,scale){const m=new T.Mesh(new T.SphereGeometry(r,24,16),material);m.position.copy(position);m.scale.set(...scale);parent.add(m);return m;}
 // Clean garment edges sit on their owning bones, covering the small colour
 // transition band in the deforming skin without separate shoulder caps.
 const band=new T.Mesh(new T.CylinderGeometry(.19,.195,.045,40),shorts);
 band.position.y=.065;band.scale.z=.73;bones.hips.add(band);
 for(const prefix of ['left','right']){
  const cuff=new T.Mesh(new T.CylinderGeometry(.085,.092,.035,32),shorts);
  cuff.position.y=.24;bones[prefix+'Thigh'].add(cuff);
  const sleeve=new T.Mesh(new T.CylinderGeometry(.069,.073,.022,32),shirt);
  sleeve.position.y=.17;bones[prefix+'Upper'].add(sleeve);
 }
 ellipsoid(bones.chest,.064,skin,V(0,.085,0),[1,1.65,1]);
 const head=new T.Group();bones.chest.add(head);head.position.set(0,.15,0);
 ellipsoid(head,.122,skin,V(0,.095,-.012),[.91,1.22,.96]);ellipsoid(head,.12,hair,V(0,.168,.007),[.98,.68,1]);ellipsoid(head,.024,skin,V(0,.099,-.127),[.78,.85,1]);
 for(const side of [-1,1]){ellipsoid(head,.024,skin,V(side*.11,.095,-.002),[.55,1,.75]);const prefix=side<0?'left':'right';
  ellipsoid(bones[prefix+'Hand'],.046,skin,V(0,.018,0),[.8,1.35,.85]);
  ellipsoid(bones[prefix+'Foot'],.10,shoe,V(0,-.04,-.055),[.85,.66,1.65]);ellipsoid(bones[prefix+'Foot'],.10,sole,V(0,-.085,-.055),[.88,.23,1.68]);
 }
 const localPosition=b=>body.worldToLocal(b.getWorldPosition(V()));
 const localQuaternion=b=>body.getWorldQuaternion(new T.Quaternion()).invert().multiply(b.getWorldQuaternion(new T.Quaternion()));
 function worldRotation(b,q){b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(body.getWorldQuaternion(new T.Quaternion()).multiply(q)));b.updateWorldMatrix(false,true);}
 function setLimb(prefix,type,a,joint,end,endRotation){
  const upper=bones[prefix+(type==='arm'?'Upper':'Thigh')],lower=bones[prefix+(type==='arm'?'Lower':'Shin')],tip=bones[prefix+(type==='arm'?'Hand':'Foot')];
  // Orient both segments in their shared hinge plane, then inherit through the
  // hierarchy. Child offsets never change, so joints cannot pull apart.
  const normal=joint.clone().sub(a).cross(end.clone().sub(joint)).normalize();
  const orientation=(from,to)=>{const y=to.clone().sub(from).normalize(),z=normal.clone(),x=y.clone().cross(z).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));};
  worldRotation(upper,orientation(a,joint));worldRotation(lower,orientation(joint,end));worldRotation(tip,endRotation??new T.Quaternion());
 }
 return {head,mesh,bones,
  setTorso({hip,shift,forward=0,lift,pelvisTurn,turn,lean}){body.position.y=lift;bones.hips.position.set(shift,hip,forward);bones.hips.rotation.set(0,pelvisTurn,0);bones.spine.rotation.set(lean*.5,(turn-pelvisTurn)*.5,0,'YXZ');bones.chest.rotation.set(lean*.5,(turn-pelvisTurn)*.5,0,'YXZ');body.updateWorldMatrix(true,true);},
  shoulder:side=>localPosition(bones[side<0?'leftUpper':'rightUpper']),
  hip:side=>localPosition(bones[side<0?'leftThigh':'rightThigh']),
  chestQuaternion:()=>localQuaternion(bones.chest),
  setArm:(side,a,j,e,q)=>setLimb(side<0?'left':'right','arm',a,j,e,q),
  setLeg:(side,a,j,e,q)=>setLimb(side<0?'left':'right','leg',a,j,e,q),
  update:()=>{body.updateMatrixWorld(true);mesh.skeleton.update();},
 };
}
