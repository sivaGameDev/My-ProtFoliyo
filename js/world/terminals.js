// Procedural "terminal" structures — one per milestone. No model files:
// every shape is built from primitive geometry + the shared material recipes
// in materials.js, matching the station designs of the original space theme.

import * as THREE from "three";
import { createGlassMaterial, createMetalMaterial, createEmissiveTrimMaterial } from "./materials.js";

class Terminal {
  constructor({ group, interactive, pulseTargets = [] }) {
    this.group = group;
    this.interactive = interactive;
    this.pulseTargets = pulseTargets;
    this.discovered = false;
    this.hovered = false;
    this._flash = 0;
    this._bobSeed = Math.random() * Math.PI * 2;
    this._currentGlow = 0.9;
    this._currentScale = 1;
  }

  triggerActivateFlash() {
    this._flash = 1;
  }

  update(time, dt, { hovered, discovered }) {
    this.hovered = hovered;
    this.discovered = discovered;

    this.group.position.y = Math.sin(time * 0.6 + this._bobSeed) * 0.04;
    this.group.rotation.y += dt * 0.15 * (hovered ? 2.2 : 1);

    const targetGlow = hovered ? 3 : discovered ? 1.1 : 0.9;
    const glowLerp = 1 - Math.pow(0.001, dt);
    this._currentGlow += (targetGlow - this._currentGlow) * glowLerp;

    this._flash = Math.max(0, this._flash - dt * 1.6);
    const glow = this._currentGlow + this._flash * 2.4;

    this.pulseTargets.forEach((mat) => {
      if (mat && "emissiveIntensity" in mat) mat.emissiveIntensity = glow;
    });

    const targetScale = hovered ? 1.08 : 1;
    const scaleLerp = 1 - Math.pow(0.0005, dt);
    this._currentScale += (targetScale - this._currentScale) * scaleLerp;
    this.group.scale.setScalar(this._currentScale);
  }
}

function buildAboutTerminal() {
  const group = new THREE.Group();
  const metal = createMetalMaterial({ color: 0x8fa3ad, roughness: 0.45 });
  const glass = createGlassMaterial({ color: 0x5eead4, opacity: 0.22 });
  const trim = createEmissiveTrimMaterial({ color: 0x5eead4, intensity: 1.4 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.4, 8), metal);
  base.position.y = 0.2;
  group.add(base);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 8), trim);
  collar.position.y = 0.55;
  group.add(collar);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.9), glass);
  dome.position.y = 0.7;
  group.add(dome);

  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), trim);
  shard.position.y = 1.05;
  group.add(shard);

  return { group, interactive: [base, dome, collar], pulse: [trim, glass] };
}

const PANEL_ACCENTS = [0x5eead4, 0xffb454, 0x60a5fa, 0xa78bfa, 0x34d399, 0xf472b6];

function buildProjectsTerminal(panelCount = 5) {
  const group = new THREE.Group();
  const metal = createMetalMaterial({ color: 0x7d8b96, roughness: 0.5 });
  const glass = createGlassMaterial({ color: 0x9fe9de, opacity: 0.18 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.35, 6), metal);
  base.position.y = 0.18;
  group.add(base);

  const interactive = [base];
  const trims = [];
  const spread = Math.min(Math.max(panelCount, 1), 6);

  for (let i = 0; i < spread; i++) {
    const panelGroup = new THREE.Group();
    const angle = (i / spread) * Math.PI * 2;
    const accent = PANEL_ACCENTS[i % PANEL_ACCENTS.length];
    const edgeTrim = createEmissiveTrimMaterial({ color: accent, intensity: 1.4 });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.06), metal);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.05), glass);
    face.position.z = 0.035;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.08), edgeTrim);
    edge.position.y = -0.63;

    panelGroup.add(frame, face, edge);
    const panelRadius = spread <= 4 ? 0.7 : 0.95;
    panelGroup.position.set(Math.cos(angle) * panelRadius, 1.15, Math.sin(angle) * panelRadius);
    panelGroup.rotation.y = -angle + Math.PI / 2;
    panelGroup.rotation.x = -0.15;

    group.add(panelGroup);
    interactive.push(frame, face);
    trims.push(edgeTrim);
  }

  return { group, interactive, pulse: [...trims, glass] };
}

function buildResumeTerminal() {
  const group = new THREE.Group();
  const metal = createMetalMaterial({ color: 0x86929c, roughness: 0.4 });
  const trim = createEmissiveTrimMaterial({ color: 0xffb454, intensity: 1.3 });

  const obelisk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.5), metal);
  obelisk.position.y = 1.05;
  group.add(obelisk);

  const lines = [];
  for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.05, 0.06), trim);
    line.position.set(0, 0.4 + i * 0.4, 0.28);
    group.add(line);
    lines.push(line);
  }

  return { group, interactive: [obelisk, ...lines], pulse: [trim] };
}

function buildContactTerminal() {
  const group = new THREE.Group();
  const metal = createMetalMaterial({ color: 0x8b98a2, roughness: 0.45 });
  const trim = createEmissiveTrimMaterial({ color: 0x5eead4, intensity: 1.4 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.1, 8), metal);
  base.position.y = 0.55;
  group.add(base);

  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.35, 16, 1, true), metal);
  dish.rotation.x = Math.PI * 0.65;
  dish.position.set(0, 1.25, 0.1);
  group.add(dish);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 8, 32), trim);
  ring.rotation.x = Math.PI / 2.4;
  ring.position.y = 1.1;
  group.add(ring);

  return { group, interactive: [base, dish, ring], pulse: [trim] };
}

const BUILDERS = {
  about: buildAboutTerminal,
  projects: () => buildProjectsTerminal(5),
  resume: buildResumeTerminal,
  contact: buildContactTerminal,
};

export function createTerminal(id) {
  const builder = BUILDERS[id];
  if (!builder) throw new Error(`Unknown terminal type: ${id}`);
  const { group, interactive, pulse } = builder();
  return new Terminal({ group, interactive, pulseTargets: pulse });
}
