'use strict';
/* ===== helpers ===== */
const MOBILE=/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent)||(('ontouchstart' in window)&&Math.min(innerWidth,innerHeight)<700);
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rnd=(a,b)=>a+Math.random()*(b-a);
const ri=n=>Math.floor(Math.random()*n);
const HALF=70;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const fwd=y=>({x:-Math.sin(y),z:-Math.cos(y)});

/* enemy types */
const ET=[
 {n:'inf',hp:70,spd:3.7,r:.45,h:1.9,rng:34,dmg:7,cd:[.55,1.1],coin:20,xp:1},
 {n:'heavy',hp:340,spd:2.3,r:.62,h:2.5,rng:40,dmg:5,cd:[.14,.22],coin:70,xp:3},
 {n:'tank',hp:2800,spd:2.5,r:1.9,h:2.6,rng:62,dmg:70,cd:[3,3.8],coin:600,xp:15,boss:1},
 {n:'heli',hp:2000,spd:7,r:2.2,h:3,rng:62,dmg:30,cd:[.9,1.3],coin:600,xp:15,boss:1,fly:1}];

/* ===== renderer / scene ===== */
let renderer=null,scene,camera,sunL,hemiL,skyMesh,world=null,gunGroup,gunMeshes=[],flashM;
function initRenderer(){
 if(renderer)return true;
 if(typeof THREE==='undefined')return false;
 try{renderer=new THREE.WebGLRenderer({canvas:$('#gl'),antialias:!MOBILE,powerPreference:'high-performance'})}catch(e){return false}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,MOBILE?1.5:2));
 renderer.shadowMap.enabled=!MOBILE;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(75,1,.08,700);camera.rotation.order='YXZ';scene.add(camera);
 hemiL=new THREE.HemisphereLight(0xffffff,0x555555,.7);scene.add(hemiL);
 sunL=new THREE.DirectionalLight(0xffffff,1);sunL.position.set(40,70,25);
 if(!MOBILE){sunL.castShadow=true;sunL.shadow.mapSize.set(2048,2048);const c=sunL.shadow.camera;c.left=-50;c.right=50;c.top=50;c.bottom=-50;c.near=10;c.far=220;sunL.shadow.bias=-.0006}
 scene.add(sunL);scene.add(sunL.target);
 skyMesh=new THREE.Mesh(new THREE.SphereGeometry(500,16,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color()},bot:{value:new THREE.Color()}},
  vertexShader:'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 top;uniform vec3 bot;varying float h;void main(){gl_FragColor=vec4(mix(bot,top,clamp(h*1.6,0.,1.)),1.);}'}));
 skyMesh.renderOrder=-1;scene.add(skyMesh);
 buildGun();
 const rs=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()};
 addEventListener('resize',rs);rs();
 return true}

/* ===== materials / textures ===== */
const MC={};
function M(color,rough=.85,metal=0,extra){const k=color+'|'+rough+'|'+metal+(extra&&extra.k||'');return MC[k]||(MC[k]=new THREE.MeshStandardMaterial(Object.assign({color,roughness:rough,metalness:metal},extra&&extra.o||{})))}
const TC={};
function ctex(key,size,rep,draw){if(TC[key])return TC[key];const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep,rep);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return TC[key]=t}
function grain(g,s,base,n,amp){g.fillStyle=base;g.fillRect(0,0,s,s);for(let i=0;i<n;i++){const v=Math.random()<.5?0:255;g.fillStyle=`rgba(${v},${v},${v},${Math.random()*amp})`;const w=1+ri(4);g.fillRect(ri(s),ri(s),w,w)}}
function groundTex(base,rep){return ctex('g'+base+rep,256,rep,(g,s)=>{grain(g,s,base,6000,.12);for(let i=0;i<40;i++){g.fillStyle=`rgba(0,0,0,${Math.random()*.06})`;g.beginPath();g.arc(ri(s),ri(s),8+ri(30),0,7);g.fill()}})}
function facadeTex(base){return ctex('f'+base,256,1,(g,s)=>{grain(g,s,base,4000,.1);g.fillStyle='rgba(20,28,36,.85)';for(let y=0;y<4;y++)for(let x=0;x<4;x++){if(Math.random()<.22)continue;g.fillStyle='rgba(20,28,36,.85)';g.fillRect(14+x*62,18+y*62,34,40);g.fillStyle='rgba(120,150,170,.25)';g.fillRect(14+x*62,18+y*62,34,10)}})}
function concreteTex(base){return ctex('c'+base,128,1,(g,s)=>{grain(g,s,base,2500,.14);g.strokeStyle='rgba(0,0,0,.18)';g.strokeRect(1,1,s-2,s-2)})}

/* ===== map ===== */
const MAPS=[
 {k:'city',gr:'#6a6a66',rep:60,fog:0x9aa7b2,sky:[0x4f7fb4,0xc8d4dc],sun:0xfff0d8,sI:1.15,hm:[0xc2d0de,0x555552],bld:'#9a9892',acc:'#6e6d68'},
 {k:'desert',gr:'#c9a96c',rep:70,fog:0xe0cba0,sky:[0x5f9ad4,0xf3dfb8],sun:0xffe0ae,sI:1.3,hm:[0xf5e6c8,0x8a7248],bld:'#bfa270',acc:'#92794f'},
 {k:'jungle',gr:'#456b30',rep:60,fog:0x86a58c,sky:[0x628fa0,0xbcd4c4],sun:0xfff0c0,sI:.95,hm:[0xb0d0a8,0x2a3a22],bld:'#85846f',acc:'#5b684c'},
 {k:'arctic',gr:'#eaf0f6',rep:30,fog:0xcad7e3,sky:[0x6f9ac8,0xe0eaf4],sun:0xeef4ff,sI:1.1,hm:[0xd8e6f4,0x8a98a8],bld:'#7d6c58',acc:'#5c4b3b'}];
let OB=[];   // obstacles: {t:0 box|1 cyl,x,z,hx,hz,r,h}
function buildWorld(mi,seed){
 if(world){scene.remove(world);world.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
 world=new THREE.Group();scene.add(world);OB=[];
 const T=MAPS[mi],rng=mulberry(seed|0),R=(a,b)=>a+rng()*(b-a),RI=n=>Math.floor(rng()*n);
 scene.fog=new THREE.Fog(T.fog,45,190);skyMesh.material.uniforms.top.value.set(T.sky[0]);skyMesh.material.uniforms.bot.value.set(T.sky[1]);
 sunL.color.set(T.sun);sunL.intensity=T.sI;hemiL.color.set(T.hm[0]);hemiL.groundColor.set(T.hm[1]);
 const gm=new THREE.MeshStandardMaterial({color:0xffffff,map:groundTex(T.gr,T.rep),roughness:1});
 const gnd=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),gm);gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;world.add(gnd);
 const BG=new THREE.BoxGeometry(1,1,1),CG=new THREE.CylinderGeometry(1,1,1,12),SG=new THREE.IcosahedronGeometry(1,1),CN=new THREE.ConeGeometry(1,1,9);
 const add=(geo,mat,x,y,z,cs=true,rs=true)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=cs&&!MOBILE;m.receiveShadow=rs;world.add(m);return m};
 const free=(x,z,r)=>{if(Math.hypot(x,z)<13)return false;if(Math.abs(x)>HALF-r-2||Math.abs(z)>HALF-r-2)return false;for(const o of OB){const orr=o.t?o.r:Math.hypot(o.hx,o.hz);if(Math.hypot(x-o.x,z-o.z)<r+orr+1.5)return false}return true};
 const place=(r,fn,tries=40)=>{for(let i=0;i<tries;i++){const x=R(-HALF+6,HALF-6),z=R(-HALF+6,HALF-6);if(free(x,z,r)){fn(x,z);return true}}return false};
 const obox=(x,z,w,d,h,mat,y0=0)=>{OB.push({t:0,x,z,hx:w/2,hz:d/2,h:h+y0});const m=add(BG,mat,x,y0+h/2,z);m.scale.set(w,h,d);return m};
 const ocyl=(x,z,r,h)=>OB.push({t:1,x,z,r,h});
 const crate=()=>place(1.4,(x,z)=>{obox(x,z,1.4,1.4,1.4,M('#7a5a36',.9));if(rng()<.4)add(BG,M('#6b4e2e',.9),x,1.9,z).scale.set(1,.9,1)});
 const sandbag=()=>place(2.5,(x,z)=>{const a=RI(2);obox(x,z,a?4.4:1.1,a?1.1:4.4,1,M('#a89268',1))});
 const barrel=()=>place(1,(x,z)=>{ocyl(x,z,.45,1.1);add(CG,M(rng()<.5?'#a33a2a':'#3d5a3a',.5,.4),x,.55,z).scale.set(.45,1.1,.45)});
 const rock=(sc,col)=>place(sc*1.2,(x,z)=>{const s=R(.7,1.3)*sc;ocyl(x,z,s*.95,s*1.5);const m=add(SG,M(col,1),x,s*.5,z);m.scale.set(s,s*1.1,s*.9);m.rotation.set(R(0,3),R(0,3),0)});
 const tree=(kind)=>place(1.4,(x,z)=>{
  if(kind==='pine'){const h=R(8,12);ocyl(x,z,.5,h);add(CG,M('#4a3624',1),x,h*.3,z).scale.set(.35,h*.6,.35);for(let i=0;i<4;i++)add(CN,M(i%2?'#2f5a3a':'#3b6b44',.9),x,h*.35+i*h*.17,z).scale.set(3-i*.55,h*.3,3-i*.55)}
  else{const h=R(9,14);ocyl(x,z,.6,h);add(CG,M('#5a4630',1),x,h*.5,z).scale.set(.5,h,.5);for(let i=0;i<3;i++)add(SG,M(['#2f6a2a','#3a7a30','#2a5a26'][i],.9),x+R(-1.3,1.3),h*.85+i*.9,z+R(-1.3,1.3)).scale.set(R(3,4.2),R(1.8,2.4),R(3,4.2))}});
 const bush=()=>{const x=R(-HALF,HALF),z=R(-HALF,HALF);if(Math.hypot(x,z)>8)add(SG,M(T.k==='jungle'?'#3a7a32':'#6a8a5a',1),x,.5,z,false).scale.set(R(.8,1.6),R(.5,.9),R(.8,1.6))};
 // perimeter
 const wm=M(T.acc,.95,0,{k:'w',o:{map:concreteTex(T.acc)}});
 [[0,HALF+1,HALF*2+4,2],[0,-HALF-1,HALF*2+4,2],[HALF+1,0,2,HALF*2+4],[-HALF-1,0,2,HALF*2+4]].forEach(([x,z,w,d])=>{OB.push({t:0,x,z,hx:w/2,hz:d/2,h:9});add(BG,wm,x,4.5,z).scale.set(w,9,d)});
 if(T.k==='city'){
  const fm=new THREE.MeshStandardMaterial({color:0xffffff,map:facadeTex(T.bld),roughness:.95});
  for(let i=0;i<13;i++)place(11,(x,z)=>{const w=R(8,15),d=R(8,15),h=R(7,17);OB.push({t:0,x,z,hx:w/2,hz:d/2,h});add(BG,fm,x,h/2,z).scale.set(w,h,d);add(BG,M('#4a4a48',1),x,h+.25,z).scale.set(w+.4,.5,d+.4);if(rng()<.5)add(BG,M('#3b3b3a',1),x+R(-2,2),h+1,z+R(-2,2)).scale.set(2,1.2,2)},60);
  for(let i=0;i<10;i++)place(6,(x,z)=>{const l=R(5,10),h=R(2.5,4.5),a=RI(2);obox(x,z,a?l:.6,a?.6:l,h,wm)});
  for(let i=0;i<8;i++)place(3,(x,z)=>{const c=['#8a2a2a','#2a4a7a','#c8c8c0','#2f2f33','#6a7a3a'][RI(5)];obox(x,z,2,4.2,.95,M(c,.4,.5));add(BG,M('#1a2530',.2,.6),x,1.25,z).scale.set(1.8,.55,2.2)});
  const rm=new THREE.MeshStandardMaterial({color:0xffffff,map:groundTex('#38383a',20),roughness:.9});
  add(BG,rm,0,.02,0,false).scale.set(HALF*2,.04,9);add(BG,rm,0,.02,0,false).scale.set(9,.04,HALF*2);
  for(let i=0;i<16;i++)crate();for(let i=0;i<10;i++)sandbag();for(let i=0;i<10;i++)barrel();
 }else if(T.k==='desert'){
  const bm=M(T.bld,1,0,{k:'b',o:{map:concreteTex(T.bld)}});
  for(let i=0;i<8;i++)place(8,(x,z)=>{const w=R(7,10),d=R(6,8);obox(x,z,w,d,3.2,bm);add(BG,M('#5d4c32',1),x,3.45,z).scale.set(w+.6,.5,d+.6);add(BG,M('#1a1a1a',1),x,1.1,z+d/2+.02,false).scale.set(1.8,2.2,.1)},60);
  for(let i=0;i<26;i++)rock(R(1.2,2.6),'#a98a55');
  for(let i=0;i<6;i++)place(4,(x,z)=>{obox(x,z,3.4,6,1.6,M('#4a5240',.6,.5));add(BG,M('#454c3b',.6,.5),x,2,z).scale.set(2,.8,2.4)});
  for(let i=0;i<14;i++)crate();for(let i=0;i<12;i++)sandbag();for(let i=0;i<10;i++)barrel();
  for(let i=0;i<14;i++){const x=R(-HALF*2,HALF*2),z=R(-HALF*2,HALF*2);if(Math.abs(x)>HALF+10||Math.abs(z)>HALF+10)add(SG,M('#cdb07a',1),x,0,z,false).scale.set(R(14,30),R(4,9),R(14,30))}
 }else if(T.k==='jungle'){
  for(let i=0;i<58;i++)tree('jungle');for(let i=0;i<40;i++)bush();for(let i=0;i<16;i++)rock(R(1,2.2),'#6a7a5a');
  const sm=M('#8a8a7a',1,0,{k:'s',o:{map:concreteTex('#8a8a7a')}});
  obox(0,-26,14,14,1.2,sm);[[-6,-32],[6,-32],[-6,-20],[6,-20]].forEach(([x,z])=>obox(x,z,1.6,1.6,6.5,sm,1.2));
  for(let i=0;i<8;i++)crate();for(let i=0;i<8;i++)sandbag();for(let i=0;i<6;i++)barrel();
 }else{
  for(let i=0;i<42;i++)tree('pine');for(let i=0;i<22;i++)rock(R(1.2,2.8),'#c4d6e6');
  for(let i=0;i<6;i++)place(7,(x,z)=>{const w=8,d=6;obox(x,z,w,d,3.5,M('#6a4a30',.95));add(BG,M('#eef4fa',.9),x,3.9,z).scale.set(w+1,.9,d+1);add(BG,M('#2a1a10',1),x,1.1,z+d/2+.02,false).scale.set(1.4,2.2,.1)},60);
  for(let i=0;i<12;i++)crate();for(let i=0;i<8;i++)sandbag();for(let i=0;i<8;i++)barrel();
  for(let i=0;i<18;i++){const x=R(-HALF,HALF),z=R(-HALF,HALF);add(SG,M('#f4f8fc',1),x,0,z,false).scale.set(R(2,6),R(.3,.9),R(2,6))}
 }
 return T}
/* collision: returns ground height under (x,z) at height y */
function collide(p,r,y,climb){
 let g=0;
 for(let i=0;i<OB.length;i++){const o=OB[i];
  if(o.t===0){const dx=p.x-o.x,dz=p.z-o.z,ex=Math.abs(dx)-o.hx,ez=Math.abs(dz)-o.hz;
   if(ex<r&&ez<r){if(climb&&y>=o.h-.06){if(o.h>g)g=o.h;continue}const px=r-ex,pz=r-ez;if(px<pz)p.x+=dx>0?px:-px;else p.z+=dz>0?pz:-pz}}
  else{const dx=p.x-o.x,dz=p.z-o.z,rr=r+o.r,d2=dx*dx+dz*dz;if(d2<rr*rr){if(climb&&y>=o.h-.06){if(o.h>g)g=o.h;continue}const d=Math.sqrt(d2)||.001;p.x=o.x+dx/d*rr;p.z=o.z+dz/d*rr}}}
 p.x=clamp(p.x,-HALF+r,HALF-r);p.z=clamp(p.z,-HALF+r,HALF-r);return g}
function rayCyl(ox,oy,oz,dx,dy,dz,cx,cz,r,y0,y1,maxT){
 const fx=ox-cx,fz=oz-cz,a=dx*dx+dz*dz;if(a<1e-9)return -1;
 const b=2*(fx*dx+fz*dz),c=fx*fx+fz*fz-r*r,disc=b*b-4*a*c;if(disc<0)return -1;
 const s=Math.sqrt(disc);let t=(-b-s)/(2*a);if(t<0)t=(-b+s)/(2*a);if(t<0||t>maxT)return -1;
 const y=oy+dy*t;return(y>=y0&&y<=y1)?t:-1}
function rayBox(ox,oy,oz,dx,dy,dz,o,maxT){
 let t0=0,t1=maxT;const A=[[ox,dx,o.x-o.hx,o.x+o.hx],[oy,dy,0,o.h],[oz,dz,o.z-o.hz,o.z+o.hz]];
 for(let i=0;i<3;i++){const a=A[i];if(Math.abs(a[1])<1e-8){if(a[0]<a[2]||a[0]>a[3])return -1}else{let u=(a[2]-a[0])/a[1],v=(a[3]-a[0])/a[1];if(u>v){const w=u;u=v;v=w}if(u>t0)t0=u;if(v<t1)t1=v;if(t0>t1)return -1}}
 return t0}
function rayObs(ox,oy,oz,dx,dy,dz,maxT){
 let best=maxT;
 for(let i=0;i<OB.length;i++){const o=OB[i];let t;
  if(o.t===0){if(Math.abs(o.x-ox)-o.hx>maxT||Math.abs(o.z-oz)-o.hz>maxT)continue;t=rayBox(ox,oy,oz,dx,dy,dz,o,best)}
  else t=rayCyl(ox,oy,oz,dx,dy,dz,o.x,o.z,o.r,0,o.h,best);
  if(t>=0&&t<best)best=t}
 return best}
function inObs(x,y,z){for(const o of OB){if(y>o.h)continue;if(o.t===0){if(Math.abs(x-o.x)<o.hx&&Math.abs(z-o.z)<o.hz)return true}else if(Math.hypot(x-o.x,z-o.z)<o.r)return true}return false}

/* ===== models ===== */
const GC={};
const geo=(k,f)=>GC[k]||(GC[k]=f());
function pivotBox(w,h,d,py){const g=new THREE.BoxGeometry(w,h,d);g.translate(0,py,0);return g}
function makeSoldier(c1,c2,scale,heavy){
 const g=new THREE.Group(),u=g.userData;
 const mc=M(c1,.9),mh=M(c2,.7),skin=M('#c9a283',.8),dark=M('#1d1f22',.5,.5);
 const mk=(geom,mat,x,y,z)=>{const m=new THREE.Mesh(geom,mat);m.position.set(x,y,z);m.castShadow=!MOBILE;g.add(m);return m};
 const lg=geo('leg',()=>pivotBox(.22,.85,.26,-.42));
 u.l1=mk(lg,mc,-.15,.85,0);u.l2=mk(lg,mc,.15,.85,0);
 mk(geo('torso',()=>new THREE.BoxGeometry(.58,.72,.34)),mc,0,1.22,0);
 mk(geo('vest',()=>new THREE.BoxGeometry(.62,.5,.38)),mh,0,1.28,0);
 mk(geo('head',()=>new THREE.SphereGeometry(.17,10,8)),skin,0,1.76,0);
 mk(geo('helm',()=>new THREE.SphereGeometry(.2,10,6,0,Math.PI*2,0,Math.PI*.55)),mh,0,1.79,0);
 const ar=geo('arm',()=>pivotBox(.16,.62,.16,-.3));
 u.a1=mk(ar,mc,-.39,1.5,0);u.a2=mk(ar,mc,.39,1.5,0);u.a1.rotation.x=u.a2.rotation.x=-1.25;
 mk(geo(heavy?'gunH':'gun',()=>new THREE.BoxGeometry(.09,.12,heavy?1:.75)),dark,.14,1.3,heavy?-.55:-.45);
 if(heavy)mk(geo('hbp',()=>new THREE.BoxGeometry(.7,.3,.45)),mh,0,1.55,.22);
 g.scale.setScalar(scale);return g}
function animSoldier(g,speed,t){const u=g.userData,s=Math.sin(t*8)*Math.min(speed,4)*.18;u.l1.rotation.x=s;u.l2.rotation.x=-s}
function makeTank(){
 const g=new THREE.Group(),u=g.userData,hull=M('#4d5642',.6,.4),dk=M('#2b2f27',.7,.3);
 const mk=(geom,mat,x,y,z)=>{const m=new THREE.Mesh(geom,mat);m.position.set(x,y,z);m.castShadow=!MOBILE;g.add(m);return m};
 mk(new THREE.BoxGeometry(3,1.1,5.4),hull,0,1.05,0);
 mk(new THREE.BoxGeometry(.9,1.1,5.8),dk,-1.75,.6,0);mk(new THREE.BoxGeometry(.9,1.1,5.8),dk,1.75,.6,0);
 u.tur=new THREE.Group();u.tur.position.y=1.9;g.add(u.tur);
 const t=new THREE.Mesh(new THREE.BoxGeometry(2.1,.9,2.6),hull);t.castShadow=!MOBILE;u.tur.add(t);
 const b=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,4,8),dk);b.rotation.x=Math.PI/2;b.position.set(0,.1,-3);u.tur.add(b);
 g.scale.setScalar(1.15);return g}
function makeHeli(){
 const g=new THREE.Group(),u=g.userData,body=M('#3a4048',.5,.5),dk=M('#16181b',.6,.4);
 const mk=(geom,mat,x,y,z)=>{const m=new THREE.Mesh(geom,mat);m.position.set(x,y,z);m.castShadow=!MOBILE;g.add(m);return m};
 mk(new THREE.SphereGeometry(1,12,10),body,0,0,0).scale.set(1.5,1.2,3);
 mk(new THREE.BoxGeometry(.35,.4,4.2),body,0,.2,4.2);mk(new THREE.BoxGeometry(.12,1.4,.9),body,0,.9,6);
 mk(new THREE.SphereGeometry(1,8,6),M('#6aa0c0',.1,.8),0,.35,-1.9).scale.set(.9,.7,1);
 mk(new THREE.BoxGeometry(.2,.2,3),dk,-1.1,-1.3,0);mk(new THREE.BoxGeometry(.2,.2,3),dk,1.1,-1.3,0);
 u.rot=new THREE.Group();u.rot.position.y=1.35;g.add(u.rot);
 u.rot.add(new THREE.Mesh(new THREE.BoxGeometry(11,.07,.45),dk),new THREE.Mesh(new THREE.BoxGeometry(.45,.07,11),dk));
 g.scale.setScalar(1.1);return g}
function makeEnemy(ty){
 if(ty===0)return makeSoldier('#6e3b30','#3a2622',1,false);
 if(ty===1)return makeSoldier('#33373d','#a02a22',1.3,true);
 return ty===2?makeTank():makeHeli()}
function makeProj(k){
 const mc=k==='g'?'#3f4a35':k==='r'?'#c8c8c0':'#ff8a30';
 const m=new THREE.Mesh(k==='g'?new THREE.SphereGeometry(.14,8,6):k==='r'?new THREE.CylinderGeometry(.09,.09,.9,6):new THREE.SphereGeometry(.28,8,6),k==='e'||k==='m'?new THREE.MeshBasicMaterial({color:mc}):M(mc,.5,.4));
 if(k==='r')m.rotation.x=Math.PI/2;
 const g=new THREE.Group();g.add(m);if(k==='r'||k==='m'){const t=new THREE.Mesh(new THREE.SphereGeometry(.18,6,4),new THREE.MeshBasicMaterial({color:0xffaa33}));t.position.z=.55;g.add(t)}return g}
function makePickup(k){
 const col=k==='h'?'#e23b3b':k==='a'?'#4aa0e0':'#d8b440';
 const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(.6,.4,.45),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.5,roughness:.5}));b.position.y=.7;g.add(b);
 if(k==='h'){const l=new THREE.Mesh(new THREE.BoxGeometry(.16,.5,.5),new THREE.MeshBasicMaterial({color:0xffffff}));l.position.y=.7;g.add(l);const l2=l.clone();l2.rotation.y=Math.PI/2;g.add(l2)}return g}

/* first-person weapon models (front = -z) */
function buildGun(){
 gunGroup=new THREE.Group();camera.add(gunGroup);
 const dk=new THREE.MeshStandardMaterial({color:0x22252a,roughness:.45,metalness:.6,depthTest:false}),
  wd=new THREE.MeshStandardMaterial({color:0x6a4a2c,roughness:.8,depthTest:false}),
  gr=new THREE.MeshStandardMaterial({color:0x3a4538,roughness:.6,metalness:.3,depthTest:false});
 const part=(g,w,h,d,x,y,z,m)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.renderOrder=999;g.add(b);return b};
 const mkw=(f)=>{const g=new THREE.Group();f(g);g.visible=false;gunGroup.add(g);gunMeshes.push(g)};
 mkw(g=>{part(g,.06,.09,.3,0,0,-.15,dk);part(g,.05,.12,.07,0,-.09,0,wd)});
 mkw(g=>{part(g,.07,.1,.62,0,0,-.3,gr);part(g,.03,.03,.3,0,.01,-.78,dk);part(g,.05,.16,.08,0,-.12,-.1,dk);part(g,.07,.13,.2,0,-.02,.1,wd)});
 mkw(g=>{part(g,.07,.09,.75,0,0,-.35,dk);part(g,.09,.07,.4,0,-.07,-.45,wd);part(g,.07,.12,.22,0,-.03,.12,wd)});
 mkw(g=>{part(g,.07,.1,.4,0,0,-.2,dk);part(g,.04,.2,.07,0,-.13,-.1,dk);part(g,.03,.03,.2,0,0,-.5,dk)});
 mkw(g=>{part(g,.06,.09,.95,0,0,-.45,gr);part(g,.03,.03,.5,0,.01,-1.1,dk);part(g,.05,.07,.2,0,.09,-.35,dk);part(g,.07,.12,.25,0,-.02,.15,wd)});
 mkw(g=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,1,10),gr);c.rotation.x=Math.PI/2;c.position.set(0,.02,-.4);c.renderOrder=999;g.add(c);part(g,.05,.12,.06,0,-.1,-.1,dk)});
 flashM=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:0xffd070,depthTest:false}));flashM.renderOrder=1000;flashM.visible=false;gunGroup.add(flashM);
 gunGroup.position.set(.26,-.25,-.5)}
const MUZ=[[0,0,-.32],[0,.01,-.95],[0,0,-.8],[0,0,-.55],[0,.01,-1.4],[0,.02,-.92]];
function showGun(i,flash){gunMeshes.forEach((g,k)=>g.visible=k===i);if(flashM){flashM.visible=!!flash;if(flash)flashM.position.set(MUZ[i][0],MUZ[i][1],MUZ[i][2])}}

/* ===== effects ===== */
const FX={list:[],trPool:[],ptPool:[],shake:0};
function fxTracer(x1,y1,z1,x2,y2,z2,col){
 let m=FX.trPool.pop();if(!m)m=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,1),new THREE.MeshBasicMaterial({color:0xffe08a,transparent:true,opacity:.9}));
 scene.add(m);m.material.color.set(col||0xffe08a);const dx=x2-x1,dy=y2-y1,dz=z2-z1,L=Math.hypot(dx,dy,dz)||1;
 m.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);m.lookAt(x2,y2,z2);m.scale.set(1,1,L);FX.list.push({k:0,m,t:.07,mt:.07})}
function fxPart(x,y,z,vx,vy,vz,col,life,sz,grav){
 let m=FX.ptPool.pop();if(!m)m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:col}));
 m.material.color.set(col);m.position.set(x,y,z);m.scale.setScalar(sz);scene.add(m);FX.list.push({k:1,m,vx,vy,vz,t:life,mt:life,sz,g:grav})}
function fxSparks(x,y,z,col,n){for(let i=0;i<n;i++)fxPart(x,y,z,rnd(-3,3),rnd(1,4),rnd(-3,3),col,rnd(.2,.5),rnd(.05,.1),12)}
function fxBoom(x,y,z,r){
 const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),new THREE.MeshBasicMaterial({color:0xffa030,transparent:true,opacity:.9}));m.position.set(x,y,z);scene.add(m);FX.list.push({k:2,m,t:.45,mt:.45,r});
 for(let i=0;i<(MOBILE?10:22);i++)fxPart(x,y,z,rnd(-1,1)*r,rnd(.4,1.2)*r,rnd(-1,1)*r,i%3?0x555048:0xff8a2a,rnd(.5,1.1),rnd(.25,.6),6);
 const d=Math.hypot(x-camera.position.x,z-camera.position.z);if(d<40)FX.shake=Math.max(FX.shake,(1-d/40)*.5)}
function fxUpdate(dt){
 for(let i=FX.list.length-1;i>=0;i--){const f=FX.list[i];f.t-=dt;
  if(f.k===1){f.vy-=f.g*dt;f.m.position.x+=f.vx*dt;f.m.position.y=Math.max(.03,f.m.position.y+f.vy*dt);f.m.position.z+=f.vz*dt;f.m.scale.setScalar(Math.max(.001,f.sz*Math.max(0,f.t/f.mt)))}
  else if(f.k===2){const p=1-f.t/f.mt;f.m.scale.setScalar(f.r*(.3+p*.9));f.m.material.opacity=Math.max(0,.9*(1-p))}
  if(f.t<=0){scene.remove(f.m);if(f.k===0)FX.trPool.push(f.m);else if(f.k===1)FX.ptPool.push(f.m);else{f.m.geometry.dispose();f.m.material.dispose()}FX.list.splice(i,1)}}
 FX.shake=Math.max(0,FX.shake-dt*1.4)}
function fxClear(){FX.list.forEach(f=>scene.remove(f.m));FX.list.length=0}

/* ===== audio ===== */
const Snd={c:null,m:null,mute:false,nb:null,
 init(){if(this.c){if(this.c.state==='suspended')this.c.resume();return}
  try{const C=window.AudioContext||window.webkitAudioContext;this.c=new C();this.m=this.c.createGain();this.m.gain.value=this.mute?0:.45;this.m.connect(this.c.destination);
   const n=this.c.createBuffer(1,this.c.sampleRate,this.c.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nb=n}catch(e){this.c=null}},
 setMute(v){this.mute=v;if(this.m)this.m.gain.value=v?0:.45},
 noise(dur,f0,f1,vol,type){const c=this.c,t=c.currentTime,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.nb;f.type=type||'bandpass';f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(40,f1),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(this.m);s.start(t,Math.random()*.5);s.stop(t+dur+.02)},
 tone(dur,f0,f1,vol,type){const c=this.c,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(this.m);o.start(t);o.stop(t+dur+.02)},
 play(n,v=1){if(!this.c||this.mute||v<=.02)return;
  switch(n){
   case'pistol':this.noise(.12,2400,500,.5*v);this.tone(.1,200,60,.5*v,'triangle');break;
   case'rifle':this.noise(.1,2000,400,.45*v);this.tone(.09,150,50,.45*v,'triangle');break;
   case'smg':this.noise(.07,2600,700,.35*v);this.tone(.06,180,70,.3*v,'triangle');break;
   case'shotgun':this.noise(.26,1500,200,.8*v);this.tone(.2,110,35,.7*v,'sawtooth');break;
   case'sniper':this.noise(.4,1200,120,.85*v);this.tone(.3,90,28,.8*v,'sawtooth');break;
   case'rocket':this.noise(.5,900,150,.6*v,'lowpass');this.tone(.35,140,50,.5*v,'sawtooth');break;
   case'boom':this.noise(.9,700,60,1*v,'lowpass');this.tone(.6,90,24,.9*v,'sine');break;
   case'enemy':this.noise(.08,1800,500,.22*v);break;
   case'cannon':this.noise(.5,600,80,.8*v,'lowpass');this.tone(.4,70,26,.7*v,'sawtooth');break;
   case'reload':this.tone(.05,900,500,.3*v,'square');setTimeout(()=>this.c&&this.tone(.07,500,900,.3*v,'square'),260);break;
   case'empty':this.tone(.04,600,400,.25*v,'square');break;
   case'hit':this.tone(.05,1500,1100,.25*v,'square');break;
   case'kill':this.tone(.12,900,1800,.3*v,'square');break;
   case'hurt':this.tone(.18,180,80,.55*v,'sawtooth');break;
   case'coin':this.tone(.08,1100,1700,.28*v,'square');setTimeout(()=>this.c&&this.tone(.1,1700,2300,.25*v,'square'),70);break;
   case'horn':this.tone(.7,170,150,.5*v,'sawtooth');break;
   case'click':this.tone(.04,700,500,.25*v,'square');break;
   case'pick':this.tone(.1,700,1200,.3*v,'triangle');break}}};
