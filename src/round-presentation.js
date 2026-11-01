// Presentations are visual only: the fixed-step physics remains paused while shown.
export const SPLASH_FILES=Object.freeze({
 ready:'./assets/ui/splash-ready.svg',
 go:'./assets/ui/splash-go.svg',
 goal:'./assets/ui/splash-goal.svg',
 smash:'./assets/ui/splash-smash.svg',
 win:'./assets/ui/splash-win.svg',
 lose:'./assets/ui/splash-lose.svg'
});
export const GO_DURATION_MS=700;
export const GOAL_DURATION_MS=1250;
export const RESULT_DURATION_MS=2100;
export function randomReadyDelayMs(random=Math.random){
 const v=Number(random());
 const fraction=Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
 return Math.min(4000,1000+Math.floor(fraction*3001));
}
export function chooseRoundSplash(goal,scores,scoreToWin=7){
 if(!goal||goal.type!=='goal')return null;
 if(Math.max(...scores)>=scoreToWin)return scores[0]>scores[1]?'win':'lose';
 return goal.smash?'smash':'goal';
}
