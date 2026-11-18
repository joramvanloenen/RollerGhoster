import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { integrateRide } from "./physics.mjs";

const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const UP = new THREE.Vector3(0, 1, 0);
const YAW_AXIS = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const clock = new THREE.Clock();
let seed = 1947;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function range(a, b) { return a + (b - a) * random(); }
function choose(arr) { return arr[Math.floor(random() * arr.length)]; }

const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.37;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06090b);
scene.fog = new THREE.FogExp2(0x090e11, 0.018);
scene.add(new THREE.HemisphereLight(0x7b94aa, 0x120c0a, 0.23));
const moonlight = new THREE.DirectionalLight(0x9dbbdf, 0.43);
moonlight.position.set(-35, 42, -65);
scene.add(moonlight);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.06, 155);
const car = new THREE.Group();
scene.add(car);
car.add(camera);
camera.position.set(0, 1.53, 0.63);

const flashlightPair = [];
function flashlight(x, y, strength, angle) {
  const light = new THREE.SpotLight(0xffefce, strength, 42, angle, 0.62, 1.45);
  light.position.set(x, y, 0.03);
  const target = new THREE.Object3D();
  target.position.set(x * 0.15, -0.5, -22);
  camera.add(target);
  camera.add(light);
  light.target = target;
  flashlightPair.push({light, strength});
}
flashlight(-0.29, -0.13, 90, Math.PI / 7.1);
flashlight(0.31, -0.15, 72, Math.PI / 7.6);

const materials = {
  rail: new THREE.MeshStandardMaterial({color: 0x6e777a, metalness: 0.85, roughness: 0.33}),
  railDark: new THREE.MeshStandardMaterial({color: 0x22282a, metalness: 0.76, roughness: 0.52}),
  sleeper: new THREE.MeshStandardMaterial({color: 0x322d2a, roughness: 0.94}),
  iron: new THREE.MeshStandardMaterial({color: 0x242b30, metalness: 0.83, roughness: 0.44}),
  rustyIron: new THREE.MeshStandardMaterial({color: 0x4c2922, metalness: 0.64, roughness: 0.72}),
  stone: new THREE.MeshStandardMaterial({color: 0x333739, roughness: 0.99}),
  stoneTrim: new THREE.MeshStandardMaterial({color: 0x494948, roughness: 0.99}),
  black: new THREE.MeshStandardMaterial({color: 0x0c1012, roughness: 0.98}),
  wood: new THREE.MeshStandardMaterial({color: 0x342722, roughness: 0.93}),
  woodTrim: new THREE.MeshStandardMaterial({color: 0x554034, roughness: 0.9}),
  bone: new THREE.MeshStandardMaterial({color: 0xb8b5a5, roughness: 0.9}),
  candle: new THREE.MeshBasicMaterial({color: 0xffbd79}),
  red: new THREE.MeshBasicMaterial({color: 0xae281d}),
  velvet: new THREE.MeshStandardMaterial({color: 0x36141a, roughness: 1}),
  moon: new THREE.MeshBasicMaterial({color: 0xc2daef}),
  fog: new THREE.MeshBasicMaterial({color: 0x9cb2b7, transparent:true, opacity:0.035, depthWrite:false, side: THREE.DoubleSide})
};
const boxCache = new Map();
function boxGeo(w,h,d) {
  const key = [w,h,d].join(":");
  if (!boxCache.has(key)) boxCache.set(key, new THREE.BoxGeometry(w,h,d));
  return boxCache.get(key);
}
function cube(parent, mat, w,h,d, x=0,y=0,z=0) {
  const mesh = new THREE.Mesh(boxGeo(w,h,d), mat);
  mesh.position.set(x,y,z);
  if(sceneryClear(parent,x,y,z,w,h,d))parent.add(mesh);
  return mesh;
}
function cylinder(parent, mat, radiusTop, radiusBot, height, x,y,z, sides=8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop,radiusBot,height,sides),mat);
  m.position.set(x,y,z);
  if(sceneryClear(parent,x,y,z,Math.max(radiusTop,radiusBot)*2,height,Math.max(radiusTop,radiusBot)*2))parent.add(m);
  return m;
}
function sphere(parent, mat, radius, x,y,z, width=12, height=8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius,width,height),mat);
  m.position.set(x,y,z);
  if(sceneryClear(parent,x,y,z,radius*2,radius*2,radius*2))parent.add(m);
  return m;
}
function lineTube(parent, pts, radius, mat) {
  const path = new THREE.CatmullRomCurve3(pts);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(4, pts.length*3), radius, 5, false), mat);
  parent.add(mesh);
  return mesh;
}
function canvasTexture(paint, w=256, h=256) {
  const c = document.createElement("canvas");
  c.width=w; c.height=h;
  const ctx=c.getContext("2d");
  paint(ctx,w,h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
const brickTexture = canvasTexture((ctx,w,h)=>{
  ctx.fillStyle="#414344"; ctx.fillRect(0,0,w,h);
  for(let row=0;row<8;row++){
    const shift=row%2?16:0;
    for(let col=-1;col<6;col++){
      const x=col*55-shift, y=row*33;
      ctx.fillStyle="rgb("+Math.floor(range(49,75))+","+Math.floor(range(49,74))+","+Math.floor(range(48,71))+")";
      ctx.fillRect(x+2,y+2,52,30);
      ctx.fillStyle="rgba(0,0,0,.22)";ctx.fillRect(x+2,y+29,52,3);
      for(let k=0;k<9;k++){
        ctx.fillStyle="rgba(0,0,0,"+range(.02,.2)+")";
        ctx.fillRect(x+range(0,50),y+range(2,30),range(2,19),1);
      }
    }
  }
});
materials.brick = new THREE.MeshStandardMaterial({map:brickTexture,color:0xb9b9b3,roughness:1});
const portraitTexture = canvasTexture((c,w,h)=>{
  c.fillStyle="#181618";c.fillRect(0,0,w,h);
  let grd=c.createRadialGradient(127,100,10,128,130,145);
  grd.addColorStop(0,"#604b48");grd.addColorStop(.6,"#211f22");grd.addColorStop(1,"#080a0d");
  c.fillStyle=grd;c.fillRect(8,8,240,240);
  c.fillStyle="#16151b";c.beginPath();c.ellipse(127,258,88,132,0,0,Math.PI*2);c.fill();
  c.fillStyle="#5b5953";c.beginPath();c.ellipse(126,114,51,72,0,0,Math.PI*2);c.fill();
  c.fillStyle="#30272b";c.beginPath();c.ellipse(125,71,57,44,0,Math.PI,Math.PI*2);c.fill();
  c.fillStyle="#09090a";c.beginPath();c.ellipse(109,112,10,13,0,0,Math.PI*2);c.ellipse(145,112,10,13,0,0,Math.PI*2);c.fill();
  c.fillRect(111,162,34,5);
  c.strokeStyle="#786d57";c.lineWidth=3;c.strokeRect(10,10,236,236);
});
const sigilTexture = canvasTexture((c,w,h)=>{
  c.clearRect(0,0,w,h);
  c.strokeStyle="#ab443a";c.lineWidth=3;c.beginPath();c.arc(128,128,103,0,Math.PI*2);c.stroke();
  c.beginPath();c.moveTo(128,31);c.lineTo(43,180);c.lineTo(211,180);c.closePath();c.stroke();
  c.beginPath();c.moveTo(30,128);c.lineTo(226,128);c.moveTo(128,30);c.lineTo(128,226);c.stroke();
});
const ghostTexture = canvasTexture((c,w,h)=>{
  c.clearRect(0,0,w,h);
  const aura = c.createRadialGradient(128,115,1,128,130,125);
  aura.addColorStop(0,"rgba(220,231,232,.9)");aura.addColorStop(.46,"rgba(171,195,203,.5)");
  aura.addColorStop(1,"rgba(122,166,188,0)");
  c.fillStyle=aura;c.fillRect(0,0,w,h);
  c.fillStyle="#c0d7d7";c.beginPath();c.ellipse(128,103,44,61,0,0,Math.PI*2);c.fill();
  c.fillStyle="#8aabab";c.beginPath();c.moveTo(86,126);c.quadraticCurveTo(55,183,68,248);c.quadraticCurveTo(102,224,128,248);c.quadraticCurveTo(161,221,186,248);c.quadraticCurveTo(196,187,167,126);c.closePath();c.fill();
  c.fillStyle="#10141b";c.beginPath();c.ellipse(110,98,14,21,-.2,0,Math.PI*2);c.ellipse(148,98,14,21,.2,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(129,147,10,20,0,0,Math.PI*2);c.fill();
});
const scareTexture = canvasTexture((c,w,h)=>{
  c.clearRect(0,0,w,h);
  const aura = c.createRadialGradient(128,145,25,128,138,128);
  aura.addColorStop(0,"rgba(211,210,200,1)");aura.addColorStop(.62,"rgba(131,138,132,.98)");aura.addColorStop(1,"rgba(20,26,27,0)");
  c.fillStyle=aura;c.fillRect(0,0,w,h);
  c.fillStyle="#babcb2";c.beginPath();c.moveTo(65,84);c.bezierCurveTo(55,18,192,10,193,88);c.bezierCurveTo(186,172,177,207,128,243);c.bezierCurveTo(74,199,70,158,65,84);c.fill();
  c.fillStyle="#242322";c.beginPath();c.moveTo(56,65);c.lineTo(70,19);c.lineTo(91,33);c.lineTo(125,11);c.lineTo(173,30);c.lineTo(203,9);c.lineTo(197,77);c.closePath();c.fill();
  c.fillStyle="#050607";c.beginPath();c.ellipse(94,115,23,31,-.3,0,Math.PI*2);c.ellipse(161,113,23,31,.3,0,Math.PI*2);c.fill();
  c.fillStyle="#ff3c28";c.beginPath();c.arc(95,116,4,0,Math.PI*2);c.arc(161,114,4,0,Math.PI*2);c.fill();
  c.fillStyle="#0a0708";c.beginPath();c.moveTo(93,174);c.quadraticCurveTo(128,155,161,174);c.quadraticCurveTo(163,220,129,235);c.quadraticCurveTo(95,214,93,174);c.fill();
  c.strokeStyle="#ddd2bc";c.lineWidth=3;for(let i=0;i<7;i++){let x=99+i*9;c.beginPath();c.moveTo(x,174);c.lineTo(x+1,187);c.stroke();}
  c.strokeStyle="rgba(68,14,16,.6)";c.lineWidth=5;c.beginPath();c.moveTo(77,118);c.lineTo(63,162);c.lineTo(74,193);c.moveTo(176,104);c.lineTo(197,170);c.stroke();
},256,256);

const pathPoints = [
  [0,3,37], [0,3,23], [0,3,3], [0,3,-24],
  [11,4,-44], [32,6,-57], [55,14,-43], [62,21,-15],
  [52,17,11], [39,5,24], [19,4,37], [-6,4,40],
  [-31,4,31], [-49,9,17], [-57,20,-8], [-45,17,-31],
  [-31,5,-53], [-13,3,-46], [0,3,-28], [2,3,-5],
  [1,3,17], [0,3,37]
].map(v=>new THREE.Vector3(...v));
const track = new THREE.CatmullRomCurve3(pathPoints, false, "catmullrom", 0.22);
track.arcLengthDivisions = 1000;
const trackLength = track.getLength();
function at(t) { return track.getPointAt(clamp(t,0,1)); }
function tangent(t) { return track.getTangentAt(clamp(t,0,1)).normalize(); }
function frameGroup(t, side=0) {
  const p=at(t), d=tangent(t);
  const g=new THREE.Group();
  g.position.copy(p);
  g.rotation.y = Math.atan2(-d.x,-d.z);
  if(side)g.translateX(side);
  g.userData.trackScenery=true;
  scene.add(g);
  return g;
}
function chapterAt(t) {
  if(t<.18)return 0;
  if(t<.37)return 1;
  if(t<.52)return 2;
  if(t<.66)return 3;
  if(t<.84)return 4;
  return 5;
}
const chapters=[
  {title:"THE BOARDING HOUSE",subtitle:"THE GATES NEVER OPEN TWICE",sector:"THE STATION"},
  {title:"THE WATCHING GALLERY",subtitle:"THE PORTRAITS ARE NOT PAINTINGS",sector:"GALLERY"},
  {title:"THE FORGOTTEN NURSERY",subtitle:"HUSH. IT'S TRYING TO SLEEP",sector:"NURSERY"},
  {title:"THE BLACKTHORN DROP",subtitle:"THERE IS NO BRAKE IN THE DARK",sector:"THE DROP"},
  {title:"THE FAMILY CRYPT",subtitle:"SOMEONE IS WAITING BELOW",sector:"CRYPT"},
  {title:"THE LAST EXIT",subtitle:"DO NOT TRUST THE EXIT SIGNS",sector:"EXIT"}
];
function openArea(t) { return (t>.295&&t<.365)||(t>.535&&t<.648); }

// Check hard scenery against the swept passenger envelope on EVERY part
// of the track: the circuit passes close to itself in a few places.
const ridePathSamples=Array.from({length:Math.ceil(trackLength/.65)+1},(_,i)=>{
  const t=i/Math.ceil(trackLength/.65);
  return {t,p:at(t)};
});
function rideVolumeOverlaps(parent,x,y,z,w,h,d) {
  const angle=parent.rotation.y, cos=Math.cos(angle),sin=Math.sin(angle);
  const hx=w/2,hy=h/2,hz=d/2;
  for(const {p} of ridePathSamples) {
    const dx=p.x-parent.position.x,dz=p.z-parent.position.z;
    const lx=cos*dx-sin*dz,lz=sin*dx+cos*dz;
    const horizontal=Math.hypot(Math.max(0,Math.abs(lx-x)-hx),Math.max(0,Math.abs(lz-z)-hz));
    if(horizontal>1.9)continue;
    const ly=p.y-parent.position.y;
    if(ly+3.2>=y-hy && ly-.55<=y+hy)return true;
  }
  return false;
}
function sceneryClear(parent,x,y,z,w,h,d) {
  return !parent.userData.trackScenery || !rideVolumeOverlaps(parent,x,y,z,w,h,d);
}
function worldSupportClear(p,t,radius,height) {
  for(const s of ridePathSamples) {
    if(Math.abs(s.t-t)<.016)continue;
    if(Math.hypot(s.p.x-p.x,s.p.z-p.z)<radius+1.85 &&
       s.p.y+3.2>p.y-height && s.p.y-.55<p.y)return false;
  }
  return true;
}

function buildTrack() {
  const left=[],right=[],center=[];
  const steps = Math.max(240,Math.ceil(trackLength/1.2));
  for(let i=0;i<=steps;i++){
    const t=i/steps,p=at(t),dir=tangent(t);
    const side=new THREE.Vector3().crossVectors(dir,UP).normalize();
    const centerP=p.clone().addScaledVector(UP,-.18);
    left.push(centerP.clone().addScaledVector(side,-.74));
    right.push(centerP.clone().addScaledVector(side,.74));
    center.push(centerP);
  }
  for(const arr of [left,right]){
    const smooth=new THREE.CatmullRomCurve3(arr,false,"centripetal");
    const rail=new THREE.Mesh(new THREE.TubeGeometry(smooth,steps,0.085,7,false),materials.rail);
    scene.add(rail);
  }
  const beamCurve=new THREE.CatmullRomCurve3(center,false,"centripetal");
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(beamCurve,steps,0.09,5,false),materials.railDark));
  const sleeperGeo=boxGeo(2.35,.16,.33);
  const sleeperCount=Math.floor(trackLength/2.25);
  for(let i=0;i<=sleeperCount;i++){
    const t=i/sleeperCount, p=at(t),dir=tangent(t);
    const m=new THREE.Mesh(sleeperGeo,materials.sleeper);
    m.position.copy(p).addScaledVector(UP,-.34);
    m.rotation.y=Math.atan2(-dir.x,-dir.z);
    m.rotation.x=Math.asin(clamp(dir.y,-.85,.85));
    scene.add(m);
    if(i%5===0){
      const footY=openArea(t)?-2:-1.6;
      const supportHeight=Math.max(.1,p.y-footY-.4);
      if(worldSupportClear(p,t,.2,supportHeight)){
        cylinder(scene,materials.rustyIron,.115,.17,supportHeight,p.x,p.y-.35-supportHeight/2,p.z,6);
        if(openArea(t))cube(scene,materials.stone,1.2,.28,1.2,p.x,footY-.15,p.z);
      }
    }
  }
}
function makeLamp(g, x, y, z, realLight=false) {
  cube(g,materials.iron,.08,1.5,.09,x,y+.75,z);
  cube(g,materials.iron,.64,.09,.64,x,y,z);
  cube(g,materials.iron,.48,.09,.48,x,y+.65,z);
  cube(g,materials.candle,.25,.43,.25,x,y+.33,z);
  if(realLight){
    const lamp=new THREE.PointLight(0xffac71,2.0,14,2.1);
    lamp.position.set(x,y+.36,z);
    g.add(lamp);
    return lamp;
  }
  return null;
}
const lamps=[];
const doors=[];
const ghosts=[];
const embers=[];
function buildWorld() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(230,230),new THREE.MeshStandardMaterial({color:0x101519,roughness:1}));
  ground.rotation.x=-Math.PI/2;
  ground.position.y=-2.17;
  scene.add(ground);
  const roofCount=Math.max(1,Math.floor(trackLength/6));
  for(let i=0;i<roofCount;i++){
    const t=(i+.5)/roofCount;
    const root=frameGroup(t);
    const wood=t<.2||t>.85;
    const crypt=t>.67&&t<.86;
    const wall=wood?materials.wood:crypt?materials.stone:materials.brick;
    const trim=wood?materials.woodTrim:materials.stoneTrim;
    if(!openArea(t)){
      cube(root,materials.stone,13.4,.28,6.55,0,-1.83,0);
      cube(root,wall,.54,8.9,6.6,-6.65,2.55,0);
      cube(root,wall,.54,8.9,6.6,6.65,2.55,0);
      cube(root,wall,13.7,.52,6.58,0,7.23,0);
      if(i%2===0){
        for(const side of [-1,1]){
          cube(root,trim,.8,8.7,.9,side*6.25,2.44,-2.82);
          cube(root,materials.black,1.1,3.7,.22,side*6.21,1.9,0);
          cube(root,trim,.26,4.2,.26,side*6.04,1.9,-2.35);
          cube(root,trim,.26,4.2,.26,side*6.04,1.9,2.35);
        }
        cube(root,trim,13.55,.65,.78,0,6.6,-2.85);
        cylinder(root,materials.iron,.09,.09,1.5,0,6.15,-2.85,6);
      }
      if(i%8===2){
        const x=i%16===2?-4.35:4.35;
        const lamp=makeLamp(root,x,4.95,-.8,lamps.length<11);
        if(lamp)lamps.push({light:lamp,base:lamp.intensity,phase:range(0,12)});
      }
      if(wood&&i%3===0) {
        for(const side of [-1,1]){
          cube(root,materials.woodTrim,.1,5.4,3.65,side*6.18,2.15,0);
          cube(root,materials.wood,.13,4.9,3.25,side*6.10,2.15,0);
        }
      }
      if(crypt&&i%3===1){
        const side=i%2===0?1:-1;
        cube(root,materials.black,.24,3.8,2.7,side*6.08,2.0,0);
        const sigil=new THREE.Mesh(new THREE.PlaneGeometry(2.0,2.0),new THREE.MeshBasicMaterial({map:sigilTexture,transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false}));
        sigil.position.set(side*5.9,2.4,0);
        sigil.rotation.y=Math.PI/2;
        root.add(sigil);
      }
    }else{
      if(i%3===0){
        for(const side of [-1,1]){
          const x=side*6.1, y=-.4;
          cylinder(root,materials.stone,.43,.59,range(4,7),x,y,0,6);
          if(random()>.35){
            const cross=cube(root,materials.stoneTrim,.39,2.3,.35,side*8.0,-.55,range(-2,2));
            cube(root,materials.stoneTrim,1.4,.36,.34,cross.position.x,.04,cross.position.z);
          }
        }
      }
    }
  }
  const moon=sphere(scene,materials.moon,5,-78,52,-100,24,16);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTexture((c,w,h)=>{
    const g=c.createRadialGradient(128,128,12,128,128,128);
    g.addColorStop(0,"rgba(160,191,215,.35)");g.addColorStop(1,"rgba(160,191,215,0)");
    c.fillStyle=g;c.fillRect(0,0,w,h);
  }),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  halo.position.copy(moon.position);halo.scale.set(45,45,1);scene.add(halo);
  for(let i=0;i<38;i++){
    const t=(i+.5)/38;
    if(!openArea(t))continue;
    const root=frameGroup(t);
    for(const side of [-1,1]){
      const x=side*range(10,19), z=range(-5,5);
      const trunk=cylinder(root,materials.black,.13,.32,range(7,13),x,3,z,6);
      trunk.rotation.z=range(-.17,.17);
      for(let b=0;b<3;b++){
        const branch=cylinder(root,materials.black,.05,.11,range(3,6),x+range(-2,2),6+range(0,5),z+range(-2,2),5);
        branch.rotation.z=range(-1,1);
      }
    }
  }
  // Cast shadows as architecture, not as a flat painted backdrop.
  for(let i=0;i<46;i++){
    const t=range(.01,.99);
    const root=frameGroup(t,range(-2.5,2.5));
    const fog=new THREE.Mesh(new THREE.PlaneGeometry(range(5,11),range(2,5)),materials.fog);
    fog.rotation.x=-Math.PI/2;fog.position.y=-1.0;root.add(fog);
  }
  // Dust visible in the cone of the carriage lamps.
  const particles=new Float32Array(540*3);
  for(let i=0;i<540;i++){particles[i*3]=range(-80,80);particles[i*3+1]=range(0,27);particles[i*3+2]=range(-80,65);}
  const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.BufferAttribute(particles,3));
  scene.add(new THREE.Points(pg,new THREE.PointsMaterial({color:0xb9a898,size:.08,transparent:true,opacity:.43,depthWrite:false})));
}
function portrait(t, side) {
  const g=frameGroup(t);
  if(!sceneryClear(g,side*5.76,2.7,0,.8,4.7,3.7))return;
  const x=side*5.76;
  cube(g,materials.woodTrim,.28,4.55,3.4,x,2.7,0);
  const p=new THREE.Mesh(new THREE.PlaneGeometry(3.1,4.2),new THREE.MeshBasicMaterial({map:portraitTexture,side:THREE.DoubleSide}));
  p.rotation.y=Math.PI/2;p.position.set(x-side*.19,2.7,0);g.add(p);
  for(const z of [-1.77,1.77])cube(g,materials.woodTrim,.38,4.75,.23,x-side*.15,2.7,z);
  cube(g,materials.woodTrim,.38,.3,3.65,x-side*.15,5.04,0);
}
function ghost(t, side, scale=1.2) {
  const g=frameGroup(t);
  const material=new THREE.MeshBasicMaterial({map:ghostTexture,transparent:true,opacity:.03,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.8*scale,3.3*scale),material);
  mesh.position.set(side*range(2.8,5.2),range(1.3,3.2),range(-2,2));
  g.add(mesh);
  ghosts.push({mesh,originY:mesh.position.y,phase:range(0,7),at:t,material,scale});
}
function coffin(t,side) {
  const g=frameGroup(t);
  if(!sceneryClear(g,side*4,-.7,0,3,2,4.3))return;
  const x=side*4.0;
  const base=cube(g,materials.wood,2.15,.72,3.4,x,-1.08,0);
  base.rotation.y=range(-.5,.5);
  const lid=cube(g,materials.woodTrim,2.36,.18,3.55,x,-.59,0);
  lid.rotation.z=side*.1;lid.rotation.y=base.rotation.y;
  cube(g,materials.rustyIron,.11,.12,3.0,x,-.47,0);
  sphere(g,materials.bone,.18,x,-.11,-.65);
}
function sculpture(t,side) {
  const g=frameGroup(t);
  if(!sceneryClear(g,side*4.2,1.5,0,2.8,6.2,2.9))return;
  const x=side*4.2;
  cube(g,materials.stoneTrim,2.1,.6,2.1,x,-1.39,0);
  cube(g,materials.stone,1.2,3.1,1.2,x,.55,0);
  const shroud=new THREE.Mesh(new THREE.ConeGeometry(1.0,3.2,7),materials.stone);
  shroud.position.set(x,3.0,0);g.add(shroud);
  sphere(g,materials.bone,.53,x,4.18,-.14);
  const eyeMat=materials.red;
  sphere(g,eyeMat,.078,x-.17,4.24,-.62,6,5);
  sphere(g,eyeMat,.078,x+.17,4.24,-.62,6,5);
}
function nursery(t,side) {
  const g=frameGroup(t);
  if(!sceneryClear(g,side*3.6,0,0,3.3,2.7,2.3))return;
  const x=side*3.6;
  cube(g,materials.woodTrim,2.7,.23,1.4,x,-.6,0);
  for(const sx of [-1,1]){
    cube(g,materials.wood,.18,2.15,.18,x+sx*1.27,.25,-.57);
    cube(g,materials.wood,.18,2.15,.18,x+sx*1.27,.25,.57);
  }
  for(let j=0;j<11;j++){
    cube(g,materials.wood,.09,1.45,.1,x-1.15+j*.23,.1,-.6);
    cube(g,materials.wood,.09,1.45,.1,x-1.15+j*.23,.1,.6);
  }
  const doll=sphere(g,materials.bone,.25,x,-.14,0);
  doll.position.y=0;
  sphere(g,materials.black,.045,x-.08,.05,-.22,6,5);
  sphere(g,materials.black,.045,x+.08,.05,-.22,6,5);
}
function doorsAt(t) {
  const g=frameGroup(t);
  cube(g,materials.stoneTrim,7.4,.58,1.7,0,5.3,0);
  for(const s of [-1,1]){
    cube(g,materials.stoneTrim,.65,6.4,1.75,s*3.55,2.0,0);
    const pivot=new THREE.Group();
    pivot.position.set(s*3.25,0,0);g.add(pivot);
    cube(pivot,materials.woodTrim,3.15,5.4,.32,-s*1.58,1.03,0);
    cube(pivot,materials.iron,2.45,4.6,.05,-s*1.58,1.03,-.19);
    sphere(pivot,materials.rail,.09,-s*2.7,1.1,-.25);
    doors.push({pivot,t,side:s});
  }
}
function signAt(t) {
  const g=frameGroup(t);
  cube(g,materials.iron,9,.21,.35,0,5.7,0);
  for(const side of [-1,1])cube(g,materials.iron,.3,6.5,.35,side*4.65,2.5,0);
  const texture=canvasTexture((c,w,h)=>{
    c.fillStyle="#121310";c.fillRect(0,0,w,h);
    c.strokeStyle="#aa7d5b";c.lineWidth=9;c.strokeRect(7,7,w-14,h-14);
    c.textAlign="center";c.fillStyle="#c0a08b";c.font="bold 27px Georgia";c.fillText("BLACKTHORN",w/2,98);
    c.font="16px Georgia";c.fillText("ESTATE — 1967",w/2,128);
    c.fillStyle="#8d4034";c.font="bold 12px Georgia";c.fillText("NO RETURN",w/2,168);
  },350,200);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(5.6,2.6),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  panel.position.set(0,4.9,0);g.add(panel);
}
function setpieces() {
  signAt(.014);
  portrait(.074,-1);portrait(.108,1);portrait(.149,-1);
  portrait(.202,1);portrait(.235,-1);portrait(.27,1);
  ghost(.157,1,1.05);ghost(.29,-1,1.3);
  sculpture(.21,-1);sculpture(.264,1);
  nursery(.392,1);nursery(.435,-1);nursery(.47,1);
  ghost(.417,-1,1.0);ghost(.486,1,1.45);
  coffin(.68,1);coffin(.715,-1);coffin(.755,1);coffin(.802,-1);
  sculpture(.69,-1);sculpture(.795,1);
  ghost(.74,-1,1.45);ghost(.82,1,1.7);
  portrait(.87,-1);portrait(.9,1);
  ghost(.927,-1,1.9);
  doorsAt(.328);doorsAt(.585);doorsAt(.857);
  for(let i=0;i<38;i++){
    const t=range(0,1);
    const g=frameGroup(t);
    const side=random()<.5?-1:1;
    if(openArea(t)){
      const x=side*range(7.5,12);
      const grave=cube(g,materials.stoneTrim,range(.6,1.5),range(1,2),.24,x,-.8,range(-3,3));
      grave.rotation.z=range(-.2,.2);
    } else if(random()>.5) {
      cube(g,materials.rustyIron,.07,range(1.5,5),.07,side*5.6,range(3,5),range(-3,3));
    }
  }
}
function buildCar() {
  cube(car,materials.iron,2.5,.42,3.0,0,-.13,.05);
  cube(car,materials.wood,2.2,.12,1.45,0,.13,.65);
  cube(car,materials.rustyIron,2.25,.21,.19,0,.67,-.72);
  for(const s of [-1,1]){
    cube(car,materials.railDark,.19,.8,2.65,s*1.16,.36,-.13);
    cube(car,materials.rail,.13,.13,2.7,s*1.12,1.05,-.18);
    cube(car,materials.iron,.14,.97,.14,s*1.14,.56,-1.28);
    cube(car,materials.rustyIron,.17,.17,.17,s*.9,.65,-.73);
  }
  cube(car,materials.rail,.15,.15,2.45,0,1.06,-1.28).rotation.y=Math.PI/2;
  cube(car,materials.iron,2.4,.3,.22,0,.18,-1.37);
  // Car-mounted instrument, intentionally tiny in the player's field of view.
  cube(car,materials.black,.6,.28,.12,0,.62,-1.26);
  for(let i=0;i<3;i++)sphere(car,i===0?materials.red:materials.candle,.025,(i-1)*.15,.69,-1.34,6,5);
  const sideBar=cube(car,materials.iron,.11,.9,.11,0,.62,1.28);
  sideBar.visible=false;
}
buildTrack();
buildWorld();
setpieces();
buildCar();

const scareMaterial=new THREE.MeshBasicMaterial({map:scareTexture,transparent:true,opacity:0,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
const scareFace=new THREE.Mesh(new THREE.PlaneGeometry(2.65,2.65),scareMaterial);
scareFace.position.set(0,-.02,-2.1);
scareFace.renderOrder=1001;
scareFace.visible=false;
camera.add(scareFace);

const state={
  progress:0,distance:0,speed:0,time:0,playing:false,paused:false,done:false,
  forces:{acceleration:0,totalG:1,verticalG:1,lateralG:0,braking:0,traction:0,mode:"drive"},
  soundOn:true,lightsOn:true,scareLevel:"full",scares:0,chapter:-1,
  chapterHold:0,whisperHold:0,scareTime:0,scareDuration:.8,scareFlicker:0,
  viewYaw:0,viewPitch:0,dragging:false,lastInput:0,motionReduced:window.matchMedia("(prefers-reduced-motion: reduce)").matches
};
const scareBeats=[
  {at:.174,message:"IT FOUND YOU",kind:0},
  {at:.472,message:"WAKE UP",kind:1},
  {at:.755,message:"DON'T LOOK",kind:0},
  {at:.916,message:"YOU BELONG HERE",kind:1}
];
const whispers=[
  {at:.048,text:"KEEP YOUR HANDS INSIDE THE CAR"},
  {at:.139,text:"...DO YOU HEAR BREATHING?"},
  {at:.344,text:"SOMETHING MOVED BEHIND YOU"},
  {at:.409,text:"PLEASE DON'T WAKE HER"},
  {at:.684,text:"THIS HOUSE KNOWS YOUR NAME"},
  {at:.875,text:"THERE WAS NEVER AN EXIT"}
];
const playedScares=new Set(), playedWhispers=new Set();
// Signed curvature in 1/metre and track grade for the force integrator.
function sampleTrackForces(t) {
  const eps=Math.min(.0015,3/trackLength);
  const a=Math.max(0,t-eps),b=Math.min(1,t+eps);
  const dir=tangent(t);
  const derivative=tangent(b).sub(tangent(a)).divideScalar(Math.max(.01,(b-a)*trackLength));
  const lateral=new THREE.Vector3().crossVectors(dir,UP).normalize();
  return {grade:dir.y,verticalCurvature:derivative.y,lateralCurvature:derivative.dot(lateral)};
}
function formatTime(s) {
  const time=Math.max(0,Math.floor(s));
  return String(Math.floor(time/60)).padStart(2,"0")+":"+String(time%60).padStart(2,"0");
}
class Soundscape {
  constructor() {this.context=null;this.master=null;this.rolling=null;this.drone=null;}
  init(){
    if(this.context){this.context.resume();return;}
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    const ctx=new Audio();
    this.context=ctx;
    this.master=ctx.createGain();this.master.gain.value=.6;this.master.connect(ctx.destination);
    const low=ctx.createBiquadFilter();low.type="lowpass";low.frequency.value=240;low.connect(this.master);
    for(const [freq,type,gain] of [[42,"sine",.055],[55,"sawtooth",.018],[84,"sine",.016]]){
      const osc=ctx.createOscillator();osc.type=type;osc.frequency.value=freq;
      const amp=ctx.createGain();amp.gain.value=gain;
      osc.connect(amp);amp.connect(low);osc.start();
      if(freq===42)this.drone=osc;
    }
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const rumbleFilter=ctx.createBiquadFilter();rumbleFilter.type="lowpass";rumbleFilter.frequency.value=160;
    this.rolling=ctx.createGain();this.rolling.gain.value=.01;
    noise.connect(rumbleFilter);rumbleFilter.connect(this.rolling);this.rolling.connect(this.master);noise.start();
    this.setEnabled(state.soundOn);
  }
  setEnabled(on){
    if(!this.context||!this.master)return;
    this.master.gain.setTargetAtTime(on?.62:0,this.context.currentTime,.065);
  }
  tick(speed,progress){
    if(!this.context)return;
    this.rolling.gain.setTargetAtTime(.017+speed*.004,this.context.currentTime,.15);
    if(this.drone)this.drone.frequency.setTargetAtTime(43+Math.sin(progress*35)*3,this.context.currentTime,.2);
  }
  tone(freq,seconds=.5,volume=.1,type="sine"){
    if(!this.context||!state.soundOn)return;
    const ctx=this.context, now=ctx.currentTime;
    const osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.4),now+seconds);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(Math.max(.002,volume),now+.023);
    gain.gain.exponentialRampToValueAtTime(.0001,now+seconds);
    osc.connect(gain);gain.connect(this.master);osc.start(now);osc.stop(now+seconds+.02);
  }
  sting(){
    this.tone(880,.8,.3,"sawtooth");
    this.tone(137,.95,.34,"square");
    this.tone(1970,.27,.18,"sawtooth");
    this.tone(66,1,.25,"sine");
  }
  whisper(){this.tone(295,.6,.04,"sine");}
}
const audio=new Soundscape();
function showChapter(index){
  const c=chapters[index];
  $("chapterNumber").textContent=String(index+1).padStart(2,"0")+" / 06";
  $("chapterName").textContent=c.title;
  $("chapterHint").textContent=c.subtitle;
  $("sectorValue").textContent=c.sector;
  $("chapterCard").classList.add("visible");
  state.chapterHold=5;
}
function whisper(text){
  $("whisper").textContent=text;
  $("whisper").classList.add("visible");
  state.whisperHold=3.8;
  audio.whisper();
}
function jumpScare(beat){
  if(state.scareLevel==="low"&&beat.kind===1)return;
  state.scareTime=state.scareDuration;
  state.scareFlicker=1.8;
  state.scares++;
  scareFace.visible=true;
  $("scareMessage").textContent=beat.message;
  $("scareMessage").classList.add("visible");
  $("scareMessage").setAttribute("aria-hidden","false");
  $("scareFlash").classList.add("active");
  audio.sting();
}
function updateScare(dt){
  if(state.scareTime>0){
    state.scareTime=Math.max(0,state.scareTime-dt);
    const f=1-state.scareTime/state.scareDuration;
    scareMaterial.opacity=Math.min(1,Math.sin(Math.PI*Math.pow(f,.5))*1.55);
    scareFace.scale.setScalar(lerp(.62,1.65,f));
    scareFace.position.x=Math.sin(f*66)*.11;
    scareFace.position.y=Math.cos(f*44)*.08;
    if(f>.1)$("scareFlash").classList.remove("active");
    if(f>.55)$("scareMessage").classList.remove("visible");
    if(state.scareTime<=0){
      scareFace.visible=false;
      $("scareMessage").classList.remove("visible");
      $("scareMessage").setAttribute("aria-hidden","true");
    }
  }
  state.scareFlicker=Math.max(0,state.scareFlicker-dt);
}
function updateHud(){
  $("speedValue").textContent=String(Math.round(state.speed*3.6)).padStart(2,"0");
  $("timeValue").textContent=formatTime(state.time);
  $("progressValue").textContent=String(Math.floor(state.progress*100)).padStart(2,"0")+"%";
  $("progressFill").style.width=(state.progress*100).toFixed(2)+"%";
  $("gValue").textContent=state.forces.totalG.toFixed(1);
}
function finish(){
  if(state.done)return;
  state.done=true;state.playing=false;state.paused=false;
  $("endTime").textContent=formatTime(state.time);
  $("endScares").textContent=String(state.scares).padStart(2,"0");
  $("endScreen").classList.remove("is-hidden");
  $("liveIndicator").querySelector("span").textContent="RIDE COMPLETE";
  audio.tone(190,1.9,.1,"sine");
}
function reset(){
  state.progress=0;state.distance=0;state.speed=0;state.time=0;
  state.forces={acceleration:0,totalG:1,verticalG:1,lateralG:0,braking:0,traction:0,mode:"drive"};
  state.done=false;state.paused=false;state.playing=true;state.scares=0;
  state.scareTime=0;state.scareFlicker=0;state.viewYaw=0;state.viewPitch=0;
  state.chapter=-1;state.chapterHold=0;state.whisperHold=0;
  playedScares.clear();playedWhispers.clear();
  scareFace.visible=false;
  $("scareMessage").classList.remove("visible");
  $("scareFlash").classList.remove("active");
  $("whisper").classList.remove("visible");
  $("endScreen").classList.add("is-hidden");
  $("welcome").classList.add("is-hidden");
  $("liveIndicator").classList.add("riding");
  $("liveIndicator").querySelector("span").textContent="RIDE IN PROGRESS";
  $("pauseButton").classList.remove("is-active");
  $("pauseButton").title="Pause ride (Space)";
  audio.init();audio.lastDistance=0;audio.setPaused(false);audio.setEnabled(state.soundOn);
  updateHud();
}
function toggleLight(){
  state.lightsOn=!state.lightsOn;
  $("lampButton").classList.toggle("is-active",state.lightsOn);
  $("lampButton").setAttribute("aria-pressed",String(state.lightsOn));
}
function toggleSound(){
  state.soundOn=!state.soundOn;
  $("soundButton").classList.toggle("is-active",state.soundOn);
  $("soundButton").setAttribute("aria-pressed",String(state.soundOn));
  audio.setEnabled(state.soundOn);
}
function togglePause(){
  if(!state.playing||state.done)return;
  state.paused=!state.paused;
  $("pauseButton").classList.toggle("is-active",state.paused);
  $("pauseButton").querySelector("span").textContent=state.paused?"RESUME":"PAUSE";
  $("pauseButton").title=state.paused?"Resume ride (Space)":"Pause ride (Space)";
  $("liveIndicator").querySelector("span").textContent=state.paused?"RIDE PAUSED":"RIDE IN PROGRESS";
  audio.setPaused(state.paused);
}
$("startRide").addEventListener("click",reset);
$("rideAgain").addEventListener("click",reset);
$("lampButton").addEventListener("click",toggleLight);
$("soundButton").addEventListener("click",toggleSound);
$("pauseButton").addEventListener("click",togglePause);
$("scareLevel").addEventListener("click",()=>{
  state.scareLevel=state.scareLevel==="full"?"low":"full";
  $("levelValue").innerHTML=state.scareLevel==="full"?"FULL <span>⌄</span>":"MILD <span>⌄</span>";
});
window.addEventListener("keydown",e=>{
  if(e.repeat)return;
  if(e.code==="KeyF")toggleLight();
  else if(e.code==="KeyM")toggleSound();
  else if(e.code==="Space"){e.preventDefault();togglePause();}
  else if(e.code==="KeyR"&&state.playing)reset();
});
let pointer=null;
canvas.addEventListener("pointerdown",e=>{
  if(!state.playing||state.paused)return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
  state.dragging=true;
  try{canvas.setPointerCapture(e.pointerId);}catch(err){}
});
canvas.addEventListener("pointermove",e=>{
  if(!pointer||e.pointerId!==pointer.id)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  pointer.x=e.clientX;pointer.y=e.clientY;
  state.viewYaw=clamp(state.viewYaw-dx*.0037,-1.1,1.1);
  state.viewPitch=clamp(state.viewPitch-dy*.0032,-.52,.55);
  state.lastInput=clock.elapsedTime;
});
function releasePointer(e){
  if(!pointer||e.pointerId!==pointer.id)return;
  pointer=null;state.dragging=false;
}
canvas.addEventListener("pointerup",releasePointer);
canvas.addEventListener("pointercancel",releasePointer);
window.addEventListener("resize",()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
});
function updateCamera(dt,now){
  const t=state.progress, p=at(t), direction=tangent(t), next=tangent(Math.min(.9999,t+.006));
  const turn=direction.clone().cross(next).y;
  const yaw=Math.atan2(-direction.x,-direction.z);
  const pitch=Math.atan2(direction.y,Math.hypot(direction.x,direction.z));
  const roll=clamp(turn*1.8,-.15,.15)*(state.motionReduced?.2:1);
  car.position.copy(p);
  car.rotation.order="YXZ";
  car.rotation.set(pitch,yaw,roll);
  if(!state.dragging&&now-state.lastInput>2.1){
    state.viewYaw=lerp(state.viewYaw,0,Math.min(1,dt*.48));
    state.viewPitch=lerp(state.viewPitch,0,Math.min(1,dt*.5));
  }
  camera.rotation.set(state.viewPitch,state.viewYaw,0,"YXZ");
  const wobble=state.motionReduced?0:Math.min(.023,state.speed*.0009);
  camera.position.set(Math.sin(now*19)*wobble,1.53+Math.sin(now*14)*wobble,0.63);
  if(state.scareTime>0&&!state.motionReduced){
    const amount=state.scareTime/state.scareDuration;
    camera.position.x+=Math.sin(now*110)*.055*amount;
    camera.position.y+=Math.cos(now*125)*.08*amount;
  }
  camera.fov=lerp(camera.fov,75+Math.min(8,state.speed*.31),Math.min(1,dt*1.7));
  camera.updateProjectionMatrix();
}
function updateLights(now){
  for(let i=0;i<flashlightPair.length;i++){
    const f=flashlightPair[i];
    const flicker=state.scareFlicker>0?(Math.sin(now*39+i*5)>.32?.22:1):1;
    f.light.intensity=state.lightsOn?f.strength*flicker:0;
  }
  for(const l of lamps)l.light.intensity=l.base*(.82+Math.sin(now*8+l.phase)*.12+Math.sin(now*21+l.phase*3)*.06);
}
function updateProps(now,dt){
  camera.updateMatrixWorld();
  camera.getWorldPosition(tmpV);
  for(const g of ghosts){
    g.mesh.getWorldPosition(YAW_AXIS);
    const distance=YAW_AXIS.distanceTo(tmpV);
    const reveal=clamp((31-distance)/12,0,1);
    const behind=state.progress>g.at+.028?.22:1;
    g.material.opacity=clamp(reveal*.48*behind,0,.55)*(state.lightsOn?1:.55);
    g.mesh.position.y=g.originY+Math.sin(now*1.15+g.phase)*.25;
    g.mesh.lookAt(tmpV);
  }
  for(const d of doors){
    const metresAhead=(d.t-state.progress)*trackLength;
    let opening=0;
    if(metresAhead<32&&metresAhead>18)opening=1-(metresAhead-18)/14;
    else if(metresAhead<=18&&metresAhead>=-12)opening=1;
    else if(metresAhead< -12&&metresAhead> -30)opening=1-(-metresAhead-12)/18;
    d.pivot.rotation.y=d.side*opening*1.57;
  }
}
let lastHud=0,lastTime=performance.now();
function animate(ms){
  requestAnimationFrame(animate);
  const dt=Math.min((ms-lastTime)/1000,.05)||.016;
  lastTime=ms;
  const now=ms/1000;
  if(state.playing&&!state.paused&&!state.done){
    state.time+=dt;
    const frame=integrateRide(state,dt,trackLength,sampleTrackForces);
    state.speed=frame.speed;
    state.distance=frame.distance;
    state.progress=frame.progress;
    state.forces=frame.forces;
    const newChapter=chapterAt(state.progress);
    if(newChapter!==state.chapter){state.chapter=newChapter;showChapter(newChapter);}
    for(let i=0;i<scareBeats.length;i++){
      if(state.progress>=scareBeats[i].at&&!playedScares.has(i)){
        playedScares.add(i);jumpScare(scareBeats[i]);
      }
    }
    for(let i=0;i<whispers.length;i++){
      if(state.progress>=whispers[i].at&&!playedWhispers.has(i)){
        playedWhispers.add(i);whisper(whispers[i].text);
      }
    }
    if(state.chapterHold>0){
      state.chapterHold-=dt;
      if(state.chapterHold<=0)$("chapterCard").classList.remove("visible");
    }
    if(state.whisperHold>0){
      state.whisperHold-=dt;
      if(state.whisperHold<=0)$("whisper").classList.remove("visible");
    }
    updateScare(dt);
    audio.tick(state.speed,state.distance,state.forces);
    if(state.progress>=1)finish();
  }else if(!state.playing&&!state.done){
    state.progress=0;state.speed=0;
  }
  updateCamera(dt,now);
  updateLights(now);
  updateProps(now,dt);
  if(ms-lastHud>120){updateHud();lastHud=ms;}
  renderer.render(scene,camera);
}
updateCamera(.016,0);
updateHud();
requestAnimationFrame(animate);
window.addEventListener("load",()=>{
  const loader=$("loading");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    loader.classList.add("marked");
    setTimeout(()=>loader.remove(),850);
  }));
});
