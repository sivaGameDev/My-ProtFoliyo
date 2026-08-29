import * as THREE from "three";
import { createGlassMaterial, createMetalMaterial, createEmissiveTrimMaterial, createParticleField } from "./materials.js";
import { createTerminal } from "./terminals.js";
import { createWaypointMarker } from "./markers.js";
import { buildCollectibles } from "./collectibles.js";
import { MILESTONES } from "./content-data.js";

const PLATFORM_RADIUS = 16;

// Asymmetric terminal placement, scattered around the central hub rather
// than pinned to four identical cardinal points.
const TERMINAL_POSITIONS = [
  { x: 4, z: -10 }, // about — north, slightly east
  { x: 10, z: -2 }, // projects — east
  { x: -10, z: 6 }, // resume — west, south
  { x: 6, z: 10 }, // contact — south, slightly east
];

function buildPlatform(scene) {
  const deck = new THREE.Mesh(
    new THREE.CircleGeometry(PLATFORM_RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a2260, roughness: 0.5, metalness: 0.4 })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.receiveShadow = true;
  scene.add(deck);

  // A soft violet-to-magenta wash radiating from the hub, so the deck reads
  // as colorful even where no accent geometry sits directly on top of it.
  const wash = new THREE.Mesh(
    new THREE.CircleGeometry(PLATFORM_RADIUS * 0.6, 48),
    new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
  );
  wash.rotation.x = -Math.PI / 2;
  wash.position.y = 0.008;
  scene.add(wash);

  const ringColors = [0x5eead4, 0xa78bfa, 0xffb454];
  [4, 8, 12].forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.03, r + 0.03, 96),
      new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0.16, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);
  });

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(PLATFORM_RADIUS, 0.14, 8, 96),
    createEmissiveTrimMaterial({ color: 0x5eead4, intensity: 0.45 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.05;
  scene.add(rim);

  return deck;
}

function buildLandingPads(group) {
  MILESTONES.forEach((data, i) => {
    const pos = TERMINAL_POSITIONS[i];
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 40),
      new THREE.MeshBasicMaterial({ color: data.accentColor, transparent: true, opacity: 0.14, side: THREE.DoubleSide })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(pos.x, 0.015, pos.z);
    group.add(pad);

    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.25, 48),
      createEmissiveTrimMaterial({ color: data.accentColor, intensity: 0.7 })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(pos.x, 0.02, pos.z);
    group.add(padRing);
  });
}

function createStrip(from, to, { width = 0.6, color = 0x5eead4, y = 0.02 } = {}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);

  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.03, width),
    new THREE.MeshStandardMaterial({ color: 0x141b2c, roughness: 0.6, metalness: 0.4 })
  );
  group.add(base);

  const edgeMat = createEmissiveTrimMaterial({ color, intensity: 0.9 });
  [-1, 1].forEach((side) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.035, 0.05), edgeMat);
    edge.position.z = (side * width) / 2;
    group.add(edge);
  });

  group.position.set((from.x + to.x) / 2, y, (from.z + to.z) / 2);
  group.rotation.y = -angle;
  return group;
}

function buildWalkways(group) {
  const hub = { x: 0, z: 0 };
  TERMINAL_POSITIONS.forEach((pos, i) => {
    group.add(createStrip(hub, pos, { color: MILESTONES[i].accentColor }));
  });
}

// The plaza centerpiece — an emissive core with a translucent shell, a
// wireframe cage, and a slow-orbiting particle halo.
function buildEnergyCore(group) {
  const core = new THREE.Group();

  const coreMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial({ color: 0x101010, emissive: 0x5eead4, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.3 })
  );
  coreMesh.position.y = 1.1;
  core.add(coreMesh);

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), createGlassMaterial({ color: 0x5eead4, opacity: 0.16 }));
  shell.position.y = 1.1;
  core.add(shell);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, 1),
    new THREE.MeshBasicMaterial({ color: 0x2dd4bf, wireframe: true, transparent: true, opacity: 0.35 })
  );
  wire.position.y = 1.1;
  core.add(wire);

  const particles = createParticleField({ count: 90, innerRadius: 1.3, spread: 0.8, color: 0x5eead4, size: 0.03, opacity: 0.6 });
  particles.position.y = 1.1;
  core.add(particles);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.65, 0.3, 8),
    createMetalMaterial({ color: 0x8fa3ad, roughness: 0.4 })
  );
  pedestal.position.y = 0.15;
  core.add(pedestal);

  group.add(core);
  return { core, coreMesh, shell, wire, particles };
}

function buildTerminals(group) {
  const milestoneRuntime = [];

  MILESTONES.forEach((data, i) => {
    const pos = TERMINAL_POSITIONS[i];
    const terminal = createTerminal(data.id);
    terminal.group.position.set(pos.x, 0, pos.z);
    group.add(terminal.group);

    const marker = createWaypointMarker({ color: data.accentColor });
    terminal.group.add(marker.sprite);

    milestoneRuntime.push({
      ...data,
      position: new THREE.Vector3(pos.x, 0, pos.z),
      radius: 3.4,
      terminal,
      marker,
      discovered: false,
      hovered: false,
    });
  });

  return milestoneRuntime;
}

// Crates, pylons, and drifting debris scattered along the walkways and
// around the platform edge for atmosphere.
const PROP_LAYOUT = [
  { type: "crate", x: -1.6, z: -1.4, scale: 0.5 },
  { type: "crate", x: -1.9, z: -1.1, scale: 0.35 },
  { type: "crate", x: 1.7, z: 1.3, scale: 0.42 },
  { type: "pylon", x: 2.2, z: -3.4 },
  { type: "pylon", x: -2.2, z: 3.4 },
  { type: "pylon", x: 3.4, z: -6.8 },
  { type: "pylon", x: -3.4, z: 4 },
  { type: "pylon", x: 7, z: -1.4 },
  { type: "pylon", x: -7, z: 4.2 },
  { type: "crate", x: 6.6, z: -8.6, scale: 0.45 },
  { type: "crate", x: 2, z: -8.4, scale: 0.38 },
  { type: "crate", x: 8.4, z: -3, scale: 0.4 },
  { type: "crate", x: -8.4, z: 4.6, scale: 0.4 },
  { type: "crate", x: -11, z: 8, scale: 0.5 },
  { type: "crate", x: 4.4, z: 8.6, scale: 0.42 },
  { type: "crate", x: 8, z: 11.4, scale: 0.36 },
];

function buildProps(group) {
  const colliders = [];
  const metal = new THREE.MeshStandardMaterial({
    color: 0x9aa5b1,
    emissive: 0xd6ecff,
    emissiveIntensity: 0.18,
    roughness: 0.4,
    metalness: 0.85,
  });
  const silverTrim = createEmissiveTrimMaterial({ color: 0xe4f2ff, intensity: 0.9 });

  PROP_LAYOUT.forEach(({ type, x, z, scale = 1 }) => {
    if (type === "crate") {
      const size = 0.6 * scale;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), metal);
      crate.position.set(x, size / 2, z);
      crate.rotation.y = Math.random() * Math.PI;
      crate.castShadow = true;
      group.add(crate);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(crate.geometry),
        new THREE.LineBasicMaterial({ color: 0xe4f2ff, transparent: true, opacity: 0.7 })
      );
      edges.position.copy(crate.position);
      edges.rotation.copy(crate.rotation);
      group.add(edges);

      colliders.push({ x, z, radius: size * 0.7 });
    } else if (type === "pylon") {
      const pylon = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 6), metal);
      pole.position.y = 0.7;
      pylon.add(pole);
      const cap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 16), silverTrim);
      cap.rotation.x = Math.PI / 2;
      cap.position.y = 1.35;
      pylon.add(cap);
      pylon.position.set(x, 0, z);
      group.add(pylon);
      colliders.push({ x, z, radius: 0.25 });
    }
  });

  return colliders;
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  group.name = "station";

  buildPlatform(scene);
  buildLandingPads(group);
  buildWalkways(group);
  const energyCore = buildEnergyCore(group);
  const milestones = buildTerminals(group);
  const propColliders = buildProps(group);
  const collectibles = buildCollectibles(group);

  const dust = createParticleField({ count: 220, innerRadius: 6, spread: PLATFORM_RADIUS, color: 0x5eead4, size: 0.02, opacity: 0.25 });
  dust.position.y = 3;
  scene.add(dust);

  scene.add(group);

  const terminalColliders = milestones.map((m) => ({ x: m.position.x, z: m.position.z, radius: 1.5 }));
  const coreCollider = { x: 0, z: 0, radius: 1.0 };

  return {
    group,
    milestones,
    collectibles,
    dust,
    core: energyCore.core,
    coreMesh: energyCore.coreMesh,
    wire: energyCore.wire,
    particles: energyCore.particles,
    colliders: [coreCollider, ...terminalColliders, ...propColliders],
    worldBounds: PLATFORM_RADIUS - 1.5,
  };
}
