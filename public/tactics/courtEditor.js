import * as THREE from './vendor/three.module.js';

// The figures themselves are the drag handles. Empty space retains camera control.
export function addCourtEditor({host,canvas,getCamera,preview,onDrag}){
  const target=document.createElement('button');target.className='shot-target';target.setAttribute('aria-label','Move bounce spot');target.title='Bounce spot';host.append(target);

  const actors=preview.getPlayerObjects(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  let drag=null,selected=null,lastTap=null;
  function cast(event,camera=getCamera()){
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    return ray.ray.intersectPlane(plane,new THREE.Vector3());
  }
  function pick(event){
    cast(event);
    const hits=ray.intersectObjects(actors,true);
    if(hits.length){let obj=hits[0].object;while(obj&&!actors.includes(obj))obj=obj.parent;return actors.indexOf(obj);}
    // A small screen-space allowance keeps distant players usable on a phone.
    const rect=canvas.getBoundingClientRect();let best=20,index=-1;
    actors.forEach((actor,i)=>{
      const p=actor.position.clone();p.y=.9;p.project(getCamera());if(p.z<-1||p.z>1)return;
      const distance=Math.hypot(event.clientX-(rect.left+(p.x+1)*rect.width/2),event.clientY-(rect.top+(1-p.y)*rect.height/2));
      if(distance<best){best=distance;index=i;}
    });return index;
  }
  function begin(event,index,element){
    if(event.button!==0||index<0||drag)return;
    event.preventDefault();event.stopImmediatePropagation();selected=index;
    // Freeze the ray camera while dragging, including the following player camera.
    const camera=getCamera().clone();camera.updateMatrixWorld(true);const point=cast(event,camera);if(!point)return;
    const setup=preview.getSetup(),p=index===4?setup.landing:setup.positions[index];
    drag={id:event.pointerId,index,camera,element,startX:event.clientX,startY:event.clientY,moved:false,offset:[p[0]-point.x,p[1]-point.z]};
    preview.setEditing(true);onDrag(true);element.setPointerCapture(event.pointerId);element.focus();canvas.style.cursor='grabbing';
  }
  function move(index,x,z){if(index===4)preview.aim(x,z);else preview.movePlayer(index,x,z);}
  function pointerMove(event){
    if(!drag){if(event.currentTarget===canvas)canvas.style.cursor=pick(event)>=0?'grab':'';return;}
    if(event.pointerId!==drag.id)return;event.preventDefault();event.stopImmediatePropagation();
    if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;
    drag.moved=true;lastTap=null;
    const point=cast(event,drag.camera);if(point)move(drag.index,point.x+drag.offset[0],point.z+drag.offset[1]);
  }
  function stop(){
    if(!drag)return;const previous=drag;drag=null;
    if(previous.element.hasPointerCapture(previous.id))previous.element.releasePointerCapture(previous.id);
    canvas.style.cursor='';onDrag(false);
  }
  canvas.addEventListener('pointerdown',event=>begin(event,pick(event),canvas),true);
  target.addEventListener('pointerdown',event=>begin(event,4,target));
  for(const element of [canvas,target]){
    element.addEventListener('pointermove',pointerMove,true);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,event=>{
      if(!drag||event.pointerId!==drag.id)return;event.stopImmediatePropagation();
      const previous=drag;stop();
      if(name!=='pointerup'||previous.moved||previous.index===4){lastTap=null;return;}
      const now=performance.now();
      if(lastTap&&lastTap.index===previous.index&&now-lastTap.time<400&&Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<18){
        preview.setHitter(previous.index);lastTap=null;
      }else lastTap={index:previous.index,time:now,x:event.clientX,y:event.clientY};
    },true);
    element.addEventListener('keydown',event=>{
      if(element===canvas&&selected!==null&&(event.key==='Enter'||event.key===' ')){event.preventDefault();preview.setHitter(selected);return;}
      const index=element===target?4:selected,delta={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,-.25],ArrowDown:[0,.25]}[event.key];
      if(index===null||!delta)return;event.preventDefault();preview.setEditing(true);
      const setup=preview.getSetup(),p=index===4?setup.landing:setup.positions[index];move(index,p[0]+delta[0],p[1]+delta[1]);
    });
  }
  function update(){
    const setup=preview.getSetup(),p=new THREE.Vector3(setup.landing[0],.025,setup.landing[1]).project(getCamera());
    target.hidden=p.z<-1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;
    target.style.left=`${(p.x+1)*50}%`;target.style.top=`${(1-p.y)*50}%`;
    // DOM evidence for accessible coordinate feedback and UI regression checks.
    canvas.dataset.hitter=String(setup.hitterIndex);canvas.dataset.playerPositions=JSON.stringify(setup.positions);target.dataset.position=JSON.stringify(setup.landing);canvas.dataset.predictedBounce=JSON.stringify(setup.predictedLanding);
  }
  canvas.setAttribute('aria-label','Padel court. Double-click a player to make them the hitter. Drag a player to move them. Drag empty space to move the camera. Use arrow keys after selecting a player to adjust their position.');
  return {stop,update,isDragging:()=>drag!==null};
}
