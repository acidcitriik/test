// Approved independent Synthpuck sprites, extracted from the second transparent
// painted reference sheet at native high resolution, without edge clipping.
// The inkWidth values reflect each sprite's actual non-transparent illustration.
// These data are used only for 2.5D projection; physics/table calibration is unchanged.
// 'anchor' locates the painted disk/contact ellipse centre in the SOURCE image,
// not the bottom of the transparent canvas. The former anchors (0.83/0.66)
// put the visible paddles and puck noticeably behind their green physical rings.
export const SPRITE_URLS=Object.freeze({
 player:'./assets/sprites/paddle-player.webp',
 puck:'./assets/sprites/puck.webp',
 ai:'./assets/sprites/paddle-ai.webp'
});
export const SPRITE_ART=Object.freeze({
 player:Object.freeze({inkWidth:622,anchor:.64,inkBottom:.945}),
 puck:Object.freeze({inkWidth:497,anchor:.44,inkBottom:.93}),
 ai:Object.freeze({inkWidth:620,anchor:.64,inkBottom:.945})
});
