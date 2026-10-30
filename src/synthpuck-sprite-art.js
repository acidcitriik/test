// Approved independent Synthpuck sprites, extracted from the second transparent
// painted reference sheet at native high resolution, without edge clipping.
// The inkWidth values reflect each sprite's actual non-transparent illustration.
// These data are used only for 2.5D projection; physics/table calibration is unchanged.
export const SPRITE_URLS=Object.freeze({
 player:'./assets/sprites/paddle-player.webp',
 puck:'./assets/sprites/puck.webp',
 ai:'./assets/sprites/paddle-ai.webp'
});
export const SPRITE_ART=Object.freeze({
 player:Object.freeze({inkWidth:622,anchor:.83}),
 puck:Object.freeze({inkWidth:497,anchor:.66}),
 ai:Object.freeze({inkWidth:620,anchor:.83})
});
