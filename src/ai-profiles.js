import {chooseAITarget} from './ai.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// The saved 2501 tactical agent is the basis of every opponent.
// Optional target modifiers are deterministic and affect *commands*, never the puck
// or the actual physical collision. No style => original 2501 exactly.
export function chooseCharacterAITarget(puck,ai,player,cfg,brain,now){
  const target=chooseAITarget(puck,ai,player,cfg,brain,now);
  const style=cfg.aiStyle;
  if(!style)return target;
  const xMax=cfg.width/2-cfg.paddleRadius-.08;
  const zMin=cfg.paddleRadius+.08,zMax=cfg.length/2-zMin;
  let x=target.x,z=target.z;
  if(style==='guard'){
    // Mute is careful and holds her goal rather than pursuing remote pucks.
    if(puck.z<1.3){x*=.75;z=Math.max(z,3.25);}
  }else if(style==='bruiser'){
    if(puck.z>1.3){z=Math.max(z,puck.z+.09);}
  }else if(style==='banker'){
    if(puck.z>1.0 && Math.hypot(puck.vx,puck.vz)<1.8){x+=puck.x>=0?-.24:.24;}
  }else if(style==='rush'){
    if(puck.z>0.5){z-=.24;}
  }else if(style==='showboat'){
    if(puck.z>0.8 && Math.abs(puck.vz)<2.5){x+=Math.sin(now*2.3)*.17;}
  }else if(style==='erratic'){
    if(puck.z>1.0){x+=Math.sin(now*3.2)*.12;}
  }else if(style==='adaptive'){
    // Adjust to the human paddle position for deliberate angled returns.
    if(puck.z>0.8 && puck.vz<1.0){x+=player.x>=0?-.09:.09;}
  }
  return {x:clamp(x,-xMax,xMax),z:clamp(z,zMin,zMax)};
}