import {BALL,AIR,SURFACES,STEP,energy,wallMaterial,netTop,simulateFlight,simulateFree} from './physics.js';
export const ENGINE_VERSION='court-physics-2026-10-15-firm-floor';
export const SOURCES={
  ball:'https://www.padelfip.com/wp-content/uploads/2024/04/PADEL-BALLS-APPROVAL-2025.pdf',
  aerodynamics:'https://twu.tennis-warehouse.com/learning_center/aerodynamics2.php',
  validation:'https://www.grc.nasa.gov/www/wind/valid/tutorial/overview.html',
};
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const finite=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const total=s=>energy({v:s.v,w:s.omega})+BALL.mass*9.81*s.p[1];
export function auditFlight(flight,intent=null){
  const failures=[],warnings=[],samples=flight.samples,impacts=flight.impacts;
  const fail=(code,detail)=>{if(!failures.some(f=>f.code===code))failures.push({code,detail});};
  if(samples.length<2)fail('trace','Missing trajectory samples');
  let peak=0,maxSpeed=0,maxEnergyIncrease=0;
  for(let i=0;i<samples.length;i++){
    const s=samples[i];
    if(!finite(s.p)||!finite(s.v)||!finite(s.omega)||!Number.isFinite(s.t)){fail('finite','Non-finite position, velocity, spin or time');continue;}
    peak=Math.max(peak,s.p[1]);maxSpeed=Math.max(maxSpeed,Math.hypot(...s.v));
    if(s.p[1]<BALL.radius-.001)fail('penetration','Ball passed below the ground');
    if(i){const a=samples[i-1],dt=s.t-a.t;
      if(dt<0)fail('time','Trajectory timestamps run backwards');
      // Conservative kinematic upper bound catches teleports independently of
      // the integrator. Exact contact records explain velocity discontinuities.
      if(distance(a.p,s.p)>dt*Math.max(Math.hypot(...a.v),Math.hypot(...s.v))+ .002)fail('teleport','Unexplained position jump');
      const gain=total(s)-total(a);maxEnergyIncrease=Math.max(maxEnergyIncrease,gain);
      if(gain>1e-4)fail('energy','Mechanical energy increased in still air or on a passive surface');
    }
  }
  for(const hit of impacts){
    if(!finite(hit.p)||!finite(hit.incomingVelocity)||!finite(hit.outgoingVelocity)||!finite(hit.incomingSpin)||!finite(hit.outgoingSpin)){
      fail('impact-data','Incomplete collision record');continue;
    }
    const before=energy({v:hit.incomingVelocity,w:hit.incomingSpin}),after=energy({v:hit.outgoingVelocity,w:hit.outgoingSpin});
    if(after>before+1e-7)fail('impact-energy',`${hit.kind} added kinetic energy`);
    if(hit.kind==='floor'&&Math.abs(hit.p[1]-BALL.radius)>.001)fail('floor-contact','Floor bounce away from ground');
    if(['glass','mesh'].includes(hit.kind)){
      const axis=Math.abs(Math.abs(hit.p[0])-(5-BALL.radius))<.001?0:2;
      const plane=axis===0?5:10;
      if(Math.abs(Math.abs(hit.p[axis])-(plane-BALL.radius))>.001||wallMaterial(axis,hit.p)!==hit.kind)fail('wall-contact','Impact does not match a real enclosure surface');
    }
    if(hit.kind==='net'&&(Math.abs(hit.p[2])>BALL.radius+.001||hit.p[1]>netTop(hit.p[0])+BALL.radius+.001))fail('net-contact','Net collision outside the net');
  }
  let netHeight=null,netClearance=null;
  const first=impacts[0],firstFloor=impacts.find(i=>i.kind==='floor');
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];if(first&&b.t>first.t)break;
    if(a.p[2]*b.p[2]<=0&&a.p[2]!==b.p[2]){
      const f=a.p[2]/(a.p[2]-b.p[2]),x=a.p[0]+f*(b.p[0]-a.p[0]);
      netHeight=a.p[1]+f*(b.p[1]-a.p[1]);netClearance=netHeight-BALL.radius-netTop(x);break;
    }
  }
  const landingError=intent&&firstFloor?Math.hypot(firstFloor.p[0]-intent.landing[0],firstFloor.p[2]-intent.landing[1]):null;
  if(intent&&first?.kind==='floor'){
    if(landingError>.002)fail('landing','Uninterrupted first bounce misses the chosen point by more than 2 mm');
    if(netHeight===null||Math.abs(netHeight-intent.height)>.002)fail('height','Measured trajectory misses selected net height by more than 2 mm');
  }else if(intent)warnings.push('A collision or court exit interrupts the intended landing.');
  const launchSpeed=Math.hypot(...(samples[0]?.v??[]));
  if(launchSpeed<14||launchSpeed>30)warnings.push('Launch speed is outside the 14–30 m/s measured range of the tennis-ball aerodynamic reference.');
  warnings.push('Turf, glass and mesh coefficients have not been validated against this court.');
  return {numerical:failures.length?'fail':'pass',realWorld:'uncalibrated',failures,warnings,
    metrics:{landingError,netHeight,netClearance,peak,maxSpeed,launchSpeed,maxEnergyIncrease},
    events:impacts.map(i=>({surface:i.kind,time:i.t,position:i.p,incomingSpeed:Math.hypot(...i.incomingVelocity),outgoingSpeed:Math.hypot(...i.outgoingVelocity),incomingVelocity:i.incomingVelocity,outgoingVelocity:i.outgoingVelocity,incomingSpin:i.incomingSpin,outgoingSpin:i.outgoingSpin})),exit:flight.exit};
}
export function compareResolution(a,b){
  let positionError=0,timeError=0;const sameEvents=a.impacts.length===b.impacts.length&&a.impacts.every((hit,i)=>hit.kind===b.impacts[i].kind);
  if(sameEvents)a.impacts.forEach((hit,i)=>{positionError=Math.max(positionError,distance(hit.p,b.impacts[i].p));timeError=Math.max(timeError,Math.abs(hit.t-b.impacts[i].t));});
  // Compare the whole flight, not just a landing that the solver already fixes.
  let j=0,maxPathError=0;
  for(const sample of a.samples){
    while(j+1<b.samples.length&&b.samples[j+1].t<sample.t)j++;
    const first=b.samples[j],next=b.samples[Math.min(j+1,b.samples.length-1)];
    if(sample.t>next.t+1e-7)continue;
    const f=next.t>first.t?(sample.t-first.t)/(next.t-first.t):0;
    maxPathError=Math.max(maxPathError,distance(sample.p,first.p.map((n,i)=>n+f*(next.p[i]-n))));
  }
  const sameExit=Boolean(a.exit)===Boolean(b.exit);
  return {status:sameEvents&&sameExit&&positionError<.002&&timeError<.001&&maxPathError<.002?'pass':'fail',positionError,timeError,maxPathError,sameEvents,sameExit};
}
export function simulateAudited(origin,velocity,angular,intent){
  let step=STEP,flight=simulateFlight(origin,velocity,angular,{step}),audit=auditFlight(flight,intent);
  const attempts=[{step,status:audit.numerical}];
  // Automatic correction is restricted to numerical resolution. Never tune
  // physical coefficients against the model's own output to manufacture a pass.
  while(audit.numerical==='fail'&&step>STEP/4){
    step/=2;flight=simulateFlight(origin,velocity,angular,{step});audit=auditFlight(flight,intent);attempts.push({step,status:audit.numerical});
  }
  const snapshot={version:ENGINE_VERSION,origin:[...origin],velocity:[...velocity],angular:[...angular],intent,
    parameters:JSON.parse(JSON.stringify({ball:BALL,air:AIR,surfaces:SURFACES,step,gravity:9.81})),attempts};
  return {...flight,audit,snapshot};
}
export function reviewShot(flight){
  const input=flight.snapshot,fine=simulateFlight(input.origin,input.velocity,input.angular,{step:input.parameters.step/2});
  return {...flight.audit,convergence:compareResolution(flight,fine),references:referenceChecks(),sources:SOURCES,
    validation:{courtMeasurements:0,status:'not validated',reason:'No independently measured padel trajectories have been supplied.'}};
}
export function referenceChecks(){
  const drop=simulateFlight([0,2.54,4],[0,0,0],[0,0,0],{floor:SURFACES.hard}),first=drop.impacts[0];
  const peak=Math.max(...drop.samples.filter(s=>s.t>first.t).map(s=>s.p[1]));
  const air={...AIR,density:0,spinDecay:0},end=simulateFree([0,10,4],[4,3,2],[0,0,0],.8,{air});
  const vacuumError=distance(end.p,[3.2,10+3*.8-4.905*.8**2,5.6]);
  return [
    {name:'FIP hard-surface drop',status:peak>=1.35&&peak<=1.45?'pass':'fail',actual:peak,range:[1.35,1.45],unit:'m',role:'calibration check, not independent court validation',source:SOURCES.ball},
    {name:'Vacuum ballistic solution',status:vacuumError<1e-6?'pass':'fail',actual:vacuumError,unit:'m error',role:'independent analytical verification'},
    {name:'Measured felt-ball drag coefficient',status:'proxy',actual:AIR.dragCoefficient,measuredMean:.507,measuredStandardDeviation:.024,role:'tennis measurement used as padel proxy',source:SOURCES.aerodynamics},
  ];
}
// Measurement data must have independent provenance and known launch state.
// This never calls the target solver: fitting the endpoint would hide errors.
export function compareMeasurement(record){
  if(record?.provenance?.kind!=='measured'||!record.provenance.source||!record.provenance.date||!finite(record.origin)||!finite(record.velocity)||!finite(record.angular)||!Array.isArray(record.observations)||!record.observations.length)throw new Error('Measured record requires source/date, launch position/velocity/spin and observations');
  let last=-1;
  for(const o of record.observations){if(!Number.isFinite(o.t)||o.t<last||o.t<0||!finite(o.p)||!Number.isFinite(o.uncertaintyMetres)||o.uncertaintyMetres<=0)throw new Error('Observations require ordered times, 3D positions and positive measurement uncertainty');last=o.t;}
  const flight=simulateFlight(record.origin,record.velocity,record.angular,{duration:last+.01,maxBounces:20});
  const errors=record.observations.map(o=>{let i=flight.samples.findIndex(s=>s.t>=o.t);if(i<0)throw new Error('Measurement outside simulated time');
    const b=flight.samples[i],a=flight.samples[Math.max(0,i-1)],f=b.t>a.t?(o.t-a.t)/(b.t-a.t):0;
    const predicted=a.p.map((n,j)=>n+f*(b.p[j]-n)),error=distance(predicted,o.p);
    return {time:o.t,measured:o.p,predicted,error,uncertainty:o.uncertaintyMetres,withinUncertainty:error<=o.uncertaintyMetres};
  });
  return {provenance:record.provenance,status:errors.every(e=>e.withinUncertainty)?'within supplied uncertainty':'mismatch',rmse:Math.sqrt(errors.reduce((s,e)=>s+e.error**2,0)/errors.length),errors};
}
