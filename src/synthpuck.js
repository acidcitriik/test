import {Match,clamp,magnitude} from './physics.js';
import {SPRITE_URLS,SPRITE_ART} from './synthpuck-sprite-art.js';
import {HAL_STAGE_ID,HAL_EYE_CALIBRATION,halEyeTarget} from './hal-eye.js';
import {moveTargetWithMouse,moveTargetWithTouch} from './controls.js';
import {ROSTER,STAT_NAMES,getCharacter,matchConfiguration} from './roster.js';
import {ARCADE_ORDER,nextArcadeLevel,stageIdFor} from './campaign.js';

const NATIVE={w:1672,h:941};
// Stage-normalised portrait height. Every real opponent stays behind the far rail.
const OPPONENT_HEIGHT_NATIVE=240;
const $=id=>document.getElementById(id);
const panel=$('panel'),backdrop=$('backdrop'),arena=$('arena');
const bg=backdrop.getContext('2d',{alpha:false});
const ctx=arena.getContext('2d');
const hud=$('hud'),touchBar=$('touchBar');
const images={stages:{},characters:{},sprites:{},halEye:null};
let halGaze={x:HAL_EYE_CALIBRATION.x,y:HAL_EYE_CALIBRATION.y};
let mode='arcade',level=0,selected='mute',opponent=ROSTER[0];
let currentStage='mamouda',screen='splash',match=null,active=false;
let lastTime=0,accumulator=0,mouseSensitivity=1,touchId=null;
let lastTouch={x:0,y:0},inputMode='normal',pointerRequested=false;
let layout={scale:1,x:0,y:0,cssW:1,cssH:1,dpr:1};
let pausedReason='',showFarOpponent=false;
const isTouch=()=>navigator.maxTouchPoints>0 || matchMedia('(pointer:coarse)').matches;

const statBar=(value,accent)=>`<div class="meter" style="--accent:${accent}">${Array.from({length:5},(_,i)=>`<i class="${i<value?'on':''}"></i>`).join('')}</div>`;
const statsHtml=c=>`<div class="stats" style="--accent:${c.accent}">${STAT_NAMES.map((title,i)=>`<div class="stat-line"><label>${title}</label>${statBar(c.stats[i],c.accent)}</div>`).join('')}</div>`;
const avatar=c=>`<img loading="eager" src="./assets/characters/${c.id}.webp?v=fighters-hd-20261031" alt="Portrait de ${c.name}"/>`;
const btn=(label,action,primary=false)=>`<button class="btn ${primary?'primary':''}" data-action="${action}" type="button">${label}</button>`;
const statusText=()=>match?.awaitingServe?(match.server===-1?'À TOI DE SERVIR':'SERVICE ADVERSAIRE'):'PREMIER À 7';
function setScreen(name,compact=false){screen=name;panel.className=compact?'compact':'';panel.removeAttribute('hidden');panel.setAttribute('data-screen',name);$('fighterName').hidden=true;}
function showSplash(){setScreen('splash');hud.hidden=true;touchBar.hidden=true;panel.innerHTML=`<img class="studio-image" src="./assets/ui/studio-splash-hd.avif" alt="PiperadeGames présente : logo peint avec un seul piment rouge"/>`;}
function showMenu(){
  active=false;touchId=null;mode='arcade';currentStage='mamouda';setBackground(currentStage,false);
  setScreen('menu');hud.hidden=true;touchBar.hidden=true;$('fighterName').hidden=true;
  panel.innerHTML=`<div class="menu-art"><div class="menu-image" role="img" aria-label="SYNTHPUCK, Strike Spin Survive, menu illustré néon BD"></div><nav class="menu menu-hotspots" aria-label="Menu principal">${btn('ARCADE','arcade',true)}${btn('ENTRAÎNEMENT','training')}<button class="btn" disabled aria-disabled="true">OPTIONS</button><button class="btn" disabled aria-disabled="true">EXIT</button></nav></div>`;
}
function showArcadeIntro(){
  mode='arcade';opponent=ROSTER[level];selected=opponent.id;
  currentStage=opponent.id;setBackground(currentStage,false);
  setScreen('intro');hud.hidden=true;touchBar.hidden=true;
  panel.innerHTML=`<div class="page"><header class="page-head"><div><p class="eyebrow">ARCADE / DUEL ${String(level+1).padStart(2,'0')} DE 07</p><h2>TON PROCHAIN ADVERSAIRE</h2></div>${btn('← MENU','menu')}</header><article class="fight-card" style="--accent:${opponent.accent}"><div class="portrait">${avatar(opponent)}</div><div class="fight-detail"><p class="eyebrow">${opponent.arena}</p><h2>${opponent.name}</h2><h3>${opponent.epithet}</h3><p class="sub">${opponent.bio}</p>${statsHtml(opponent)}${btn('LANCER LE DUEL','play',true)}</div></article><p class="sub">Vaincs chaque adversaire dans l’ordre. Premier à 7 points.</p></div>`;
}
function showTrainingSelect(){
  active=false;mode='training';currentStage='training';setBackground('training',false);
  const c=getCharacter(selected);
  setScreen('training');hud.hidden=true;touchBar.hidden=true;
  panel.innerHTML=`<div class="page"><header class="page-head"><div><p class="eyebrow">GRID 00 / SALLE D’ENTRAÎNEMENT</p><h2>CHOISIS TON ADVERSAIRE</h2></div>${btn('← MENU','menu')}</header><div class="roster" role="group" aria-label="Sélection des personnages">${ROSTER.map(p=>`<button data-character="${p.id}" type="button" class="roster-card ${p.id===c.id?'selected':''}" aria-label="Sélectionner ${p.name}" aria-pressed="${p.id===c.id}">${avatar(p)}<strong>${p.name}</strong></button>`).join('')}</div><div class="select-bottom"><div class="select-info" style="--accent:${c.accent}"><p class="eyebrow">${c.epithet}</p><h3>${c.name}</h3><p class="sub">${c.bio}</p>${statsHtml(c)}</div><div class="select-actions"><p class="sub">Joue contre le profil original de ${c.name} dans l’arène neutre GRID 00. Aucun résultat n’affecte l’Arcade.</p>${btn('COMMENCER L’ENTRAÎNEMENT','play',true)}</div></div></div>`;
}
function showPause(reason='DUEL EN PAUSE'){
  if(!match)return;
  active=false;pausedReason=reason;setScreen('pause',true);
  // This is a debug-friendly Arcade shortcut, not a campaign unlock system:
  // choosing a stage starts a fresh match and resets its score.
  const levels=mode==='arcade'
    ? `<div class="pause-levels"><p class="eyebrow">CHOISIR UN NIVEAU · NOUVEAU DUEL</p><div class="pause-level-grid" role="group" aria-label="Niveaux Arcade">${ROSTER.map((fighter,index)=>`<button type="button" class="pause-level ${index===level?'current':''}" data-pause-level="${index}" aria-label="Niveau ${String(index+1).padStart(2,'0')} : ${fighter.name}" ${index===level?'aria-current="step"':''}><span>${String(index+1).padStart(2,'0')}</span><strong>${fighter.name}</strong></button>`).join('')}</div></div>`
    : ``;
  panel.innerHTML=`<div class="compact-center pause-center"><p class="eyebrow">SYNTHPUCK</p><h2>${reason}</h2><p class="sub">${opponent.name} · ${mode==='arcade'?'ARCADE':'ENTRAÎNEMENT'}</p>${levels}<div class="pause-actions">${btn('REPRENDRE','resume',true)}${btn('RECOMMENCER','retry')}${btn('RETOUR AU MENU','menu')}</div></div>`;
  document.exitPointerLock?.();
}
function showPoint(){
  active=false;
  setScreen('point',true);const last=match.events.findLast(e=>e.type==='goal');
  const won=last?.scorer===0;
  panel.innerHTML=`<div class="compact-center"><p class="eyebrow">${opponent.name}</p><h2 class="${won?'win':'lose'}">${won?'POINT !':'POINT ADVERSE'}</h2><p class="sub">${match.scores[0]} : ${match.scores[1]} · ${statusText()}</p>${btn('CONTINUER','resume',true)}</div>`;
  document.exitPointerLock?.();
}
function showMatchEnd(){
  active=false;
  const win=match.scores[0]>match.scores[1];
  const result=mode==='arcade'?nextArcadeLevel(level,win):{type:'practice'};
  if(result.type==='complete'){
    setScreen('complete',true);
    panel.innerHTML=`<div class="compact-center"><p class="eyebrow">PIPERADEGAMES</p><h2 class="win">ARCADE TERMINÉ !</h2><p class="sub">Les sept rivaux sont tombés. Tu es le champion de SYNTHPUCK.</p>${btn('RETOUR AU MENU','menu',true)}${btn('REFAIRE L’ARCADE','arcade')}</div>`;
  }else{
    setScreen('result',true);
    panel.innerHTML=`<div class="compact-center"><p class="eyebrow">${opponent.name} · ${match.scores[0]} : ${match.scores[1]}</p><h2 class="${win?'win':'lose'}">${win?'VICTOIRE':'DÉFAITE'}</h2><p class="sub">${mode==='training'?'Entraînement terminé.':win?'Adversaire vaincu. Le prochain défi t’attend.':'Réessaie pour poursuivre l’Arcade.'}</p>${mode==='arcade'&&win?btn('ADVERSAIRE SUIVANT','next',true):btn('REJOUER','retry',true)}${mode==='training'?btn('CHOISIR UN ADVERSAIRE','training'):''}${btn('RETOUR AU MENU','menu')}</div>`;
  }
  document.exitPointerLock?.();
}
function createMatch(){opponent=mode==='training'?getCharacter(selected):ROSTER[level];match=new Match(matchConfiguration(opponent));match.serve();halGaze={x:HAL_EYE_CALIBRATION.x,y:HAL_EYE_CALIBRATION.y};}
function beginMatch(){
  currentStage=stageIdFor(mode,opponent.id);
  setBackground(currentStage,true);createMatch();
  $('fighterName').textContent=opponent.name;
  $('fighterName').hidden=true;hud.hidden=false;
  $('hudMode').textContent=mode.toUpperCase();
  $('hudStage').textContent=mode==='training'?`GRID 00 · ${opponent.name}`:`${opponent.arena} · ${opponent.name}`;
  $('hudLevel').textContent=mode==='arcade'?`${String(level+1).padStart(2,'0')} / 07`:'GRID 00';
  touchBar.hidden=!isTouch();
  if(isTouch())selectTouchMode(inputMode);
  resume();
}
function resume(){
  panel.innerHTML='';setScreen('playing');
  active=true;accumulator=0;lastTime=0;
  if(match?.state==='ready')match.serve();
  if(!isTouch() && !pointerRequested){
    pointerRequested=true;
    const lock=arena.requestPointerLock?.();
    if(lock?.catch)lock.catch(()=>{pointerRequested=false;});
  }
}
function buttonAction(action){
  if(action==='menu'){active=false;document.exitPointerLock?.();showMenu();}
  else if(action==='arcade'){level=0;mode='arcade';showArcadeIntro();}
  else if(action==='training'){mode='training';showTrainingSelect();}
  else if(action==='play'){beginMatch();}
  else if(action==='resume'){resume();}
  else if(action==='retry'){beginMatch();}
  else if(action==='next'){
    const result=nextArcadeLevel(level,true);
    if(result.type==='next'){level=result.index;showArcadeIntro();}
  }
}
panel.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button || button.disabled)return;
  if(button.dataset.pauseLevel!==undefined){
    // Only a paused Arcade match may jump to another stage.
    const index=Number(button.dataset.pauseLevel);
    if(screen!=='pause'||mode!=='arcade'||!Number.isInteger(index)||index<0||index>=ROSTER.length)return;
    level=index;
    opponent=ROSTER[level];
    selected=opponent.id;
    touchId=null;
    beginMatch();
    return;
  }
  if(button.dataset.character){selected=button.dataset.character;showTrainingSelect();return;}
  if(button.dataset.action)buttonAction(button.dataset.action);
});
$('pauseButton').addEventListener('click',()=>{if(active)showPause();});
function selectTouchMode(val){inputMode=val;if(match){match.setButton('left',val==='rigid'||val==='grip');match.setButton('right',val==='soft'||val==='grip');}document.querySelectorAll('[data-touch-mode]').forEach(b=>b.classList.toggle('chosen',b.dataset.touchMode===val));}
touchBar.addEventListener('click',e=>{const b=e.target.closest('[data-touch-mode]');if(b)selectTouchMode(b.dataset.touchMode);});
function loadImage(src){const img=new Image();img.decoding='async';img.addEventListener('load',()=>{frame.stageReady=false;drawBackdrop();});img.src=src;return img;}
for(const p of ROSTER)images.characters[p.id]=loadImage(`./assets/characters/${p.id}.webp?v=fighters-hd-20261031`);
for(const name of ['mamouda','mute','chonk','simous','diamond','stal','2502','training']) images.stages[name]=loadImage(`./assets/stages/${name}.webp`);
for(const type of ['player','puck','ai'])images.sprites[type]=loadImage(SPRITE_URLS[type]);
// HAL is built into the final stage; the independently painted retina moves at runtime.
images.halEye=loadImage('./assets/characters/hal-eye.webp');
// Full-resolution, separately painted art assets. The previous tiny composite atlas
// was cropped and enlarged at runtime, which introduced blur/pixelation everywhere.
// Preload the menu and HUD assets so ready means their decoded images are available.
const uiPaths=[
 './assets/ui/studio-splash-hd.avif',
 './assets/ui/menu-hd.avif',
 './assets/ui/panel-blue.webp',
 './assets/ui/panel-red.webp',
 './assets/ui/panel-neutral.webp',
 './assets/ui/pause.webp'
];
let uiArtReady=false;
Promise.all(uiPaths.map(src=>new Promise((resolve,reject)=>{
 const img=new Image();
 img.onload=()=>img.decode?.().then(resolve,reject)??resolve();
 img.onerror=()=>reject(new Error('Missing Synthpuck HD asset: '+src));
 img.src=src;
}))).then(()=>{
 uiArtReady=true;
 document.documentElement.dataset.uiArt='loaded';
}).catch(error=>{
 document.documentElement.dataset.uiArt='failed';
 console.error(error);
});

function resize(){
  const cssW=innerWidth,cssH=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
  // Contain the entire calibrated table and rear-rail silhouette on every aspect ratio.
  // Cover-cropping hides the goals on tall phones and makes the duel unplayable.
  layout={cssW,cssH,dpr,scale:Math.min(cssW/NATIVE.w,cssH/NATIVE.h),x:0,y:0};
  layout.x=(cssW-NATIVE.w*layout.scale)/2;layout.y=(cssH-NATIVE.h*layout.scale)/2;
  // Align the HUD with the actual letterboxed arena, never the black side bands.
  document.documentElement.style.setProperty('--arena-side',`${layout.x}px`);
  document.documentElement.style.setProperty('--arena-top',`${layout.y}px`);
  document.documentElement.style.setProperty('--arena-width',`${NATIVE.w*layout.scale}px`);
  for(const c of [arena,backdrop]){c.width=Math.round(cssW*dpr);c.height=Math.round(cssH*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  bg.setTransform(dpr,0,0,dpr,0,0);
  drawBackdrop();
}
function drawBackdrop(){
  const stage=images.stages[currentStage];
  bg.fillStyle='#080d1a';bg.fillRect(0,0,layout.cssW,layout.cssH);
  if(stage?.complete&&stage.naturalWidth){
    bg.drawImage(stage,layout.x,layout.y,NATIVE.w*layout.scale,NATIVE.h*layout.scale);
  }
  if(showFarOpponent)drawOpponent();
}
function drawOpponent(){
  // HAL's black lens is already part of the final backdrop: never overlay a character here.
  if(currentStage===HAL_STAGE_ID)return;
  const image=images.characters[opponent.id];if(!image?.complete||!image.naturalWidth)return;
  // The character sits behind the visible far rail (same fixed geometry as the puck).
  bg.save();bg.beginPath();bg.rect(0,0,layout.cssW,layout.y+390*layout.scale);bg.clip();
  // Slightly larger portraits, sunk behind the far-rail lip: the cropped
  // torso stays hidden while the head/shoulders remain clear of the table.
  const height=OPPONENT_HEIGHT_NATIVE*layout.scale;
  const width=image.naturalWidth/image.naturalHeight*height;
  const x=layout.x+NATIVE.w*layout.scale/2-width/2;
  const y=layout.y+(396-OPPONENT_HEIGHT_NATIVE)*layout.scale;
  bg.imageSmoothingEnabled=true;
  bg.imageSmoothingQuality='high';
  bg.shadowBlur=0;
  bg.drawImage(image,x,y,width,height);
  bg.restore();
}
// Common 1672 x 941 playing surface measured on the ORIGINAL training artwork.
// Do not edit any image in assets/stages: calibrate only moving object projection.
// The green physics boundary revealed the true inner painted rail positions:
// far Y≈390, centre Y≈554, near Y≈816. This is projection-only calibration.
export const TABLE_CALIBRATION=Object.freeze({
 far:{y:390,left:680,right:992},
 center:{y:554,left:475,right:1201},
 near:{y:816,left:200,right:1475}
});
function project(x,z){
  // Same physics, camera-right = -world X; clamp world coordinates for graphics.
  const u=clamp(.5-x/match.cfg.width,0,1);
  const v=clamp(.5-z/match.cfg.length,0,1);
  const yy=390+230*v+196*v*v;
  const left=680-340*v-140*v*v;
  const right=992+353*v+130*v*v;
  return {x:layout.x+(left+(right-left)*u)*layout.scale,y:layout.y+yy*layout.scale};
}
function projectedRadius(x,z,r){
  const a=project(x-r,z),b=project(x+r,z),c=project(x,z-r),d=project(x,z+r);
  return {rx:Math.max(3,Math.abs(b.x-a.x)/2),ry:Math.max(2,Math.abs(c.y-d.y)/2)};
}
// Independent transparent artwork. No source rectangles, so no cropped heads,
// rims or cut puck edges. Alpha margins are part of each image.
const spriteArt=SPRITE_ART;

function spriteGeometry(obj,type){
 const p=project(obj.x,obj.z);
 const radius=match.cfg[type==='puck'?'puckRadius':'paddleRadius'];
 const {rx}=projectedRadius(obj.x,obj.z,radius);
 const sprite=spriteArt[type],img=images.sprites[type];
 const sourceWidth=img?.naturalWidth || (type==='ai'?672:type==='player'?674:549);
 const sourceHeight=img?.naturalHeight || (type==='puck'?361:482);
 const width=2*rx*.98*sourceWidth/sprite.inkWidth;
 const height=width*sourceHeight/sourceWidth;
 return {x:p.x-width/2,y:p.y-height*sprite.anchor,width,height};
}
function drawObject(obj,type){
 const {x,y,width,height}=spriteGeometry(obj,type);
 const img=images.sprites[type];
 if(img?.complete&&img.naturalWidth){
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.shadowColor='#030712b8';ctx.shadowBlur=5*layout.scale;
  ctx.drawImage(img,x,y,width,height);
  ctx.restore();
 }else{
  const p=project(obj.x,obj.z),{rx}=projectedRadius(obj.x,obj.z,match.cfg[type==='puck'?'puckRadius':'paddleRadius']);
  ctx.beginPath();ctx.ellipse(p.x,p.y,rx,rx*.48,0,0,Math.PI*2);
  ctx.fillStyle=type==='player'?'#4ce3ff':type==='ai'?'#ff4865':'#f0faff';ctx.fill();
 }
}
function drawHalEye(dt){
  if(currentStage!==HAL_STAGE_ID||!match)return;
  const eye=images.halEye;
  if(!eye?.complete||!eye.naturalWidth)return;
  const target=halEyeTarget(match.puck,match.cfg);
  const easing=1-Math.exp(-9*Math.max(0,Math.min(dt,0.05)));
  halGaze.x+=(target.x-halGaze.x)*easing;
  halGaze.y+=(target.y-halGaze.y)*easing;
  const c=HAL_EYE_CALIBRATION,scale=layout.scale;
  ctx.save();
  // Keep the moving retina inside the black, raster-painted aperture.
  ctx.beginPath();ctx.arc(layout.x+c.x*scale,layout.y+c.y*scale,c.apertureRadius*scale,0,Math.PI*2);ctx.clip();
  const size=c.spriteSize*scale;
  ctx.drawImage(eye,layout.x+halGaze.x*scale-size/2,layout.y+halGaze.y*scale-size/2,size,size);
  ctx.restore();
}
// Visual debug only: project the actual invisible physics walls, without
// creating/changing collision geometry or repainting the illustrated arena.
function drawPhysicalTableWalls(){
  const {width,length,goalWidth}=match.cfg;
  const halfW=width/2,halfL=length/2,halfGoal=goalWidth/2;
  ctx.save();
  ctx.strokeStyle='#B4FF88';
  ctx.lineWidth=Math.max(2,4*layout.scale);
  ctx.lineCap='round';
  ctx.lineJoin='round';
  const wall=(x0,z0,x1,z1)=>{
    ctx.beginPath();
    for(let i=0;i<=24;i++){
      const t=i/24,p=project(x0+(x1-x0)*t,z0+(z1-z0)*t);
      if(i===0)ctx.moveTo(p.x,p.y);
      else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
  };
  // Lateral walls, then front/rear wall segments: retain the real goal gaps.
  wall(-halfW,-halfL,-halfW,halfL);
  wall(halfW,-halfL,halfW,halfL);
  for(const z of [-halfL,halfL]){
    wall(-halfW,z,-halfGoal,z);
    wall(halfGoal,z,halfW,z);
  }
  ctx.restore();
}
function drawActors(dt=0){ctx.clearRect(0,0,layout.cssW,layout.cssH);if(!match)return;
  drawHalEye(dt);
  // The far opponent's paddle is behind the centre puck, which is behind the player's paddle.
  const actors=[{...match.ai,type:'ai'},{...match.puck,type:'puck'},
    {...(active?match.target:match.player),type:'player'}];
  actors.sort((a,b)=>b.z-a.z);
  for(const p of actors)drawObject(p,p.type);
  drawPhysicalTableWalls();
}
function updateHud(){if(!match)return;
  $('score').innerHTML=`${match.scores[0]} <span>:</span> ${match.scores[1]}`;
  $('hudStatus').textContent=statusText();
}
function frame(time){
  requestAnimationFrame(frame);
  const dt=lastTime?Math.min(.04,(time-lastTime)/1000):0;lastTime=time;
  if(active&&match){
    accumulator+=dt;
    let steps=0;
    while(accumulator>=match.cfg.tick&&steps<8){match.tick();accumulator-=match.cfg.tick;steps++;}
    if(steps===8)accumulator=0;
    if(match.state==='over'){showMatchEnd();}
    else if(match.state==='ready'){showPoint();}
  }
  if(images.stages[currentStage]?.complete&&images.stages[currentStage].naturalWidth && !frame.stageReady){drawBackdrop();frame.stageReady=true;}
  if(screen==='playing'||screen==='pause'||screen==='point'||screen==='result'){drawActors(dt);updateHud();}
}
function setBackground(stage,withOpponent){
  currentStage=stage;showFarOpponent=withOpponent;ctx.clearRect(0,0,layout.cssW,layout.cssH);frame.stageReady=false;
  // Draw the opponent only in gameplay, never on the select/menu backdrop.
  if(!withOpponent){const prior=active;active=false;drawBackdrop();active=prior;}
  else{drawBackdrop();}
}
addEventListener('resize',resize);
document.addEventListener('mousemove',e=>{
  if(!active||!match||isTouch())return;
  // Relative motion allows the original controller to stay instant and reversible.
  const movement=moveTargetWithMouse(match.target,e.movementX,e.movementY,mouseSensitivity,match.cfg);
  match.target.x=movement.x;match.target.z=movement.z;
});
arena.addEventListener('click',()=>{if(active&&!isTouch()&&document.pointerLockElement!==arena){arena.requestPointerLock?.().catch(()=>{});}});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==arena){pointerRequested=false;if(active&&!isTouch())showPause();}});
document.addEventListener('mousedown',e=>{if(!active||!match||isTouch())return;if(e.button===0)match.setButton('left',true);if(e.button===2)match.setButton('right',true);});
document.addEventListener('mouseup',e=>{if(!match||isTouch())return;if(e.button===0)match.setButton('left',false);if(e.button===2)match.setButton('right',false);});
document.addEventListener('contextmenu',e=>{if(active)e.preventDefault();});
arena.addEventListener('touchstart',e=>{
  if(!active||!match||touchId!==null)return;
  const t=e.changedTouches[0];if(!t)return;e.preventDefault();touchId=t.identifier;lastTouch={x:t.clientX,y:t.clientY};
},{passive:false});
addEventListener('touchmove',e=>{
  if(!active||touchId===null||!match)return;
  const t=[...e.changedTouches].find(t=>t.identifier===touchId);if(!t)return;e.preventDefault();
  const target=moveTargetWithTouch(match.target,t.clientX-lastTouch.x,t.clientY-lastTouch.y,layout.cssW,layout.cssH,mouseSensitivity,match.cfg);
  match.target.x=target.x;match.target.z=target.z;lastTouch={x:t.clientX,y:t.clientY};
},{passive:false});
for(const type of ['touchend','touchcancel'])addEventListener(type,e=>{if([...e.changedTouches].some(t=>t.identifier===touchId))touchId=null;});
addEventListener('keydown',e=>{
  if(e.code==='Escape'&&active){e.preventDefault();showPause();}
  if(e.code==='Space'){e.preventDefault();if(screen==='pause'||screen==='point')resume();}
});
addEventListener('blur',()=>{match?.setButton('left',false);match?.setButton('right',false);if(active)showPause('FENÊTRE INACTIVE');});
// Read-only diagnostics support end-to-end verification of game states.
window.__synthpuck=Object.freeze({
  snapshot:()=>({screen,mode,level,opponent:opponent.id,stage:currentStage,
    score:match?[...match.scores]:null,state:match?.state??null,
    ready:Boolean(images.stages[currentStage]?.complete&&images.stages[currentStage].naturalWidth),
    spriteSizes:Object.fromEntries(Object.entries(images.sprites).map(([type,img])=>[type,[img.naturalWidth||0,img.naturalHeight||0]])),
    viewport:{width:layout.cssW,height:layout.cssH},
    uiArtReady,
    opponentHeightNative:OPPONENT_HEIGHT_NATIVE,
    arenaFrame:{left:layout.x,top:layout.y,width:NATIVE.w*layout.scale,height:NATIVE.h*layout.scale},
    halEyeReady:Boolean(images.halEye?.complete&&images.halEye.naturalWidth),
    halEyePosition:currentStage===HAL_STAGE_ID?{...halGaze}:null,
    aiSpeed:match?.cfg.aiSpeed??null,aiStyle:match?.cfg.aiStyle??null,
    player:match?{x:match.player.x,z:match.player.z}:null,
    target:match?{x:match.target.x,z:match.target.z}:null}),
  project:(x,z)=>match?project(x,z):null,
  projectedRadius:(x,z,r)=>match?projectedRadius(x,z,r):null,
  spriteGeometry:(type,x,z)=>match?spriteGeometry({x,z},type):null,
  calibration:TABLE_CALIBRATION
});
resize();requestAnimationFrame(frame);
const params=new URLSearchParams(location.search);
if(params.get('skipSplash')==='1'){showMenu();}
else{showSplash();setTimeout(()=>{if(screen==='splash')showMenu();},1750);}
// Never unlock future Arcade stages using query-string parameters.