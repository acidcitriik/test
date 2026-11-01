// Public STUN fallback for guest / pending Cloudflare deployment.
// TURN requires a signed-in Supabase user and a deployed Worker.
export function iceConfiguration(){
  return {iceServers:[
    {urls:'stun:stun.cloudflare.com:3478'},
    {urls:'stun:stun.l.google.com:19302'},
    {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],username:'peerjs',credential:'peerjsp'}
  ],iceCandidatePoolSize:0,iceTransportPolicy:'all'};
}
export async function cloudflareConfiguration(accessToken){
  if(!accessToken)throw new Error('Connecte-toi pour utiliser le relais TURN.');
  const response=await fetch('https://synthpuck-turn.acidcitriik.workers.dev/',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},
    body:'{}',
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error(response.status===401?'Session expirée ou relais non activé.':'Relais Cloudflare indisponible ('+response.status+').');
  const data=await response.json();
  if(!Array.isArray(data.iceServers)||!data.iceServers.some(s=>s.username&&s.credential))
    throw new Error('Identifiants TURN temporaires invalides.');
  return {iceServers:data.iceServers,iceTransportPolicy:'all',iceCandidatePoolSize:0};
}
