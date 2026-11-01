// Screen-space calibration of the ORIGINAL 1672×941 painted table.
// No artwork, collision coordinate or gameplay constant is modified here.
// All Synthpuck stage illustrations share the same table silhouette.
export const TABLE_CALIBRATION = Object.freeze({
  far: Object.freeze({y:405,left:640,right:1032}),
  center: Object.freeze({y:554,left:475,right:1201}),
  near: Object.freeze({y:816,left:200,right:1475})
});

// Compute the unique 3x3 projective mapping (h33=1) from four point pairs.
// Partial-pivot Gaussian elimination prevents using hand-tuned polynomial rails.
export function solveHomography(source, destination) {
  if (source.length !== 4 || destination.length !== 4)
    throw new Error('Homography requires four source and destination corners');
  const a = [];
  for (let i=0;i<4;i++) {
    const [x,z]=source[i], [u,v]=destination[i];
    a.push([x,z,1,0,0,0,-u*x,-u*z,u]);
    a.push([0,0,0,x,z,1,-v*x,-v*z,v]);
  }
  for (let col=0;col<8;col++) {
    let pivot=col;
    for (let row=col+1;row<8;row++)
      if (Math.abs(a[row][col])>Math.abs(a[pivot][col])) pivot=row;
    if (Math.abs(a[pivot][col])<1e-10) throw new Error('Degenerate table homography');
    [a[col],a[pivot]]=[a[pivot],a[col]];
    const value=a[col][col];
    for (let j=col;j<=8;j++) a[col][j]/=value;
    for (let row=0;row<8;row++) {
      if (row===col) continue;
      const factor=a[row][col];
      for (let j=col;j<=8;j++) a[row][j]-=factor*a[col][j];
    }
  }
  return [...a.map(row=>row[8]),1];
}

const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

export function createTableProjection(width, length, calibration=TABLE_CALIBRATION) {
  if (!(width>0 && length>0)) throw new Error('Invalid table dimensions');
  const halfW=width/2, halfL=length/2, {far,center,near}=calibration;
  // Engine positive X appears to the LEFT of the camera.
  const source=[[-halfW,-halfL],[halfW,-halfL],[halfW,halfL],[-halfW,halfL]];
  const destination=[
    [near.right,near.y],[near.left,near.y],
    [far.left,far.y],[far.right,far.y]
  ];
  const matrix=solveHomography(source,destination);
  const raw=(x,z)=>{
    const den=matrix[6]*x+matrix[7]*z+matrix[8];
    if (Math.abs(den)<1e-9) throw new Error('Invalid projective denominator');
    return {
      x:(matrix[0]*x+matrix[1]*z+matrix[2])/den,
      y:(matrix[3]*x+matrix[4]*z+matrix[5])/den
    };
  };

  // The painted artwork is not a perfect pinhole-camera photograph:
  // a four-corner-only homography would shift the existing centre circle
  // by ~50 px. Reparameterise the longitudinal (physical) Z smoothly to
  // keep the painted middle line without altering either end or the physics.
  const h=matrix, centreZ=(center.y-h[5])/(h[4]-center.y*h[7]);
  if (!Number.isFinite(centreZ) || Math.abs(centreZ)>=halfL/2)
    throw new Error('Unstable centre perspective calibration');
  const centreLeft=raw(halfW,centreZ).x;
  const centreRight=raw(-halfW,centreZ).x;
  const correctionLeft=center.left-centreLeft;
  const correctionRight=center.right-centreRight;

  function project(x,z) {
    const xc=clamp(x,-halfW,halfW), zc=clamp(z,-halfL,halfL);
    const progress=zc/halfL;
    const rearFrontFade=1-progress*progress;
    const warpedZ=zc+centreZ*rearFrontFade;
    const point=raw(xc,warpedZ);
    // The extra <= 9 px centre-width correction is zero at both end rails.
    // It compensates for a minor non-projective detail of the painted art.
    const u=clamp(.5-xc/width,0,1);
    const xCorrection=(correctionLeft*(1-u)+correctionRight*u)*rearFrontFade*rearFrontFade;
    return {x:point.x+xCorrection,y:point.y};
  }
  return Object.freeze({
    matrix:Object.freeze(matrix),centreVirtualZ:centreZ,project,projectRaw:raw
  });
}
