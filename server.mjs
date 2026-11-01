import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {randomInt} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {WebSocketServer, WebSocket} from 'ws';
import {Match,clamp} from './src/physics.js';

const root=resolve('.'), rooms=new Map();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
    if(!path.startsWith(root+sep)||!['/src/','/assets/'].some(prefix=>path.slice(root.length).replaceAll('\\','/').startsWith(prefix))&&path!==resolve(root,'index.html')){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  }catch{res.writeHead(404).end();}
});
const wss=new WebSocketServer({server,maxPayload:2048});
const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<65536)ws.send(JSON.stringify(data));};
function leave(ws){const r=ws.room;if(!r)return;rooms.delete(r.code);for(const p of r.players){p.room=null;send(p,{type:'left'});}}
wss.on('connection',ws=>{
  ws.alive=true;ws.on('pong',()=>ws.alive=true);
  ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
  ws.on('message',raw=>{try{
    const d=JSON.parse(raw);
    if(d.type==='create'&&!ws.room){let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));const r={code,players:[ws],match:null,elapsed:0,broadcast:0};rooms.set(code,r);ws.room=r;ws.slot=0;send(ws,{type:'lobby',code});}
    else if(d.type==='join'&&!ws.room){const r=rooms.get(String(d.code));if(!r||r.players.length!==1){send(ws,{type:'error',message:'Partie introuvable ou complète.'});return;}r.players.push(ws);ws.room=r;ws.slot=1;r.match=new Match();r.match.remoteTarget={x:0,z:-3.8};r.match.serve();for(const p of r.players)send(p,{type:'start',slot:p.slot});}
    else if(d.type==='input'&&ws.room?.match){const m=ws.room.match;if(!Number.isFinite(d.x)||!Number.isFinite(d.z))return;const t={x:clamp(d.x,-2.46,2.46),z:clamp(d.z,-4.56,-.22)};if(ws.slot===0){m.target=t;m.setButton('left',!!d.left);m.setButton('right',!!d.right);}else{m.remoteTarget=t;m.remoteMode=d.left?(d.right?'grip':'rigid'):(d.right?'soft':'normal');}}
  }catch{send(ws,{type:'error',message:'Message invalide.'});}});
});
let last=performance.now();
setInterval(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.1);last=now;for(const r of rooms.values()){
  const m=r.match;if(!m)continue;r.elapsed+=dt;r.broadcast+=dt;
  while(r.elapsed>=m.cfg.tick){m.tick();r.elapsed-=m.cfg.tick;if(m.state==='ready'){r.nextServe??=now+1500;if(now>=r.nextServe){m.serve();m.remoteTarget={x:0,z:-3.8};r.nextServe=null;}}}
  if(r.broadcast>=1/60){r.broadcast=0;for(const p of r.players)send(p,{type:'state',player:m.player,ai:m.ai,puck:m.puck,scores:m.scores,state:m.state,server:m.server,awaitingServe:m.awaitingServe,time:m.time,serveStartedAt:m.serveStartedAt,possessionSide:m.possessionSide,possessionSince:m.possessionSince});}
}},4);
setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000).unref();
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Synthpuck : http://localhost:'+ (Number(process.env.PORT)||3000)));
