import assert from "node:assert/strict";
import * as THREE from "three";
import { buildEstate } from "../src/scenery.mjs";

const points=[
 [0,3,37],[17,3,27],[26,3,6],[23,3,-21],[11,4,-44],[32,6,-57],
 [55,14,-43],[62,21,-15],[52,17,11],[39,5,24],[19,4,37],[-6,4,40],
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
