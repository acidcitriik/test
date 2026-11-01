import {escapeHtml} from './player-profile.js';

export function lobbyMarkup(btn){
  return '<div class="page online-page">'+
    '<header class="page-head"><div><p class="eyebrow">SYNTHPUCK / RÉSEAU</p><h2>ONLINE · DUELS 1V1</h2></div>'+btn('← MENU','menu')+'</header>'+
    '<p id="lobbyStatus" class="sub" role="status" aria-live="polite">Choisis un adversaire ou partage un code de partie.</p>'+
    '<div class="online-layout">'+
      '<section class="online-panel"><h3>JOUEURS EN LIGNE</h3>'+
        '<p class="sub">Clique sur un joueur disponible pour l’inviter.</p><div id="onlinePlayers" class="online-list"></div></section>'+
      '<section class="online-panel"><h3>INVITATIONS REÇUES</h3><div id="onlineInvites" class="online-list"></div>'+
        '<h3>INVITATIONS ENVOYÉES</h3><div id="onlineOutgoing" class="online-list"></div></section>'+
    '</div>'+
    '<section class="online-code"><h3>PARTIE PRIVÉE PAR CODE</h3>'+
      '<p class="sub">Accessible aussi aux invités. Les connexions directes peuvent être limitées par certains réseaux.</p>'+
      '<div class="online-code-actions">'+btn('CRÉER UNE PARTIE','host',true)+
      '<label>CODE REÇU<input id="roomCode" type="text" maxlength="128" autocomplete="off" spellcheck="false" placeholder="Colle le code ici"></label>'+
      btn('REJOINDRE','join')+'</div></section></div>';
}
export function renderOnlineSections(directory,authenticated){
  const list=document.getElementById('onlinePlayers');
  const incoming=document.getElementById('onlineInvites');
  const outgoing=document.getElementById('onlineOutgoing');
  if(!list||!incoming||!outgoing)return;
  if(!authenticated){
    list.innerHTML='<p class="sub">Connecte-toi pour apparaître dans le salon et voir les joueurs connectés.</p>'+
      '<button type="button" class="online-cta" data-action="account">SE CONNECTER / CRÉER UN COMPTE</button>';
    incoming.innerHTML='<p class="sub">Aucune invitation.</p>';
    outgoing.innerHTML='<p class="sub">Aucune invitation.</p>';
    return;
  }
  list.innerHTML=directory.players.length?directory.players.map(player=>
    '<button type="button" class="online-player" data-online-invite="'+escapeHtml(player.user_id)+'" '+
    (player.status==='busy'?'disabled aria-disabled="true"':'')+'>'+
    '<span class="online-dot '+(player.status==='available'?'available':'busy')+'"></span>'+
    '<strong>'+escapeHtml(player.nickname)+'</strong><small>'+(
      player.status==='available'?'INVITER À JOUER':'EN PARTIE')+'</small></button>'
  ).join(''):'<p class="sub">Aucun autre joueur connecté pour le moment.</p>';
  incoming.innerHTML=directory.incoming.length?directory.incoming.map(invite=>
    '<div class="online-invite"><strong>'+escapeHtml(invite.sender_nickname)+'</strong>'+
    '<p class="sub">Te propose un duel 1v1.</p>'+
    '<div class="online-invite-actions">'+
    '<button type="button" data-online-respond="'+escapeHtml(invite.id)+'" data-online-accept="1">ACCEPTER</button>'+
    '<button type="button" data-online-respond="'+escapeHtml(invite.id)+'" data-online-accept="0">REFUSER</button>'+
    '</div></div>'
  ).join(''):'<p class="sub">Aucune invitation en attente.</p>';
  outgoing.innerHTML=directory.outgoing.length?directory.outgoing.map(invite=>
    '<p class="sub">Invitation envoyée · en attente d’acceptation…</p>'
  ).join(''):'<p class="sub">Aucune demande en attente.</p>';
  if(directory.message){
    const note=document.getElementById('onlineServiceMessage');
    if(note)note.textContent=directory.message;
    else{
      const item=document.createElement('p');item.id='onlineServiceMessage';item.className='sub';
      item.textContent=directory.message;list.prepend(item);
    }
  }
}
