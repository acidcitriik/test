import {Match,clamp,magnitude} from './physics.js';
import {moveTargetWithMouse,moveTargetWithTouch} from './controls.js';
import {ROSTER,STAT_NAMES,getCharacter,matchConfiguration} from './roster.js';
import {ARCADE_ORDER,nextArcadeLevel,stageIdFor} from './campaign.js';

const NATIVE={w:1672,h:941};
const $=id=>document.getElementById(id);
const panel=$('panel'),backdrop=$('backdrop'),arena=$('arena');
const bg=backdrop.getContext('2d',{alpha:false});
const ctx=arena.getContext('2d');
const hud=$('hud'),touchBar=$('touchBar');
const images={stages:{},characters:{},sprites:null};
let mode='arcade',level=0,selected='mute',opponent=ROSTER[0];
let currentStage='mamouda',screen='splash',match=null,active=false;
let lastTime=0,accumulator=0,mouseSensitivity=1,touchId=null;
let lastTouch={x:0,y:0},inputMode='normal',pointerRequested=false;
let layout={scale:1,x:0,y:0,cssW:1,cssH:1,dpr:1};
let pausedReason='',showFarOpponent=false;
const isTouch=()=>navigator.maxTouchPoints>0 || matchMedia('(pointer:coarse)').matches;

const logo=`<svg class="logo" viewBox="0 0 120 150" role="img" aria-label="Piment rouge de PiperadeGames" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pepper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff8c45"/><stop offset=".45" stop-color="#f12d4a"/><stop offset="1" stop-color="#9f123c"/></linearGradient></defs><path d="M68 36C78 23 76 12 72 6C68 17 57 23 49 33" fill="none" stroke="#6ed083" stroke-width="9" stroke-linecap="round"/><path d="M61 36C89 20 111 42 103 72C94 108 68 127 32 135C15 138 5 129 16 116C42 95 47 72 45 51C44 43 50 38 61 36Z" fill="url(#pepper)" stroke="#ff9c7a" stroke-width="3"/><path d="M57 45C50 60 58 85 42 105" fill="none" stroke="#ffb2a1" stroke-width="6" stroke-linecap="round" opacity=".7"/><path d="M49 37C57 28 69 29 79 37" fill="none" stroke="#89e177" stroke-width="7" stroke-linecap="round"/></svg>`;
const statBar=(value,accent)=>`<div class="meter" style="--accent:${accent}">${Array.from({length:5},(_,i)=>`<i class="${i<value?'on':''}"></i>`).join('')}</div>`;
const statsHtml=c=>`<div class="stats" style="--accent:${c.accent}">${STAT_NAMES.map((title,i)=>`<div class="stat-line"><label>${title}</label>${statBar(c.stats[i],c.accent)}</div>`).join('')}</div>`;
const avatar=c=>`<img loading="eager" src="./assets/characters/${c.id}.webp" alt="Portrait de ${c.name}"/>`;
const btn=(label,action,primary=false)=>`<button class="btn ${primary?'primary':''}" data-action="${action}" type="button">${label}</button>`;
const statusText=()=>match?.awaitingServe?(match.server===-1?'À TOI DE SERVIR':'SERVICE ADVERSAIRE'):'PREMIER À 7';
function setScreen(name,compact=false){screen=name;panel.className=compact?'compact':'';panel.removeAttribute('hidden');panel.setAttribute('data-screen',name);$('fighterName').hidden=name!=='playing';}
function showSplash(){setScreen('splash');panel.innerHTML=`<div class="studio">${logo}<h2>PIPERADE<span>GAMES</span></h2><p class="eyebrow">PRESENTS</p></div>`;}
function showMenu(){
  active=false;touchId=null;mode='arcade';currentStage='mamouda';setBackground(currentStage,false);
  setScreen('menu');hud.hidden=true;touchBar.hidden=true;$('fighterName').hidden=true;
  panel.innerHTML=`<div class="title-screen"><p class="eyebrow">PIPERADEGAMES PRÉSENTE</p><h1>SYNTHPUCK</h1><p class="subtitle">STRIKE. SPIN. SURVIVE.</p><nav class="menu" aria-label="Menu principal">${btn('ARCADE','arcade',true)}${btn('ENTRAÎNEMENT','training')}<button class="btn" disabled aria-disabled="true" title="Bientôt disponible">OPTIONS <span aria-hidden="true">·</span> BIENTÔT</button><button class="btn" disabled aria-disabled="true" title="Non disponible dans le navigateur">EXIT <span aria-hidden="true">·</span> INACTIF</button></nav><p class="title-foot">7 RIVAUX · 8 ARÈNES · UN SEUL VAINQUEUR</p></div>`;
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
  panel.innerHTML=`<div class="compact-center"><p class="eyebrow">SYNTHPUCK</p><h2>${reason}</h2><p class="sub">${opponent.name} · ${mode==='arcade'?'ARCADE':'ENTRAÎNEMENT'}</p>${btn('REPRENDRE','resume',true)}${btn('RECOMMENCER','retry')}${btn('RETOUR AU MENU','menu')}</div>`;
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
function createMatch(){opponent=mode==='training'?getCharacter(selected):ROSTER[level];match=new Match(matchConfiguration(opponent));match.serve();}
function beginMatch(){
  currentStage=stageIdFor(mode,opponent.id);
  setBackground(currentStage,true);createMatch();
  $('fighterName').textContent=opponent.name;
  $('fighterName').hidden=false;hud.hidden=false;
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
  if(button.dataset.character){selected=button.dataset.character;showTrainingSelect();return;}
  if(button.dataset.action)buttonAction(button.dataset.action);
});
$('pauseButton').addEventListener('click',()=>{if(active)showPause();});
function selectTouchMode(val){inputMode=val;if(match){match.setButton('left',val==='rigid'||val==='grip');match.setButton('right',val==='soft'||val==='grip');}document.querySelectorAll('[data-touch-mode]').forEach(b=>b.classList.toggle('chosen',b.dataset.touchMode===val));}
touchBar.addEventListener('click',e=>{const b=e.target.closest('[data-touch-mode]');if(b)selectTouchMode(b.dataset.touchMode);});
function loadImage(src){const img=new Image();img.decoding='async';img.addEventListener('load',()=>{frame.stageReady=false;drawBackdrop();});img.src=src;return img;}
for(const p of ROSTER)images.characters[p.id]=loadImage(`./assets/characters/${p.id}.webp`);
for(const name of ['mamouda','mute','chonk','simous','diamond','stal','2502','training']) images.stages[name]=loadImage(`./assets/stages/${name}.webp`);
images.sprites=loadImage('./assets/mamouda/sprites.webp');
function resize(){
  const cssW=innerWidth,cssH=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
  // Contain the entire calibrated table and rear-rail silhouette on every aspect ratio.
  // Cover-cropping hides the goals on tall phones and makes the duel unplayable.
  layout={cssW,cssH,dpr,scale:Math.min(cssW/NATIVE.w,cssH/NATIVE.h),x:0,y:0};
  layout.x=(cssW-NATIVE.w*layout.scale)/2;layout.y=(cssH-NATIVE.h*layout.scale)/2;
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
  const image=images.characters[opponent.id];if(!image?.complete||!image.naturalWidth)return;
  // The tabletop begins at native Y=351. Clip exactly at its far edge:
  // no character pixel or shadow can cover the table or its playing surface.
  bg.save();bg.beginPath();bg.rect(0,0,layout.cssW,layout.y+351*layout.scale);bg.clip();
  const height=260*layout.scale,width=image.width/image.height*height;
  const x=layout.x+NATIVE.w*layout.scale/2-width/2;
  const y=layout.y+135*layout.scale;
  bg.shadowColor=opponent.accent;bg.shadowBlur=24*layout.scale;
  bg.drawImage(image,x,y,width,height);
  bg.restore();
}
function project(x,z){
  // Identical mapping for ALL eight pixel-aligned stages. The existing engine's
  // camera-right is negative world X, as established by controls.js.
  const u=.5-x/match.cfg.width;
  const v=.5-z/match.cfg.length;
  const iy=351+325*v+122*v*v;
  const left=675-320*v-155*v*v,right=994+310*v+166*v*v;
  return {x:layout.x+(left+(right-left)*u)*layout.scale,y:layout.y+iy*layout.scale};
}
function projectedRadius(x,z,r){
  const a=project(x-r,z),b=project(x+r,z),c=project(x,z-r),d=project(x,z+r);
  return {rx:Math.max(3,Math.abs(b.x-a.x)/2),ry:Math.max(2,Math.abs(c.y-d.y)/2)};
}
const atlasCrop={player:[6,8,232,137],ai:[258,8,232,137],puck:[10,164,90,60]};
function drawObject(obj,type){
  const p=project(obj.x,obj.z),{rx}=projectedRadius(obj.x,obj.z,match.cfg[type==='puck'?'puckRadius':'paddleRadius']);
  const rect=atlasCrop[type],img=images.sprites;
  const width=2.12*rx,height=width*rect[3]/rect[2];
  if(img?.complete&&img.naturalWidth){
    ctx.save();ctx.shadowColor='#030712c9';ctx.shadowBlur=10*layout.scale;
    ctx.drawImage(img,...rect,p.x-width/2,p.y-height*.83,width,height);
    ctx.restore();
  }else{
    ctx.beginPath();ctx.ellipse(p.x,p.y,rx,rx*.48,0,0,Math.PI*2);
    ctx.fillStyle=type==='player'?'#4ce3ff':type==='ai'?'#ff4865':'#f0faff';ctx.fill();
  }
}
function drawActors(){ctx.clearRect(0,0,layout.cssW,layout.cssH);if(!match)return;
  // The far opponent's paddle is behind the centre puck, which is behind the player's paddle.
  const actors=[{...match.ai,type:'ai'},{...match.puck,type:'puck'},
    {...(active?match.target:match.player),type:'player'}];
  actors.sort((a,b)=>b.z-a.z);
  for(const p of actors)drawObject(p,p.type);
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
  if(screen==='playing'||screen==='pause'||screen==='point'||screen==='result'){drawActors();updateHud();}
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
    viewport:{width:layout.cssW,height:layout.cssH},
    aiSpeed:match?.cfg.aiSpeed??null,aiStyle:match?.cfg.aiStyle??null,
    player:match?{x:match.player.x,z:match.player.z}:null,
    target:match?{x:match.target.x,z:match.target.z}:null}),
  project:(x,z)=>match?project(x,z):null,
  projectedRadius:(x,z,r)=>match?projectedRadius(x,z,r):null
});
resize();requestAnimationFrame(frame);
const params=new URLSearchParams(location.search);
if(params.get('skipSplash')==='1'){showMenu();}
else{showSplash();setTimeout(()=>{if(screen==='splash')showMenu();},1750);}
// Never unlock future Arcade stages using query-string parameters.