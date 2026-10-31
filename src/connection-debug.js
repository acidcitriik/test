export class ConnectionDebug {
  constructor(){this.lines=[];this.started=performance.now();this.seen=new Set();this.pc=null;this.stopped=false;
    this.log('Environnement',{secureContext:isSecureContext,online:navigator.onLine,webRTC:typeof RTCPeerConnection!=='undefined',visibility:document.visibilityState,userAgent:navigator.userAgent});
    this.log('Limites','Les ports ci-dessous sont des candidats WebRTC, pas un scan de la box. Un échec ICE ne prouve pas quel pare-feu bloque. Les adresses IP et SDP ne sont pas enregistrées.');
  }
  log(stage,data=''){const line=`+${((performance.now()-this.started)/1000).toFixed(2)}s ${stage} ${typeof data==='string'?data:JSON.stringify(data)}`;this.lines.push(line);if(this.lines.length>300)this.lines.shift();this.onchange?.(this.report());}
  report(){return ['SYNTHPUCK — diagnostic connexion',new Date().toISOString(),...this.lines].join('\n');}
  candidate(c,direction){if(!c)return;const key=[direction,c.type||c.candidateType,c.protocol,c.port,c.address||c.ip].join('/');if(this.seen.has(key))return;this.seen.add(key);this.log('Candidat '+direction,{type:c.type||c.candidateType,protocol:c.protocol,port:c.port,tcpType:c.tcpType,relayProtocol:c.relayProtocol});}
  watch(connection){this.poll=setInterval(()=>{const pc=connection.peerConnection;if(pc&&!this.pc){this.pc=pc;
      for(const event of ['connectionstatechange','iceconnectionstatechange','icegatheringstatechange','signalingstatechange'])pc.addEventListener(event,()=>{if(!this.stopped)this.states();});
      pc.addEventListener('icecandidate',e=>{if(!this.stopped){if(e.candidate)this.candidate(e.candidate,'local');else this.log('ICE','Collecte terminée');}});
      pc.addEventListener('icecandidateerror',e=>{if(!this.stopped)this.log('Erreur STUN/TURN',{code:e.errorCode,url:e.url?.replace(/\/\/.*@/,'//'),message:e.errorText});});this.states();
    }},100);
    this.stats=setInterval(()=>this.sample(),1000);
  }
  states(){const p=this.pc;this.log('WebRTC',{connection:p.connectionState,ice:p.iceConnectionState,gathering:p.iceGatheringState,signaling:p.signalingState});}
  async sample(){try{if(!this.pc||this.stopped||this.busy)return;this.busy=true;const stats=await this.pc.getStats();if(this.stopped)return;
    for(const s of stats.values()){
      if(s.type==='local-candidate'||s.type==='remote-candidate')this.candidate(s,s.type);
      if(s.type==='candidate-pair'&&(s.state==='succeeded'||s.state==='in-progress'||s.nominated)){
        const a=stats.get(s.localCandidateId),b=stats.get(s.remoteCandidateId);
        this.log('Paire ICE',{state:s.state,nominated:s.nominated,local:a?.candidateType,remote:b?.candidateType,protocol:a?.protocol,localPort:a?.port,remotePort:b?.port,rttMs:s.currentRoundTripTime===undefined?undefined:Math.round(s.currentRoundTripTime*1000),sent:s.bytesSent,received:s.bytesReceived});
      }
      if(s.type==='data-channel')this.log('Canal données',{state:s.state,sent:s.messagesSent,received:s.messagesReceived});
    }
  }catch(e){this.log('Statistiques indisponibles',e.name);}finally{this.busy=false;}}
  diagnosis(){const state=this.pc?.iceConnectionState;
    if(!this.pc)this.log('Bilan','Aucune connexion WebRTC créée : vérifier la signalisation, le code et la disponibilité de l’hôte.');
    else if(['connected','completed'].includes(state))this.log('Bilan','ICE connecté. Vérifier l’ouverture du canal de données et les événements applicatifs.');
    else this.log('Bilan','Aucun chemin WebRTC établi. Causes possibles : réseau filtré, NAT, échange de candidats incomplet ou hôte indisponible. Aucun relais TURN configuré ; un relais peut être nécessaire.');
  }
  stop(){this.stopped=true;clearInterval(this.poll);clearInterval(this.stats);}
}
