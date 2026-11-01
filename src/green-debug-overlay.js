// Purely visual colour palette for the green physics diagnostics.
// Opacity is deliberately below 1 so the painted scene remains visible.
// Never use this module to change collision geometry, gameplay or sprite art.
export const GREEN_DEBUG_OVERLAY=Object.freeze({
  playerFill:'rgba(57,255,106,0.16)',
  aiFill:'rgba(57,255,106,0.16)',
  puckFill:'rgba(57,255,106,0.22)',
  colliderOutline:'rgba(57,255,106,0.42)',
  colliderIndicator:'rgba(57,255,106,0.42)',
  tableRails:'rgba(57,255,106,0.24)'
});
