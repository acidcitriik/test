/** Painted Mamouda test scene.
 * Full-bleed illustration fixed to the perspective camera, with decorative
 * Three.js emissive stage pieces. Only presentation is modified.
 */
export function createMamoudaPaintedStage(THREE, scene, camera) {
  const group = new THREE.Group();
  group.name = 'mamouda-painted-stage';
  scene.add(group);
  const textureLoader = new THREE.TextureLoader();
  const paintingMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: false, depthWrite: false,
    depthTest: false, fog: false, toneMapped: false,
    side: THREE.DoubleSide
  });
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1), paintingMaterial);
  backdrop.name = 'mamouda-illustration';
  backdrop.renderOrder = -100;
  camera.add(backdrop);
  scene.add(camera);
  backdrop.position.set(0, 0, -48);
  textureLoader.load(new URL('../assets/mamouda/painted-bar.webp', import.meta.url).href,
    texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      paintingMaterial.map = texture;
      paintingMaterial.needsUpdate = true;
    }, undefined, error => console.error('Painted Mamouda artwork failed', error));

  function resize() {
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 48;
    // Overscan reduces edge peeking when switching between portrait/landscape.
    backdrop.scale.set(height * camera.aspect * 1.015, height * 1.015, 1);
  }
  resize();

  // Separate decorative 3D layer; nothing touches the physical play surface.
  const casing = new THREE.MeshStandardMaterial({
    color: 0x281525, roughness: .48, metalness: .45
  });
  const neon = new THREE.MeshBasicMaterial({
    color: 0xff365c, toneMapped: false
  });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.08, 2.7, .08), casing);
    post.position.set(side * 6.65, 1.3, 7.4);
    post.name = 'far-3d-rig';
    group.add(post);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.04, 2.55, .04), neon);
    strip.position.set(side * 6.6, 1.3, 7.35);
    group.add(strip);
  }
  const red = new THREE.PointLight(0xf62255, 8.5, 15, 2);
  red.position.set(4.3, 4, 4.4);
  group.add(red);
  const blue = new THREE.PointLight(0x2f8ed0, 4, 14, 2);
  blue.position.set(-4.3, 3.8, 4.9);
  group.add(blue);

  function update(seconds) {
    red.intensity = 8.5 + .45 * Math.sin(seconds * .83);
    blue.intensity = 4 + .2 * Math.sin(seconds * 1.17);
  }
  return {
    group, resize, update,
    backgroundLayers: 1,
    ready: () => Boolean(paintingMaterial.map)
  };
}
