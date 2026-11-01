import {playerAuth} from './player-auth.js';

// The online directory uses Supabase Postgres (RLS + RPC) rather than trusting
// client-supplied nicknames, presence states or invitation targets.
export class OnlineDirectory {
  constructor(onUpdate=()=>{}){
    this.onUpdate=onUpdate;this.active=false;this.players=[];this.incoming=[];this.outgoing=[];
    this.message='';this.sessionId=crypto.randomUUID();this.token=0;this.refreshing=false;
    this.userId=null;this.status='available';this.seen=new Set();
    this.unsubscribe=playerAuth.subscribe(()=>{if(this.active)void this.syncIdentity();});
  }
  get ready(){return this.active&&!!this.userId;}
  async start(){
    this.active=true;
    await playerAuth.init();
    if(!this.active)return;
    await this.syncIdentity();
    clearInterval(this.timer);
    this.timer=setInterval(()=>{void this.refresh();},3000);
    clearInterval(this.heartbeat);
    this.heartbeat=setInterval(()=>{void this.pulse();},15000);
  }
  stop(){
    this.active=false;this.token++;clearInterval(this.timer);clearInterval(this.heartbeat);
    const previous=this.userId;const id=this.sessionId;this.userId=null;
    this.players=[];this.incoming=[];this.outgoing=[];this.status='available';this.seen.clear();
    if(previous&&playerAuth.snapshot().user?.id===previous){
      playerAuth.database().rpc('online_leave',{p_session_id:id}).then(()=>{},()=>{});
    }
  }
  async syncIdentity(){
    const id=playerAuth.snapshot().user?.id??null;
    if(id===this.userId&&this.userId)return;
    this.token++;
    this.userId=id;this.players=[];this.incoming=[];this.outgoing=[];this.seen.clear();
    if(!id){this.message='Connecte-toi pour voir les joueurs en ligne et envoyer des invitations.';this.onUpdate(this);return;}
    this.message='Connexion au salon en ligne…';
    this.onUpdate(this);
    await this.pulse();
  }
  async pulse(){
    if(!this.ready)return;
    const token=this.token;
    try{
      const {data,error}=await playerAuth.database().rpc('online_heartbeat',{
        p_session_id:this.sessionId,p_status:this.status
      });
      if(error)throw error;
      if(!data)throw new Error('Ce compte utilise déjà une autre session en ligne.');
      if(token!==this.token)return;
      this.message='';
      await this.refresh();
    }catch(error){if(token===this.token){this.message='Salon indisponible : '+error.message;this.onUpdate(this);}}
  }
  async setStatus(value){
    if(value!=='available'&&value!=='busy')throw new Error('État du joueur incorrect.');
    this.status=value;
    await this.pulse();
  }
  async refresh(){
    if(!this.ready||this.refreshing)return;
    this.refreshing=true;const token=this.token,id=this.userId;
    try{
      const db=playerAuth.database();
      const cutoff=new Date(Date.now()-45000).toISOString();
      const live=db.from('online_players').select('user_id,nickname,status,last_seen')
        .gte('last_seen',cutoff).neq('user_id',id).order('nickname');
      const invites=db.from('online_invites')
        .select('id,sender_id,recipient_id,sender_nickname,room_code,status,expires_at,created_at')
        .or('sender_id.eq.'+id+',recipient_id.eq.'+id)
        .gt('expires_at',new Date().toISOString())
        .order('created_at',{ascending:false}).limit(25);
      const [a,b]=await Promise.all([live,invites]);
      if(a.error)throw a.error;
      if(b.error)throw b.error;
      if(token!==this.token||!this.active)return;
      this.players=a.data||[];
      this.incoming=(b.data||[]).filter(v=>v.recipient_id===id&&v.status==='pending');
      this.outgoing=(b.data||[]).filter(v=>v.sender_id===id&&v.status==='pending');
      for(const v of b.data||[]){
        if(v.sender_id===id&&v.status==='accepted'&&!this.seen.has(v.id)){
          this.seen.add(v.id);this.onAccepted?.(v);
        }
      }
      this.message='';this.onUpdate(this);
    }catch(error){if(token===this.token){this.message='Actualisation impossible : '+error.message;this.onUpdate(this);}}
    finally{this.refreshing=false;}
  }
  async invite(recipientId,roomCode){
    if(!this.ready)throw new Error('Connecte-toi pour inviter un joueur.');
    if(!/^[\w-]{6,128}$/.test(roomCode))throw new Error('Salon de partie incorrect.');
    const {data,error}=await playerAuth.database().rpc('online_send_invite',{
      p_recipient:recipientId,p_room_code:roomCode
    });
    if(error)throw error;
    await this.refresh();
    return data;
  }
  async cancelPending(){
    if(!this.ready)return;
    const {error}=await playerAuth.database().rpc('online_cancel_invites');
    if(error)throw error;
  }
  async respond(invitationId,accept){
    if(!this.ready)throw new Error('Connecte-toi pour répondre.');
    const {data,error}=await playerAuth.database().rpc('online_reply_invite',{
      p_invite_id:invitationId,p_accept:Boolean(accept)
    });
    if(error)throw error;
    await this.refresh();
    return data;
  }
}
