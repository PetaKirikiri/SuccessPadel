import {normalizeSpin} from './ballFlight.js';

export function addSpinControl(onChange){
  const disk=document.querySelector('#spin-ball'),point=document.querySelector('#spin-point');
  const value=document.querySelector('#spin-value');
  let contact={x:0,y:0},pointer=null;
  function update(next){
    contact=normalizeSpin(next);
    // Leave room for the marker at the edge of the ball.
    point.style.left=`${50+contact.x*40}%`;point.style.top=`${50-contact.y*40}%`;
    const strength=Math.round(Math.hypot(contact.x,contact.y)*100),parts=[];
    if(Math.abs(contact.y)>.08)parts.push(contact.y>0?'Top':'Back');
    if(Math.abs(contact.x)>.08)parts.push('side');
    value.textContent=strength?`${parts.join(' + ')||'Spin'} · ${strength}%`:'No spin';
    disk.dataset.contact=JSON.stringify(contact);
    disk.setAttribute('aria-label',`Spin contact point: ${value.textContent}. Top for topspin, bottom for backspin. Arrow keys adjust; Home centres.`);
    onChange(contact);
  }
  function locate(event){
    const rect=disk.getBoundingClientRect();
    const x=(event.clientX-rect.left-rect.width/2)/(rect.width*.40),y=(rect.top+rect.height/2-event.clientY)/(rect.height*.40);
    update(Math.hypot(x,y)<.15?{x:0,y:0}:{x,y});
  }
  disk.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer=e.pointerId;disk.setPointerCapture(pointer);disk.focus();locate(e);e.preventDefault();});
  disk.addEventListener('pointermove',e=>{if(e.pointerId===pointer)locate(e);});
  const release=()=>{pointer=null;};
  disk.addEventListener('pointerup',release);disk.addEventListener('pointercancel',release);
  disk.addEventListener('keydown',e=>{
    const steps={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]};
    if(e.key==='Home'){e.preventDefault();update({x:0,y:0});}
    if(steps[e.key]){e.preventDefault();const [x,y]=steps[e.key];update({x:contact.x+x,y:contact.y+y});}
  });
}
