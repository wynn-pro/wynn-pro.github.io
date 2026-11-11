'use strict';
/* ================= data ================= */
const W=[
 {id:'pistol',dmg:30,rof:4.5,mag:12,res:-1,auto:false,spr:.012,rng:140,pel:1,rl:1.1,snd:'pistol',kick:.02},
 {id:'rifle',dmg:24,rof:10,mag:30,res:180,auto:true,spr:.02,rng:160,pel:1,rl:1.7,snd:'rifle',kick:.012},
 {id:'shotgun',dmg:13,rof:1.15,mag:6,res:36,auto:false,spr:.075,rng:45,pel:9,rl:2.3,snd:'shotgun',kick:.07},
 {id:'smg',dmg:15,rof:14,mag:40,res:240,auto:true,spr:.035,rng:100,pel:1,rl:1.6,snd:'smg',kick:.008},
 {id:'sniper',dmg:170,rof:.85,mag:5,res:25,auto:false,spr:.002,rng:300,pel:1,rl:2.4,snd:'sniper',kick:.09,scope:1},
 {id:'rocket',dmg:230,rof:.8,mag:1,res:6,auto:false,spr:0,rng:0,pel:0,rl:2.6,snd:'rocket',kick:.08,rad:7}];
const SHOP=[
 {id:'w2',w:2,cost:()=>350},{id:'w3',w:3,cost:()=>450},{id:'w4',w:4,cost:()=>800},{id:'w5',w:5,cost:()=>1400},
 {id:'ammo',cost:()=>80},{id:'armor',cost:()=>100},{id:'med',cost:()=>80},{id:'gren',cost:()=>120},
 {id:'dmg',lv:'dmgLv',max:5,cost:l=>300+l*250},{id:'hp',lv:'hpLv',max:5,cost:l=>250+l*200}];
const BOTN=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet','Kilo','Lima','Mike','Nova','Oscar'];
const DIFH=[.8,1,1.35],DIFD=[.7,1,1.3];
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
const rankOf=xp=>Math.min(10,Math.floor(Math.sqrt(xp/15))+1);
const rankXp=r=>15*(r-1)*(r-1);

/* ================= profile / i18n ================= */
let prof={name:'',skin:0,xp:0,lang:-1,mute:0};
try{Object.assign(prof,JSON.parse(localStorage.getItem('tof_prof')||'{}'))}catch(e){}
if(!(prof.lang>=0&&prof.lang<LANGS.length)){const i=LANGS.indexOf((navigator.language||'en').slice(0,2));prof.lang=i<0?0:i}
const saveProf=()=>{try{localStorage.setItem('tof_prof',JSON.stringify(prof))}catch(e){}};
const tr=k=>{const a=D[k];return a?(a[prof.lang]||a[0]):k};
const myName=()=>(prof.name||'Hero').slice(0,12);
Snd.mute=!!prof.mute;
function toast(m,ms=1800){const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>e.style.display='none',ms)}

/* ================= state ================= */
let G=null;            // host simulation
let V=null;            // guest view {P,E,J,K Maps, w}
let L=null;            // local player controls state
let ME=null;           // local player record (host: G.P[0]; guest: mirror)
let myId=0,INFO=new Map(),playing=false,screen='sMenu';
const R={online:false,host:true,code:'',pl:[],bots:2,diff:1,map:0,waves:10,you:0};
const MESH={p:new Map(),e:new Map(),j:new Map(),k:new Map()};
const keys=new Set();
let locked=false,touchOn=false,lastTs=0,clock=0,hmT=0,lastHp=100,hurtT=0;
const J={x:0,y:0,id:-1};   // joystick

/* ================= screens / UI ================= */
const SCR=['sMenu','sLobby','sRoom','sSkin','sHow','sEnd'];
function show(id){screen=id;SCR.forEach(s=>$('#'+s).classList.toggle('on',s===id))}
function hideScreens(){SCR.forEach(s=>$('#'+s).classList.remove('on'))}
function applyLang(){
 document.documentElement.lang=LANGS[prof.lang];
 document.querySelectorAll('[data-i]').forEach(e=>e.textContent=tr(e.dataset.i));
 $('#sub').textContent=tr('sub');$('#bPlay').textContent=tr('play');$('#bOnline').textContent=tr('online');$('#bSkin').textContent=tr('soldier');$('#bHow').textContent=tr('how');
 $('#pname').placeholder=tr('name');$('#howTxt').textContent=tr('howText');
 $('#mapSeg').innerHTML='';$('#waveSeg').innerHTML='';$('#diffSeg').innerHTML='';renderRoom();renderSkins();
 $('#bMute').textContent=$('#bHMute').textContent=Snd.mute?'🔇':'🔊'}
(function(){const s=$('#lang');LNAME.forEach((n,i)=>{const o=document.createElement('option');o.value=i;o.textContent=n;s.appendChild(o)});s.value=prof.lang;
 s.onchange=()=>{prof.lang=+s.value;saveProf();applyLang()};
 const pn=$('#pname');pn.value=prof.name;pn.oninput=()=>{prof.name=pn.value.slice(0,12);saveProf()}})();
function setMute(v){Snd.init();Snd.setMute(v);prof.mute=v?1:0;saveProf();$('#bMute').textContent=$('#bHMute').textContent=v?'🔇':'🔊'}
$('#bMute').onclick=()=>setMute(!Snd.mute);$('#bHMute').onclick=()=>setMute(!Snd.mute);

function renderSkins(){
 const rk=rankOf(prof.xp),g=$('#skinGrid');g.innerHTML='';
 SKINS.forEach((s,i)=>{const d=document.createElement('div');d.className='sk'+(prof.skin===i?' on':'')+(rk<s.r?' lock':'');
  d.innerHTML=`<i style="background:${s.c}"></i>${s.n}<br><small>${rk<s.r?'🔒 '+tr('locked')+' '+s.r:'✓'}</small>`;
  d.onclick=()=>{if(rk<s.r)return;prof.skin=i;saveProf();Snd.init();Snd.play('click');renderSkins()};g.appendChild(d)});
 const nx=rk<10?rankXp(rk+1):rankXp(10),pv=rankXp(rk);
 $('#rankTxt').textContent=`${tr('rank')} ${rk} · ${prof.xp} XP`;$('#xpBar i').style.width=(rk>=10?100:clamp((prof.xp-pv)/(nx-pv)*100,0,100))+'%'}
$('#bSkin').onclick=()=>{Snd.init();Snd.play('click');renderSkins();show('sSkin')};$('#bSkinBack').onclick=()=>show('sMenu');
$('#bHow').onclick=()=>{Snd.init();Snd.play('click');show('sHow')};$('#bHowBack').onclick=()=>show('sMenu');

/* ---- room ---- */
const WAVEOPT=[5,10,15,20,0];
function seg(el,labels,sel,on,dis){
 if(el.children.length!==labels.length){el.innerHTML='';labels.forEach((l,i)=>{const b=document.createElement('button');b.onclick=()=>{if(!R.host)return;Snd.play('click');on(i)};el.appendChild(b)})}
 [...el.children].forEach((b,i)=>{b.textContent=labels[i];b.classList.toggle('on',i===sel);b.disabled=dis})}
function renderRoom(){
 const dis=!R.host;
 seg($('#mapSeg'),[0,1,2,3].map(i=>tr('m'+i)),R.map,i=>{R.map=i;changed()},dis);
 seg($('#waveSeg'),WAVEOPT.map(w=>w?w+'':'∞'),WAVEOPT.indexOf(R.waves),i=>{R.waves=WAVEOPT[i];changed()},dis);
 seg($('#diffSeg'),[tr('easy'),tr('normal'),tr('hard')],R.diff,i=>{R.diff=i;changed()},dis);
 const l=$('#roomList');l.innerHTML='';
 R.pl.forEach((p,i)=>{const d=document.createElement('div');d.className='li';d.innerHTML=`<span class="dot" style="background:${SKINS[p.s|0].c}"></span>${esc(p.n)}${i===R.you?' ★':''}<small>${tr('rank')} ${p.k}</small>`;l.appendChild(d)});
 if(R.bots>0){const d=document.createElement('div');d.className='li';d.innerHTML=`<span class="dot" style="background:#888"></span>🤖 ×${R.bots}`;l.appendChild(d)}
 $('#botN').textContent=R.bots;$('#botDn').disabled=$('#botUp').disabled=dis;
 $('#codeBox').hidden=!R.online;$('#roomCode').textContent=R.code;
 $('#bStart').disabled=dis;$('#roomMsg').textContent=dis?tr('waitHost'):''}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function maxBots(){return Math.max(0,16-R.pl.length)}
function openRoom(){if(!R.online)R.pl=[{n:myName(),s:prof.skin,k:rankOf(prof.xp)}];R.you=0;R.bots=clamp(R.bots,0,maxBots());renderRoom();show('sRoom')}
function roomBroadcast(){
 const guests=Net.conns.filter(x=>x.ready);
 R.pl=[{n:myName(),s:prof.skin,k:rankOf(prof.xp)}].concat(guests.map(x=>({n:x.name,s:x.skin,k:x.rank})));
 R.bots=clamp(R.bots,0,maxBots());
 guests.forEach((x,i)=>Net.send(x.c,{t:'room',pl:R.pl,bots:R.bots,diff:R.diff,map:R.map,waves:R.waves,you:i+1}))}
function changed(){if(R.online&&R.host)roomBroadcast();renderRoom()}
$('#botDn').onclick=()=>{R.bots=clamp(R.bots-1,0,maxBots());changed()};
$('#botUp').onclick=()=>{R.bots=clamp(R.bots+1,0,maxBots());changed()};
$('#bPlay').onclick=()=>{Snd.init();Snd.play('click');R.online=false;R.host=true;R.code='';R.bots=Math.max(R.bots,3);openRoom()};
$('#bRoomBack').onclick=()=>{Snd.play('click');if(R.online)Net.close();R.online=false;R.host=true;show('sMenu')};

/* ================= local weapon logic ================= */
function newLocal(){
 L={x:0,y:0,z:7,vy:0,vx:0,vz:0,yaw:0,pitch:0,wi:1,ammo:W.map(()=>({m:0,r:0})),gren:3,cd:0,gcd:0,rl:0,fire:false,scope:false,og:true,bob:0,kick:0,flash:0,sendT:0,jump:false,fov:75};
 L.ammo[0]={m:12,r:-1};L.ammo[1]={m:30,r:150}}
const owns=i=>(ME.own>>i)&1;
function selectWeapon(i){if(i<0||i>5||!owns(i)||i===L.wi)return;L.wi=i;L.rl=0;L.cd=.25;L.scope=false;Snd.play('click',.5)}
function nextWeapon(d){let i=L.wi;for(let k=0;k<6;k++){i=(i+d+6)%6;if(owns(i)){selectWeapon(i);return}}}
function startReload(){const w=W[L.wi],a=L.ammo[L.wi];if(!ME.alive||L.rl>0||a.m>=w.mag||a.r===0)return;L.rl=w.rl;L.scope=false;Snd.play('reload')}
function finishReload(){const w=W[L.wi],a=L.ammo[L.wi],need=w.mag-a.m,take=a.r<0?need:Math.min(need,a.r);a.m+=take;if(a.r>0)a.r-=take}
function camDir(){const cp=Math.cos(L.pitch);return[-Math.sin(L.yaw)*cp,Math.sin(L.pitch),-Math.cos(L.yaw)*cp]}
function tryFire(){
 if(!ME.alive||L.rl>0||L.cd>0||!playing)return;
 const w=W[L.wi],a=L.ammo[L.wi];
 if(a.m<=0){if(a.r!==0)startReload();else{Snd.play('empty');L.cd=.3}return}
 a.m--;L.cd=1/w.rof;
 const o=[L.x,L.y+1.62,L.z],d=camDir();
 if(G)hostFire(G.P[0],L.wi,o,d,L.scope);else Net.send(Net.conn,{t:'f',w:L.wi,o:o.map(r2),d:d.map(r3),s:L.scope?1:0});
 Snd.play(w.snd,.9);L.flash=.05;L.kick=Math.min(1,L.kick+.6);
 L.pitch=clamp(L.pitch+w.kick*(L.scope?.4:1)*rnd(.6,1),-1.5,1.5);L.yaw+=rnd(-.4,.4)*w.kick*.3;
 if(w.pel){const t=Math.min(rayObs(o[0],o[1],o[2],d[0],d[1],d[2],90),90),rt=[-d[2],0,d[0]],mx=o[0]+d[0]*.9+rt[0]*.25,my=o[1]+d[1]*.9-.18,mz=o[2]+d[2]*.9+rt[2]*.25;
  fxTracer(mx,my,mz,o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t)}
 if(a.m===0&&a.r!==0)setTimeout(()=>{if(playing&&L&&!L.rl&&L.ammo[L.wi].m===0)startReload()},180)}
function throwGrenade(){
 if(!playing||!ME.alive||L.gren<=0||L.gcd>0)return;L.gren--;L.gcd=.8;
 const o=[L.x,L.y+1.5,L.z],d=camDir();d[1]+=.22;const n=Math.hypot(d[0],d[1],d[2]);d.forEach((v,i)=>d[i]=v/n);
 if(G)hostGrenade(G.P[0],o,d);else Net.send(Net.conn,{t:'g',o:o.map(r2),d:d.map(r3)});Snd.play('click',.6)}
function applyGive(id){
 if(id[0]==='w'){const i=+id[1];L.ammo[i]={m:W[i].mag,r:W[i].res};L.wi=i;L.rl=0;L.scope=false}
 else if(id==='ammo'){for(let i=1;i<6;i++)if(owns(i))L.ammo[i]={m:W[i].mag,r:W[i].res};L.gren=Math.max(L.gren,3)}
 else if(id==='gren')L.gren=Math.min(9,L.gren+3);
 else if(id==='am'){for(let i=1;i<6;i++)if(owns(i)){const a=L.ammo[i];a.r=Math.min(W[i].res,a.r+Math.ceil(W[i].res*.4))}L.gren=Math.min(9,L.gren+1)}
 Snd.play('coin',.7)}

/* ================= host simulation ================= */
function mkPlayer(id,name,skin,human,conn){
 return{id,name,skin,human,conn,x:0,y:0,z:0,yaw:0,pitch:0,wi:1,hp:100,ar:0,mhp:100,alive:true,kills:0,deaths:0,coins:200,own:3,dmgLv:0,hpLv:0,inv:0,nf:0,gf:0,xp:0,dmgDone:0,rc:100,rv:null,
  ai:{cd:rnd(0,.4),sd:Math.random()<.5?1:-1,tg:null,tc:0,ev:0,stk:0}}}
function spawnSpot(){for(let i=0;i<20;i++){const a=rnd(0,6.28),r=rnd(4,11),x=Math.cos(a)*r,z=Math.sin(a)*r;if(!inObs(x,.5,z))return{x,z}}return{x:0,z:0}}
function newGame(){
 return{t:0,P:[],E:[],J:[],K:[],evOut:[],nid:1,wave:0,total:R.waves,state:'prep',timer:7,queue:[],sp:0,diff:R.diff,over:false,snapT:0,sendEv:Net.conns.some(x=>x.ready)}}
function emit(ev){applyEv(ev);if(G&&G.sendEv&&G.evOut.length<60)G.evOut.push(ev)}
function respCost(){return 100+30*Math.max(0,G.wave-1)}
function hurtP(p,dmg){
 if(!p.alive||p.inv>0||G.over)return;
 let a=0;if(p.ar>0){a=Math.min(p.ar,dmg*.7);p.ar-=a}p.hp-=dmg-a;
 if(p.hp<=0){p.hp=0;p.alive=false;p.deaths++;emit({k:'d',p:p.id})}}
function revive(p,free){
 const s=spawnSpot();p.x=s.x;p.z=s.z;p.y=0;p.alive=true;p.hp=p.mhp;p.ar=free?p.ar:Math.max(p.ar,25);p.inv=2.5;
 if(p.id===0){L.x=s.x;L.z=s.z;L.y=0;L.vy=0;L.vx=L.vz=0}else if(p.conn)p.rv=[r1(s.x),r1(s.z)]}
function waveSize(n){const pc=G.P.length;return Math.round((8+3.2*n)*(.55+.09*pc)*[.8,1,1.2][G.diff])}
function startWave(){
 const g=G,n=++g.wave;g.state='fight';g.queue=[];g.sp=1;
 const cnt=waveSize(n),hv=n>=3?Math.min(.4,(n-2)*.06):0;
 for(let i=0;i<cnt;i++)g.queue.push(Math.random()<hv?1:0);
 const boss=n%5===0||(g.total>0&&n===g.total);
 if(boss){g.queue.unshift(n%10===0?3:2);emit({k:'b',m:'boss',n})}else emit({k:'b',m:'wave',n})}
function spawnEnemy(ty){
 const T=ET[ty],g=G;let x=0,z=0;
 for(let i=0;i<14;i++){const a=rnd(0,6.28),r=rnd(56,66);x=Math.cos(a)*r;z=Math.sin(a)*r;if(!inObs(x,.5,z))break}
 const pc=g.P.length,n=g.wave;
 let hp=T.hp*(1+.07*(n-1))*DIFH[g.diff]*(1+.04*(pc-1));if(T.boss)hp*=1+.1*(pc-1)+.02*n;
 g.E.push({id:g.nid++,ty,x,y:T.fly?13:0,z,yaw:0,hp,mhp:hp,cd:rnd(.5,1.5),tg:null,tc:0,sd:Math.random()<.5?1:-1,av:0,stk:0,sv:rnd(.88,1.12),spd:0,dm:DIFD[g.diff]*(1+.02*n)})}
function waveClear(){
 const g=G;emit({k:'b',m:'clear',n:g.wave});
 g.P.forEach(p=>{if(p.human){p.coins+=50+10*g.wave;p.xp+=5*g.wave}if(!p.alive)revive(p,true);else p.hp=Math.min(p.mhp,p.hp+25)});
 if(g.total>0&&g.wave>=g.total){endGame(true);return}
 g.state='prep';g.timer=10}
function los(x1,y1,z1,x2,y2,z2){const dx=x2-x1,dy=y2-y1,dz=z2-z1,d=Math.hypot(dx,dy,dz)||1;return rayObs(x1,y1,z1,dx/d,dy/d,dz/d,d)>=d-.6}
function pickDrop(x,z){
 const g=G,r=Math.random();if(g.K.length>14)return;
 const k=r<.14?'h':r<.27?'a':r<.45?'m':null;if(k)g.K.push({id:g.nid++,k,x,z,t:28})}
function killEnemy(e,by){
 const T=ET[e.ty],g=G;g.E.splice(g.E.indexOf(e),1);
 if(by){by.kills++;by.xp+=T.xp;g.P.forEach(p=>{if(p.human){if(p===by)p.coins+=T.coin;else if(p.alive)p.coins+=Math.round(T.coin*.35)}})}
 emit({k:'k',x:r1(e.x),y:r1(e.y),z:r1(e.z),ty:e.ty});pickDrop(e.x,e.z)}
function hurtE(e,dmg,by,hs){
 if(!G.E.includes(e))return;
 e.hp-=dmg;if(by)by.dmgDone+=dmg;
 if(e.hp<=0){killEnemy(e,by);if(by&&by.human)emit({k:'h',p:by.id,kill:1})}
 else if(by&&by.human)emit({k:'h',p:by.id,kill:0,hs:hs?1:0})}
function eRay(ox,oy,oz,dx,dy,dz,maxT){
 let best=maxT,he=null;
 for(const e of G.E){const T=ET[e.ty],y0=T.fly?e.y-1.5:e.y,t=rayCyl(ox,oy,oz,dx,dy,dz,e.x,e.z,T.r+.12,y0,y0+(T.fly?3:T.h),best);if(t>=0&&t<best){best=t;he=e}}
 return{t:best,e:he}}
function hostFire(p,wi,o,d,scoped){
 const g=G,w=W[wi];if(!p.alive||!((p.own>>wi)&1)||g.over)return;
 if(g.t<p.nf-.03)return;p.nf=g.t+.9/w.rof;
 const dl=Math.hypot(d[0],d[1],d[2])||1;d=[d[0]/dl,d[1]/dl,d[2]/dl];
 const ox=clamp(o[0],-HALF,HALF),oy=clamp(o[1],.2,40),oz=clamp(o[2],-HALF,HALF);
 if(wi===5){spawnProj('r',ox+d[0]*.8,oy-.1+d[1]*.8,oz+d[2]*.8,d,46,p.id,w.dmg*(1+.12*p.dmgLv),w.rad,5);emit({k:'s',p:p.id,w:5,a:[r1(ox),r1(oy),r1(oz)],b:[r1(ox+d[0]*3),r1(oy+d[1]*3),r1(oz+d[2]*3)]});return}
 const sp=w.spr*(scoped?.35:1),mult=1+.12*p.dmgLv;let first=null;
 for(let i=0;i<w.pel;i++){
  let dx=d[0]+rnd(-sp,sp),dy=d[1]+rnd(-sp,sp),dz=d[2]+rnd(-sp,sp);const n=Math.hypot(dx,dy,dz);dx/=n;dy/=n;dz/=n;
  const to=rayObs(ox,oy,oz,dx,dy,dz,w.rng),er=eRay(ox,oy,oz,dx,dy,dz,to);let t=to;
  if(er.e){t=er.t;const e=er.e,T=ET[e.ty],head=!T.fly&&e.ty<2&&(oy+dy*t)>e.y+T.h*.78;
   let dm=w.dmg*mult*(head?2:1);if(w.pel>1)dm*=1-t/w.rng*.65;hurtE(e,dm,p,head)}
  else if(i<2)emit({k:'i',x:r1(ox+dx*t),y:r1(oy+dy*t),z:r1(oz+dz*t)});
  if(i===0)first=[ox+dx*t,oy+dy*t,oz+dz*t]}
 emit({k:'s',p:p.id,w:wi,a:[r1(ox+d[0]*.9),r1(oy-.2+d[1]*.9),r1(oz+d[2]*.9)],b:first.map(r1)})}
function hostGrenade(p,o,d){
 if(!p.alive||G.over)return;if(G.t<p.gf-.05)return;p.gf=G.t+.6;
 const dl=Math.hypot(d[0],d[1],d[2])||1;d=[d[0]/dl,d[1]/dl,d[2]/dl];
 spawnProj('g',o[0]+d[0],o[1]+d[1],o[2]+d[2],d,17,p.id,130*(1+.12*p.dmgLv),6,2.3)}
function spawnProj(k,x,y,z,d,sp,owner,dmg,rad,fuse){
 G.J.push({id:G.nid++,k,x,y,z,vx:d[0]*sp,vy:d[1]*sp,vz:d[2]*sp,owner,dmg,rad,life:fuse,yaw:Math.atan2(-d[0],-d[2])})}
function explode(j){
 const g=G;g.J.splice(g.J.indexOf(j),1);emit({k:'x',x:r1(j.x),y:r1(j.y),z:r1(j.z),r:j.rad});
 if(j.owner>=0){const by=g.P.find(p=>p.id===j.owner);
  for(const e of g.E.slice()){const T=ET[e.ty],cy=e.y+(T.fly?0:T.h/2),d=Math.hypot(e.x-j.x,cy-j.y,e.z-j.z)-T.r;if(d<j.rad)hurtE(e,j.dmg*(1-clamp(d,0,j.rad)/j.rad*.7),by,false)}
  if(by&&by.alive){const d=Math.hypot(by.x-j.x,by.y+1-j.y,by.z-j.z);if(d<j.rad*.7)hurtP(by,j.dmg*.25*(1-d/(j.rad*.7)))}}
 else for(const p of g.P){if(!p.alive)continue;const d=Math.hypot(p.x-j.x,p.y+1-j.y,p.z-j.z);if(d<j.rad)hurtP(p,j.dmg*(1-d/j.rad*.7))}}
function stepProjs(dt){
 const g=G;
 for(const j of g.J.slice()){
  j.life-=dt;const sp=Math.hypot(j.vx,j.vy,j.vz),n=Math.max(1,Math.ceil(sp*dt/.5)),h=dt/n;let boom=false;
  for(let s=0;s<n&&!boom;s++){
   if(j.k==='g')j.vy-=22*h;
   const nx=j.x+j.vx*h,ny=j.y+j.vy*h,nz=j.z+j.vz*h;
   if(j.k==='g'){
    if(ny<.15){j.y=.15;j.vy=-j.vy*.4;j.vx*=.65;j.vz*=.65;j.x=nx;j.z=nz;continue}
    if(inObs(nx,ny,nz)){j.vx*=-.4;j.vz*=-.4;continue}
    j.x=nx;j.y=ny;j.z=nz}
   else{j.x=nx;j.y=ny;j.z=nz;
    if(j.y<.1||inObs(j.x,j.y,j.z))boom=true;
    else if(j.owner>=0){for(const e of g.E){const T=ET[e.ty],cy=e.y+(T.fly?0:T.h/2);if(Math.hypot(e.x-j.x,e.z-j.z)<T.r+.5&&Math.abs(cy-j.y)<T.h/2+.5){boom=true;break}}}
    else for(const p of g.P)if(p.alive&&Math.hypot(p.x-j.x,p.z-j.z)<1.1&&j.y<p.y+2.1){boom=true;break}}}
  if(j.k!=='g'&&j.life<=0)boom=true;
  if(boom||(j.k==='g'&&j.life<=0))explode(j)}}
function meMsg(p){const m={t:'me',hp:Math.round(p.hp),ar:Math.round(p.ar),mhp:p.mhp,coins:p.coins,own:p.own,dmgLv:p.dmgLv,hpLv:p.hpLv,alive:p.alive?1:0,kills:p.kills,rc:p.rc};if(p.rv){m.rv=p.rv;p.rv=null}return m}
function giveTo(p,id){if(p.id===0)applyGive(id);else if(p.conn){Net.send(p.conn,meMsg(p));Net.send(p.conn,{t:'give',id})}}
function pickupStep(dt){
 const g=G;
 for(let i=g.K.length-1;i>=0;i--){const k=g.K[i];k.t-=dt;if(k.t<=0){g.K.splice(i,1);continue}
  for(const p of g.P){if(!p.human||!p.alive||Math.hypot(p.x-k.x,p.z-k.z)>1.8)continue;
   if(k.k==='h'){if(p.hp>=p.mhp)continue;p.hp=Math.min(p.mhp,p.hp+35)}else if(k.k==='a'){if(p.ar>=100)continue;p.ar=Math.min(100,p.ar+35)}else giveTo(p,'am');
   emit({k:'pk',p:p.id});g.K.splice(i,1);break}}}
function hostBuy(p,id){
 const it=SHOP.find(s=>s.id===id);if(!it||G.over)return;
 const lv=it.lv?p[it.lv]:0;if(it.lv&&lv>=it.max)return;
 const cost=it.cost(lv);if(it.w&&((p.own>>it.w)&1))return;
 if(p.coins<cost){if(p.id===0)toast(tr('noCoins'));else Net.send(p.conn,{t:'err'});return}
 if(id==='armor'&&p.ar>=100||id==='med'&&p.hp>=p.mhp)return;
 p.coins-=cost;
 if(it.w){p.own|=1<<it.w;giveTo(p,id)}
 else if(id==='ammo'||id==='gren')giveTo(p,id);
 else if(id==='armor')p.ar=Math.min(100,p.ar+50);
 else if(id==='med')p.hp=Math.min(p.mhp,p.hp+60);
 else if(id==='dmg')p.dmgLv++;
 else if(id==='hp'){p.hpLv++;p.mhp+=20;p.hp+=20}
 if(p.id===0)Snd.play('coin',.7)}

/* ---- AI ---- */
function enemyAI(e,dt){
 const g=G,T=ET[e.ty];
 e.tc-=dt;if(e.tc<=0||!e.tg||!e.tg.alive){e.tc=.5+Math.random()*.3;let b=null,bd=1e9;for(const p of g.P){if(!p.alive)continue;const d=(p.x-e.x)**2+(p.z-e.z)**2;if(d<bd){bd=d;b=p}}e.tg=b}
 const tg=e.tg;if(!tg)return;
 const dx=tg.x-e.x,dz=tg.z-e.z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d;
 e.yaw=Math.atan2(-dx,-dz);
 const want=T.fly?24:e.ty===2?34:e.ty===1?20:15+(e.id%5)*2;
 let mx=0,mz=0;
 if(e.av>0){e.av-=dt;mx=-uz*e.sd;mz=ux*e.sd}
 else if(d>want+3){mx=ux;mz=uz}else if(d<want*.55){mx=-ux;mz=-uz}else{mx=-uz*e.sd*.7;mz=ux*e.sd*.7;if(Math.random()<dt*.25)e.sd=-e.sd}
 const sp=T.spd*e.sv*(d>want+3?1:.6);e.spd=sp;
 const ox=e.x,oz=e.z;e.x+=mx*sp*dt;e.z+=mz*sp*dt;
 if(T.fly){e.x=clamp(e.x,-HALF+3,HALF-3);e.z=clamp(e.z,-HALF+3,HALF-3);e.y+=(13+Math.sin(g.t*.5+e.id)*2-e.y)*dt}
 else{collide(e,T.r,0,false);const mv=Math.hypot(e.x-ox,e.z-oz);if(mv<sp*dt*.3&&(mx||mz)){e.stk+=dt;if(e.stk>.35){e.av=.9;e.sd=-e.sd;e.stk=0}}else e.stk=0}
 e.cd-=dt;
 if(e.cd<=0&&d<T.rng){
  const ey=T.fly?e.y:T.h*.72,ty=tg.y+1.25;
  if(los(e.x,ey,e.z,tg.x,ty,tg.z)){
   e.cd=rnd(T.cd[0],T.cd[1]);
   if(e.ty<2){
    const ph=clamp(.8-d*.014,.14,.72)*(g.diff===0?.75:g.diff===2?1.15:1);
    const hit=Math.random()<ph;if(hit)hurtP(tg,T.dmg*e.dm);
    const ex=hit?tg.x:tg.x+rnd(-1.6,1.6),ez=hit?tg.z:tg.z+rnd(-1.6,1.6);
    emit({k:'s',p:-1,w:9+e.ty,a:[r1(e.x+ux*.8),r1(ey),r1(e.z+uz*.8)],b:[r1(ex),r1(hit?ty:rnd(.3,1.6)),r1(ez)]})}
   else{const sy=e.ty===2?2.2:e.y-.8,dd=Math.hypot(dx,ty-sy,dz),dir=[dx/dd,(ty-sy)/dd,dz/dd];
    spawnProj(e.ty===2?'e':'m',e.x+dir[0]*3,sy,e.z+dir[2]*3,dir,e.ty===2?30:34,-1,T.dmg*e.dm,e.ty===2?5:3.5,6);
    emit({k:'s',p:-1,w:9+e.ty,a:[r1(e.x),r1(sy),r1(e.z)],b:[r1(e.x+dir[0]*4),r1(sy+dir[1]*4),r1(e.z+dir[2]*4)]})}}
  else e.cd=.25}}
function allyAI(p,dt){
 const g=G;if(!p.alive)return;const a=p.ai;
 a.tc-=dt;if(a.tc<=0){a.tc=.4+Math.random()*.3;let b=null,bd=1e9;for(const e of g.E){const d=(e.x-p.x)**2+(e.z-p.z)**2;if(d<bd){bd=d;b=e}}a.tg=b}
 let mx=0,mz=0,face=null,dist=1e9;
 if(a.tg&&g.E.includes(a.tg)){const e=a.tg,dx=e.x-p.x,dz=e.z-p.z;dist=Math.hypot(dx,dz)||1;face=[dx,dz];
  if(dist>22){mx=dx/dist;mz=dz/dist}else if(dist<10){mx=-dx/dist;mz=-dz/dist}else{mx=-dz/dist*a.sd*.6;mz=dx/dist*a.sd*.6;if(Math.random()<dt*.3)a.sd=-a.sd}}
 else{const h=g.P.find(q=>q.human&&q.alive);if(h){const dx=h.x-p.x,dz=h.z-p.z,d=Math.hypot(dx,dz);if(d>9){mx=dx/d;mz=dz/d}}}
 const ox=p.x,oz=p.z,sp=5;p.x+=mx*sp*dt;p.z+=mz*sp*dt;collide(p,.45,0,false);
 if((mx||mz)&&Math.hypot(p.x-ox,p.z-oz)<sp*dt*.3){a.stk+=dt;if(a.stk>.4){a.sd=-a.sd;a.stk=0}}else a.stk=0;
 if(face)p.yaw=Math.atan2(-face[0],-face[1]);
 a.cd-=dt;
 if(face&&a.cd<=0&&dist<65){
  const e=a.tg,T=ET[e.ty],ty=T.fly?e.y:T.h*.6;
  if(los(p.x,1.5,p.z,e.x,ty,e.z)){a.cd=rnd(.14,.32);
   if(Math.random()<.55)hurtE(e,15*(1+.12*p.dmgLv),p,false);
   if(g.t-a.ev>.3){a.ev=g.t;const f=1/dist;emit({k:'s',p:p.id,w:1,a:[r1(p.x+face[0]*f*.9),1.3,r1(p.z+face[1]*f*.9)],b:[r1(e.x+rnd(-.5,.5)),r1(ty),r1(e.z+rnd(-.5,.5))]})}}
  else a.cd=.3}}
function waveStep(dt){
 const g=G;
 if(g.state==='prep'){g.timer-=dt;if(g.timer<=0)startWave();return}
 if(g.queue.length){g.sp-=dt;if(g.sp<=0){g.sp=.45;const cap=MOBILE?18:28,living=g.E.reduce((n,e)=>n+(ET[e.ty].boss?0:1),0);if(living<cap||ET[g.queue[0]].boss)spawnEnemy(g.queue.shift())}}
 else if(g.E.length===0)waveClear()}
function hostStep(dt){
 const g=G;if(g.over)return;g.t+=dt;
 const me=g.P[0];me.x=L.x;me.y=L.y;me.z=L.z;me.yaw=L.yaw;me.wi=L.wi;me.pitch=L.pitch;
 for(const p of g.P)if(p.inv>0)p.inv-=dt;
 waveStep(dt);if(g.over)return;
 for(const p of g.P)if(!p.human)allyAI(p,dt);
 for(const e of g.E.slice())enemyAI(e,dt);
 stepProjs(dt);pickupStep(dt);
 const cost=respCost();g.P.forEach(p=>p.rc=cost);
 if(g.P.every(p=>!p.alive)&&!g.P.some(p=>p.human&&p.coins>=cost))endGame(false);
 g.snapT-=dt;if(g.snapT<=0){g.snapT=.1;sendSnap()}}
function sendSnap(){
 const g=G,guests=Net.conns.filter(x=>x.ready&&x.p);if(!guests.length){g.evOut.length=0;return}
 const s={t:'s',w:[g.wave,g.total,g.E.length+g.queue.length,g.state==='fight'?1:0,Math.ceil(Math.max(0,g.timer))],
  p:g.P.map(p=>[p.id,r1(p.x),r1(p.z),r2(p.yaw),p.alive?1:0,p.wi,Math.round(p.hp),p.kills,r1(p.y)]),
  e:g.E.map(e=>[e.id,e.ty,r1(e.x),r1(e.y),r1(e.z),r2(e.yaw),Math.max(1,Math.ceil(e.hp/e.mhp*100))]),
  j:g.J.map(j=>[j.id,j.k,r1(j.x),r1(j.y),r1(j.z),r2(j.yaw)]),k:g.K.map(k=>[k.id,k.k,r1(k.x),r1(k.z)]),ev:g.evOut};
 guests.forEach(x=>{const p=x.p;Net.send(x.c,s);
  Net.send(x.c,meMsg(p))});
 g.evOut=[]}
function endGame(win){
 const g=G;if(g.over)return;g.over=true;
 const res=g.P.map(p=>[p.id,p.name,p.kills,p.deaths,p.xp,p.human?1:0]);
 Net.conns.forEach(x=>Net.send(x.c,{t:'end',win:win?1:0,res,wave:g.wave}));
 setTimeout(()=>{if(G===g)showEnd(win,res,g.wave)},1600)}

/* ================= events (both) ================= */
function vol(x,z,m=90){return clamp(1-Math.hypot(x-L.x,z-L.z)/m,0,1)}
function applyEv(ev){
 if(!playing||!L)return;
 switch(ev.k){
  case's':{const a=ev.a,b=ev.b;
   if(ev.p===myId)break;
   fxTracer(a[0],a[1],a[2],b[0],b[1],b[2],ev.p<0?0xff6a4a:0xffe08a);
   const v=vol(a[0],a[2]);
   if(ev.p<0)Snd.play(ev.w>=11?'cannon':'enemy',v*(ev.w>=11?.9:.5));else Snd.play(W[ev.w].snd,v*.6);break}
  case'i':fxSparks(ev.x,ev.y,ev.z,0xffe0a0,3);break;
  case'x':fxBoom(ev.x,ev.y,ev.z,ev.r);Snd.play('boom',vol(ev.x,ev.z,110));break;
  case'h':if(ev.p===myId){hmT=.14;const h=$('#hm');h.classList.add('on');h.classList.toggle('kill',!!ev.kill);Snd.play(ev.kill?'kill':'hit',.7)}break;
  case'k':fxSparks(ev.x,ev.y+1,ev.z,0xaa2a20,8);if(ev.ty>=2){fxBoom(ev.x,ev.y+1,ev.z,5);Snd.play('boom',vol(ev.x,ev.z,120))}break;
  case'd':{const i=INFO.get(ev.p);feed((i?i.name:'?')+' ✖',ev.p===myId?'#ff7d6a':'#ddd');break}
  case'pk':if(ev.p===myId)Snd.play('pick',.7);break;
  case'b':{const n=ev.n;
   if(ev.m==='wave'){banner(tr('wave')+' '+n);Snd.play('horn',.6)}
   else if(ev.m==='boss'){banner('⚠ '+tr('bossAlert'),3000);Snd.play('horn',1)}
   else banner(tr('waveClear'),2500);break}}}
let bannerT=0;
function banner(txt,ms=2200){const b=$('#banner');b.textContent=txt;b.classList.add('on');clearTimeout(bannerT);bannerT=setTimeout(()=>b.classList.remove('on'),ms)}
function feed(txt,col){const f=$('#feed'),d=document.createElement('div');d.textContent=txt;d.style.color=col||'#fff';f.appendChild(d);while(f.children.length>5)f.firstChild.remove();setTimeout(()=>d.remove(),4500)}

/* ================= local movement / camera ================= */
function moveLocal(dt){
 if(!ME.alive){L.vx=L.vz=0;return}
 let kx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),kz=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
 kx+=J.x;kz+=-J.y;const kn=Math.hypot(kx,kz);if(kn>1){kx/=kn;kz/=kn}
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight')||(kn>.92&&touchOn);
 const sp=(sprint?8.6:6)*(L.scope?.5:1)*(L.rl>0?.9:1);
 const f=fwd(L.yaw),rx=Math.cos(L.yaw),rz=-Math.sin(L.yaw);
 const tx=(f.x*kz+rx*kx)*sp,tz=(f.z*kz+rz*kx)*sp,k=Math.min(1,dt*14);
 L.vx+=(tx-L.vx)*k;L.vz+=(tz-L.vz)*k;
 const p={x:L.x+L.vx*dt,z:L.z+L.vz*dt};
 let gh=collide(p,.42,L.y,true);L.x=p.x;L.z=p.z;
 if((keys.has('Space')||L.jump)&&L.og){L.vy=7.4;L.og=false}
 L.vy-=22*dt;L.y+=L.vy*dt;
 if(L.y<=gh){L.y=gh;L.vy=0;L.og=true}else L.og=false;
 L.bob+=Math.hypot(L.vx,L.vz)*dt*1.6*(L.og?1:0)}
function updateCamera(dt){
 const tf=ME.alive?(L.scope?(W[L.wi].scope?20:52):(MOBILE?80:75)):75;L.fov+=(tf-L.fov)*Math.min(1,dt*14);
 if(Math.abs(camera.fov-L.fov)>.05){camera.fov=L.fov;camera.updateProjectionMatrix()}
 const bobY=Math.sin(L.bob)*.035*(L.scope?.2:1),sh=FX.shake;
 camera.position.set(L.x,L.y+(ME.alive?1.65+bobY:.5),L.z);
 camera.rotation.set(clamp(L.pitch,-1.5,1.5)+(Math.random()-.5)*sh*.06,L.yaw+(Math.random()-.5)*sh*.06,ME.alive?0:.6);
 L.kick=Math.max(0,L.kick-dt*7);L.flash=Math.max(0,L.flash-dt);
 const scopedGun=L.scope&&W[L.wi].scope;
 gunGroup.visible=ME.alive&&!scopedGun;showGun(L.wi,L.flash>0);
 gunGroup.position.set(.26-(L.scope?.2:0),-.25+(L.scope?.04:0)+Math.sin(L.bob*2)*.004,-.5+L.kick*.1);
 gunGroup.rotation.set(L.kick*.12+(L.rl>0?-.5:0),0,Math.sin(L.bob)*.01);
 $('#scope').style.display=scopedGun&&ME.alive?'block':'none';$('#xh').style.display=scopedGun?'none':'block';
 skyMesh.position.copy(camera.position);
 sunL.position.set(L.x+40,70,L.z+25);sunL.target.position.set(L.x,0,L.z)}

/* ================= rendering of entities ================= */
function lists(){return G?{P:G.P,E:G.E,J:G.J,K:G.K}:{P:[...V.P.values()],E:[...V.E.values()],J:[...V.J.values()],K:[...V.K.values()]}}
function syncKind(kind,arr,make,upd,skipId){
 const m=MESH[kind],seen=new Set();
 for(const r of arr){if(r.id===skipId)continue;seen.add(r.id);let o=m.get(r.id);if(!o){o=make(r);scene.add(o);m.set(r.id,o)}upd(o,r)}
 for(const[id,o]of m)if(!seen.has(id)){scene.remove(o);m.delete(id)}}
function renderEntities(dt){
 const ls=lists();
 syncKind('p',ls.P,r=>{const s=SKINS[r.skin|0];const o=makeSoldier(s.c,s.h,1,false);o.userData.lx=r.x;o.userData.lz=r.z;return o},
  (o,r)=>{o.visible=!!r.alive;o.position.set(r.x,r.y,r.z);o.rotation.y=r.yaw;const u=o.userData,sp=Math.hypot(r.x-u.lx,r.z-u.lz)/Math.max(dt,.001);u.lx=r.x;u.lz=r.z;animSoldier(o,sp,clock)},myId);
 syncKind('e',ls.E,r=>makeEnemy(r.ty),
  (o,r)=>{o.position.set(r.x,r.y,r.z);o.rotation.y=r.yaw;const u=o.userData;
   if(r.ty<2){const sp=r.spd!==undefined?r.spd:(Math.hypot(r.x-(u.lx||r.x),r.z-(u.lz||r.z))/Math.max(dt,.001));u.lx=r.x;u.lz=r.z;animSoldier(o,sp,clock+r.id)}
   else if(r.ty===3){u.rot.rotation.y+=dt*30;o.rotation.z=Math.sin(clock*1.3)*.05}});
 syncKind('j',ls.J,r=>makeProj(r.k),(o,r)=>{o.position.set(r.x,r.y,r.z);o.rotation.y=r.yaw});
 syncKind('k',ls.K,r=>makePickup(r.k),(o,r)=>{o.position.set(r.x,Math.sin(clock*3+r.id)*.12,r.z);o.rotation.y=clock*2})}
function smoothView(dt){
 const k=Math.min(1,dt*14),ang=(a,b)=>{let d=b-a;while(d>Math.PI)d-=6.2832;while(d<-Math.PI)d+=6.2832;return a+d*k};
 const sm=r=>{if(r.tx===undefined)return;r.x+=(r.tx-r.x)*k;r.z+=(r.tz-r.z)*k;r.y+=(r.ty-r.y)*k;if(r.tyaw!==undefined)r.yaw=ang(r.yaw,r.tyaw)};
 V.P.forEach(sm);V.E.forEach(sm);V.J.forEach(sm)}

/* ================= HUD ================= */
let hc={};
const setT=(id,v)=>{if(hc[id]!==v){hc[id]=v;$('#'+id).textContent=v}};
function updateHud(dt){
 const w=G?[G.wave,G.total,G.E.length+G.queue.length,G.state==='fight'?1:0,Math.ceil(Math.max(0,G.timer))]:V.w;
 setT('hWave',tr('wave')+' '+w[0]+(w[1]?'/'+w[1]:'')+(w[3]?'':' · '+tr('getReady')+' '+w[4]));
 setT('hLeft',tr('left')+' '+w[2]);setT('hCoins','🪙 '+ME.coins);
 const hp=Math.round(ME.hp),mh=ME.mhp;$('#hpF').style.width=clamp(hp/mh*100,0,100)+'%';setT('hpT','❤ '+hp);
 $('#arF').style.width=clamp(ME.ar,0,100)+'%';setT('arT','🛡 '+Math.round(ME.ar));
 if(hp<lastHp-.5&&ME.alive){hurtT=1;Snd.play('hurt',.7)}lastHp=hp;
 hurtT=Math.max(0,hurtT-dt*2);$('#hurt').style.opacity=clamp(hurtT+(ME.alive&&hp<30?.35+Math.sin(clock*6)*.15:0),0,1);
 const a=L.ammo[L.wi];
 $('#ammo').innerHTML=`${a.m}<small> / ${a.r<0?'∞':a.r}</small>`;
 setT('wname',tr('w'+L.wi)+(L.rl>0?' · …':'')+'  💣'+L.gren);
 let wl='';for(let i=0;i<6;i++)if(owns(i))wl+=`<span class="${i===L.wi?'on':''}">${i+1}</span>`;if(hc.wl!==wl){hc.wl=wl;$('#wlist').innerHTML=wl}
 if(hmT>0){hmT-=dt;if(hmT<=0)$('#hm').classList.remove('on')}
 const ls=lists(),boss=ls.E.find(e=>e.ty>=2);
 if(boss){$('#boss').style.display='block';setT('bossN',tr('bossName'));$('#bossF').style.width=(G?boss.hp/boss.mhp*100:boss.hp)+'%'}else $('#boss').style.display='none';
 const dead=!ME.alive&&!(G&&G.over);
 $('#sDead').classList.toggle('on',dead&&screen==='hud');if(dead&&document.pointerLockElement)document.exitPointerLock();
 if(dead){const c=ME.rc;setT('bResp',tr('respawn')+' · '+c+' 🪙');$('#bResp').disabled=ME.coins<c;setT('deadSub',tr('deadSub'))}
 drawRadar(ls)}
function drawRadar(ls){
 const c=$('#radar'),g=c.getContext('2d'),s=224,h=s/2,range=48;g.clearRect(0,0,s,s);
 g.strokeStyle='rgba(255,255,255,.18)';g.beginPath();g.arc(h,h,h*.5,0,7);g.stroke();
 const c1=Math.cos(L.yaw),s1=Math.sin(L.yaw);
 const dot=(x,z,col,r)=>{const dx=x-L.x,dz=z-L.z,rx=dx*c1-dz*s1,rz=dx*s1+dz*c1;let px=rx/range*h,py=rz/range*h;const d=Math.hypot(px,py);if(d>h-5){px*=(h-5)/d;py*=(h-5)/d}g.fillStyle=col;g.beginPath();g.arc(h+px,h+py,r,0,7);g.fill()};
 ls.K.forEach(k=>dot(k.x,k.z,k.k==='h'?'#e23b3b':k.k==='a'?'#4aa0e0':'#d8b440',3));
 ls.E.forEach(e=>dot(e.x,e.z,'#ff4a3a',e.ty>=2?7:4));
 ls.P.forEach(p=>{if(p.id!==myId&&p.alive)dot(p.x,p.z,p.human?'#6ede5a':'#8ab4ff',4)});
 g.fillStyle='#fff';g.beginPath();g.moveTo(h,h-8);g.lineTo(h-5,h+5);g.lineTo(h+5,h+5);g.fill()}

/* ================= shop ================= */
const SHOPKEY={ammo:'s_ammo',armor:'s_armor',med:'s_med',gren:'s_gren',dmg:'s_dmg',hp:'s_hp'};
function renderShop(){
 $('#shopCoins').textContent='🪙 '+ME.coins;const l=$('#shopList');l.innerHTML='';
 SHOP.forEach(it=>{
  const lv=it.lv?ME[it.lv]||0:0,cost=it.cost(lv),own=it.w&&owns(it.w),maxed=it.lv&&lv>=it.max;
  const name=it.w?tr('w'+it.w):tr(SHOPKEY[it.id]);
  const d=document.createElement('div');d.className='si'+(own||maxed?' own':'')+(!own&&!maxed&&ME.coins<cost?' no':'');
  d.innerHTML=`${esc(name)}${it.lv?' ('+lv+'/'+it.max+')':''}<small>${own||maxed?tr('owned'):'🪙 '+cost}</small>`;
  d.onclick=()=>{if(own||maxed)return;buy(it.id)};l.appendChild(d)})}
function buy(id){Snd.init();if(G)hostBuy(G.P[0],id);else Net.send(Net.conn,{t:'buy',id});setTimeout(()=>{if(screen==='shop')renderShop()},150)}
function openShop(){if(!playing||!ME||(G&&G.over))return;screen='shop';renderShop();$('#sShop').classList.add('on');$('#sDead').classList.remove('on');if(document.pointerLockElement)document.exitPointerLock()}
function closeShop(){$('#sShop').classList.remove('on');screen='hud'}
$('#bShop').onclick=()=>{screen==='shop'?closeShop():openShop()};$('#bShopClose').onclick=closeShop;$('#bDeadShop').onclick=openShop;
setInterval(()=>{if(screen==='shop'&&ME)renderShop()},400);
$('#bResp').onclick=()=>{if(!ME||ME.alive)return;Snd.init();if(G){const p=G.P[0];if(!p.alive&&p.coins>=p.rc){p.coins-=p.rc;revive(p,false);Snd.play('coin')}}else Net.send(Net.conn,{t:'resp'})};

/* ================= game start / end ================= */
function hostStart(){
 const guests=Net.conns.filter(x=>x.ready);
 const seed=Math.floor(Math.random()*1e9),g=newGame();G=g;V=null;g.sendEv=guests.length>0;
 const info=[];const me=mkPlayer(0,myName(),prof.skin,true,null);g.P.push(me);info.push({id:0,name:me.name,skin:me.skin,human:1});
 guests.forEach((x,i)=>{const p=mkPlayer(i+1,x.name,x.skin,true,x.c);x.p=p;g.P.push(p);info.push({id:p.id,name:p.name,skin:p.skin,human:1})});
 for(let i=0;i<R.bots;i++){const id=guests.length+1+i,p=mkPlayer(id,BOTN[i%BOTN.length],i%SKINS.length,false,null);g.P.push(p);info.push({id,name:p.name,skin:p.skin,human:0})}
 g.nid=100;
 g.P.forEach((p,i)=>{const a=i/g.P.length*6.28;p.x=Math.cos(a)*5;p.z=Math.sin(a)*5});
 guests.forEach(x=>Net.send(x.c,{t:'start',map:R.map,seed,waves:R.waves,diff:R.diff,you:x.p.id,pl:info}));
 if(!beginLocal(info,0,R.map,seed)){G=null;return}
 const me0=G.P[0];L.x=me0.x;L.z=me0.z}
function beginLocal(info,you,map,seed){
 if(!initRenderer()){toast('WebGL not available',4000);return false}
 Snd.init();myId=you;INFO=new Map(info.map(i=>[i.id,i]));
 buildWorld(map,seed);newLocal();fxClear();
 Object.values(MESH).forEach(m=>{m.forEach(o=>scene.remove(o));m.clear()});
 if(G){ME=G.P[0]}
 else{ME={hp:100,ar:0,mhp:100,coins:200,own:3,dmgLv:0,hpLv:0,alive:true,kills:0,rc:100};V={P:new Map(),E:new Map(),J:new Map(),K:new Map(),w:[0,R.waves,0,0,7]}}
 lastHp=100;hc={};hideScreens();$('#sDead').classList.remove('on');$('#sShop').classList.remove('on');
 $('#hud').classList.add('on');screen='hud';playing=true;$('#feed').innerHTML='';
 if(MOBILE||touchOn)setTouch(true);
 banner(tr('getReady'),2500);return true}
$('#bStart').onclick=()=>{Snd.init();Snd.play('click');if(R.host)hostStart()};
function showEnd(win,res,wave){
 if(!playing||screen==='sEnd')return;screen='sEnd';if(document.pointerLockElement)document.exitPointerLock();
 $('#sDead').classList.remove('on');$('#sShop').classList.remove('on');
 const me=res.find(r=>r[0]===myId),gain=(me?me[4]:0)+(win?50:0)+wave*2;
 const old=rankOf(prof.xp);prof.xp+=gain;saveProf();
 $('#endTitle').textContent=tr(win?'victory':'defeat');$('#endTitle').style.color=win?'#ffd54f':'#ff7d6a';
 $('#endSub').textContent=`${tr('wave')} ${wave} · +${gain} XP`+(rankOf(prof.xp)>old?' · '+tr('rank')+' '+rankOf(prof.xp)+'!':'');
 let h=`<tr><th>#</th><th></th><th>${tr('kills')}</th><th>${tr('deaths')}</th></tr>`;
 res.slice().sort((a,b)=>b[2]-a[2]).forEach((r,i)=>{h+=`<tr class="${r[0]===myId?'me':''}"><td>${i+1}</td><td>${esc(r[1])}${r[5]?'':' 🤖'}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`});
 $('#endTable').innerHTML=h;hideScreens();$('#sEnd').classList.add('on');$('#hud').classList.remove('on')}
function stopGame(){playing=false;G=null;V=null;ME=null;if(renderer){fxClear();Object.values(MESH).forEach(m=>{m.forEach(o=>scene.remove(o));m.clear()})}$('#hud').classList.remove('on');$('#sDead').classList.remove('on');$('#sShop').classList.remove('on');if(document.pointerLockElement)document.exitPointerLock();keys.clear()}
$('#bEndAgain').onclick=()=>{Snd.play('click');const wasPlaying=playing;stopGame();
 if(R.online){if(R.host){roomBroadcast();Net.conns.forEach(x=>Net.send(x.c,{t:'lobby'}));renderRoom();show('sRoom')}else{renderRoom();show('sRoom')}}
 else{R.online=false;R.host=true;openRoom()}};
$('#bEndMenu').onclick=()=>{Snd.play('click');quitToMenu()};
function quitToMenu(){if(R.online&&R.host)Net.conns.forEach(x=>Net.send(x.c,{t:'bye'}));stopGame();Net.close();R.online=false;R.host=true;hideScreens();show('sMenu')}
$('#bQuit').onclick=()=>{if(confirm('Leave the match?'))quitToMenu()};

/* ================= online ================= */
const Net={peer:null,role:'',conns:[],conn:null,hb:null,wd:null,last:0,
 send(c,m){try{if(c&&c.open)c.send(m)}catch(e){}},
 close(){clearInterval(this.hb);clearInterval(this.wd);try{this.conns.forEach(x=>x.c.close())}catch(e){}try{this.conn&&this.conn.close()}catch(e){}try{this.peer&&this.peer.destroy()}catch(e){}this.peer=null;this.role='';this.conns=[];this.conn=null}};
function loadPeer(){return new Promise((res,rej)=>{if(window.Peer)return res();const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
function openPeer(id){return new Promise((res,rej)=>{const p=id?new Peer(id):new Peer();p.on('open',()=>res(p));p.on('error',rej);setTimeout(()=>rej({type:'timeout'}),12000)})}
const lobMsg=k=>$('#lobMsg').textContent=k?tr(k):'';
const genCode=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<5;i++)s+=a[ri(a.length)];return s};
$('#bOnline').onclick=()=>{Snd.init();Snd.play('click');Net.close();lobMsg();show('sLobby')};
$('#bLobBack').onclick=()=>{Net.close();show('sMenu')};
$('#bCreate').onclick=async()=>{
 Snd.play('click');lobMsg('connecting');
 try{await loadPeer()}catch(e){lobMsg('loadErr');return}
 let code,peer;
 for(let q=0;q<5;q++){code=genCode();try{peer=await openPeer('tof-'+code);break}catch(e){if(!(e&&e.type==='unavailable-id')){lobMsg('connErr');return}}}
 if(!peer){lobMsg('connErr');return}
 Net.peer=peer;Net.role='host';R.online=true;R.host=true;R.code=code;R.bots=Math.min(R.bots,6);
 peer.on('connection',c=>{const x={c,ready:false,name:'',skin:0,rank:1,p:null};
  const reg=()=>{c.on('data',m=>hostData(x,m));c.on('close',()=>guestGone(x));c.on('error',()=>{})};
  if(c.open)reg();else c.on('open',reg)});
 peer.on('error',()=>{});openRoom()};
function guestGone(x){
 const i=Net.conns.indexOf(x);if(i<0)return;Net.conns.splice(i,1);
 if(G&&!G.over){if(x.p){x.p.human=false;x.p.conn=null;x.p.name+=' 🤖'}}
 else if(screen==='sRoom'||screen==='sEnd'){roomBroadcast();if(screen==='sRoom')renderRoom()}}
function refuse(x){Net.send(x.c,{t:'full'});setTimeout(()=>{try{x.c.close()}catch(e){}},300)}
const fin=(...a)=>a.every(Number.isFinite);
function hostData(x,m){
 if(!m||typeof m!=='object')return;
 if(m.t==='hello'){
  if((G&&!G.over)||x.ready)return refuse(x);
  const humans=Net.conns.filter(y=>y.ready).length+1;
  if(humans+R.bots>=16){if(R.bots>0)R.bots--;else return refuse(x)}
  x.name=String(m.name||'Hero').slice(0,12);x.skin=clamp(m.skin|0,0,7);x.rank=clamp(m.rank|0,1,10);
  x.ready=true;Net.conns.push(x);roomBroadcast();renderRoom();return}
 if(!x.ready||!G||!x.p)return;
 const p=x.p;
 if(m.t==='p'){if(fin(m.x,m.y,m.z,m.yaw)){p.x=clamp(m.x,-HALF,HALF);p.z=clamp(m.z,-HALF,HALF);p.y=clamp(m.y,0,30);p.yaw=m.yaw;p.wi=clamp(m.wi|0,0,5)}}
 else if(m.t==='f'&&Array.isArray(m.o)&&Array.isArray(m.d)&&m.o.length===3&&m.d.length===3&&fin(...m.o,...m.d))hostFire(p,clamp(m.w|0,0,5),m.o,m.d,!!m.s);
 else if(m.t==='g'&&Array.isArray(m.o)&&Array.isArray(m.d)&&m.o.length===3&&m.d.length===3&&fin(...m.o,...m.d))hostGrenade(p,m.o,m.d);
 else if(m.t==='buy')hostBuy(p,String(m.id));
 else if(m.t==='resp'){if(!p.alive&&p.coins>=p.rc){p.coins-=p.rc;revive(p,false)}}}
async function joinRoom(code){
 code=(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!==5){lobMsg('notFound');return}lobMsg('connecting');
 try{await loadPeer()}catch(e){lobMsg('loadErr');return}
 let peer;try{peer=await openPeer()}catch(e){lobMsg('connErr');return}
 Net.peer=peer;Net.role='guest';let opened=false;
 peer.on('error',e=>{if(!opened)lobMsg(e&&e.type==='peer-unavailable'?'notFound':'connErr')});
 const c=peer.connect('tof-'+code,{reliable:true});Net.conn=c;
 c.on('open',()=>{opened=true;R.online=true;R.host=false;R.code=code;Net.last=Date.now();
  c.send({t:'hello',name:myName(),skin:prof.skin,rank:rankOf(prof.xp)});
  Net.hb=setInterval(()=>Net.send(c,{t:'ping'}),3000);
  Net.wd=setInterval(()=>{if(Date.now()-Net.last>15000)hostGone()},2000)});
 c.on('data',guestData);c.on('close',()=>{if(opened)hostGone()});c.on('error',()=>{});
 setTimeout(()=>{if(!opened&&Net.peer===peer){lobMsg('notFound');Net.close()}},12000)}
function hostGone(){if(!Net.peer)return;Net.close();toast(tr('hostLeft'),3000);stopGame();R.online=false;R.host=true;hideScreens();show('sMenu')}
$('#bJoin').onclick=()=>{Snd.init();Snd.play('click');joinRoom($('#joinCode').value)};
$('#bCopy').onclick=async()=>{const url=location.origin+location.pathname+'?room='+R.code;try{await navigator.clipboard.writeText(url);toast(tr('copied'))}catch(e){$('#roomMsg').textContent=url}};
function guestData(m){
 if(!m||typeof m!=='object')return;Net.last=Date.now();
 switch(m.t){
  case'room':
   R.pl=(m.pl||[]).slice(0,16).map(p=>({n:String(p.n).slice(0,12),s:clamp(p.s|0,0,7),k:clamp(p.k|0,1,10)}));R.bots=clamp(m.bots|0,0,15);R.diff=clamp(m.diff|0,0,2);R.map=clamp(m.map|0,0,3);R.waves=WAVEOPT.includes(m.waves)?m.waves:10;R.you=m.you|0;
   if(!playing){renderRoom();show('sRoom')}break;
  case'full':Net.close();lobMsg('full');show('sLobby');break;
  case'start':{
   if(!Array.isArray(m.pl)||m.pl.length<1||m.pl.length>16)break;
   const info=m.pl.map(p=>({id:p.id|0,name:String(p.name).slice(0,14),skin:clamp(p.skin|0,0,7),human:p.human?1:0}));
   if(playing)stopGame();G=null;R.waves=m.waves|0;beginLocal(info,m.you|0,clamp(m.map|0,0,3),m.seed|0);break}
  case's':if(V&&playing)applySnap(m);break;
  case'me':if(ME&&!G){
    ME.hp=m.hp;ME.ar=m.ar;ME.mhp=m.mhp;ME.coins=m.coins;ME.own=m.own;ME.dmgLv=m.dmgLv;ME.hpLv=m.hpLv;ME.alive=!!m.alive;ME.kills=m.kills;ME.rc=m.rc;
    if(m.rv){L.x=m.rv[0];L.z=m.rv[1];L.y=0;L.vy=0;L.vx=L.vz=0}}break;
  case'give':if(L&&ME&&typeof m.id==='string')applyGive(m.id);break;
  case'err':toast(tr('noCoins'));break;
  case'end':if(playing&&Array.isArray(m.res))showEnd(!!m.win,m.res,m.wave|0);break;
  case'lobby':if(playing){stopGame()}renderRoom();show('sRoom');break;
  case'bye':hostGone();break}}
function applySnap(m){
 if(!m.w||!m.p||!m.e)return;V.w=m.w;
 const upd=(map,arr,mk,set)=>{const seen=new Set();for(const a of arr){let r=map.get(a[0]);if(!r){r=mk(a);map.set(a[0],r)}set(r,a);seen.add(a[0])}for(const id of [...map.keys()])if(!seen.has(id))map.delete(id)};
 upd(V.P,m.p,a=>{const i=INFO.get(a[0])||{name:'?',skin:0,human:1};return{id:a[0],name:i.name,skin:i.skin,human:i.human,x:a[1],z:a[2],y:a[8],yaw:a[3],alive:1,wi:1,kills:0,hp:100}},
  (r,a)=>{r.tx=a[1];r.tz=a[2];r.ty=a[8];r.tyaw=a[3];r.alive=a[4];r.wi=a[5];r.hp=a[6];r.kills=a[7]});
 upd(V.E,m.e,a=>({id:a[0],ty:a[1],x:a[2],y:a[3],z:a[4],yaw:a[5],hp:100}),(r,a)=>{r.tx=a[2];r.ty=a[3];r.tz=a[4];r.tyaw=a[5];r.hp=a[6]});
 upd(V.J,m.j||[],a=>({id:a[0],k:a[1],x:a[2],y:a[3],z:a[4],yaw:a[5]}),(r,a)=>{r.tx=a[2];r.ty=a[3];r.tz=a[4];r.tyaw=a[5]});
 upd(V.K,m.k||[],a=>({id:a[0],k:a[1],x:a[2],y:0,z:a[3]}),()=>{});
 if(Array.isArray(m.ev))m.ev.forEach(applyEv)}

/* ================= input ================= */
addEventListener('keydown',e=>{
 if(!playing||!ME||(document.activeElement&&document.activeElement.tagName==='INPUT'))return;
 if(e.code==='KeyB'||e.code==='Tab'){e.preventDefault();screen==='shop'?closeShop():openShop();return}
 if(e.code==='Escape'&&screen==='shop'){closeShop();return}
 if(screen==='shop')return;
 keys.add(e.code);
 if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();
 if(e.code==='KeyR')startReload();if(e.code==='KeyG')throwGrenade();
 if(e.code.startsWith('Digit')){const n=+e.code.slice(5)-1;if(n>=0&&n<6)selectWeapon(n)}});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();if(L)L.fire=false});
const cv=$('#gl');
cv.addEventListener('click',()=>{if(playing&&!touchOn&&screen==='hud'&&!document.pointerLockElement&&cv.requestPointerLock)try{cv.requestPointerLock()}catch(e){}});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===cv});
addEventListener('mousemove',e=>{if(!playing||!locked||!ME||!ME.alive)return;const s=.0022*(camera.fov/75);L.yaw-=e.movementX*s;L.pitch=clamp(L.pitch-e.movementY*s,-1.5,1.5)});
addEventListener('mousedown',e=>{if(!playing||!locked||!ME)return;if(e.button===0){L.fire=true;if(!W[L.wi].auto)tryFire()}else if(e.button===2){L.scope=true}});
addEventListener('mouseup',e=>{if(!L)return;if(e.button===0)L.fire=false;if(e.button===2)L.scope=false});
addEventListener('contextmenu',e=>{if(playing)e.preventDefault()});
addEventListener('wheel',e=>{if(playing&&screen==='hud'&&ME&&ME.alive)nextWeapon(e.deltaY>0?1:-1)},{passive:true});
/* touch */
function setTouch(v){touchOn=v;$('#touch').classList.toggle('on',v)}
addEventListener('touchstart',()=>{if(!touchOn&&playing)setTouch(true)},{passive:true});
(function(){
 const joy=$('#joy'),knob=$('#joyK');
 const jm=e=>{const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(e.clientX-cx)/(r.width/2),dy=(e.clientY-cy)/(r.height/2);const n=Math.hypot(dx,dy);if(n>1){dx/=n;dy/=n}J.x=dx;J.y=dy;knob.style.transform=`translate(${dx*40}px,${dy*40}px)`};
 joy.addEventListener('pointerdown',e=>{J.id=e.pointerId;joy.setPointerCapture(e.pointerId);jm(e);e.preventDefault()});
 joy.addEventListener('pointermove',e=>{if(e.pointerId===J.id)jm(e)});
 const je=e=>{if(e.pointerId===J.id){J.id=-1;J.x=J.y=0;knob.style.transform=''}};joy.addEventListener('pointerup',je);joy.addEventListener('pointercancel',je);
 const lz=$('#lookZ');let lid=-1,lx=0,ly=0;
 lz.addEventListener('pointerdown',e=>{lid=e.pointerId;lz.setPointerCapture(e.pointerId);lx=e.clientX;ly=e.clientY;e.preventDefault()});
 lz.addEventListener('pointermove',e=>{if(e.pointerId!==lid||!ME||!ME.alive)return;const s=.0055*(camera.fov/75);L.yaw-=(e.clientX-lx)*s;L.pitch=clamp(L.pitch-(e.clientY-ly)*s,-1.5,1.5);lx=e.clientX;ly=e.clientY});
 const le=e=>{if(e.pointerId===lid)lid=-1};lz.addEventListener('pointerup',le);lz.addEventListener('pointercancel',le);
 const hold=(id,on,off)=>{const b=$(id);b.addEventListener('pointerdown',e=>{if(!playing||!ME)return;b.setPointerCapture(e.pointerId);on();e.preventDefault()});const o=()=>{if(off&&L)off()};b.addEventListener('pointerup',o);b.addEventListener('pointercancel',o)};
 hold('#tFire',()=>{L.fire=true;if(!W[L.wi].auto)tryFire()},()=>L.fire=false);
 hold('#tJump',()=>L.jump=true,()=>L.jump=false);
 hold('#tReload',()=>startReload());hold('#tGren',()=>throwGrenade());hold('#tWeap',()=>nextWeapon(1));
 hold('#tScope',()=>{L.scope=!L.scope})})();

/* ================= main loop ================= */
function frame(ts){
 requestAnimationFrame(frame);
 const dt=Math.min(.05,(ts-lastTs)/1000||.016);lastTs=ts;clock+=dt;
 if(!playing||!ME||!renderer||!L)return;
 moveLocal(dt);if(L.cd>0)L.cd-=dt;if(L.gcd>0)L.gcd-=dt;
 if(L.rl>0){L.rl-=dt;if(L.rl<=0){L.rl=0;finishReload()}}
 if(L.fire&&W[L.wi].auto&&screen==='hud')tryFire();
 if(G)hostStep(dt);
 else{smoothView(dt);L.sendT-=dt;if(L.sendT<=0){L.sendT=.066;Net.send(Net.conn,{t:'p',x:r2(L.x),y:r2(L.y),z:r2(L.z),yaw:r3(L.yaw),wi:L.wi})}}
 if(!owns(L.wi))L.wi=owns(1)?1:0;
 updateCamera(dt);renderEntities(dt);fxUpdate(dt);updateHud(dt);
 renderer.render(scene,camera)}

/* ================= boot ================= */
applyLang();
if(typeof THREE==='undefined'){$('#bPlay').disabled=$('#bOnline').disabled=true;$('#sub').textContent='3D engine failed to load — check your connection'}
requestAnimationFrame(frame);
(function(){const q=new URLSearchParams(location.search).get('room');if(q){show('sLobby');$('#joinCode').value=q.toUpperCase().slice(0,5);setTimeout(()=>joinRoom(q),150)}})();
