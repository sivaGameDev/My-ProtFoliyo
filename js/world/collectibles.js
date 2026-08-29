// Collectible orbs — white-based spheres that cycle through the rainbow,
// scattered at reachable height around the station. Walking up and
// interacting "collects" one (a quick pop-and-shrink, then it's gone for
// good); collecting every orb triggers a small bonus celebration.

import * as THREE from "three";

const ORB_RADIUS = 0.22;
const INTERACT_RADIUS = 1.6;

const ORB_POSITIONS = [
  { x: -5, z: -3 },
  { x: 6, z: -6 },
  { x: -8, z: 1 },
  { x: 2, z: 3 },
  { x: -3, z: 7 },
  { x: 11, z: 3 },
  { x: -11, z: -4 },
  { x: 11, z: -8 },
];

const ORB_HEIGHT = 1.3;

export function buildCollectibles(group) {
  const orbs = ORB_POSITIONS.map((pos) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff0000,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(ORB_RADIUS, 20, 16), mat);
    mesh.position.set(pos.x, ORB_HEIGHT, pos.z);
    mesh.castShadow = true;
    group.add(mesh);

    const glow = new THREE.PointLight(0xffffff, 0.7, 3.2, 2);
    glow.position.copy(mesh.position);
    group.add(glow);

    return {
      mesh,
      glow,
      mat,
      position: new THREE.Vector3(pos.x, ORB_HEIGHT, pos.z),
      radius: INTERACT_RADIUS,
      collected: false,
      hueSeed: Math.random(),
      bobSeed: Math.random() * Math.PI * 2,
      collectT: 0,
    };
  });

  let collectedCount = 0;

  function update(time, dt, nearestOrb) {
    orbs.forEach((orb) => {
      if (orb.collected) {
        if (orb.collectT < 1) {
          orb.collectT = Math.min(1, orb.collectT + dt * 2.4);
          const pop = orb.collectT < 0.3 ? 1 + orb.collectT * 1.5 : 1.45 * (1 - (orb.collectT - 0.3) / 0.7);
          orb.mesh.scale.setScalar(Math.max(0, pop));
          orb.glow.intensity = 0.7 * (1 - orb.collectT);
          if (orb.collectT >= 1) {
            orb.mesh.visible = false;
            orb.glow.visible = false;
          }
        }
        return;
      }

      const hue = (time * 0.15 + orb.hueSeed) % 1;
      orb.mat.emissive.setHSL(hue, 1, 0.55);
      orb.glow.color.setHSL(hue, 1, 0.6);

      const bob = Math.sin(time * 1.6 + orb.bobSeed) * 0.08;
      orb.mesh.position.y = orb.position.y + bob;
      orb.glow.position.y = orb.mesh.position.y;
      orb.mesh.rotation.y += dt * 0.6;

      const targetScale = orb === nearestOrb ? 1.3 : 1;
      const lerp = 1 - Math.pow(0.001, dt);
      const nextScale = orb.mesh.scale.x + (targetScale - orb.mesh.scale.x) * lerp;
      orb.mesh.scale.setScalar(nextScale);
    });
  }

  function collect(orb) {
    if (orb.collected) return false;
    orb.collected = true;
    collectedCount += 1;
    return true;
  }

  return {
    orbs,
    update,
    collect,
    get collectedCount() {
      return collectedCount;
    },
    total: orbs.length,
  };
}
