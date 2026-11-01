import assert from 'node:assert/strict';

// Live integration: requires deployed Worker and a temporary Supabase user JWT.
// Do not commit or print the token. Skipped for normal offline npm tests.
const token=process.env.SYNTHPUCK_SUPABASE_ACCESS_TOKEN;
if(!token){
  console.log('SKIP Cloudflare TURN integration: set SYNTHPUCK_SUPABASE_ACCESS_TOKEN after deploying the authenticated Worker.');
}else{
  const endpoint='https://synthpuck-turn.acidcitriik.workers.dev/';
  const headers={Origin:'https://acidcitriik.github.io','Content-Type':'application/json'};
  const denied=await fetch(endpoint,{
    method:'POST',headers:{...headers,Authorization:'Bearer invalid.jwt.token'},body:'{}'
  });
  assert.equal(denied.status,401,'invalid Supabase session must not receive TURN credentials');
  const response=await fetch(endpoint,{
    method:'POST',headers:{...headers,Authorization:'Bearer '+token},body:'{}'
  });
  assert.equal(response.status,200,'valid user token must obtain temporary TURN credentials');
  const result=await response.json();
  assert.ok(Array.isArray(result.iceServers));
  assert.ok(result.iceServers.some(s=>s.username&&s.credential),'temporary TURN credentials required');
  assert.ok(result.iceServers.some(s=>[s.urls].flat().includes('turns:turn.cloudflare.com:443?transport=tcp')),'TLS 443 fallback required');
  assert.equal(result.ttl,3600);
  console.log('PASS: verified Supabase session; invalid bearer rejected; Cloudflare TURN credentials over TLS.');
}
