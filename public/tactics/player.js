import * as THREE from './vendor/three.module.js';
import { SHOTS } from './ballFlight.js';
import { createPlayerSkin } from './playerSkin.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0), clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;
const smooth=(t,a,b)=>THREE.MathUtils.smoothstep(t,a,b);
// Metre-scale skinned rig. A connected skeleton drives the surface; the
// constrained grip solve meets the ball at the existing contact point.
export function addHittingPlayer(scene,{shirtColor='#f6f3e8'}={}) {
  const root=new THREE.Group(),body=new THREE.Group();
  root.name='padel-player';root.add(body);scene.add(root);
  const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.85});
  const skin=mat('#bd8765'),shirt=mat(shirtColor),shorts=mat('#163649'),shoe=mat('#f7f5eb'),hair=mat('#292320'),sole=mat('#576775');
  function ellipsoid(parent,r,material,position,scale=[1,1,1]) {
    const m=new THREE.Mesh(new THREE.SphereGeometry(r,24,16),material);
    m.position.copy(position);m.scale.set(...scale);parent.add(m);return m;
  }
  const rig=createPlayerSkin(body,{shirtColor,skin,shirt,shorts,shoe,hair,sole}),head=rig.head;
  const racket=new THREE.Group();body.add(racket);
  const rim=mat('#153b47'),face=mat('#3faabc'),grip=mat('#eee9d9');
  const paddle=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.035,32),face);paddle.rotation.x=Math.PI/2;paddle.scale.z=1.2;racket.add(paddle);
  const edge=new THREE.Mesh(new THREE.TorusGeometry(.16,.014,8,40),rim);edge.scale.y=1.2;racket.add(edge);
  for(const x of [-.075,0,.075])for(const y of [-.09,-.03,.03,.09])for(const z of [-.021,.021])ellipsoid(racket,.012,rim,V(x,y,z),[1,1,.25]);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.025,.029,.20,16),grip);handle.position.y=-.28;racket.add(handle);
  // Stable two-bone solve. No stretched forearms and no snapping elbow pole.
  const diagnostics={arms:[],legs:[]};
  function solve(start,end,l1,l2,pole,{min=4,max=138}={}) {
    const direction=end.clone().sub(start),raw=direction.length();
    const reach=degrees=>Math.sqrt(l1*l1+l2*l2+2*l1*l2*Math.cos(degrees*Math.PI/180));
    const d=clamp(raw,reach(max),reach(min));direction.normalize();
    const bend=pole.clone().addScaledVector(direction,-pole.dot(direction));
    if(bend.lengthSq()<.0001){const fallback=Math.abs(direction.x)<.8?V(1,0,0):V(0,0,1);bend.copy(fallback).addScaledVector(direction,-fallback.dot(direction));}
    bend.normalize();const along=(l1*l1-l2*l2+d*d)/(2*d);
    const joint=start.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    return {joint,end:start.clone().addScaledVector(direction,d),raw,flexion:Math.acos(clamp((d*d-l1*l1-l2*l2)/(2*l1*l2),-1,1))*180/Math.PI};
  }
  function arm(side,wrist,pole,gripRotation=null,handBlend=0) {
    const shoulder=rig.shoulder(side);
    const chestRotation=rig.chestQuaternion();
    const localTarget=wrist.clone().sub(shoulder).applyQuaternion(chestRotation.clone().invert()).normalize();
    // Transport the overhead bend plane with the shoulder swing to avoid
    // elbow flips. Groundstrokes keep the elbow below the shoulder/wrist ray.
    const bendPole=overhead&&side===1
      ?V(side*.8,0,.6).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,localTarget))
      :V(0,-1,0);
    const result=solve(shoulder,wrist,.36,.35,bendPole.applyQuaternion(chestRotation));
    const forearm=result.end.clone().sub(result.joint).normalize();
    const neutralHand=new THREE.Quaternion().setFromUnitVectors(UP,forearm);
    const desiredHand=gripRotation??neutralHand.clone().slerp(new THREE.Quaternion(),handBlend);
    // The shaft is gripped across the palm, not used as the hand's long axis.
    // Limit the wrist relative to the forearm instead of folding it to the shaft.
    const wristAngle=neutralHand.angleTo(desiredHand);
    const handRotation=neutralHand.clone().slerp(desiredHand,Math.min(1,(35*Math.PI/180)/Math.max(1e-8,wristAngle)));
    rig.setArm(side,shoulder,result.joint,result.end,handRotation);
    const wristBend=Math.acos(clamp(forearm.dot(UP.clone().applyQuaternion(handRotation)),-1,1))*180/Math.PI;
    diagnostics.arms.push({side,shoulder:shoulder.clone(),elbow:result.joint.clone(),requestedWrist:wrist.clone(),reach:result.raw,wristBend,flexion:result.flexion,lengths:[shoulder.distanceTo(result.joint),result.joint.distanceTo(result.end)],wrist:result.end.clone()});
    return result;
  }
  function reachableWrist(side,target){
    const shoulder=rig.shoulder(side),offset=target.clone().sub(shoulder);
    return shoulder.addScaledVector(offset.normalize(),clamp(target.distanceTo(rig.shoulder(side)),.27,.708));
  }
  function stance({hip=.93,turn=0,pelvisTurn=turn*.45,lean=0,spread=.27,stagger=.14,shift=0,forward=0,lift=0,pivot=0}={}) {
    diagnostics.arms=[];diagnostics.legs=[];diagnostics.feet=[];
    // Foot targets stay planted in body space. Lower the pelvis if a target
    // would require a locked-out or stretched knee; only the jump lifts feet.
    for(const side of [-1,1]){
      const h=V(side*.115,0,0).applyAxisAngle(UP,pelvisTurn);h.x+=shift;h.z+=forward;
      const horizontal=(side*spread-h.x)**2+(side*stagger-h.z)**2;
      hip=Math.min(hip,.145+Math.sqrt(Math.max(0,.898**2-horizontal)));
    }
    rig.setTorso({hip,shift,forward,lift,pelvisTurn,turn,lean});
    diagnostics.chain={pelvis:pelvisTurn,chest:turn,lift,hip};
    for(const side of [-1,1]){
      const start=rig.hip(side);
      // Pivot around a planted forefoot rather than spinning the whole shoe
      // around a fixed ankle. The rear heel releases as weight moves forward.
      const baseYaw=-side*.12,toeOffset=V(0,-.09,-.10);
      const toe=V(side*spread,.11,side*stagger).add(toeOffset.clone().applyAxisAngle(UP,baseYaw));
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(side===1?-Math.abs(pivot)*.28:0,baseYaw+pivot*(side===1?1:.35),0,'YXZ'));
      const ankle=toe.clone().sub(toeOffset.clone().applyQuaternion(q));
      const result=solve(start,ankle,.46,.44,V(0,0,-1).applyAxisAngle(UP,pelvisTurn*.35),{min:4,max:145});
      rig.setLeg(side,start,result.joint,result.end,q);
      diagnostics.legs.push([start.distanceTo(result.joint),result.joint.distanceTo(result.end)]);
      diagnostics.feet.push({side,target:ankle,actual:result.end.clone(),toe:result.end.clone().add(toeOffset.clone().applyQuaternion(q)),flexion:result.flexion});
    }
  }
  // Cubic Hermite interpolation carries velocity THROUGH contact, rather than
  // ending an eased segment there. All clips are deterministic when scrubbing.
  function swingPoint(time,points){
    const keys=[-.8,-.57,-.30,0,.32,1.15],last=keys.length-1;
    if(time<=keys[0])return points[0].clone();if(time>=keys[last])return points[last].clone();
    let i=0;while(time>keys[i+1])i++;
    const tangent=j=>j===0||j===last?V():points[j+1].clone().sub(points[j-1]).divideScalar(keys[j+1]-keys[j-1]);
    const dt=keys[i+1]-keys[i],u=(time-keys[i])/dt,u2=u*u,u3=u2*u;
    return points[i].clone().multiplyScalar(2*u3-3*u2+1).addScaledVector(tangent(i),(u3-2*u2+u)*dt).addScaledVector(points[i+1],-2*u3+3*u2).addScaledVector(tangent(i+1),(u3-u2)*dt);
  }
  let shot,overhead=false,backhand=false,lob=false,contact;
  function setShot(kind,placement){
    shot={...SHOTS[kind]};overhead=kind==='smash';backhand=kind==='backhand';lob=kind==='lob';
    root.rotation.y=Math.atan2(-(shot.landing[0]-shot.origin[0]),-(shot.landing[1]-shot.origin[2]));
    // Right-handed backhand contacts on the left of the body; forehand/lob
    // contact on the right. The same contact point launches the actual ball.
    contact=V(overhead?.30:backhand?-.55:.78,shot.origin[1],backhand?-.42:-.28);
    if(placement){
      const [x,z]=placement.position;shot.landing=[...placement.landing];
      root.rotation.y=Math.atan2(-(shot.landing[0]-x),-(shot.landing[1]-z));
      root.position.set(x,0,z);
      const origin=contact.clone().applyAxisAngle(UP,root.rotation.y).add(root.position);
      shot.origin=origin.toArray();
      return shot;
    }
    const offset=V(contact.x,0,contact.z).applyAxisAngle(UP,root.rotation.y);
    root.position.set(shot.origin[0]-offset.x,0,shot.origin[2]-offset.z);
    return shot;
  }
  function pose(time){
    const prep=1-smooth(time,-.32,0),follow=smooth(time,0,.45),recover=smooth(time,.45,1.15);
    const load=1-smooth(time,-.8,-.3),prepare=smooth(time,-.8,-.48);
    const lift=overhead?.29*smooth(time,-.26,0)*(1-smooth(time,.02,.42)):0;
    const coil=overhead?.95:backhand?-.88:lob?.55:.92;
    const pelvisTurn=mix(coil*.6,-coil*.58,smooth(time,-.60,-.16))*(1-recover)*prepare;
    const turn=mix(coil,-coil*.90,smooth(time,-.46,.08))*(1-recover)*prepare;
    const hip=overhead?mix(.82,.98,1-load)-follow*.10:mix(.84,.91,1-load)-follow*.025;
    const transfer=(backhand?-1:1)*mix(.065,-.11,smooth(time,-.35,.18))*prepare*(1-recover);
    const forward=mix(.035,-.07,smooth(time,-.34,.16))*prepare*(1-recover);
    const pivot=-coil*.7*smooth(time,-.25,.22)*(1-recover);
    stance({hip:mix(hip,.84,recover),turn,pelvisTurn,lean:mix(overhead?.08*load-.12*follow:-.08,-.13,recover),spread:mix(.27,.34,recover),stagger:mix(overhead?.19:.13,.05,recover),lift,shift:transfer,forward,pivot});
    head.rotation.set(mix(overhead?-.20*prep:.03,.13,recover),-turn*.35*(1-recover),0);
    const finish=contact.clone().add(overhead?V(-.94,-1.55,-.28):backhand?V(1.15,.52,-.25):lob?V(-.55,.85,-.25):V(-1.28,.72,-.24));
    const loaded=contact.clone().add(overhead?V(.38,-1.0,.48):backhand?V(-.08,.04,-.12):lob?V(.03,-.20,.50):V(.03,-.06,.8));
    const start=V(.025,1.35,-.48);
    const opening=overhead?V(.85,1.65,-.38):backhand?V(-.6,1.22,-.48):V(.68,1.08,-.48);
    const centre=swingPoint(time,[start,opening,loaded,contact,finish,V(.025,1.35,-.48)]);centre.y-=lift;
    const shoulder=rig.shoulder(1);
    const axis=centre.clone().sub(shoulder).normalize();
    // Keep the racket inside the arm's reachable envelope throughout the swing.
    const maxReach=.36+.35+.34-.002;
    // Keep a useful elbow bend at the closest point of the follow-through.
    // Previously the wrist could pass within 10 cm of the shoulder.
    const reach=clamp(centre.distanceTo(shoulder),.61*(1-recover),maxReach);
    centre.copy(shoulder).addScaledVector(axis,reach);
    // Orient the face independently from the shaft: meet the outgoing ball
    // face-on, then roll the forearm through the follow-through.
    const normal=V(-Math.sin(turn*.45),0,Math.cos(turn*.45));
    normal.addScaledVector(axis,-normal.dot(axis)).normalize();
    const lateral=axis.clone().cross(normal).normalize();
    const gripRotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(lateral,axis,normal));
    gripRotation.slerp(new THREE.Quaternion(),recover);
    axis.copy(UP).applyQuaternion(gripRotation);
    const wrist=reachableWrist(1,centre.clone().addScaledVector(axis,-.34));
    centre.copy(wrist).addScaledVector(axis,.34);
    // A forward-pointing pole crossed the wrist ray during groundstrokes,
    // flipping the elbow. Keep it outside the body; overheads use their own
    // bend plane and blend to the same ready plane during recovery.
    arm(1,wrist,overhead?V(.8,-.25,-.2).lerp(V(.8,-.5,-.7),recover):V(.8,-.5,-.7),gripRotation);
    racket.position.copy(centre);racket.quaternion.copy(gripRotation);
    // The free arm points up during preparation, then folds to balance rotation.
    const leftReady=V(-.025,1.07,-.48);
    const leftLoaded=overhead?V(-.30,1.76,-.25):backhand?V(-.38,1.20,-.20):V(-.30,1.28,-.55);
    const leftFinish=overhead?V(-.42,1.02,-.42):V(-.60,1.08,-.40);
    const left=leftReady.clone().lerp(leftLoaded,prepare).lerp(leftFinish,smooth(time,-.12,.32));
    left.lerp(centre.clone().add(V(-.05,-.28,0)),recover);
    arm(-1,reachableWrist(-1,left),V(-.8,-.5,-.7),null,recover);
    diagnostics.grip=wrist.clone();
    rig.update();root.updateMatrixWorld(true);return body.localToWorld(centre.clone());
  }
  function ready(x,z,facing,{high=0,turn=0}={}){
    root.position.set(x,0,z);root.rotation.y=facing;
    stance({hip:.84+high*.04,lean:-.13,spread:.34,stagger:.05,turn});
    head.rotation.set(.13,0,0);
    const centre=V(.025,1.35+high*.14,-.48);racket.position.copy(centre);racket.quaternion.identity();
    arm(1,centre.clone().add(V(0,-.34,0)),V(.8,-.5,-.7),new THREE.Quaternion());
    arm(-1,centre.clone().add(V(-.05,-.28,0)),V(-.8,-.5,-.7),new THREE.Quaternion());
    rig.update();root.updateMatrixWorld(true);
  }
  function faceBall(target,dt,{snap=false}={}){
    const dx=target.x-root.position.x,dz=target.z-root.position.z,distance=Math.hypot(dx,dz);
    if(distance<.15)return;
    const desired=Math.atan2(-dx,-dz),difference=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));
    // Follow the shortest turn; let the head lead the shoulders and feet.
    const step=snap?difference:clamp(difference*(1-Math.exp(-Math.max(0,dt)*9)),-dt*3,dt*3);
    const facing=root.rotation.y+step,remaining=Math.atan2(Math.sin(desired-facing),Math.cos(desired-facing));
    const elevation=clamp(Math.atan2(target.y-1.6,distance),-.45,.85);
    ready(root.position.x,root.position.z,facing,{high:clamp(elevation/.65,0,1),turn:clamp(remaining*.3,-.22,.22)});
    head.rotation.set(elevation+.13,clamp(remaining-clamp(remaining*.3,-.22,.22),-.7,.7),0,'YXZ');
    root.updateMatrixWorld(true);
  }
  // Preserve the established initial player position; the controller then
  // selects Backhand without relocating the lineup.
  setShot('forehand');pose(-.8);
  return {setShot,pose,ready,faceBall,getObject:()=>root,getFrame:()=>({position:root.position.clone(),yaw:root.rotation.y}),getPoseAudit:()=>({...diagnostics,skeleton:rig.mesh.skeleton,mesh:rig.mesh})};
}
