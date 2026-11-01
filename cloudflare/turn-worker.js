// Store TURN_KEY_ID, TURN_API_TOKEN and RELAY_ACCESS_CODE as Worker secrets.
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin');
    const allowed=origin==='https://acidcitriik.github.io';
    const headers={'Access-Control-Allow-Origin':allowed?origin:'https://acidcitriik.github.io','Vary':'Origin','Cache-Control':'no-store','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Synthpuck-Access'};
    const reply=(data,status=200)=>Response.json(data,{status,headers});
    if(!allowed)return reply({error:'Origin refused'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply({error:'POST required'},405);
    if(!env.TURN_KEY_ID||!env.TURN_API_TOKEN||!env.RELAY_ACCESS_CODE)return reply({error:'Relay not configured'},503);
    if(request.headers.get('X-Synthpuck-Access')!==env.RELAY_ACCESS_CODE)return reply({error:'Code privé du relais incorrect.'},401);
    try{
      const response=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,{
        method:'POST',headers:{Authorization:`Bearer ${env.TURN_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({ttl:7200}),signal:AbortSignal.timeout(10000)
      });
      if(!response.ok)return reply({error:'Cloudflare TURN credentials unavailable'},502);
      const data=await response.json();
      if(!Array.isArray(data.iceServers))return reply({error:'Invalid TURN response'},502);
      // Include the documented TLS/443 fallback, alongside the generated URLs.
      for(const server of data.iceServers)if(server.username&&server.credential){const urls=[server.urls].flat();server.urls=[...new Set([...urls,'turns:turn.cloudflare.com:443?transport=tcp'])];}
      return reply({iceServers:data.iceServers,ttl:7200});
    }catch{return reply({error:'TURN service temporarily unavailable'},502);}
  }
};
