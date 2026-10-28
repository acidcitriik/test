import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import {Match, magnitude, clamp} from './physics.js';
import {moveTargetWithMouse, moveTargetWithTouch} from './controls.js';
import {createMamoudaStage} from './mamouda-stage.js';
import {createMamoudaPaintedStage} from './mamouda-painted-stage.js';

const canvas=document.getElementById('game'), overlay=document.getElementById('overlay');
const playButton=document.getElementById('play');
const match=new Match();
const stageName=new URLSearchParams(window.location.search).get('stage');
const showMamouda=stageName==='mamouda';
const showMamoudaPainted=stageName==='mamouda-painted';
const anyMamouda=showMamouda||showMamoudaPainted;
// Read-only diagnostic snapshots for input responsiveness regression tests.
// No mutable engine state is exposed to browser scripts.
window.__gameDiagnostics = Object.freeze({
  player: () => ({x:match.player.x,z:match.player.z,
    vx:match.player.vx,vz:match.player.vz}),
  target: () => ({x:match.target.x,z:match.target.z}),
  camera: () => ({
    x:camera.position.x,y:camera.position.y,z:camera.position.z,
    downwardAngleDegrees:Math.atan2(
      camera.position.y-.12,1.25-camera.position.z
    )*180/Math.PI,
    // Fraction of viewport measured from top; .8 leaves 20% empty below.
    tableNearEdgeFraction:(1-new THREE.Vector3(0,-.27,-match.cfg.length/2-.25).project(camera).y)/2,
    tableFarEdgeFraction:(1-new THREE.Vector3(0,-.27,match.cfg.length/2+.25).project(camera).y)/2
  })
});
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x080f1b);
scene.fog=new THREE.FogExp2(0x080f1b,0.018);
const camera=new THREE.PerspectiveCamera(55,1,.1,150);
camera.position.set(0,7.2,-10.9);
camera.lookAt(0,.12,1.25);
if(showMamoudaPainted){
  // Cosmetic test only: gently lower the view to match illustrated perspective.
  camera.position.set(0,6.55,-10.9);
  camera.lookAt(0,.12,1.25);
}
// Keep the desktop camera exactly as it is. On touch devices raise the
// viewing angle by 20 degrees, orbiting the same target at the same distance.
const desktopCameraPosition=camera.position.clone();
const cameraTarget=new THREE.Vector3(0,.12,1.25);
function setMobileCameraAngle(){
  const toCamera=desktopCameraPosition.clone().sub(cameraTarget);
  const distance=Math.hypot(toCamera.y,toCamera.z);
  const angle=Math.atan2(toCamera.y,-toCamera.z)+THREE.MathUtils.degToRad(20);
  camera.position.set(desktopCameraPosition.x,
    cameraTarget.y+distance*Math.sin(angle),
    cameraTarget.z-distance*Math.cos(angle));
  camera.lookAt(cameraTarget);
}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.45;
scene.add(new THREE.HemisphereLight(0x9cbfff,0x121c30,2.3));
function light(color,intensity,x,y,z){const l=new THREE.PointLight(color,intensity,23);l.position.set(x,y,z);scene.add(l);}
light(0x5eeafa,65,-3.5,5,-2.0);light(0xf5a553,52,3.4,5,3.5);
const directional=new THREE.DirectionalLight(0xd5efff,3.1);directional.position.set(-5,11,0);directional.castShadow=true;directional.shadow.mapSize.set(2048,2048);directional.shadow.camera.left=-11;directional.shadow.camera.right=11;directional.shadow.camera.top=11;directional.shadow.camera.bottom=-11;scene.add(directional);
const mat=(c,metal=.0,rough=.5,emissive=null)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough,emissive:emissive??0x000000,emissiveIntensity:emissive?.6:0});
function box(w,h,d,x,y,z,m){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);return mesh;}
const board=mat(0x142d40,.38,.23),rim=mat(0x34495d,.6,.3),lineMat=new THREE.MeshBasicMaterial({color:0x5ee1e6,transparent:true,opacity:.75}),lineWarm=new THREE.MeshBasicMaterial({color:0xffb86c,transparent:true,opacity:.85});
const {width:w,length:L,goalWidth:g}=match.cfg;
box(w+.42,.28,L+.5,0,-.27,0,mat(0x111d2c,.7,.27));
box(w,.12,L,0,-.06,0,board);
box(.16,.37,L+.3,-w/2-.09,.10,0,rim);box(.16,.37,L+.3,w/2+.09,.10,0,rim);
for(const side of [-1,1]){const z=side*(L/2+.06);const wallLength=(w-g)/2;for(const sx of [-1,1])box(wallLength,.33,.16,sx*(g+w)/4,.08,z,rim);}
box(g,.04,.35,0,-.08,-L/2-.19,mat(0x54dce1,.1,.3,0x267e87));
box(g,.04,.35,0,-.08,L/2+.19,mat(0xfab777,.1,.3,0x804629));
box(.035,.006,L,0,.007,0,new THREE.MeshBasicMaterial({color:0x3c6377}));
box(w,.005,.028,0,.012,0,lineMat);
function rinkRing(x,z,r,color){const points=[];for(let k=0;k<=80;k++){const a=k/80*Math.PI*2;points.push(new THREE.Vector3(x+r*Math.cos(a),.012,z+r*Math.sin(a)));}const geo=new THREE.BufferGeometry().setFromPoints(points),line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.55}));scene.add(line);}
rinkRing(0,0,.88,0x66c9d7);rinkRing(0,-3.6,.85,0x45b4be);rinkRing(0,3.6,.85,0xdd995b);
const floor=box(120,.25,120,0,-.9,0,mat(0x09111f,.03,.88));
const grid=new THREE.GridHelper(90,50,0x13273a,0x13273a);grid.position.y=-.76;if(!anyMamouda)scene.add(grid);
if(!anyMamouda)for(let i=0;i<8;i++){const a=i/8*Math.PI*2;box(.3,4,.3,Math.cos(a)*11,1,Math.sin(a)*10,mat(0x172c46,.6,.5));}
const stageFx=showMamouda?createMamoudaStage(THREE,scene,camera):showMamoudaPainted?createMamoudaPaintedStage(THREE,scene,camera):null;
window.__stageDiagnostics=Object.freeze({
  name:showMamoudaPainted?'mamouda-painted':showMamouda?'mamouda':'lab',
  ready:()=>stageFx?.ready()??true,
  backgroundLayers:()=>stageFx?.backgroundLayers??0
});
if(anyMamouda){
  floor.material.color.set(0x090916);
  floor.visible=false; // Prevent the huge neutral lab floor from masking painted bar layers.
  board.color.set(0x2a1728);
  rim.color.set(0x503047);
  if(showMamoudaPainted){
    // Purely visual: tune the existing table to the painted cyberpunk scene.
    board.color.set(0x301629);
    board.roughness=.14;
    board.metalness=.48;
    board.emissive.set(0x230718);
    board.emissiveIntensity=.35;
    rim.color.set(0x5a2038);
    rim.metalness=.58;
    rim.roughness=.27;
    const paintedNeonRed=new THREE.MeshBasicMaterial({color:0xff385e,toneMapped:false});
    const paintedNeonBlue=new THREE.MeshBasicMaterial({color:0x58cbf2,toneMapped:false});
    box(.045,.024,L+.24,-w/2-.09,.31,0,paintedNeonBlue);
    box(.045,.024,L+.24,w/2+.09,.31,0,paintedNeonRed);
    box(g,.024,.045,0,.28,L/2+.12,paintedNeonRed);
    box(g,.024,.045,0,.28,-L/2-.12,paintedNeonBlue);
  }
  document.getElementById('brand').textContent='SYNTHPUCK // MAMOUDA';
  document.getElementById('dialogTitle').textContent='SYNTHPUCK — MAMOUDA';
  document.querySelector('.lead').textContent=showMamoudaPainted?'TEST 2.5D · ILLUSTRATION':'TEST 2.5D · BAR CAPSULES';
}
function cylinder(rad,depth,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,depth,48),mat(color,.52,.26));m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
const playerObj=cylinder(match.cfg.paddleRadius,.24,0x58e5e9),aiObj=cylinder(match.cfg.paddleRadius,.24,0xf6a969),puckObj=cylinder(match.cfg.puckRadius,.095,0xf8fcfc);
const playerGlow=new THREE.PointLight(0x35e8ed,1.2,1.5);scene.add(playerGlow);
const aiGlow=new THREE.PointLight(0xffb565,.95,1.5);scene.add(aiGlow);
let active=false,lastTime=0,acc=0,sensitivity=1;

// Touch-capable mobile browsers can deliver cancelled pointer streams after
// toolbar/viewport changes. Prefer native TouchEvents for continuous gestures.
let isTouchDevice=navigator.maxTouchPoints>0 ||
  window.matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window);
let mobileCameraEnabled=false;
function enableTouchUI(){
  isTouchDevice=true;
  document.body.classList.add('touch-mode');
  if(!mobileCameraEnabled){
    setMobileCameraAngle();
    mobileCameraEnabled=true;
    resize(); // Also recalibrate if touch is first detected after page load.
  }
}
if(isTouchDevice)enableTouchUI();
// Some embedded browsers report no touch capability until their first gesture.
// This capture listener runs before the JOUER click generated by that gesture.
document.addEventListener('touchstart',enableTouchUI,{capture:true,passive:true});
let touchIdentifier=null,lastTouchX=0,lastTouchY=0,touchMode='normal';
function applyTouchMode(mode){
  touchMode=mode;
  match.setButton('left',mode==='rigid'||mode==='grip');
  match.setButton('right',mode==='soft'||mode==='grip');
  document.querySelectorAll('[data-touch-mode]').forEach(button=>{
    button.classList.toggle('selected',button.dataset.touchMode===mode);
    button.setAttribute('aria-pressed',String(button.dataset.touchMode===mode));
  });
}
document.querySelectorAll('[data-touch-mode]').forEach(button=>{
  button.addEventListener('click',()=>applyTouchMode(button.dataset.touchMode));
});
document.getElementById('mobilePause').addEventListener('click',()=>{
  if(active)show('PAUSE','Reprends quand tu veux.','REPRENDRE');
});
function clearTouch(){touchIdentifier=null;}
// Bind gestures to the canvas, but continue tracking the same finger even if
// it briefly exits the canvas. Controls/buttons cannot hijack an active drag.
canvas.addEventListener('touchstart',event=>{
  if(!active||touchIdentifier!==null)return;
  const touch=event.changedTouches[0];
  if(!touch)return;
  event.preventDefault();
  enableTouchUI();
  touchIdentifier=touch.identifier;
  lastTouchX=touch.clientX;lastTouchY=touch.clientY;
},{passive:false});
window.addEventListener('touchmove',event=>{
  if(!active||touchIdentifier===null)return;
  const touch=Array.from(event.changedTouches).find(t=>t.identifier===touchIdentifier);
  if(!touch)return;
  event.preventDefault();
  const dx=touch.clientX-lastTouchX,dy=touch.clientY-lastTouchY;
  lastTouchX=touch.clientX;lastTouchY=touch.clientY;
  const rect=canvas.getBoundingClientRect();
  const target=moveTargetWithTouch(match.target,dx,dy,rect.width,rect.height,sensitivity,match.cfg);
  match.target.x=target.x;match.target.z=target.z;
},{passive:false});
for(const type of ['touchend','touchcancel']){
  window.addEventListener(type,event=>{
    if(touchIdentifier!==null&&Array.from(event.changedTouches).some(t=>t.identifier===touchIdentifier))clearTouch();
  },{passive:true});
}

function sync(){
  // Render the latest input target immediately, even when this display frame
  // falls between 120 Hz physics steps. Physics catches up on its next tick.
  playerObj.position.set(active?match.target.x:match.player.x,.16,
    active?match.target.z:match.player.z);
  aiObj.position.set(match.ai.x,.16,match.ai.z);
  puckObj.position.set(match.puck.x,.11,match.puck.z);
  playerGlow.position.copy(playerObj.position);aiGlow.position.copy(aiObj.position);
  puckObj.rotation.y+=match.puck.spin*.0015;
  document.getElementById('score').textContent=match.scores.join(' : ');
  document.getElementById('hint').textContent=match.awaitingServe
    ? (match.server===-1 ? 'À TOI D’ENGAGER · FRAPPE LE PALET' : 'ENGAGEMENT DE L’IA · PRÉPARE-TOI')
    : 'PREMIER À 7 · PHYSICS LAB';
  document.getElementById('puckSpeed').textContent=magnitude(match.puck.vx,match.puck.vz).toFixed(1)+' m/s';
  document.getElementById('paddleSpeed').textContent=magnitude(match.player.vx,match.player.vz).toFixed(1)+' m/s';
  document.getElementById('spin').textContent=match.puck.spin.toFixed(1)+' rad/s';
  document.getElementById('hits').textContent=String(match.rally);
  document.getElementById('contact').textContent=({normal:'NATUREL',rigid:'RIGIDE',soft:'AMORTI',grip:'ADHÉRENCE'})[match.impactMode()];

}
function show(title,description,button){active=false;clearTouch();match.setButton('left',false);match.setButton('right',false);document.exitPointerLock?.();overlay.hidden=false;overlay.style.display='grid';document.getElementById('dialogTitle').textContent=title;document.getElementById('dialogText').textContent=description;playButton.textContent=button;}
function start(){if(match.state==='over')match.reset();if(match.state==='ready')match.serve();overlay.hidden=true;overlay.style.display='none';active=true;acc=0;if(isTouchDevice){applyTouchMode(touchMode);return;}const promise=canvas.requestPointerLock?.();if(promise?.catch)promise.catch(()=>show('SOURIS NON VERROUILLÉE','Autorise la capture de la souris dans ce navigateur pour jouer.','RÉESSAYER'));}
playButton.addEventListener('click',start);
canvas.addEventListener('click',()=>{if(active && !isTouchDevice && document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
document.addEventListener('pointerlockchange',()=>{if(!isTouchDevice && document.pointerLockElement!==canvas && active)show('PAUSE','Le duel est en pause. Reprends quand tu veux.','REPRENDRE');});
document.addEventListener('mousemove',e=>{if(!active||isTouchDevice||document.pointerLockElement!==canvas)return;
// Camera-right is world -X; preserve the existing forward/backward axis.
const target=moveTargetWithMouse(match.target,e.movementX,e.movementY,sensitivity,match.cfg);
match.target.x=target.x;
match.target.z=target.z;
});
document.addEventListener('contextmenu',e=>{if(active)e.preventDefault();});
document.addEventListener('mousedown',e=>{if(!active||isTouchDevice)return;if(e.button===0)match.setButton('left',true);if(e.button===2)match.setButton('right',true);});
document.addEventListener('mouseup',e=>{if(isTouchDevice)return;if(e.button===0)match.setButton('left',false);if(e.button===2)match.setButton('right',false);});
window.addEventListener('blur',()=>{match.setButton('left',false);match.setButton('right',false);if(active)show('PAUSE','Fenêtre inactive.','REPRENDRE');});
document.addEventListener('keydown',e=>{if(e.code==='KeyR'){match.reset();show('NOUVEAU MATCH','Premier à sept points.','JOUER');}if(e.code==='Space'){e.preventDefault();if(!active)start();}if(e.code==='Escape'&&active)show('PAUSE','Reprends quand tu veux.','REPRENDRE');});
const settings=[['sensitivity','sensValue',v=>sensitivity=v],['speed','speedValue',v=>match.cfg.maxSpeed=v],['accel','accelValue',v=>match.cfg.aiAcceleration=v],['bounce','bounceValue',v=>match.cfg.wallRestitution=v],['friction','frictionValue',v=>match.cfg.friction=v],['ai','aiValue',v=>match.cfg.aiSpeed=v]];
for(const[id,out,action]of settings){const el=document.getElementById(id);el.addEventListener('input',()=>{const v=Number(el.value);action(v);document.getElementById(out).textContent=String(v);});}
// Shift only the MOBILE projection upward (not the world or the physics).
// The outer near rim should end at 80% of the viewport: 20% remains free
// underneath for the user's finger and the touch control bar.
// A frustum offset retains the existing 20-degree-raised camera angle.
function updateCameraFraming(width,height){
  camera.clearViewOffset();
  if(!isTouchDevice)return;
  camera.updateMatrixWorld(true);
  const nearRim=new THREE.Vector3(0,-.27,-match.cfg.length/2-.25);
  const nearScreenY=(1-nearRim.project(camera).y)/2;
  const offsetPixels=(nearScreenY-.8)*height;
  camera.setViewOffset(width,height,0,offsetPixels,width,height);
}
function resize(){
  const width=innerWidth,height=innerHeight;
  camera.aspect=width/height;
  camera.fov=height>width?66:55;
  stageFx?.resize();
  updateCameraFraming(width,height);
  renderer.setSize(width,height,false);
}
addEventListener('resize',resize);resize();
function frame(ms){requestAnimationFrame(frame);const dt=lastTime?Math.min(.05,(ms-lastTime)/1000):0;lastTime=ms;if(active){acc+=dt;let steps=0;while(acc>=match.cfg.tick&&steps<8){match.tick();acc-=match.cfg.tick;steps++;}if(steps>=8)acc=0;if(match.state==='ready'){const last=match.events.findLast(e=>e.type==='goal');show(last?.scorer===0?'POINT POUR TOI':'POINT POUR L’IA','Le prochain serveur doit frapper le palet immobile.','CONTINUER');}if(match.state==='over')show(match.scores[0]>match.scores[1]?'VICTOIRE':'DÉFAITE','Match terminé. Rejoue pour travailler les trajectoires.','REJOUER');}sync();stageFx?.update(ms/1000);renderer.render(scene,camera);}
requestAnimationFrame(frame);
