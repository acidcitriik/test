// Deploy via Cloudflare Workers. TURN secrets stay ONLY in Worker environment:
// TURN_KEY_ID, TURN_API_TOKEN, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY.
// A valid Supabase Auth bearer token is required; NEVER ship TURN API keys to clients.
const SITE_ORIGIN='https://acidcitriik.github.io';
const LOCAL_ORIGIN=/^http:\/\/(localhost|127\.0\.0\.1):(?:3000|8000)$/;
function cors(origin,env){
  const allow=origin===SITE_ORIGIN||(env.ALLOW_LOCAL_DEV==='true'&&LOCAL_ORIGIN.test(origin||''));
  return {allow,headers:{
    'Access-Control-Allow-Origin':allow?origin:SITE_ORIGIN,
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Authorization, Content-Type',
    'Vary':'Origin','Cache-Control':'no-store'
  }};
}
export default {
  async fetch(request,env){
    const {allow,headers}=cors(request.headers.get('Origin'),env);
    const reply=(body,status=200)=>Response.json(body,{status,headers});
    if(!allow)return reply({error:'Origin refused'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply({error:'POST required'},405);
    if(!env.TURN_KEY_ID||!env.TURN_API_TOKEN||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)
      return reply({error:'Worker not configured'},503);
    const bearer=request.headers.get('Authorization')||'';
    if(!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer))return reply({error:'Login required'},401);
    let url;
    try{
      url=new URL(env.SUPABASE_URL);
      if(url.protocol!=='https:')throw new Error('HTTPS required');
    }catch{return reply({error:'Invalid Supabase URL'},503);}
    try{
      // Supabase validates the JWT signature, expiration and the actual user session.
      // Browser-supplied IDs/claims are not trusted. No service_role key is needed.
      const check=await fetch(url.origin+'/auth/v1/user',{
        method:'GET',
        headers:{Authorization:bearer,apikey:env.SUPABASE_PUBLISHABLE_KEY},
        signal:AbortSignal.timeout(7000)
      });
      if(!check.ok)return reply({error:'Login expired or invalid'},401);
      const user=await check.json();
      if(!user?.id)return reply({error:'Invalid user'},401);
      const response=await fetch(
        'https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(env.TURN_KEY_ID)+'/credentials/generate-ice-servers',{
          method:'POST',
          headers:{Authorization:'Bearer '+env.TURN_API_TOKEN,'Content-Type':'application/json'},
          body:JSON.stringify({ttl:3600}),
          signal:AbortSignal.timeout(10000)
        });
      if(!response.ok)return reply({error:'TURN unavailable'},502);
      const data=await response.json();
      if(!Array.isArray(data.iceServers))return reply({error:'TURN response invalid'},502);
      for(const server of data.iceServers){
        if(server.username&&server.credential){
          const urls=[server.urls].flat();
          server.urls=[...new Set([...urls,'turns:turn.cloudflare.com:443?transport=tcp'])];
        }
      }
      // This response contains temporary TURN username/password, not long-term secrets.
      return reply({iceServers:data.iceServers,ttl:3600});
    }catch{
      return reply({error:'Connection service temporarily unavailable'},502);
    }
  }
};
