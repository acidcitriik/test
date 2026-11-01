import {PLAYER_AUTH_CONFIG} from './player-auth-config.js';
import {cleanNickname,normalizeAvatar} from './player-profile.js';

const listeners=new Set();
let client=null,initPromise=null,profileRequest=0;
const state={status:'disabled',user:null,profile:null,profileError:'',recovery:false};
const configured=Boolean(PLAYER_AUTH_CONFIG.supabaseUrl&&PLAYER_AUTH_CONFIG.supabasePublishableKey);

function notify(){for(const listener of listeners)try{listener({...state});}catch(error){console.error('Player auth listener failed',error);}}
function patch(value){Object.assign(state,value);notify();}
function errorMessage(error){return error?.message||'Une erreur est survenue. Réessaie.';}
function sdk(){
  if(globalThis.supabase?.createClient)return Promise.resolve(globalThis.supabase);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.async=true;
    script.onload=()=>globalThis.supabase?.createClient?resolve(globalThis.supabase):reject(new Error('SDK de connexion indisponible.'));
    script.onerror=()=>reject(new Error('Impossible de charger le service de connexion. Vérifie Internet.'));
    document.head.appendChild(script);
  });
}
function requireClient(){
  if(!client)throw new Error(configured?'Service de connexion indisponible.':'Comptes non configurés. Le jeu invité reste disponible.');
  return client;
}
function publicProfile(user){
  const nickname=user?.user_metadata?.nickname;
  try{return cleanNickname(nickname);}catch{return 'Joueur';}
}
async function loadProfile(user){
  const request=++profileRequest;
  try{
    const db=requireClient();
    let {data,error}=await db.from('player_profiles').select('nickname,avatar_data').eq('id',user.id).maybeSingle();
    if(error)throw error;
    if(!data){
      const created=await db.from('player_profiles').upsert({
        id:user.id,nickname:publicProfile(user),avatar_data:normalizeAvatar()
      },{onConflict:'id',ignoreDuplicates:true}).select('nickname,avatar_data').maybeSingle();
      if(created.error)throw created.error;
      data=created.data;
      if(!data){
        const again=await db.from('player_profiles').select('nickname,avatar_data').eq('id',user.id).single();
        if(again.error)throw again.error;
        data=again.data;
      }
    }
    if(request===profileRequest&&state.user?.id===user.id)
      patch({profile:{nickname:data.nickname,avatar:normalizeAvatar(data.avatar_data)},profileError:''});
  }catch(error){
    if(request===profileRequest&&state.user?.id===user.id)
      patch({profileError:'Profil inaccessible : '+errorMessage(error)+'. Vérifie la migration SQL.'});
  }
}
function onSession(event,session){
  if(event==='PASSWORD_RECOVERY')patch({recovery:true});
  const user=session?.user??null;
  if(!user){
    ++profileRequest;
    patch({user:null,profile:null,profileError:'',status:'ready',recovery:false});
    return;
  }
  const unchanged=state.user?.id===user.id;
  patch({user,status:'ready',profile:unchanged?state.profile:null,profileError:''});
  // Supabase auth callbacks must not issue another API call while its auth lock is held.
  if(!unchanged||!state.profile)setTimeout(()=>{void loadProfile(user);},0);
}

export const playerAuth={
  get configured(){return configured;},
  snapshot(){return {...state};},
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  database(){return requireClient();},
  async accessToken(){
    await this.init();
    const {data,error}=await requireClient().auth.getSession();
    if(error)throw error;
    return data?.session?.access_token||null;
  },
  init(){
    if(initPromise)return initPromise;
    if(!configured){patch({status:'disabled'});return Promise.resolve();}
    initPromise=(async()=>{
      patch({status:'loading'});
      try{
        const url=new URL(PLAYER_AUTH_CONFIG.supabaseUrl);
        if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')
          throw new Error('Le service de connexion doit utiliser HTTPS.');
        const key=PLAYER_AUTH_CONFIG.supabasePublishableKey;
        if(/service_role|sb_secret_/i.test(key))throw new Error('Clé privée interdite côté navigateur.');
        const library=await sdk();
        client=library.createClient(url.origin,key,{
          auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}
        });
        client.auth.onAuthStateChange((event,session)=>onSession(event,session));
        const {data,error}=await client.auth.getUser();
        if(data?.user)onSession('INITIAL_SESSION',{user:data.user});
        else if(error&&error.name!=='AuthSessionMissingError')throw error;
        else if(state.status==='loading')patch({status:'ready'});
      }catch(error){
        patch({status:'error',profileError:'Connexion indisponible : '+errorMessage(error)});
      }
    })();
    return initPromise;
  },
  async signInWithGoogle(){
    const {error}=await requireClient().auth.signInWithOAuth({
      provider:'google',options:{redirectTo:new URL('./?auth=1',location.href).href}
    });
    if(error)throw error;
  },
  async signInWithEmail(email,password){
    const {error}=await requireClient().auth.signInWithPassword({email:email.trim(),password});
    if(error)throw error;
  },
  async signUpWithEmail(email,password,nickname){
    const name=cleanNickname(nickname);
    if(password.length<8)throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    const {data,error}=await requireClient().auth.signUp({
      email:email.trim(),password,
      options:{data:{nickname:name},emailRedirectTo:new URL('./?auth=1',location.href).href}
    });
    if(error)throw error;
    return {needsConfirmation:!data.session};
  },
  async requestReset(email){
    const {error}=await requireClient().auth.resetPasswordForEmail(email.trim(),{
      redirectTo:new URL('./?auth=1',location.href).href
    });
    if(error)throw error;
  },
  async changePassword(password){
    if(password.length<8)throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    const {error}=await requireClient().auth.updateUser({password});
    if(error)throw error;
    patch({recovery:false});
  },
  async saveProfile(nickname,avatar){
    const user=state.user;
    if(!user)throw new Error('Connecte-toi pour enregistrer ton profil.');
    const name=cleanNickname(nickname);
    const data=normalizeAvatar(avatar);
    const result=await requireClient().from('player_profiles').upsert({
      id:user.id,nickname:name,avatar_data:data
    },{onConflict:'id'}).select('nickname,avatar_data').single();
    if(result.error)throw result.error;
    if(state.user?.id===user.id)patch({profile:{nickname:result.data.nickname,avatar:normalizeAvatar(result.data.avatar_data)},profileError:''});
  },
  async signOut(){
    const {error}=await requireClient().auth.signOut();
    if(error)throw error;
    ++profileRequest;patch({user:null,profile:null,profileError:'',recovery:false});
  }
};
