import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../public/tactics/vendor/three.module.js';
import { attachRobotArmour } from '../public/tactics/robotArmour.js';

const source=JSON.parse(readFileSync(new URL('../public/tactics/models/quaternius/Superhero_Male_FullBody.gltf',import.meta.url)));
const joints=new Set(source.skins.flatMap(s=>s.joints));
const nodes=source.nodes.map((n,i)=>{
 const o=joints.has(i)?new T.Bone():new T.Object3D();o.name=n.name;
 if(n.translation)o.position.fromArray(n.translation);
 if(n.rotation)o.quaternion.fromArray(n.rotation);
 if(n.scale)o.scale.fromArray(n.scale);
 return o;
});
source.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>nodes[i].add(nodes[j])));
const root=new T.Group();nodes.filter(n=>!n.parent).forEach(n=>root.add(n));root.updateMatrixWorld(true);
const bones=Object.fromEntries(nodes.filter(n=>n.isBone).map(n=>[n.name,n]));
// Exercise the cosmetic body mask without allowing any vertex/weight edits.
const original=new T.BufferGeometry();
original.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,1,1,0,1,0,1,1],3));
original.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
original.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:6},()=>[1,0,0,0]).flat(),4));
original.setIndex([0,1,2,3,4,5]);
const testMesh=new T.SkinnedMesh(original,new T.MeshStandardMaterial());
testMesh.bind(new T.Skeleton([bones.pelvis,bones.hand_r]));root.add(testMesh);root.updateMatrixWorld(true);
const before=nodes.map(n=>({position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone(),world:n.matrixWorld.clone()}));
const {pieces}=attachRobotArmour(root,bones);
assert(pieces.length>=30,'Expected articulated shells, not just a material swap');
assert.notEqual(testMesh.geometry,original,'Source geometry must not be modified');
assert.deepEqual([...original.index.array],[0,1,2,3,4,5]);
assert.deepEqual([...testMesh.geometry.index.array],[3,4,5],'Only authored hand triangles should render');
for(const attribute of ['position','skinIndex','skinWeight']){
 assert.deepEqual([...testMesh.geometry.attributes[attribute].array],[...original.attributes[attribute].array],`${attribute} must stay unchanged`);
}
nodes.forEach((n,i)=>{
 assert(n.position.equals(before[i].position),`${n.name}: joint translated`);
 assert(n.quaternion.equals(before[i].quaternion),`${n.name}: joint rotated`);
 assert(n.scale.equals(before[i].scale),`${n.name}: joint scaled`);
 assert(n.matrixWorld.equals(before[i].world),`${n.name}: bind transform changed`);
});
for(const piece of pieces){
 assert(piece.parent?.isBone,'Every armour piece must move with its joint');
 piece.traverse(o=>{if(o.isMesh){
  assert([...o.geometry.attributes.position.array].every(Number.isFinite),'Invalid armour geometry');
  assert(o.castShadow&&o.receiveShadow,'Missing armour shadows');
 }});
}
const finger=pieces.find(p=>p.parent===bones.index_02_r);
const fingerBefore=finger.getWorldPosition(new T.Vector3());
bones.index_02_r.rotateX(.2);root.updateMatrixWorld(true);
assert(finger.getWorldPosition(new T.Vector3()).distanceTo(fingerBefore)>.0001,'Finger plate must follow finger curl');
console.log(`PASS: ${pieces.length} bone-mounted armour pieces; original skeleton unchanged; fingers articulated.`);
