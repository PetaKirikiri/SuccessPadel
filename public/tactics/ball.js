import * as THREE from './vendor/three.module.js';
import {simulateShot,normalizeSpin} from './ballFlight.js';
import {reviewShot} from './shotAudit.js';
import {addRobotPlayer} from './robotPlayer.js';
import {trajectoryPath} from './trajectoryPath.js';
import {createBallVisual,rotationTrack} from './ballVisual.js';
import {updateBallView} from './overheadHeight.js';

export async function addBallPreview(scene){
  const allPlayers=await Promise.all(Array.from({length:4},()=>addRobotPlayer(scene)));
  let player=allPlayers[0],hitterIndex=0;
  const partner=allPlayers[1];
  partner.ready(2.5,7.3,0);
  let waitingPlayers=[partner];
  for(const [index,x] of [-2.5,2.5].entries()) {
    const defender=allPlayers[index+2];
    defender.ready(x,-7.5,Math.PI);waitingPlayers.push(defender);
  }
  const positions=allPlayers.map(p=>{const v=p.getFrame().position;return [v.x,v.z];});
  let landing=[1.6,-7],editing=false,spin={x:0,y:0},height=null;
  const setupListeners=new Set();
  const windup=.8;
  const ball=createBallVisual();
  scene.add(ball);
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=64;
  const haloCtx=haloCanvas.getContext('2d'),glow=haloCtx.createRadialGradient(32,32,3,32,32,32);
  glow.addColorStop(0,'rgba(241,255,146,.7)');glow.addColorStop(.35,'rgba(226,255,80,.25)');glow.addColorStop(1,'rgba(226,255,80,0)');haloCtx.fillStyle=glow;haloCtx.fillRect(0,0,64,64);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(haloCanvas),transparent:true,depthWrite:false,opacity:.4}));halo.scale.set(.35,.35,1);halo.renderOrder=39;ball.add(halo);
  const marker=new THREE.Mesh(new THREE.RingGeometry(.13,.16,32),new THREE.MeshBasicMaterial({color:'#e9fa97',transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));
  marker.rotation.x=-Math.PI/2;scene.add(marker);
  const path=trajectoryPath('#72e5ff');scene.add(path);
  const reboundPath=trajectoryPath('#e6ff85');reboundPath.name='predicted-rebound';scene.add(reboundPath);
  const glassPath=trajectoryPath('#ff91d0');glassPath.name='predicted-glass-rebound';scene.add(glassPath);
  const trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#f3ff91',transparent:true,opacity:.95}));scene.add(trail);
  const flashes=[];
  const play=document.querySelector('#hit-ball'),speed=document.querySelector('#ball-speed');
  const buttons=[...document.querySelectorAll('[data-shot]')];
  let rejectedAudit=null,flight,rotations=[],invalid=false,elapsed=-windup,playing=true,rate=1,kind='backhand';
  const physicsStatus=document.querySelector('#status');
  function updateButton(){play.textContent=playing?'Pause':elapsed>=flight.duration?'Replay':elapsed>-windup?'Resume':'Hit';play.setAttribute('aria-label',playing?'Pause ball flight':elapsed>=flight.duration?'Replay shot':elapsed>-windup?'Resume ball flight':'Hit ball');}
  function select(next){
    // Shot buttons change the stroke, not the trajectory controls. Capture
    // the displayed initial height before leaving the first preset, too.
    if(next!==kind && height===null && flight)height=flight.netHeight;
    kind=next;
    const shot=player.setShot(kind,{position:positions[hitterIndex],landing});
    try{flight=simulateShot(kind,shot,spin,height);invalid=false;rejectedAudit=null;}
    catch(error){
      rejectedAudit=error.audit??{error:error.message,inputs:{kind,shot,spin:{...spin},height}};
      invalid=true;playing=false;play.disabled=true;
      path.visible=reboundPath.visible=glassPath.visible=trail.visible=ball.visible=marker.visible=false;
      flashes.forEach(f=>{f.mesh.visible=false;});
      allPlayers.forEach((p,i)=>{if(i!==hitterIndex)p.ready(...positions[i],i<2?0:Math.PI);});
      player.pose(-windup);
      if(physicsStatus){physicsStatus.hidden=false;physicsStatus.textContent='Cannot calculate this shot. Lower the height or reduce spin.';}
      for(const listener of setupListeners)listener(getSetup());
      return;
    }
    play.disabled=false;path.visible=ball.visible=marker.visible=true;
    if(physicsStatus)physicsStatus.hidden=true;
    rotations=rotationTrack(flight.samples);
    ball.quaternion.identity();elapsed=-windup;playing=!editing;player.pose(elapsed);
    const firstBounce=flight.impacts.find(impact=>impact.kind==='floor');
    const split=firstBounce?flight.samples.findIndex(sample=>sample.t>=firstBounce.t):flight.samples.length-1;
    const firstGlass=flight.impacts.find(impact=>impact.kind==='glass');
    const glassSplit=firstGlass?flight.samples.findIndex(sample=>sample.t>=firstGlass.t):flight.samples.length-1;
    path.setPoints(flight.samples.slice(0,Math.min(split,glassSplit)+1).map(s=>s.p));
    reboundPath.setPoints(flight.samples.slice(split,glassSplit+1).map(s=>s.p));
    reboundPath.visible=Boolean(firstBounce)&&split<glassSplit;
    glassPath.setPoints(flight.samples.slice(glassSplit).map(s=>s.p));
    glassPath.visible=Boolean(firstGlass);
    const coords=new Float32Array(flight.samples.length*3);
    flight.samples.forEach((s,i)=>coords.set(s.p,i*3));
    trail.geometry.dispose();trail.geometry=new THREE.BufferGeometry();trail.geometry.setAttribute('position',new THREE.BufferAttribute(coords,3));trail.geometry.setDrawRange(0,0);
    for(const f of flashes){scene.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();}flashes.length=0;
    for(const impact of flight.impacts){
      const mesh=new THREE.Mesh(new THREE.RingGeometry(.11,.145,32),new THREE.MeshBasicMaterial({color:'#efff9c',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
      mesh.position.set(...impact.p);if(impact.kind==='floor'){mesh.rotation.x=-Math.PI/2;mesh.position.y=.012;}
      scene.add(mesh);flashes.push({...impact,mesh});
    }
    allPlayers.forEach((p,i)=>{if(i!==hitterIndex)p.ready(...positions[i],i<2?0:Math.PI);});
    for(const receiver of waitingPlayers)receiver.faceBall(new THREE.Vector3(...flight.samples[0].p),0,{snap:true});
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shot===kind)));updateButton();
    for(const listener of setupListeners)listener(getSetup());
  }
  buttons.forEach(b=>b.addEventListener('click',()=>select(b.dataset.shot)));
  play.addEventListener('click',()=>{if(editing){editing=false;}if(elapsed>=flight.duration){elapsed=-windup;playing=true;}else playing=!playing;updateButton();});
  speed.addEventListener('click',()=>{rate=rate===1?.5:1;speed.setAttribute('aria-pressed',String(rate===.5));});
  select('backhand');
  function tick(dt){
    if(invalid)return;
    if(playing){elapsed=Math.min(flight.duration,elapsed+Math.max(0,dt)*rate);if(elapsed===flight.duration){playing=false;updateButton();}}
    player.pose(elapsed);
    const flightTime=Math.max(0,elapsed);
    // Contact samples occur between fixed steps. Search actual timestamps.
    let low=0,high=flight.samples.length-1;
    while(high-low>1){const middle=(low+high)>>1;if(flight.samples[middle].t<=flightTime)low=middle;else high=middle;}
    const index=Math.min(low,flight.samples.length-2);
    const a=flight.samples[index],b=flight.samples[index+1],fraction=THREE.MathUtils.clamp((flightTime-a.t)/Math.max(1e-12,b.t-a.t),0,1);
    ball.position.set(...a.p).lerp(new THREE.Vector3(...b.p),fraction);
    // A short incoming feed meets the racket exactly at flight time zero.
    if(elapsed<0){const u=-elapsed/windup;ball.position.z-=Math.sign(positions[hitterIndex][1])*1.5*u;ball.position.y+=u*(kind==='smash'?1:.25);}
    for(const receiver of waitingPlayers)receiver.faceBall(ball.position,Math.max(0,dt)*rate);
    trail.visible=elapsed>=0;
    if(elapsed<0)ball.quaternion.identity();
    else ball.quaternion.copy(rotations[index]).slerp(rotations[index+1],fraction);
    marker.position.set(ball.position.x,.012,ball.position.z);
    marker.scale.setScalar(1+ball.position.y*.10);
    const first=Math.max(0,index-100);trail.geometry.setDrawRange(first,index-first+1);
    for(const f of flashes){const age=elapsed-f.t;f.mesh.visible=age>=0;f.mesh.material.opacity=age>=0?Math.max(.22,.85-age*.5):0;f.mesh.scale.setScalar(1+Math.min(Math.max(age,0),.5)*1.2);}
  }
  function setHeight(value){if(!Number.isFinite(value))return;height=Math.max(1,Math.min(8,value));editing=true;select(kind);}
  function setSpin(contact){spin=normalizeSpin(contact);editing=true;select(kind);}
  function setEditing(value){editing=value;if(value){elapsed=-windup;playing=false;player.pose(elapsed);}updateButton();}
  function movePlayer(index,x,z){
    x=THREE.MathUtils.clamp(x,-4.35,4.35);z=THREE.MathUtils.clamp(z,index<2?.9:-9.2,index<2?9.2:-.9);
    if(positions.some((p,i)=>i!==index&&Math.hypot(p[0]-x,p[1]-z)<.9))return;
    positions[index]=[x,z];select(kind);
  }
  function setHitter(index){
    if(!Number.isInteger(index)||index<0||index>=allPlayers.length)return;
    const side=Math.sign(positions[index][1]);
    if(Math.sign(landing[1])===side)landing=[landing[0],-landing[1]];
    hitterIndex=index;player=allPlayers[index];waitingPlayers=allPlayers.filter((_,i)=>i!==index);
    editing=true;select(kind);
  }
  function aim(x,z){
    const side=Math.sign(positions[hitterIndex][1]);
    landing=[THREE.MathUtils.clamp(x,-4.6,4.6),THREE.MathUtils.clamp(z,side>0?-9.4:.65,side>0?-.65:9.4)];select(kind);
  }
  function getSetup(){return {hitterIndex,spin:{...spin},height:invalid?(height??flight.netHeight):flight.netHeight,minimumHeight:flight.minimumHeight,valid:!invalid,predictedLanding:invalid?null:flight.impacts.find(impact=>impact.kind==='floor')?.p.filter((_,index)=>index!==1)??null,positions:positions.map(p=>[...p]),landing:[...landing]};}
  function onSetupChange(listener){setupListeners.add(listener);listener(getSetup());return ()=>setupListeners.delete(listener);}
  function getAudit(){if(invalid)return {status:'rejected',...rejectedAudit};return {review:reviewShot(flight),snapshot:flight.snapshot,trace:{samples:flight.samples,impacts:flight.impacts,exit:flight.exit}};}
  return {getAudit,tick,updateView:(camera,height)=>updateBallView(ball,camera,height),getPlayerObjects:()=>allPlayers.map(p=>p.getObject()),getPlayerFrame:()=>player.getFrame(),setHitter,setSpin,setHeight,onSetupChange,setEditing,movePlayer,aim,getSetup};
}
