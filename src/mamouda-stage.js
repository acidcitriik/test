/**
 * Mamouda bar stage — a 2.5D visual-only environment.
 * No collision bodies, game rules or input handling live in this module.
 * Three layers: painted distant bar, translucent midground, and 3D props/neon.
 */
export function createMamoudaStage(THREE, scene, camera) {
  const group = new THREE.Group();
  group.name = 'mamouda-stage-25d';
  scene.add(group);

  const loader = new THREE.TextureLoader();
  const makeLayer = (name, path, width, height, y, z, opacity = 1) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false, fog: false
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
  // Keep the distant painted wall full-bleed on all viewport sizes.
  // The midground still lives in world space, giving true camera parallax.
  scene.add(camera);
  camera.add(far);
  far.position.set(0, 0, -50);
  far.renderOrder = -100;
  function resize() {
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 50;
    far.scale.set(height * camera.aspect * 1.08 / 33,
      height * 1.08 / 18.56, 1);
  }
  resize();
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

  // Thin rear trusses emphasize parallax without obstructing table sightlines.
  // The previous tall foreground bulkheads occluded too much of the bar.
  for (const side of [-1, 1]) {
    const x = side * 7.1;
    cuboid('rear-truss', .19, 3.7, .23, x, 1.45, 8.4, metal);
    cuboid('rear-neon-trim', .045, 3.3, .05,
      x - side * .13, 1.43, 8.27, side === -1 ? blueNeon : redNeon);
    cuboid('rear-rafter', 1.3, .14, .25, x - side * .5, 3.35, 8.4, wornMetal);
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
  return {group, update, resize, backgroundLayers:2,
    ready: () => Boolean(far.material.map && mid.material.map)};
}