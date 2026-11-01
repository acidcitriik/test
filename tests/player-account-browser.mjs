// Browser regression for the player account modal. Runs without real Google or
// user credentials by stubbing the public player-auth module in Playwright.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(import.meta.dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.avif':'image/avif','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+sep))throw Error('Invalid path');
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
    res.end(bytes);
  }catch(error){res.writeHead(404);res.end(String(error.message));}
});

const mockAuth=String.raw`
const listeners=new Set();
let state={status:'ready',user:{id:'test-user',email:'test@example.test',user_metadata:{}},
  profile:{nickname:'Joueur',avatar:null},profileError:'',recovery:false};
let saved=null;
const emit=()=>{for(const fn of listeners)fn({...state});};
globalThis.__mockPlayerAuth={
  emit,
  get saved(){return saved;},
  setUser(value){state={...state,user:value?{id:'test-user',email:'test@example.test',user_metadata:{}}:null,
    profile:value?{nickname:'Joueur',avatar:null}:null};emit();}
};
export const playerAuth={
  configured:true,
  snapshot(){return {...state};},
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  init:async()=>{},
  async saveProfile(nickname,avatar){
    if(nickname==='Erreur')throw Error('Échec simulé');
    saved={nickname,avatar};state.profile={nickname,avatar};emit();
  },
  async signOut(){state.user=null;state.profile=null;emit();},
  async signInWithGoogle(){return;},
  async signInWithEmail(){state.user={id:'test-user',email:'test@example.test'};emit();},
  async signUpWithEmail(){return{needsConfirmation:true};},
  async requestReset(){return;},
  async changePassword(){state.recovery=false;emit();}
};
`;
let browser;
try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/src\/player-auth\.js(?:\?.*)?$/,route=>route.fulfill({
    status:200,contentType:'text/javascript',body:mockAuth
  }));
  const url='http://127.0.0.1:'+server.address().port+'/?skipSplash=1';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.__synthpuck?.snapshot().screen==='menu');
  await page.locator('#accountLauncher').click();
  const input=page.locator('#accountOverlay [name="nickname"]');
  await input.click();
  assert.equal(await input.evaluate(el=>el===document.activeElement),true,'Click must focus nickname');
  await input.fill('Solar Player');
  await input.press('Space');
  assert.equal(await input.inputValue(),'Solar Player ','Space must insert text, not start or resume game');
  assert.equal(await page.evaluate(()=>__synthpuck.snapshot().screen),'menu','Focus must not start game');

  // Automatic Supabase callbacks may fire while a player edits: no DOM remount.
  await page.evaluate(()=>__mockPlayerAuth.emit());
  assert.equal(await input.inputValue(),'Solar Player ');
  assert.equal(await input.evaluate(el=>el===document.activeElement),true,'Auth events must preserve focus');

  await page.locator('[name="presentation"]').selectOption('androgyne');
  await page.locator('[name="hairStyle"]').selectOption('tresses');
  await page.locator('[name="accessory"]').selectOption('bandana');
  await page.locator('[name="skinTone"]').fill('#b18866');
  await page.locator('[name="eyeColor"]').fill('#345678');
  await page.locator('[name="hairColor"]').fill('#876543');

  // An API error must preserve ALL unsaved fields.
  await input.fill('Erreur');
  await page.getByRole('button',{name:'ENREGISTRER MON PROFIL'}).click();
  await page.getByText('Échec simulé').waitFor();
  assert.equal(await input.inputValue(),'Erreur','Failed save must keep the draft nickname');
  assert.equal(await page.locator('[name="accessory"]').inputValue(),'bandana','Failed save must preserve selections');
  assert.equal(await page.locator('[name="skinTone"]').inputValue(),'#b18866','Failed save must preserve colors');

  // A successful save uses the entered values without navigating to gameplay.
  await input.fill('Solar Player');
  await page.getByRole('button',{name:'ENREGISTRER MON PROFIL'}).click();
  await page.getByText('Profil joueur enregistré.').waitFor();
  const saved=await page.evaluate(()=>__mockPlayerAuth.saved);
  assert.equal(saved.nickname,'Solar Player');
  assert.equal(saved.avatar.presentation,'androgyne');
  assert.equal(saved.avatar.hairStyle,'tresses');
  assert.equal(saved.avatar.accessory,'bandana');
  assert.equal(saved.avatar.skinTone,'#b18866');
  assert.equal(await page.evaluate(()=>__synthpuck.snapshot().screen),'menu');

  // Account modal must trap focus; Escape closes it, not the game.
  await page.locator('#accountOverlay [name="nickname"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#accountOverlay').isHidden(),true);
  assert.equal(await page.evaluate(()=>__synthpuck.snapshot().screen),'menu');

  // All guest form actions remain independent from gameplay controls.
  await page.evaluate(()=>__mockPlayerAuth.setUser(false));
  await page.locator('#accountLauncher').click();
  await page.getByRole('button',{name:'CRÉER UN COMPTE'}).click();
  await page.locator('[name="nickname"]').fill('Nouveau joueur');
  await page.locator('[name="email"]').fill('new@example.test');
  await page.locator('[name="password"]').fill('abcdefgh');
  await page.locator('[name="confirm"]').fill('different');
  await page.getByRole('button',{name:'CRÉER MON COMPTE'}).click();
  await page.getByText('Les mots de passe ne correspondent pas.').waitFor();
  assert.equal(await page.locator('[name="nickname"]').inputValue(),'Nouveau joueur');
  await page.locator('[name="confirm"]').fill('abcdefgh');
  await page.getByRole('button',{name:'CRÉER MON COMPTE'}).click();
  await page.getByText('Vérifie ton e-mail').waitFor();

  await page.getByRole('button',{name:'MOT DE PASSE OUBLIÉ'}).click();
  await page.locator('#accountOverlay [name="email"]').fill('new@example.test');
  await page.getByRole('button',{name:'ENVOYER LE LIEN'}).click();
  await page.getByText('réinitialisation').waitFor();
  assert.equal(await page.evaluate(()=>__synthpuck.snapshot().screen),'menu');
  assert.deepEqual(errors,[],'No JavaScript page errors');
  console.log('PASS: nickname focus, typing/space, session refresh, all avatar controls, save/error, Escape, signup and reset actions.');
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
