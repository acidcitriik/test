// Preserve the bundled PeerJS relay fallback; add an independent STUN provider.
// These are the public credentials shipped by PeerJS, not private API keys.
export function iceConfiguration(){
  return {iceServers:[
    {urls:'stun:stun.cloudflare.com:3478'},
    {urls:'stun:stun.l.google.com:19302'},
    {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],username:'peerjs',credential:'peerjsp'}
  ],iceCandidatePoolSize:0,iceTransportPolicy:'all'};
}
