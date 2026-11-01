import {iceConfiguration} from './ice-config.js';
import {ConnectionDebug} from './connection-debug.js';
import './vendor/peerjs.min.js';
import {Match,clamp} from './physics.js?v=smash-speeds-20261101-7';

// Socket-shaped adapter: game simulation lives exclusively in the host browser.
export class BrowserHost {
  constructor(config=iceConfiguration()){this.debug=new ConnectionDebug();this.debug.log('Signalisation','Connexion PeerJS Cloud via HTTPS/WSS (port distant 443). Configuration ICE chargée ; détails des serveurs lors de la négociation.');this.readyState=0;this.bufferedAmount=0;this.closed=false;this.timer=null;
    this.peer=new globalThis.Peer(undefined,{debug:0,config});
    this.timeout=setTimeout(()=>this.fail('Connexion impossible. Réessaie ; certains réseaux nécessitent un relais TURN.'),25000);
    this.peer.on('open',()=>{if(this.closed)return;this.debug.log('Signalisation','Inscription réussie ; identifiant obtenu.');this.readyState=1;this.onopen?.();});
    this.peer.on('error',e=>{this.debug.log('Erreur PeerJS',{type:e.type,message:e.message});this.fail(e.type==='peer-unavailable'?'Partie introuvable. Vérifie le code.':'Connexion impossible. Vérifie Internet ou essaie un autre réseau.');});
    this.peer.on('disconnected',()=>{if(!this.conn?.open)this.fail('Service de connexion indisponible. Réessaie.');});
    this.peer.on('connection',c=>{if(!this.host||this.conn){c.on('open',()=>{c.send({type:'error',message:'Partie complète.'});setTimeout(()=>c.close(),500);});return;}this.attach(c);});
  }
  emit(d){if(!this.closed)this.onmessage?.({data:JSON.stringify(d)});}
  fail(message){if(this.closed)return;this.debug.log('Échec',message);this.debug.diagnosis();this.emit({type:'error',message});this.close();}
  attach(c){clearTimeout(this.timeout);this.timeout=setTimeout(()=>this.fail('Le canal WebRTC ne s’est pas ouvert après 25 secondes. Consulte le diagnostic.'),25000);this.debug.log('Connexion joueur','Canal demandé/reçu');this.debug.watch(c);this.conn=c;c.on('error',()=>this.fail('Connexion au joueur perdue.'));c.on('close',()=>{if(!this.closed)this.onclose?.();});
    c.on('data',d=>{if(this.closed||!d||typeof d!=='object')return;if(this.host){if(d.type==='input')this.input(d,1);}else if(['start','state','error'].includes(d.type))this.emit(d);});
    c.on('open',()=>{this.debug.log('Canal données','Ouvert — connexion réussie');clearTimeout(this.timeout);if(!this.host)return;
      this.match=new Match();this.match.remoteTarget={x:0,z:-3.8};this.match.serve();
      c.send({type:'start',slot:1});this.emit({type:'start',slot:0});
      let last=performance.now(),acc=0,broadcast=0,nextServe=0;
      this.timer=setInterval(()=>{const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;acc+=dt;broadcast+=dt;const m=this.match;
        while(acc>=m.cfg.tick){m.tick();acc-=m.cfg.tick;}
        if(m.state==='ready'){nextServe ||= now+1500;if(now>=nextServe){m.serve();m.remoteTarget={x:0,z:-3.8};nextServe=0;}}
        if(broadcast>=1/60){broadcast=0;const d={type:'state',player:m.player,ai:m.ai,puck:m.puck,scores:m.scores,state:m.state,server:m.server,awaitingServe:m.awaitingServe};this.emit(d);if(c.open&&c.dataChannel.bufferedAmount<65536)c.send(d);}
      },4);
    });
  }
  input(d,slot){const m=this.match;if(!m||!Number.isFinite(d.x)||!Number.isFinite(d.z))return;const t={x:clamp(d.x,-2.46,2.46),z:clamp(d.z,-4.56,-.22)};
    if(slot===0){m.target=t;m.setButton('left',!!d.left);m.setButton('right',!!d.right);}else{m.remoteTarget=t;m.remoteMode=d.left?(d.right?'grip':'rigid'):(d.right?'soft':'normal');}}
  send(raw){if(this.closed)return;const d=JSON.parse(raw);
    if(d.type==='create'){this.debug.log('Rôle','Hôte : attente d’un invité');this.host=true;clearTimeout(this.timeout);this.emit({type:'lobby',code:this.peer.id});}
    else if(d.type==='join'){this.debug.log('Rôle','Invité : demande de connexion à l’hôte');this.attach(this.peer.connect(d.code,{reliable:true,serialization:'json'}));}
    else if(d.type==='input'){if(this.host)this.input(d,0);else if(this.conn?.open&&this.conn.dataChannel.bufferedAmount<4096)this.conn.send(d);}
  }
  close(){if(this.closed)return;this.debug.log('Fermeture','Session terminée');this.debug.stop();this.closed=true;this.readyState=3;clearTimeout(this.timeout);clearInterval(this.timer);this.conn?.close();this.peer.destroy();}
}
