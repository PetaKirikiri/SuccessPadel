import * as THREE from './vendor/three.module.js';

export function createBallVisual(){
  const ball=new THREE.Group();ball.name='animated-ball';
  // Transparent render queue at full opacity: draw AFTER the path overlay, but
  // retain scene depth so a player/net can still occlude the ball naturally.
  const body=new THREE.Mesh(new THREE.SphereGeometry(.075,32,24),new THREE.MeshStandardMaterial({
    color:'#dcf537',emissive:'#829615',emissiveIntensity:.16,roughness:.9,
    transparent:true,opacity:1,depthTest:true,depthWrite:true,
  }));
  body.renderOrder=40;ball.add(body);
  // Raised, dark-edged felt seams give rotation a visible surface reference.
  // Solid geometry is depth tested, so seams on the back cannot show through.
  for(const angle of [-.6,.6]){
    const points=[];
    for(let i=0;i<96;i++){
      const a=i/96*Math.PI*2;
      points.push(new THREE.Vector3(.0755*Math.cos(a),.0755*Math.sin(a)*Math.cos(angle),.0755*Math.sin(a)*Math.sin(angle)));
    }
    const curve=new THREE.CatmullRomCurve3(points,true);
    for(const [radius,color,order] of [[.0023,'#536d24',41],[.0011,'#fffbd0',42]]){
      const seam=new THREE.Mesh(new THREE.TubeGeometry(curve,96,radius,5,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:true}));
      if(order===42)seam.scale.setScalar(1.025);
      seam.renderOrder=order;ball.add(seam);
    }
  }
  // Small ink mark breaks rotational symmetry without changing the ball's size.
  const mark=new THREE.Mesh(new THREE.SphereGeometry(.009,12,8),new THREE.MeshBasicMaterial({color:'#355128',transparent:true,depthWrite:true}));
  mark.position.set(.035,.045,.049).normalize().multiplyScalar(.068);
  mark.renderOrder=43;ball.add(mark);
  return ball;
}

// Integrate spin on the simulation timeline, not the browser's frame cadence.
// This makes pause, half speed and replay deterministic, including rebound spin.
export function rotationTrack(samples){
  const result=[new THREE.Quaternion()],axis=new THREE.Vector3(),delta=new THREE.Quaternion();
  for(let i=1;i<samples.length;i++){
    const previous=samples[i-1],dt=samples[i].t-previous.t;
    axis.set(...previous.omega);
    const speed=axis.length(),q=result[i-1].clone();
    if(speed>0&&dt>0)q.premultiply(delta.setFromAxisAngle(axis.divideScalar(speed),speed*dt)).normalize();
    result.push(q);
  }
  return result;
}
