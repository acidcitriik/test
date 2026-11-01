// Preserve the bundled PeerJS relay fallback; add an independent STUN provider.
// These are the public credentials shipped by PeerJS, not private API keys.
export function iceConfiguration(){
  return {iceServers:[
    {urls:'stun:stun.cloudflare.com:3478'},
    {urls:'stun:stun.l.google.com:19302'},
    {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],username:'peerjs',credential:'peerjsp'}
  ],iceCandidatePoolSize:0,iceTransportPolicy:'all'};
}

export async function cloudflareConfiguration(accessCode){
  const response=await fetch('https://synthpuck-turn.acidcitriik.workers.dev/',{method:'POST',headers:{'Content-Type':'application/json','X-Synthpuck-Access':accessCode},body:'{}',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(response.status===401?'Code privé du relais incorrect.':'Relais Cloudflare indisponible ('+response.status+').');
  const data=await response.json();if(!Array.isArray(data.iceServers)||!data.iceServers.some(s=>s.username&&s.credential))throw new Error('Accès TURN invalides.');
  return {iceServers:data.iceServers,iceTransportPolicy:'all',iceCandidatePoolSize:0};
}
