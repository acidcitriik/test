/**
 * SYNTHPUCK — Mamouda illustrated arena (fixed illustrated camera).
 *
 * The static illustration is the complete visual table. The actual Match XZ
 * simulation remains authoritative and unmodified; no 3D table mesh is drawn.
 * Puck/paddle visuals are projected by a calibrated 3-row perspective warp into the drawing.
 * The lit neon is a registered transparent image laid over the OFF image.
 */
export function createMamoudaIllustratedStage({canvas, match}) {
  const originalOpacity=canvas.style.opacity;
  const naturalW=1672, naturalH=941;
  const base=new Image();
  const neon=new Image();
  base.src=new URL('../assets/mamouda/scene-off.webp',import.meta.url).href;
  neon.src=new URL('../assets/mamouda/neon-on.webp',import.meta.url).href;
  // All moving props are extracted from the *approved* original artwork.
  const spriteAtlas=new Image();
  spriteAtlas.src=new URL('../assets/mamouda/sprites.webp',import.meta.url).href;
  const atlasRects={
    player:[6,8,232,137],
    ai:[258,8,232,137],
    puck:[10,164,90,60]
  };
  base.alt='Bar de Mamouda, arène SYNTHPUCK';
  neon.alt='';
  const spriteCanvas=document.createElement('canvas');
  spriteCanvas.setAttribute('aria-hidden','true');
  const spriteCtx=spriteCanvas.getContext('2d');
  const stageNodes=[base,neon,spriteCanvas];
  for(let n=0;n<stageNodes.length;n++){
    const node=stageNodes[n];
    node.dataset.mamoudaIllustrated='true';
    Object.assign(node.style,{
      position:'fixed',inset:'0',width:'100%',height:'100%',
      pointerEvents:'none',zIndex:String(n),display:'block',
    });
    if(n<2){
      node.style.objectFit='cover';
      node.draggable=false;
    }
    document.body.append(node);
  }
  spriteCanvas.style.zIndex='2';
  base.style.zIndex='0'; neon.style.zIndex='1';
  canvas.style.opacity='0';
  document.body.classList.add('illustrated-arena');

  // Illustration calibration: edge points at far/centre/near (source pixels).
  // The drawing is artistically stylised, NOT an exact pinhole projection:
  // a planar homography would put the centre line around y=489 instead of
  // the painted centre line at y=543. A smooth quadratic matches all 3 rows.
  // Only the *rendered* coordinates warp; the Match world and collisions do not.
  const corners=[
    {x:648,y:400},{x:1012,y:400},
    {x:1470,y:797},{x:202,y:797}
  ];
  function worldToImage(x,z){
    // Camera-right is world -X in the existing Three.js controls.
    // Mirror only the VISUAL projection, never the authoritative physics.
    const u=.5-x/match.cfg.width;
    const v=.5-z/match.cfg.length;
    const y=400+175*v+222*v*v;
    const left=648-286*v-160*v*v;
    const right=1012+294*v+164*v*v;
    return {x:left+(right-left)*u,y};
  }
  const layout={scale:1,offsetX:0,offsetY:0,dpr:1,w:0,h:0};
  function resize(){
    const w=window.innerWidth,h=window.innerHeight;
    // Identical CSS object-fit:cover transform for image AND all moving props.
    const scale=Math.max(w/naturalW,h/naturalH);
    layout.scale=scale;
    layout.offsetX=(w-naturalW*scale)/2;
    layout.offsetY=(h-naturalH*scale)/2;
    layout.w=w;layout.h=h;
    layout.dpr=Math.min(window.devicePixelRatio||1,2);
    spriteCanvas.width=Math.round(w*layout.dpr);
    spriteCanvas.height=Math.round(h*layout.dpr);
    spriteCtx.setTransform(layout.dpr,0,0,layout.dpr,0,0);
  }
  resize();
  const imageToScreen=p=>({
    x:layout.offsetX+layout.scale*p.x,
    y:layout.offsetY+layout.scale*p.y
  });
  const project=(x,z)=>imageToScreen(worldToImage(x,z));
  const radiusPixels=(x,z,r)=>{
    const l=project(x-r,z),rr=project(x+r,z);
    const far=project(x,z+r),near=project(x,z-r);
    return {rx:Math.max(2,Math.abs(rr.x-l.x)/2),ry:Math.max(2,Math.abs(near.y-far.y)/2)};
  };

  function drawDisc(piece,color){
    const {x,z,r,owner}=piece;
    const pt=project(x,z),{rx,ry}=radiusPixels(x,z,r);
    if(spriteAtlas.complete && spriteAtlas.naturalWidth>0){
      const rect=atlasRects[owner], [sx,sy,sw,sh]=rect;
      // The sprite was cut from the identical DA, including its own rim lights.
      // Scale with image-space distance: no physics or collision dependency.
      const width=Math.max(10,2.15*rx);
      const height=width*(sh/sw);
      const ctx=spriteCtx;
      ctx.save();
      ctx.shadowColor='rgba(0,0,0,.65)';
      ctx.shadowBlur=Math.min(14,width*.08);
      ctx.drawImage(spriteAtlas,sx,sy,sw,sh,
        pt.x-width/2,pt.y-height*.83,width,height);
      ctx.restore();
      return;
    }
    const height=Math.max(4,ry*.78),y=pt.y-height*.20;
    const ctx=spriteCtx;
    // Contact shadow: follows illustrated surface, not a physical 3D mesh.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pt.x+1,pt.y+4,rx*1.09,Math.max(3,ry*.80),0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,.65)';
    ctx.fill();

    // Sidewall and low-poly/cel-shaded top mimic the existing illustration.
    const rim=owner==='player'?'#09b9f1':owner==='ai'?'#ee2d57':'#d3dbe4';
    const dark=owner==='player'?'#031b37':owner==='ai'?'#3b0d22':'#162035';
    const bright=owner==='player'?'#9cefff':owner==='ai'?'#ffd5cf':'#ffffff';
    ctx.beginPath();
    ctx.ellipse(pt.x,y+height*.46,rx,Math.max(3,ry*.78),0,0,Math.PI*2);
    ctx.fillStyle=dark;ctx.fill();
    ctx.lineWidth=Math.max(2,rx*.14);
    ctx.strokeStyle=rim;ctx.shadowColor=rim;
    ctx.shadowBlur=Math.min(20,rx*.22);ctx.stroke();ctx.shadowBlur=0;
    ctx.beginPath();
    ctx.ellipse(pt.x,y-height*.10,rx*.78,Math.max(2,ry*.63),0,0,Math.PI*2);
    const grd=ctx.createLinearGradient(pt.x-rx,y-ry,pt.x+rx,y+ry);
    grd.addColorStop(0,bright);grd.addColorStop(.25,color);grd.addColorStop(1,dark);
    ctx.fillStyle=grd;ctx.fill();
    ctx.strokeStyle='#101425';ctx.lineWidth=Math.max(1.5,rx*.08);ctx.stroke();
    if(owner!=='puck'){
      ctx.beginPath();
      ctx.ellipse(pt.x,y-height*.09,rx*.33,Math.max(2,ry*.28),0,0,Math.PI*2);
      ctx.fillStyle=dark;ctx.fill();
      ctx.strokeStyle=bright;ctx.lineWidth=Math.max(1.5,rx*.05);ctx.stroke();
    }
    ctx.restore();
  }
  function update(timeSeconds,active){
    const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Intermittent but gentle flicker: no sustained rapid flashing.
    const phase=timeSeconds%13;
    const opacity=reducedMotion?1:
      phase<.18?0:phase<.30?1:phase<.52?0:
      phase>8.70&&phase<8.90?.15:1;
    neon.style.opacity=String(opacity);

    const ctx=spriteCtx;
    ctx.clearRect(0,0,layout.w,layout.h);
    const objects=[
      {x:match.ai.x,z:match.ai.z,r:match.cfg.paddleRadius,owner:'ai',color:'#b42b44'},
      {x:match.puck.x,z:match.puck.z,r:match.cfg.puckRadius,owner:'puck',color:'#c5d2e1'},
      {x:active?match.target.x:match.player.x,
        z:active?match.target.z:match.player.z,
        r:match.cfg.paddleRadius,owner:'player',color:'#1669bb'}
    ];
    // Painter's algorithm: farthest screen objects first.
    objects.sort((lhs,rhs)=>rhs.z-lhs.z).forEach(p=>drawDisc(p,p.color));
    if(new URLSearchParams(window.location.search).get('calibrate')==='1'){
      const quad=[corners[0],corners[1],corners[2],corners[3]];
      ctx.beginPath();
      quad.forEach((p,i)=>{
        const v=imageToScreen(p);
        if(i===0)ctx.moveTo(v.x,v.y);else ctx.lineTo(v.x,v.y);
      });
      ctx.closePath();ctx.strokeStyle='#00ffff';ctx.lineWidth=2;ctx.stroke();
    }
  }
  return {
    resize, update,
    get ready(){return base.complete&&base.naturalWidth>0&&neon.complete&&neon.naturalWidth>0&&spriteAtlas.complete&&spriteAtlas.naturalWidth>0;},
    backgroundLayers:2,
    project,
    displayRadius:(x,z,r)=>radiusPixels(x,z,r),
    destroy(){
      canvas.style.opacity=originalOpacity;
      document.body.classList.remove('illustrated-arena');
      stageNodes.forEach(n=>n.remove());
    }
  };
}