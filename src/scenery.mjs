/**
 * Site-built Blackthorn Estate scenery.
 *
 * The old world was assembled from individual wall/floor boxes that did not
 * join along the curve or follow its elevation. Here all structural geometry
 * is lofted from actual track samples. The floor, two sides and vaulted
 * ceiling share their vertices at each cross-section and cannot float apart.
 * Where the track passes near another section, rooms are opened up rather
 * than pushing an intersecting wall into the rider.
 */
export function buildEstate({
  THREE, scene, materials, at, tangent, trackLength, frameGroup,
  sceneryClear, lamps, openArea, random, range, canvasTexture, ridePathSamples
}) {
  const UP=new THREE.Vector3(0,1,0);
  const BARK=new THREE.MeshStandardMaterial({color:0x292d2b,roughness:1,flatShading:true,side:THREE.DoubleSide});
  const TRIM=new THREE.MeshStandardMaterial({color:0x333331,roughness:.95});
  const IRON=new THREE.MeshStandardMaterial({color:0x1c2426,metalness:.58,roughness:.75});
  const COPPER=new THREE.MeshStandardMaterial({color:0x453a2b,metalness:.52,roughness:.65});
  const GLOW=new THREE.MeshBasicMaterial({color:0xc28b51});
  const LOST=new THREE.MeshStandardMaterial({color:0x222723,roughness:1});
  const graveMat=new THREE.MeshStandardMaterial({color:0x3b3d3a,roughness:1});
  const materialsForZone={wood:null,stone:null,crypt:null};
  const wraps=texture=>{texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;};
  const tex=(kind)=>{
    return wraps(canvasTexture((ctx,w,h)=>{
      ctx.fillStyle=kind==="wood"?"#25201d":kind==="crypt"?"#242726":kind==="floor"?"#27292a":"#2c3030";
      ctx.fillRect(0,0,w,h);
      // Broad chromatic stains + many fine scratches prevent clean procedural rectangles.
      for(let i=0;i<2600;i++){
        const x=random()*w,y=random()*h,alpha=range(.008,.065);
        ctx.fillStyle=random()>.5?'rgba(180,172,150,'+alpha+')':'rgba(0,0,0,'+alpha*1.8+')';
        ctx.fillRect(x,y,range(1,36),range(.4,5));
      }
      if(kind==="wood"){
        for(let y=0;y<h;y+=49){
          ctx.fillStyle="rgba(2,3,4,.65)";ctx.fillRect(0,y,w,4);
          ctx.strokeStyle="rgba(95,71,54,.27)";
          for(let i=0;i<5;i++){
            ctx.beginPath();ctx.moveTo(0,y+range(4,44));ctx.bezierCurveTo(130,y+range(4,44),290,y+range(4,44),w,y+range(4,44));ctx.stroke();
          }
          for(let i=0;i<5;i++){
            ctx.fillStyle="rgba(3,2,2,.6)";ctx.fillRect(range(0,w),y+range(2,46),range(15,80),1);
          }
        }
      }else{
        const size=kind==="crypt"?56:kind==="floor"?72:85;
        for(let row=0;row<=h/size;row++){
          const y=row*size;
          ctx.fillStyle="rgba(0,0,0,.45)";ctx.fillRect(0,y,w,3);
          const step=kind==="floor"?82:105;
          for(let x=-(row%2)*step/2;x<w;x+=step){
            ctx.fillStyle="rgba(0,0,0,.4)";ctx.fillRect(x,y,3,size);
            ctx.fillStyle="rgba(150,139,123,.035)";ctx.fillRect(x+3,y+3,step-7,size-7);
            if(random()>.69){
              ctx.strokeStyle="rgba(10,10,10,.32)";ctx.lineWidth=1;
              ctx.beginPath();ctx.moveTo(x+8,y+6);
              ctx.lineTo(x+range(18,step-8),y+range(12,size-8));
              ctx.lineTo(x+range(10,step-6),y+size-7);ctx.stroke();
            }
          }
        }
      }
      for(let i=0;i<110;i++){
        const x=range(0,w),y=range(0,h),radius=range(5,58);
        const grad=ctx.createRadialGradient(x,y,0,x,y,radius);
        grad.addColorStop(0,"rgba(0,0,0,.17)");
        grad.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=grad;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
      }
    },512,512));
  };
  materialsForZone.wood=new THREE.MeshStandardMaterial({map:tex("wood"),roughness:1,side:THREE.DoubleSide,color:0xb4a99b});
  materialsForZone.stone=new THREE.MeshStandardMaterial({map:tex("stone"),roughness:1,side:THREE.DoubleSide,color:0xb8b9b2});
  materialsForZone.crypt=new THREE.MeshStandardMaterial({map:tex("crypt"),roughness:1,side:THREE.DoubleSide,color:0xb0b2b0});
  const floorMat=new THREE.MeshStandardMaterial({map:tex("floor"),roughness:1,side:THREE.DoubleSide,color:0x999994});
  const roofMat=new THREE.MeshStandardMaterial({map:tex("wood"),roughness:1,side:THREE.DoubleSide,color:0x89827c});
  const soilMat=new THREE.MeshStandardMaterial({map:tex("floor"),roughness:1,color:0x363b36});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(350,350),soilMat);
  ground.rotation.x=-Math.PI/2;
  ground.position.y=-2.6;
  ground.receiveShadow=true;
  scene.add(ground);

  const timber=materialsForZone.wood;
  const zone=t=>t<.18||t>.84?"wood":t>.685&&t<.84?"crypt":"stone";
  const point=(t,offset,y)=>{
    const p=at(t),d=tangent(t),side=new THREE.Vector3().crossVectors(d,UP).normalize();
    return p.addScaledVector(side,offset).addScaledVector(UP,y);
  };
  // The clearance check compares different corridors, not neighbouring
  // samples along the current rail. Near-crossings become open galleries.
  const safeRoom=t=>{
    const p=at(t);
    for(const r of ridePathSamples){
      if(Math.abs(r.t-t)<.050 || Math.abs(r.t-t)>.95)continue;
      if(Math.hypot(r.p.x-p.x,r.p.z-p.z)<10.1 &&
         Math.abs(r.p.y-p.y)<5.5)return false;
    }
    return true;
  };
  function meshFromQuads(quads,material){
    if(!quads.length)return;
    const positions=[],uvs=[],indices=[];
    for(const q of quads){
      const k=positions.length/3;
      for(let i=0;i<4;i++){
        positions.push(q.points[i].x,q.points[i].y,q.points[i].z);
        uvs.push(q.uv[i][0],q.uv[i][1]);
      }
      indices.push(k,k+1,k+2,k,k+2,k+3);
    }
    const geom=new THREE.BufferGeometry();
    geom.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geom.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const mesh=new THREE.Mesh(geom,material);
    mesh.receiveShadow=true;
    scene.add(mesh);
  }
  const panels={floor:[],roof:[],wood:[],stone:[],crypt:[]};
  const steps=Math.ceil(trackLength/2.35),half=6.95;
  function quad(set,a,b,c,d,u0,u1,v0,v1){
    set.push({points:[a,b,c,d],uv:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]});
  }
  for(let i=0;i<steps;i++){
    const t0=i/steps,t1=(i+1)/steps,t=(t0+t1)/2;
    if(openArea(t) || !safeRoom(t))continue;
    const u0=t0*trackLength/3.9,u1=t1*trackLength/3.9;
    quad(panels.floor,
      point(t0,-half,-1.75),point(t1,-half,-1.75),
      point(t1,half,-1.75),point(t0,half,-1.75),u0,u1,0,2.4);
    for(const side of [-1,1]){
      const wall=panels[zone(t)];
      quad(wall,
        point(t0,side*half,-1.74),point(t1,side*half,-1.74),
        point(t1,side*half,6.25),point(t0,side*half,6.25),u0,u1,0,2.5);
      quad(panels.roof,
        point(t0,side*half,6.25),point(t1,side*half,6.25),
        point(t1,0,8.05),point(t0,0,8.05),u0,u1,0,2.1);
    }
  }
  for(const [key,mat] of [["floor",floorMat],["roof",roofMat],
    ["wood",materialsForZone.wood],["stone",materialsForZone.stone],["crypt",materialsForZone.crypt]])meshFromQuads(panels[key],mat);

  function unitCylinder(parent,mat,rTop,rBot,h,x,y,z,sides=8){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBot,h,sides),mat);
    m.position.set(x,y,z);parent.add(m);return m;
  }
  function box(parent,mat,w,h,d,x,y,z){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);parent.add(m);return m;
  }
  function tube(parent,mat,points,r=.1){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(10,points.length*4),r,7,false),mat);
    parent.add(mesh);return mesh;
  }
  function lantern(root,x,y,z,withLight){
    unitCylinder(root,IRON,.035,.035,.65,x,y+.61,z,6);
    unitCylinder(root,COPPER,.4,.21,.13,x,y+.2,z,8);
    const cage=unitCylinder(root,IRON,.27,.22,.8,x,y-.25,z,8);
    cage.material=IRON;
    // Polygonal metal frame, glass and warm core, rather than a glowing box.
    unitCylinder(root,GLOW,.14,.17,.55,x,y-.28,z,8);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      unitCylinder(root,COPPER,.018,.018,.75,x+Math.sin(a)*.27,y-.25,z+Math.cos(a)*.27,6);
    }
    unitCylinder(root,COPPER,.34,.34,.1,x,y-.7,z,8);
    if(withLight){
      const light=new THREE.PointLight(0xe5a06c,.64,10,2);
      light.position.set(x,y-.22,z);root.add(light);
      lamps.push({light,base:.64,phase:range(0,14)});
    }
  }
  // Rib vaults, mouldings, wall recesses and fixtures are anchored to the
  // same local track height as their adjacent continuous wall panels.
  for(let i=2;i<Math.floor(trackLength/10);i++){
    const t=i*10/trackLength;
    if(openArea(t)||!safeRoom(t))continue;
    const g=frameGroup(t);
    const wood=zone(t)==="wood";
    const trim=wood?materials.woodTrim:TRIM;
    for(const side of [-1,1]){
      const column=unitCylinder(g,trim,.32,.43,7.9,side*6.68,2.18,0,10);
      column.rotation.y=range(-.04,.04);
      unitCylinder(g,trim,.58,.55,.4,side*6.68,-1.56,0,10);
      unitCylinder(g,trim,.52,.36,.48,side*6.68,6.32,0,10);
      // Wainscot is in front of the curved wall, not a duplicate large cube.
      box(g,wood?materials.woodTrim:TRIM,.16,1.2,5.4,side*6.72,-.97,0);
      if(i%2===0){
        box(g,materials.black,.1,3.45,1.45,side*6.69,2.45,2.0);
        const frameMat=wood?materials.woodTrim:COPPER;
        for(const z of [1.16,2.84])box(g,frameMat,.15,3.55,.12,side*6.62,2.48,z);
        tube(g,frameMat,[[side*6.61,4.28,1.2],[side*6.61,4.78,1.65],
          [side*6.61,5.03,2.0],[side*6.61,4.78,2.36],[side*6.61,4.28,2.8]],.105);
      }
    }
    tube(g,trim,[[-6.65,5.9,0],[-5.6,6.46,0],[-3.7,7.3,0],
      [-1.3,7.95,0],[0,8.12,0],[1.3,7.95,0],[3.7,7.3,0],
      [5.6,6.46,0],[6.65,5.9,0]],wood?.16:.26);
    if(i%3===1){
      lantern(g,0,5.75,0,lamps.length<12&&i%6===1);
    }
    if(i%4===0){
      // Three vertical pointed arches make a tall readable room silhouette.
      tube(g,IRON,[[-5.35,-1.1,-3.6],[-5.35,2.6,-3.6],[-5.35,4.7,-3.6],
        [-3.9,6.9,-3.6],[0,7.9,-3.6],[3.9,6.9,-3.6],
        [5.35,4.7,-3.6],[5.35,-1.1,-3.6]],.065);
    }
  }

  // Thick foundations connect the raised interior corridors to the estate
  // ground. Trestle-style supports connect elevated outdoor rails to earth.
  for(let i=1;i<Math.ceil(trackLength/11);i++){
    const t=i*11/trackLength,p=at(t);
    const outdoor=openArea(t);
    const g=frameGroup(t);
    const footY=-2.55;
    const topY=p.y-(outdoor?.45:1.8);
    const height=Math.max(.5,topY-footY);
    for(const side of [-1,1]){
      const x=side*(outdoor?1.1:6.15);
      const q=point(t,x,0);
      if(!sceneryClear(g,x,0,0,1.1,5.8,1.1))continue;
      const pier=unitCylinder(scene,outdoor?IRON:graveMat,outdoor?.21:.54,outdoor?.36:.92,
        height,q.x,footY+height/2,q.z,outdoor?8:9);
      pier.rotation.y=t*13;
      if(outdoor){
        unitCylinder(g,IRON,.12,.16,3.1,x,-.12,0,6).rotation.z=side*.28;
        box(g,IRON,3.4,.15,.22,0,-.5,0);
      } else {
        unitCylinder(scene,TRIM,.72,.82,.35,q.x,footY+.18,q.z,9);
      }
    }
  }

  // Unified procedural branched-tree mesh: organic tapered limbs, curved
  // trunk, twigs, gnarled asymmetry. No intersecting stick-shaped cylinders.
  const tempV=new THREE.Vector3();
  function tree(base,scale=1){
    const vertices=[],indices=[];
    const A=new THREE.Vector3(...base),up=new THREE.Vector3(0,1,0);
    function segment(a,b,r0,r1){
      const delta=b.clone().sub(a),axis=delta.clone().normalize();
      const helper=new THREE.Vector3(1,0,0);
      if(Math.abs(axis.dot(helper))>.92)helper.set(0,0,1);
      const u=new THREE.Vector3().crossVectors(axis,helper).normalize();
      const v=new THREE.Vector3().crossVectors(axis,u).normalize();
      const k=vertices.length/3,N=7;
      for(let j=0;j<N;j++){
        const angle=j*2*Math.PI/N,twist=range(.82,1.13);
        for(const [c,r] of [[a,r0],[b,r1]]){
          tempV.copy(c).addScaledVector(u,Math.cos(angle)*r*twist)
            .addScaledVector(v,Math.sin(angle)*r*twist);
          vertices.push(tempV.x,tempV.y,tempV.z);
        }
      }
      for(let j=0;j<N;j++){
        const a0=k+j*2,b0=k+((j+1)%N)*2;
        indices.push(a0,b0,a0+1,b0,b0+1,a0+1);
      }
    }
    const trunkHeight=range(11,20)*scale;
    function limb(origin,initialDir,length,radius,depth){
      let current=origin.clone(),dir=initialDir.clone().normalize();
      const steps=depth===0?7:depth===1?4:3;
      for(let k=0;k<steps;k++){
        const n=k/steps;
        const bend=depth===0?.12:.22;
        dir.add(new THREE.Vector3(range(-bend,bend),depth===0?-.008:range(-.13,.16),range(-bend,bend))).normalize();
        const next=current.clone().addScaledVector(dir,length/steps);
        segment(current,next,radius*(1-n*.79),Math.max(.012,radius*(1-(k+1)/steps*.86)));
        current=next;
        const canBranch=depth<3 && (depth===0?(k===2||k===4||k===5):k===1);
        if(canBranch){
          const count=depth===0?2:depth===1?2:1;
          for(let j=0;j<count;j++){
            const az=range(0,Math.PI*2);
            const side=new THREE.Vector3(Math.cos(az),range(.25,.85),Math.sin(az));
            side.addScaledVector(dir,depth===0?.19:.42).normalize();
            limb(current,side,length*range(.35,.61),radius*range(.38,.58),depth+1);
          }
        }
      }
    }
    limb(A,new THREE.Vector3(range(-.18,.18),1,range(-.2,.2)),trunkHeight,.56*scale,0);
    const geom=new THREE.BufferGeometry();
    geom.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    geom.setIndex(indices);geom.computeVertexNormals();
    const mesh=new THREE.Mesh(geom,BARK);
    scene.add(mesh);
    // Root flare and branch scars read naturally in a flashlight cone.
    return mesh;
  }
  let treeCount=0;
  for(let i=0;i<Math.ceil(trackLength/7.5);i++){
    const t=(i+.5)*7.5/trackLength;
    if(!openArea(t))continue;
    for(const side of [-1,1]){
      if(random()<.11)continue;
      for(let j=0;j<2;j++){
        const u=Math.min(.997,Math.max(.003,t+range(-.007,.007)));
        const q=point(u,side*range(10.5,27),0);
        tree([q.x,-2.54,q.z],range(.75,1.35));
        treeCount++;
      }
    }
  }
  function tombstone(p,scale=1){
    const shape=new THREE.Shape();
    const w=.5*scale;
    shape.moveTo(-w,0);shape.lineTo(w,0);shape.lineTo(w,.95*scale);
    shape.absarc(0,.95*scale,w,0,Math.PI,false);
    shape.lineTo(-w,0);
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.20*scale,bevelEnabled:true,
      bevelThickness:.025,bevelSize:.03,bevelSegments:1,steps:1,curveSegments:8}),graveMat);
    mesh.position.set(p.x,-2.56,p.z);
    mesh.rotation.y=range(-.6,.6);
    mesh.rotation.z=range(-.14,.14);
    scene.add(mesh);
  }
  for(let i=0;i<100;i++){
    const t=range(.01,.98);
    if(!openArea(t))continue;
    const side=random()<.5?-1:1;
    const p=point(t,side*range(8,22),0);
    tombstone(p,range(.6,1.55));
  }
  // A few old-fashioned cemetery railings and wrought-iron gates.
  for(const t of [.286,.568,.833]){
    const g=frameGroup(t);
    for(const side of [-1,1]){
      unitCylinder(g,IRON,.13,.23,4.0,side*6.1,.4,0,8);
      const finial=new THREE.Mesh(new THREE.ConeGeometry(.32,.74,7),IRON);
      finial.position.set(side*6.1,2.72,0);g.add(finial);
    }
    tube(g,IRON,[[-6.2,2.35,0],[-4,5.35,0],[0,6.6,0],[4,5.35,0],[6.2,2.35,0]],.18);
  }
  const moon=new THREE.Mesh(new THREE.SphereGeometry(4.9,24,16),
    new THREE.MeshBasicMaterial({color:0xb5c1c7}));
  moon.position.set(-82,55,-101);scene.add(moon);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTexture((c,w,h)=>{
    const grd=c.createRadialGradient(w/2,h/2,10,w/2,h/2,w/2);
    grd.addColorStop(0,"rgba(151,170,177,.27)");
    grd.addColorStop(1,"rgba(151,170,177,0)");
    c.fillStyle=grd;c.fillRect(0,0,w,h);
  }),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  halo.position.copy(moon.position);halo.scale.set(30,30,1);scene.add(halo);
  // Locally lit particulate matter: fine points rather than opaque fog slabs.
  const dust=new Float32Array(960*3);
  for(let i=0;i<960;i++){
    dust[3*i]=range(-95,95);dust[3*i+1]=range(-2,32);dust[3*i+2]=range(-95,85);
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute("position",new THREE.BufferAttribute(dust,3));
  scene.add(new THREE.Points(geom,new THREE.PointsMaterial({
    color:0x7f8f92,size:.043,transparent:true,opacity:.22,
    depthWrite:false,sizeAttenuation:true
  })));
  return {treeCount,environmentLength:trackLength};
}
