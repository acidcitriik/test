import {playerAuth} from './player-auth.js?v=online-20261101-3';
import {DEFAULT_AVATAR,AVATAR_CHOICES,normalizeAvatar,escapeHtml} from './player-profile.js';

const launcher=document.getElementById('accountLauncher');
const overlay=document.getElementById('accountOverlay');
let view='login',notice='',busy=false,lastFocus=null,renderedContext='';
const button=(label,action,primary=false)=>'<button type="button" class="account-button'+(primary?' primary':'')+'" data-account-action="'+action+'">'+escapeHtml(label)+'</button>';
const field=(title,name,type,extra='')=>'<label class="account-field">'+title+'<input name="'+name+'" type="'+type+'" '+extra+' required></label>';
const optionLabel={neutre:'Neutre / non genré',masculine:'Masculine',feminine:'Féminine',androgyne:'Androgyne',libre:'Libre / mixte',
  court:'Courts',long:'Longs',boucle:'Bouclés',rase:'Rasés',mohawk:'Crête',afro:'Afro',tresses:'Tresses',aucun:'Aucun',
  bandana:'Bandana devant la bouche',masque:'Masque',visiere:'Visière',lunettes:'Lunettes',cicatrice:'Cicatrice'};
const choices=(key,value)=>'<select name="'+key+'">'+AVATAR_CHOICES[key].map(choice=>
  '<option value="'+choice+'"'+(choice===value?' selected':'')+'>'+optionLabel[choice]+'</option>').join('')+'</select>';
const color=(label,name,value)=>'<label class="account-color"><span>'+label+'</span><input type="color" name="'+name+'" value="'+value+'"></label>';
const statusLine=()=>'<p id="accountNotice" class="account-notice" role="status" aria-live="polite">'+escapeHtml(notice)+'</p>';

function updateLauncher(){
  const s=playerAuth.snapshot();
  launcher.textContent=s.user?'JOUEUR : '+(s.profile?.nickname||'JOUEUR'):'COMPTE / INVITÉ';
}
function render({preserveEditing=false}={}){
  updateLauncher();
  if(overlay.hidden)return;
  const s=playerAuth.snapshot();
  const context=[s.status,s.user?.id||'',s.recovery?'recovery':'',s.user?'profile':view].join('|');
  // A token refresh or asynchronous profile lookup must never replace the
  // focused input: replacing innerHTML loses focus and the unsaved draft.
  if(preserveEditing && (busy || (context===renderedContext &&
      overlay.contains(document.activeElement) &&
      document.activeElement.matches('input,select,textarea'))))return;
  let body='';
  if(s.status==='disabled'){
    body='<p class="account-sub">Le jeu reste disponible en invité. Les comptes seront activés dès que le service Supabase sera configuré par l’administrateur.</p>'+
      '<p class="account-sub">La connexion Google et les comptes e-mail nécessitent une configuration serveur ; aucun mot de passe n’est conservé par le jeu.</p>';
  }else if(s.status==='error'){
    body='<p class="account-error">'+escapeHtml(s.profileError)+'</p>';
  }else if(s.status==='loading'){
    body='<p class="account-sub">Chargement du service de connexion…</p>';
  }else if(s.recovery){
    body='<p class="account-sub">Définis ton nouveau mot de passe.</p><form data-account-form="password" class="account-form">'+
      field('Nouveau mot de passe','password','password','minlength="8" autocomplete="new-password"')+
      field('Confirmer','confirm','password','minlength="8" autocomplete="new-password"')+
      '<button class="account-button primary" type="submit">ENREGISTRER LE MOT DE PASSE</button></form>';
  }else if(s.user){
    const avatar=normalizeAvatar(s.profile?.avatar||DEFAULT_AVATAR);
    const nickname=s.profile?.nickname||s.user.user_metadata?.nickname||'Joueur';
    body='<p class="account-sub">Connecté'+(s.user.email?' · '+escapeHtml(s.user.email):'')+'</p>'+
      (s.profileError?'<p class="account-error">'+escapeHtml(s.profileError)+'</p>':'')+
      '<form data-account-form="profile" class="account-form">'+
      '<label class="account-field">Pseudo du joueur<input name="nickname" type="text" minlength="3" maxlength="24" autocomplete="nickname" required value="'+escapeHtml(nickname)+'"></label>'+
      '<h3>MON PERSONNAGE · PRÉPARATION</h3>'+
      '<p class="account-sub">Ces préférences d’apparence seront utilisées par le futur éditeur graphique. Elles ne changent pas encore le sprite du match. La présentation est un style visuel, pas une donnée d’identité.</p>'+
      '<div class="account-layout">'+
      '<label class="account-field">Présentation'+choices('presentation',avatar.presentation)+'</label>'+
      '<label class="account-field">Coiffure'+choices('hairStyle',avatar.hairStyle)+'</label>'+
      '<label class="account-field">Accessoire du visage'+choices('accessory',avatar.accessory)+'</label>'+
      '</div><div class="account-colors">'+
      color('Peau','skinTone',avatar.skinTone)+
      color('Yeux','eyeColor',avatar.eyeColor)+
      color('Cheveux','hairColor',avatar.hairColor)+
      '</div><button class="account-button primary" type="submit">ENREGISTRER MON PROFIL</button></form>'+
      button('SE DÉCONNECTER','signout');
  }else if(view==='register'){
    body='<p class="account-sub">Crée ton compte pour retrouver ton profil sur tes appareils.</p>'+
      '<form data-account-form="register" class="account-form">'+
      field('Pseudo','nickname','text','minlength="3" maxlength="24" autocomplete="nickname"')+
      field('E-mail','email','email','autocomplete="email"')+
      field('Mot de passe (8 caractères minimum)','password','password','minlength="8" autocomplete="new-password"')+
      field('Confirmer le mot de passe','confirm','password','minlength="8" autocomplete="new-password"')+
      '<button class="account-button primary" type="submit">CRÉER MON COMPTE</button></form>'+
      button('DÉJÀ UN COMPTE ?','login');
  }else if(view==='forgot'){
    body='<p class="account-sub">Reçois un lien pour définir un nouveau mot de passe.</p>'+
      '<form data-account-form="forgot" class="account-form">'+field('E-mail','email','email','autocomplete="email"')+
      '<button class="account-button primary" type="submit">ENVOYER LE LIEN</button></form>'+
      button('RETOUR À LA CONNEXION','login');
  }else{
    body=button('CONTINUER AVEC GOOGLE','google',true)+
      '<div class="account-separator">OU AVEC TON E-MAIL</div>'+
      '<form data-account-form="login" class="account-form">'+
      field('E-mail','email','email','autocomplete="email"')+
      field('Mot de passe','password','password','autocomplete="current-password"')+
      '<button class="account-button primary" type="submit">SE CONNECTER</button></form>'+
      '<div class="account-links">'+button('CRÉER UN COMPTE','register')+button('MOT DE PASSE OUBLIÉ','forgot')+'</div>';
  }
  overlay.innerHTML='<div class="account-dialog" role="dialog" aria-modal="true" aria-labelledby="accountTitle">'+
    '<header class="account-header"><div><span class="account-tag">PIPERADEGAMES / SYNTHPUCK</span><h2 id="accountTitle">MON COMPTE JOUEUR</h2></div>'+
    '<button type="button" class="account-close" data-account-action="close" aria-label="Fermer">×</button></header>'+
    body+statusLine()+'<p class="account-footer">Tu peux jouer en invité sans jamais créer de compte.</p></div>';
  renderedContext=context;
  if(busy)overlay.querySelectorAll('button,input,select').forEach(el=>{if(el.dataset.accountAction!=='close')el.disabled=true;});
}
function openAccount(){
  lastFocus=document.activeElement;
  overlay.hidden=false;
  launcher.setAttribute('aria-expanded','true');
  render();
  overlay.querySelector('.account-close')?.focus();
}
function closeAccount(){
  overlay.hidden=true;
  overlay.innerHTML='';
  launcher.setAttribute('aria-expanded','false');
  notice='';
  lastFocus?.focus?.();
}
function showNotice(value){
  notice=value;
  const region=overlay.querySelector('#accountNotice');
  if(region)region.textContent=value;
}
function setBusy(value){
  busy=value;
  if(overlay.hidden)return;
  overlay.querySelectorAll('button,input,select').forEach(el=>{
    if(el.dataset.accountAction!=='close')el.disabled=value;
  });
}
async function execute(operation,success){
  if(busy)return;
  // Disable controls in place instead of replacing form nodes. In particular,
  // failed saves keep the nickname, selected colors and unsaved avatar values.
  setBusy(true);
  try{
    const result=await operation();
    if(success)success(result);
    else notice='';
    render();
  }catch(error){
    showNotice(error?.message||'Une erreur est survenue.');
  }finally{setBusy(false);}
}
launcher.addEventListener('click',openAccount);
// Mouse, keyboard and touch input inside the modal must not reach the
// global gameplay controller. Do not preventDefault: text entry, the
// native color picker, selections and scrolling must keep working.
for(const type of ['keydown','keyup','keypress','pointerdown','pointerup',
  'mousedown','mouseup','touchstart','touchmove','touchend','wheel']){
  overlay.addEventListener(type,event=>event.stopPropagation());
}
overlay.addEventListener('click',event=>{
  if(event.target===overlay){closeAccount();return;}
  const control=event.target.closest('[data-account-action]');
  if(!control||busy)return;
  switch(control.dataset.accountAction){
    case 'close':closeAccount();break;
    case 'register':view='register';notice='';render();break;
    case 'login':view='login';notice='';render();break;
    case 'forgot':view='forgot';notice='';render();break;
    case 'google':void execute(()=>playerAuth.signInWithGoogle(),()=>showNotice('Redirection vers Google…'));break;
    case 'signout':void execute(()=>playerAuth.signOut(),()=>{view='login';notice='Déconnecté.';});break;
  }
});
overlay.addEventListener('submit',event=>{
  const form=event.target.closest('[data-account-form]');
  if(!form)return;
  event.preventDefault();
  if(busy)return;
  const values=new FormData(form);
  const get=key=>String(values.get(key)||'');
  const checkPasswords=()=>{
    if(get('password')!==get('confirm'))throw new Error('Les mots de passe ne correspondent pas.');
  };
  switch(form.dataset.accountForm){
    case 'login':void execute(()=>playerAuth.signInWithEmail(get('email'),get('password')),()=>showNotice('Connexion réussie.'));break;
    case 'register':void execute(async()=>{
      checkPasswords();
      return playerAuth.signUpWithEmail(get('email'),get('password'),get('nickname'));
    },result=>{view='login';notice=result.needsConfirmation?'Vérifie ton e-mail et confirme ton inscription avant de te connecter.':'Compte créé !';});break;
    case 'forgot':void execute(()=>playerAuth.requestReset(get('email')),()=>{view='login';notice='Si cette adresse existe, un e-mail de réinitialisation a été envoyé.';});break;
    case 'password':void execute(async()=>{checkPasswords();return playerAuth.changePassword(get('password'));},()=>{notice='Mot de passe modifié.';});break;
    case 'profile':void execute(()=>playerAuth.saveProfile(get('nickname'),{
      presentation:get('presentation'),skinTone:get('skinTone'),eyeColor:get('eyeColor'),
      hairStyle:get('hairStyle'),hairColor:get('hairColor'),accessory:get('accessory')
    }),()=>{notice='Profil joueur enregistré.';});break;
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!overlay.hidden){event.preventDefault();event.stopPropagation();closeAccount();}
},true);
playerAuth.subscribe(()=>render({preserveEditing:true}));
updateLauncher();
void playerAuth.init();
if(new URLSearchParams(location.search).has('auth')){
  openAccount();
  const url=new URL(location.href);url.searchParams.delete('auth');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
}
