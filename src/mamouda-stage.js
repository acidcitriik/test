/**
 * Mamouda bar stage — a 2.5D visual-only environment.
 * No collision bodies, game rules or input handling live in this module.
 * Three layers: painted distant bar, translucent midground, and 3D props/neon.
 */
export function createMamoudaStage(THREE, scene) {
  const group = new THREE.Group();
  group.name = 'mamouda-stage-25d';
  scene.add(group);

  const loader = new THREE.TextureLoader();
  const makeLayer = (name, path, width, height, y, z, opacity = 1) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    plane.name = name;
    plane.position.set(0, y, z);
    plane.renderOrder = z > 12 ? -2 : -1;
    group.add(plane);
    loader.load(new URL(path, import.meta.url).href,
      texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        material.map = texture;
        material.needsUpdate = true;
      }, undefined, error => console.warn('Mamouda layer unavailable', name, error)
    );
    return plane;
  };

  // The planes are all BEHIND the far goal (z = +5). Natural 3D perspective
  // produces parallax relative to the table when the camera angle changes.
  const far = makeLayer('neon-bar-back-wall', '../assets/mamouda/back-wall.svg',
    33, 18.56, 7.0, 18.5);
  const mid = makeLayer('neon-bar-midground', '../assets/mamouda/mid-room.svg',
    21.5, 12.09, 4.4, 10.6, 0.96);

  const metal = new THREE.MeshStandardMaterial({
    color: 0x151326, metalness: 0.68, roughness: 0.43
  });
  const wornMetal = new THREE.MeshStandardMaterial({
    color: 0x342232, metalness: 0.45, roughness: 0.52
  });
  const redNeon = new THREE.MeshBasicMaterial({color: 0xff315d, toneMapped: false});
  const blueNeon = new THREE.MeshBasicMaterial({color: 0x53b9de, toneMapped: false});

  function cuboid(name, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    group.add(mesh);
    return mesh;
  }

  // Physical set dressing stays OUTSIDE the playing field (table width 5.8)
  // and the visible puck path. Only cosmetic objects are added.
  for (const side of [-1, 1]) {
    const x = side * 5.6;
    cuboid('bar-side-panel', 1.05, 3.8, 9.8, x, 0.9, 1.9, metal);
    cuboid('bar-side-neon', .06, .055, 9.7,
      x - side * .57, 2.79, 1.9, side === -1 ? blueNeon : redNeon);
    for (const z of [-2.8, .2, 3.3]) {
      cuboid('bar-post', .16, 4.4, .22, side * 6.1, 1.2, z, wornMetal);
      cuboid('post-highlight', .04, 3.4, .04,
        side * 5.99, 1.1, z, redNeon);
    }
  }

  // A restrained red glow bounces on the set, NOT on the game physics.
  const magentaLight = new THREE.PointLight(0xff1f54, 21, 17, 2);
  magentaLight.position.set(5.4, 4.2, 5.9);
  group.add(magentaLight);
  const blueLight = new THREE.PointLight(0x0a65a3, 8, 17, 2);
  blueLight.position.set(-5.4, 4.5, 6.6);
  group.add(blueLight);

  // Only a subtle background light animation; never animate table geometry.
  function update(timeSeconds) {
    magentaLight.intensity = 20.5 + Math.sin(timeSeconds * 1.23) * 1.2;
    blueLight.intensity = 8 + Math.sin(timeSeconds * .71) * .55;
    far.position.x = Math.sin(timeSeconds * .15) * .016;
    mid.position.x = Math.sin(timeSeconds * .15 + .7) * .026;
  }
  return {group, update, ready: () => Boolean(far.material.map && mid.material.map)};
}