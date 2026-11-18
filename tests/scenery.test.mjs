import assert from "node:assert/strict";
import * as THREE from "three";
import { buildEstate } from "../src/scenery.mjs";
import { integrateRide } from "../src/physics.mjs";

const points=[
 [0,3,37],[17,3,27],[26,3,6],[23,3,-21],[11,4,-44],[32,6,-57],
 [55,14,-43],[62,21,-15],[52,17,11],[39,5,24],[19,4,54],[-6,4,56],
 [-31,4,31],[-49,9,17],[-57,20,-8],[-45,17,-31],[-31,5,-53],
 [-13,3,-46],[0,3,-28],[2,3,-5],[1,3,17],[0,3,37]
].map(v=>new THREE.Vector3(...v));
const track=new THREE.CatmullRomCurve3(points,false,"catmullrom",.22);
track.arcLengthDivisions=1000;
const L=track.getLength();
const at=t=>track.getPointAt(Math.max(0,Math.min(1,t)));
const tangent=t=>track.getTangentAt(Math.max(0,Math.min(1,t))).normalize();
const scene=new THREE.Scene();
let randState=4254;
const random=()=>((randState=(1664525*randState+1013904223)>>>0)/4294967296);
const range=(a,b)=>a+(b-a)*random();
const frameGroup=t=>{
 const g=new THREE.Group(),d=tangent(t);
 g.position.copy(at(t));
 g.rotation.y=Math.atan2(-d.x,-d.z);
 g.userData.trackScenery=true;
 scene.add(g);return g;
};
const mockMat=new THREE.MeshStandardMaterial({color:0x333333});
const laps=Math.ceil(L/.65);
const samples=Array.from({length:laps+1},(_,i)=>({t:i/laps,p:at(i/laps)}));
const built=buildEstate({
 THREE,scene,materials:{woodTrim:mockMat,black:mockMat},at,tangent,
 trackLength:L,frameGroup,sceneryClear:()=>true,
 lamps:[],openArea:t=>(t>.272&&t<.421)||(t>.574&&t<.735)||(t>.812&&t<.856),
 random,range,canvasTexture:()=>new THREE.Texture(),ridePathSamples:samples
});
assert.ok(built.treeCount>15,"Expected proper procedural branching forest");
assert.ok(built.environmentLength>470,"Track is unexpectedly short");
let highDetail=0,objects=0;
scene.traverse(o=>{
 if(!o.isMesh)return;
 objects++;
 if(o.geometry?.attributes?.position){
   const p=o.geometry.attributes.position.array;
   for(let i=0;i<p.length;i++)assert.ok(Number.isFinite(p[i]),"NaN in estate geometry");
   if(o.geometry.attributes.position.count>900)highDetail++;
 }
});
assert.ok(objects>60,"Missing architectural detail");
assert.ok(highDetail>=10,"Expected multi-segment tree meshes (not block trees)");
console.log("3D estate smoke test passed:",built.treeCount,"trees",objects,"meshes");


// Adjacent samples share rails intentionally; unrelated passes must never cut
// through the car or its full-height passenger envelope. The first and last
// few metres of the loop share the station and are deliberately exempt.
const checkpoints=420;
const pathSamples=Array.from({length:checkpoints+1},(_,i)=>at(i/checkpoints));
let collisions=0;
for(let i=0;i<=checkpoints;i++){
  for(let j=i+22;j<=checkpoints;j++){
    if(i<22&&j>checkpoints-22)continue;
    const a=pathSamples[i],b=pathSamples[j];
    const lateral=Math.hypot(a.x-b.x,a.z-b.z);
    const vertical=Math.abs(a.y-b.y);
    if(lateral<6.8 && vertical<4.6)collisions++;
  }
}
assert.equal(collisions,0,"Different track sections intersect the carriage clearance envelope");

// End-to-end force-based speed profile. The experience must be a COASTER,
// not a walking-speed ghost train with artificial speed assignments.
const sampleForces=t=>{
 const delta=Math.min(.0015,3/L),a=Math.max(0,t-delta),b=Math.min(1,t+delta);
 const d=tangent(t);
 const change=tangent(b).sub(tangent(a)).divideScalar(Math.max(.01,(b-a)*L));
 const side=new THREE.Vector3().crossVectors(d,new THREE.Vector3(0,1,0)).normalize();
 return {grade:d.y,verticalCurvature:change.y,lateralCurvature:change.dot(side)};
};
let simulation={distance:0,speed:0},seconds=0,top=0,stallCount=0;
while(simulation.distance<L && seconds<160){
 simulation=integrateRide(simulation,1/60,L,sampleForces);
 seconds+=1/60;
 top=Math.max(top,simulation.speed);
 if(seconds>4 && simulation.speed<.05)stallCount++;
}
assert.ok(simulation.progress>=1,"Ride didn't reach the exit");
assert.ok(seconds<80,"Ride is too slow: "+seconds.toFixed(1)+"s");
assert.ok(top>15,"No fast drops: "+(top*3.6).toFixed(1)+"km/h");
assert.ok(stallCount<6,"Ride repeatedly stalls");
console.log("Full coaster profile:",seconds.toFixed(1)+"s",Math.round(top*3.6)+"km/h peak");
