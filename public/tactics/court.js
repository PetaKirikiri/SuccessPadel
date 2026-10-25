import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { addBallPreview } from './ball.js';
import { addHeightControl } from './heightControl.js';
import { addSpinControl } from './spinControl.js';
import { addCourtEditor } from './courtEditor.js';
import { addCoverage } from './coverage.js';

// Preview only. Metres: 10 × 20, service lines 6.95 from net; net 0.88–0.92.
const host = document.querySelector('#court');
const status = document.querySelector('#status');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch {
  status.textContent = 'This browser could not start 3D graphics. Try opening this preview in Safari or Chrome.';
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// Keep the playing surface clear; material lighting still shows 3D form.
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
host.appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', '3D court. Drag to orbit, scroll or pinch to zoom. Camera presets below.');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#17242e');
scene.fog = new THREE.Fog('#17242e', 48, 110);
const environment = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(environment, 0.04);
scene.environment = envMap.texture;
environment.dispose(); pmrem.dispose();
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(44, 1, 0.05, 180);
const overhead = new THREE.OrthographicCamera(-8,8,14,-14,0.1,100);
overhead.position.set(0,40,0); overhead.up.set(0,0,-1); overhead.lookAt(0,0,0);
let activeCamera = camera;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 2; controls.maxDistance = 65;
controls.maxPolarAngle = Math.PI / 2 - 0.025;
controls.minTargetRadius = 0; controls.maxTargetRadius = 14;
controls.autoRotateSpeed = 0.55;
controls.enablePan = false;
const topControls = new OrbitControls(overhead,renderer.domElement);
topControls.enableRotate=false;topControls.enablePan=true;topControls.minZoom=.7;topControls.maxZoom=5;topControls.enabled=false;
const hemi = new THREE.HemisphereLight('#ceeaff','#4f5146',1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4db',2.5);
sun.position.set(-12,22,8); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:65});
sun.shadow.normalBias=0.035; sun.shadow.bias=-0.00015; sun.shadow.radius=3;
scene.add(sun);

let seed=73521;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function surfaceTexture(turf){
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d');const pixels=ctx.createImageData(512,512);
  for(let i=0;i<pixels.data.length;i+=4){
    const v=random();const grain=(v-.5)*(turf?26:14);
    pixels.data[i]=(turf?16:66)+grain;
    pixels.data[i+1]=(turf?99:72)+grain;
    pixels.data[i+2]=(turf?166:75)+grain;
    pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  if(turf){
    for(let i=0;i<19000;i++){
      const x=random()*512,y=random()*512;
      ctx.strokeStyle=random()>.7?'rgba(150,205,226,.18)':'rgba(4,46,87,.15)';
      ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*2,y+1+random()*3);ctx.stroke();
    }
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(turf?5:12,turf?10:12);
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}
const turfTexture=surfaceTexture(true),concreteTexture=surfaceTexture(false);
const metal=new THREE.MeshStandardMaterial({color:'#26353e',metalness:.78,roughness:.38});
const chrome=new THREE.MeshStandardMaterial({color:'#a9b4b7',metalness:.85,roughness:.28});
const white=new THREE.MeshStandardMaterial({color:'#f3efe4',roughness:.9});
const glass=new THREE.MeshPhysicalMaterial({color:'#add5e4',metalness:0,roughness:.075,transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false,envMapIntensity:.65});
const edgeMaterial=new THREE.LineBasicMaterial({color:'#badfe9',transparent:true,opacity:.42});
function box(w,h,d,x,y,z,material,shadow=true){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);
  mesh.castShadow=shadow;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function rod(a,b,r,material=metal){
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),delta=B.clone().sub(A);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material);
  mesh.position.copy(A).add(B).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  mesh.castShadow=true;scene.add(mesh);return mesh;
}
box(200,.15,200,0,-.42,0,new THREE.MeshStandardMaterial({color:'#18242b',roughness:1}),false);
box(13.4,.25,23.4,0,-.21,0,new THREE.MeshStandardMaterial({map:concreteTexture,color:'#7a8185',roughness:.96}));
// Bias only the turf's depth behind its ground overlays. Millimetre spacing
// alone loses depth precision at distant/grazing camera angles and produces
// blue triangles through coverage. Keep coverage depth-tested so court lines,
// players and the net still occlude it normally.
box(10,.08,20,0,-.04,0,new THREE.MeshStandardMaterial({map:turfTexture,color:'#b2d4f5',bumpMap:turfTexture,bumpScale:.018,roughness:1,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2}));
// Thin inlaid lines: do not add tennis tramlines or rear centre lines.
for(const z of [-6.95,6.95]) box(10,.004,.05,0,.004,z,white,false);
for(const sign of [-1,1]) box(.05,.004,7.15,0,.005,sign*3.575,white,false);

function glassPanel(w,h,x,y,z,rotation=0){
  const g=new THREE.PlaneGeometry(w,h);const panel=new THREE.Mesh(g,glass);
  panel.position.set(x,y,z);panel.rotation.y=rotation;scene.add(panel);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(g),edgeMaterial);
  edge.position.copy(panel.position);edge.rotation.copy(panel.rotation);scene.add(edge);
  for(const dx of [-w/2+.12,w/2-.12])for(const dy of [-h/2+.18,h/2-.18]){
    const bolt=new THREE.Mesh(new THREE.SphereGeometry(.025,6,4),chrome);
    bolt.position.set(x+dx*Math.cos(rotation),y+dy,z-dx*Math.sin(rotation));scene.add(bolt);
  }
}
function gridTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  ctx.clearRect(0,0,128,128);ctx.strokeStyle='#3e4c52';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(128,0);ctx.moveTo(0,0);ctx.lineTo(0,128);ctx.stroke();
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;
}
const grid=gridTexture();
const fenceWire=new THREE.LineBasicMaterial({color:'#101b21',transparent:true,opacity:.5});
function fence(w,h,x,y,z,rotation=0){
  // Actual wire lines remain legible where the old alpha texture disappeared.
  // This makes the empty entrance distinct from the surrounding mesh panels.
  const wire=[];
  const columns=Math.ceil(w/.075),rows=Math.ceil(h/.075);
  for(let i=0;i<=columns;i++){const u=-w/2+w*i/columns;wire.push(u,-h/2,0,u,h/2,0);}
  for(let i=0;i<=rows;i++){const v=-h/2+h*i/rows;wire.push(-w/2,v,0,w/2,v,0);}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(wire,3));
  const m=new THREE.LineSegments(geometry,fenceWire);m.position.set(x,y,z);m.rotation.y=rotation;scene.add(m);
  const dx=w/2*Math.cos(rotation),dz=-w/2*Math.sin(rotation);
  for(const yy of [y-h/2,y+h/2])rod([x-dx,yy,z-dz],[x+dx,yy,z+dz],.023);
}
function post(x,z,h=4){box(.10,h,.10,x,h/2,z,metal);box(.24,.035,.24,x,.02,z,metal);box(.12,.025,.12,x,h+.012,z,metal);}
// 3m glass on the back and corner side panels; mesh near the court entrances.
for(const sign of [-1,1]){
  for(let i=0;i<5;i++){glassPanel(1.98,2.96,-4+i*2,1.51,sign*10);fence(2,1,-4+i*2,3.5,sign*10);}
  for(let x=-5;x<=5;x+=2)post(x,sign*10);
  for(const x of [-5,5]){
    glassPanel(1.98,2.96,x,1.51,sign*9,Math.PI/2);
    fence(2,1,x,3.5,sign*9,Math.PI/2);
    glassPanel(1.98,2.96,x,1.51,sign*7,Math.PI/2);
    for(const z of [sign*8,sign*6,sign*4,sign*2])post(x,z,z===sign*8?4:3);
    for(const z of [sign*5,sign*3])fence(2,3,x,1.5,z,Math.PI/2);
    // Two metre entrance on each side of the net; lintel clears player height.
    fence(2,.7,x,2.65,sign*1,Math.PI/2);
    box(.10,.09,2,x,2.3,sign,metal,false);
    post(x,0,3);
  }
}
// Net, including slight centre sag and 5cm top tape.
for(const x of [-5,5]){rod([x,0,0],[x,1.02,0],.045);box(.16,.025,.16,x,.014,0,metal);}
const netGeometry=new THREE.PlaneGeometry(10,.92,80,1);
const pos=netGeometry.attributes.position;
for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),top=.88+.04*(x*x/25);
  pos.setY(i,pos.getY(i)>0?top:.02);
}
netGeometry.computeVertexNormals();
const netTex=grid.clone();netTex.repeat.set(10/.042,.92/.042);
const net=new THREE.Mesh(netGeometry,new THREE.MeshStandardMaterial({color:'#101b22',map:netTex,transparent:true,alphaTest:.2,side:THREE.DoubleSide,roughness:.9}));scene.add(net);
const tapePositions=[],tapeIndices=[];
for(let i=0;i<=80;i++){const x=-5+i/8,y=.88+.04*x*x/25;tapePositions.push(x,y,-.004,x,y-.05,-.004);if(i<80){const k=i*2;tapeIndices.push(k,k+1,k+2,k+1,k+3,k+2);}}
const tapeGeo=new THREE.BufferGeometry();tapeGeo.setAttribute('position',new THREE.Float32BufferAttribute(tapePositions,3));tapeGeo.setIndex(tapeIndices);tapeGeo.computeVertexNormals();
scene.add(new THREE.Mesh(tapeGeo,new THREE.MeshStandardMaterial({color:'#f1ece0',side:THREE.DoubleSide,roughness:.85})));
// Physical luminaires give the enclosure a recognisable real-world silhouette.
for(const x of [-5.45,5.45])for(const z of [-6,6]){
  rod([x,0,z],[x,6,z],.075);rod([x,6,z],[x-Math.sign(x)*.65,6,z],.055);
  const fixture=box(.7,.12,.32,x-Math.sign(x)*.6,5.96,z,metal);
  fixture.rotation.z=-Math.sign(x)*.14;
  box(.57,.015,.25,x-Math.sign(x)*.6,5.89,z,new THREE.MeshStandardMaterial({color:'#f3f4dd',emissive:'#e9eed5',emissiveIntensity:.4}));
}

// Geometric net weave stays visible when texture mipmaps get small.
const weave=[];
for(let x=-5;x<=5;x+=.045){weave.push(x,.02,.006,x,.88+.04*x*x/25,.006);}
for(let y=.045;y<.87;y+=.045){weave.push(-5,y,.006,5,y,.006);}
const weaveGeo=new THREE.BufferGeometry();weaveGeo.setAttribute('position',new THREE.Float32BufferAttribute(weave,3));
scene.add(new THREE.LineSegments(weaveGeo,new THREE.LineBasicMaterial({color:'#0b171c',transparent:true,opacity:.65})));

let ballPreview;
try{ballPreview=await addBallPreview(scene);}
catch(error){
  status.hidden=false;status.textContent='The player models could not load. Reload the court to try again.';
  throw error;
}
addCoverage(scene,ballPreview);
addSpinControl(contact=>ballPreview.setSpin(contact));
addHeightControl(ballPreview);
let playerYaw=0,playerPitch=.38,playerDistance=3;
function playerCameraFrame(){
  const frame=ballPreview.getPlayerFrame(),yaw=frame.yaw+playerYaw;
  const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const destination=frame.position.clone().addScaledVector(forward,-playerDistance*Math.cos(playerPitch)).addScaledVector(right,.45);
  destination.y=1.35+playerDistance*Math.sin(playerPitch);
  const target=frame.position.clone().addScaledVector(forward,2.5);target.y=1.3;
  return {destination,target};
}
let mode='orbit',transition=null;
const viewButtons=[...document.querySelectorAll('[data-view]')];
function resize(){
  const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  const halfH=Math.max(10.7,5.85/(w/h));
  overhead.left=-halfH*w/h;overhead.right=halfH*w/h;overhead.top=halfH;overhead.bottom=-halfH;overhead.updateProjectionMatrix();
}
function setView(next,instant=false){
  mode=next;controls.autoRotate=false;document.querySelector('#rotate').setAttribute('aria-pressed','false');
  viewButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===next)));
  activeCamera=next==='top'?overhead:camera;controls.enabled=next==='orbit';topControls.enabled=next==='top';camera.fov=next==='player'?60:44;camera.updateProjectionMatrix();
  document.querySelector('#hint').textContent=next==='top'?'10 × 20 metres · Scroll or pinch to zoom':next==='player'?'Drag to look around · Scroll or pinch to zoom':'Drag to explore · Scroll or pinch to zoom';
  if(next==='top'){transition=null;overhead.zoom=1;topControls.target.set(0,0,0);overhead.position.set(0,40,0);overhead.updateProjectionMatrix();topControls.update();return;}
  if(next==='player'){playerYaw=0;playerPitch=.38;playerDistance=3;}
  const playerFrame=playerCameraFrame();
  const target=next==='player'?playerFrame.target:new THREE.Vector3(0,2,0);
  // Fit the court and lob height to the available viewport instead of fixed zoom.
  const direction=new THREE.Vector3(18,20,25).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
  const up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;
  let distance=0;
  for(const x of [-6.7,6.7])for(const y of [0,7.5])for(const z of [-11.7,11.7]){
    const corner=new THREE.Vector3(x,y,z).sub(target),depth=corner.dot(direction);
    distance=Math.max(distance,depth+Math.abs(corner.dot(right))/tanH,depth+Math.abs(corner.dot(up))/tanV);
  }
  const destination=next==='player'?playerFrame.destination:target.clone().addScaledVector(direction,distance*1.03);
  controls.minDistance=next==='player'?.5:7;
  if(instant){camera.position.copy(destination);controls.target.copy(target);controls.update();}
  else transition={start:performance.now(),from:camera.position.clone(),fromTarget:controls.target.clone(),to:destination,target};
}
viewButtons.forEach(b=>b.addEventListener('click',()=>{editor.stop();setView(b.dataset.view);}));
controls.addEventListener('start',()=>{transition=null;});
document.querySelector('#rotate').addEventListener('click',()=>{
  editor.stop();if(mode!=='orbit')setView('orbit',true);
  controls.autoRotate=!controls.autoRotate;document.querySelector('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));
});
const fullButton=document.querySelector('#fullscreen');
if(!document.fullscreenEnabled)fullButton.hidden=true;
fullButton.addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{document.querySelector('#hint').textContent='Fullscreen is unavailable in this browser';}
});
document.addEventListener('fullscreenchange',()=>fullButton.setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();status.hidden=false;status.textContent='3D graphics paused. Reload this preview to continue.';});
new ResizeObserver(resize).observe(host);resize();setView('orbit',true);
const editor=addCourtEditor({host,canvas:renderer.domElement,getCamera:()=>activeCamera,preview:ballPreview,onDrag:dragging=>{transition=null;controls.autoRotate=false;controls.enabled=!dragging&&mode==='orbit';topControls.enabled=!dragging&&mode==='top';}});
let lastTime=performance.now();
// Third-person view stays anchored behind the active hitter. Drag orbits the player.
const fingers=new Map();let lastPinch=0;
function look(dx,dy){
  playerYaw-=dx*.004;playerPitch=THREE.MathUtils.clamp(playerPitch+dy*.004,.08,1.1);
}
renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='player')return;transition=null;fingers.set(e.pointerId,[e.clientX,e.clientY]);renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{
  if(mode!=='player'||!fingers.has(e.pointerId))return;
  const before=fingers.get(e.pointerId);fingers.set(e.pointerId,[e.clientX,e.clientY]);
  if(fingers.size===1)look(e.clientX-before[0],e.clientY-before[1]);
  else{const [a,b]=[...fingers.values()];const gap=Math.hypot(a[0]-b[0],a[1]-b[1]);if(lastPinch){playerDistance=THREE.MathUtils.clamp(playerDistance*lastPinch/gap,1.8,5);}lastPinch=gap;}
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(name,e=>{fingers.delete(e.pointerId);lastPinch=0;});
renderer.domElement.addEventListener('wheel',e=>{if(mode!=='player')return;e.preventDefault();playerDistance=THREE.MathUtils.clamp(playerDistance+e.deltaY*.006,1.8,5);},{passive:false});
function render(time){
  requestAnimationFrame(render);
  const dt=Math.max(0,Math.min((time-lastTime)/1000,.1));lastTime=time;
  if(document.hidden)return;
  ballPreview.tick(dt);
  if(mode==='player'&&!editor.isDragging()){
    const frame=playerCameraFrame();
    if(transition){transition.to.copy(frame.destination);transition.target.copy(frame.target);}
    else {camera.position.lerp(frame.destination,1-Math.exp(-dt*12));controls.target.lerp(frame.target,1-Math.exp(-dt*12));}
  }
  if(transition){const t=Math.min((time-transition.start)/700,1),k=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,k);controls.target.lerpVectors(transition.fromTarget,transition.target,k);if(t===1)transition=null;}
  if(controls.enabled)controls.update(dt);else if(mode==='player')camera.lookAt(controls.target);
  editor.update();
  ballPreview.updateView(activeCamera,host.clientHeight);
  renderer.render(scene,activeCamera);
}
requestAnimationFrame(render);status.hidden=true;
