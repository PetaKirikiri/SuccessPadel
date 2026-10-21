import * as THREE from './vendor/three.module.js';
import {overheadPathExtra} from './overheadHeight.js';

// A screen-width ribbon stays readable at the far glass and in overhead view.
// Native WebGL lines are generally limited to one pixel, regardless of linewidth.
export function trajectoryPath(color){
  const group=new THREE.Group(),resolution=new THREE.Vector2();
  const vertexShader=`
    attribute vec3 segmentStart;
    attribute vec3 segmentEnd;
    attribute vec2 heightWidth;
    uniform vec2 resolution;
    uniform float width;
    uniform float nearPlane;
    uniform float overhead;
    void main(){
      vec4 a=modelViewMatrix*vec4(segmentStart,1.0);
      vec4 b=modelViewMatrix*vec4(segmentEnd,1.0);
      float plane=-nearPlane*1.01;
      if(a.z>plane && b.z>plane){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
      if(a.z>plane)a=mix(a,b,(plane-a.z)/(b.z-a.z));
      if(b.z>plane)b=mix(b,a,(plane-b.z)/(a.z-b.z));
      vec4 ca=projectionMatrix*a,cb=projectionMatrix*b;
      vec2 delta=(cb.xy/cb.w-ca.xy/ca.w)*resolution;
      vec2 normal=vec2(-delta.y,delta.x)/max(length(delta),0.0001);
      vec4 clip=mix(ca,cb,position.x);
      float visibleWidth=width+overhead*mix(heightWidth.x,heightWidth.y,position.x);
      clip.xy+=normal*position.y*visibleWidth/resolution*clip.w;
      gl_Position=clip;
    }`;
  let geometry=new THREE.InstancedBufferGeometry();
  const materials=[{color:'#102431',width:6,order:30},{color,width:3,order:31}].map(layer=>{
    const material=new THREE.ShaderMaterial({
      uniforms:{resolution:{value:new THREE.Vector2(1,1)},width:{value:layer.width},nearPlane:{value:.1},overhead:{value:0},ink:{value:new THREE.Color(layer.color)}},
      vertexShader,fragmentShader:'uniform vec3 ink; void main(){gl_FragColor=vec4(ink,1.0);}',
      depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
    });
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=layer.order;
    mesh.onBeforeRender=(renderer,scene,camera)=>{renderer.getSize(resolution);material.uniforms.resolution.value.copy(resolution);material.uniforms.nearPlane.value=camera.near;material.uniforms.overhead.value=camera.isOrthographicCamera?1:0;};
    group.add(mesh);return material;
  });
  group.setPoints=points=>{
    const starts=[],ends=[],widths=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];if(Math.hypot(...a.map((v,j)=>v-b[j]))<1e-8)continue;
      starts.push(...a);ends.push(...b);
      widths.push(overheadPathExtra(a[1]),overheadPathExtra(b[1]));
    }
    const next=new THREE.InstancedBufferGeometry();
    next.setAttribute('position',new THREE.Float32BufferAttribute([0,-1,0,1,-1,0,0,1,0,1,1,0],3));
    next.setIndex([0,1,2,2,1,3]);
    next.setAttribute('segmentStart',new THREE.InstancedBufferAttribute(new Float32Array(starts),3));
    next.setAttribute('segmentEnd',new THREE.InstancedBufferAttribute(new Float32Array(ends),3));
    next.setAttribute('heightWidth',new THREE.InstancedBufferAttribute(new Float32Array(widths),2));
    next.instanceCount=starts.length/3;
    group.children.forEach(mesh=>{mesh.geometry=next;});geometry.dispose();geometry=next;
  };
  group.dispose=()=>{geometry.dispose();materials.forEach(m=>m.dispose());};
  return group;
}
