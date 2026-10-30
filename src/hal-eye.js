// HAL's aperture coordinates are anchored in the SAME 1672x941 calibrated game art.
// A pure target function lets the gaze follow the real puck without touching physics.
export const HAL_STAGE_ID='2502'; // preserves the existing seventh Arcade slot
export const HAL_EYE_CALIBRATION=Object.freeze({x:836,y:165,apertureRadius:101,spriteSize:155,maxDX:35,maxDY:19});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function halEyeTarget(puck,cfg){
 const c=HAL_EYE_CALIBRATION;
 const x=clamp((puck?.x??0)/Math.max(.001,cfg.width/2),-1,1);
 const z=clamp((puck?.z??0)/Math.max(.001,cfg.length/2),-1,1);
 // Engine +X is screen-left, +Z is towards HAL, just like the common stage projection.
 return {x:c.x-c.maxDX*x,y:c.y-c.maxDY*z};
}
