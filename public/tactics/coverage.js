import * as THREE from './vendor/three.module.js';
import {coverageFrame,coverageAt} from './coverageModel.js';

export function addCoverage(scene,preview){
  const canvas=document.createElement('canvas');canvas.width=100;canvas.height=200;
  const context=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,opacity:.9});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(10,20),material);
  mesh.name='defensive-ground-coverage';mesh.rotation.x=-Math.PI/2;
  // Above turf, below the inlaid court lines and every physical object.
  mesh.position.y=.001;scene.add(mesh);
  const button=document.querySelector('#coverage-toggle'),legend=document.querySelector('#coverage-key');
  let enabled=true,pending=null,scheduled=false,valid=false;
  function paint(){
    scheduled=false;
    const setup=pending,audit=preview.getAudit(),frame=coverageFrame(setup,audit.trace);
    valid=Boolean(frame);mesh.visible=enabled&&valid;legend.hidden=!mesh.visible;
    button.disabled=!valid;
    const pixels=context.createImageData(canvas.width,canvas.height);
    if(frame)for(let row=0;row<canvas.height;row++)for(let col=0;col<canvas.width;col++){
      // Plane UV top is world -Z after rotating onto the floor.
      const x=-5+(col+.5)*10/canvas.width,z=-10+(row+.5)*20/canvas.height;
      const value=coverageAt(frame,x,z);if(value===null)continue;
      const i=(row*canvas.width+col)*4;
      const exposed=[248,116,111],covered=[92,225,155];
      for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(exposed[c]+(covered[c]-exposed[c])*value);
      pixels.data[i+3]=245;
    }
    context.putImageData(pixels,0,0);texture.needsUpdate=true;
    button.dataset.defendingSide=setup.positions[setup.hitterIndex][1]>0?'far':'near';
  }
  preview.onSetupChange(setup=>{
    pending=setup;
    // Coalesce pointer updates without recalculating on animation/camera frames.
    if(!scheduled){scheduled=true;requestAnimationFrame(paint);}
  });
  button.addEventListener('click',()=>{
    enabled=!enabled;button.setAttribute('aria-pressed',String(enabled));
    mesh.visible=enabled&&valid;legend.hidden=!mesh.visible;
  });
  return mesh;
}
