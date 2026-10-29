import {ROSTER} from './roster.js';
export const ARCADE_ORDER=Object.freeze(ROSTER.map(p=>p.id));
export function nextArcadeLevel(index,playerWon){
  if(!playerWon)return {type:'retry',index};
  if(index<0||index>=ARCADE_ORDER.length)throw RangeError('Invalid arcade level');
  return index===ARCADE_ORDER.length-1
    ?{type:'complete',index}
    :{type:'next',index:index+1,id:ARCADE_ORDER[index+1]};
}
export const stageIdFor=(mode,opponentId)=>mode==='training'?'training':opponentId;