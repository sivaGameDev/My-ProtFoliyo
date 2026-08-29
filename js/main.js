import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createSpaceSkybox, createSignatureLighting } from "./world/materials.js";
import * as audio from "./world/audio.js";
import { ShootingStarField } from "./world/shooting-stars.js";
import { buildWorld } from "./world/world-builder.js";
import { PlayerController } from "./world/player-controller.js";
import { createHud } from "./world/hud.js";

const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

const canvas = document.getElementById("worldCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b0f19, 0.02);

const skybox = createSpaceSkybox({ radius: 120 });
scene.add(skybox);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 250);

createSignatureLighting(scene, { keyIntensity: 2, rimIntensity: 1.1 });

const touchEls = isTouch
  ? {
      stick: document.getElementById("touchStick"),
      stickKnob: document.getElementById("touchStickKnob"),
      look: document.getElementById("touchLook"),
      interactBtn: document.getElementById("touchInteractBtn"),
    }
  : {};

const controller = new PlayerController({ camera, domElement: canvas, touchEls });
scene.add(controller.object);

const hud = createHud({ controller, isTouch });

const worldData = buildWorld(scene);
const shootingStars = new ShootingStarField(scene, { skyRadius: 120 });

let nearestMilestone = null;
let nearestOrb = null;
hud.updateOrbBadge(worldData.collectibles.collectedCount, worldData.collectibles.total);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.4, 0.72));
composer.addPass(new OutputPass());

controller.onInteract = () => {
  if (hud.panelOpen) return;

  if (nearestMilestone) {
    hud.onMilestoneDiscovered(nearestMilestone);
    hud.playInteractSound();
    return;
  }

  if (nearestOrb) {
    const collected = worldData.collectibles.collect(nearestOrb);
    if (!collected) return;
    const { collectedCount, total } = worldData.collectibles;
    hud.updateOrbBadge(collectedCount, total);
    if (collectedCount === total) {
      audio.playCollectAll();
      hud.showToast("🌈 All Orbs Collected!");
    } else {
      audio.playCollect();
      hud.showToast(`Orb collected — ${collectedCount} / ${total}`);
    }
  }
};

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const time = clock.elapsedTime;

  if (!hud.panelOpen) {
    controller.update(dt, { colliders: worldData.colliders, worldBounds: worldData.worldBounds });
  }

  worldData.core.rotation.y += dt * 0.12;
  worldData.coreMesh.material.emissiveIntensity = 0.8 * (1 + Math.sin(time * 1.4) * 0.22);
  worldData.wire.rotation.y -= dt * 0.08;
  worldData.particles.rotation.y -= dt * 0.15;
  worldData.dust.rotation.y += dt * 0.008;
  skybox.rotation.y += dt * 0.0015;
  shootingStars.update(dt);

  nearestMilestone = null;
  let bestDist = Infinity;
  for (const m of worldData.milestones) {
    const dx = controller.object.position.x - m.position.x;
    const dz = controller.object.position.z - m.position.z;
    const dist = Math.hypot(dx, dz);
    const inRange = dist <= m.radius;
    if (inRange && dist < bestDist) {
      bestDist = dist;
      nearestMilestone = m;
    }
  }

  for (const m of worldData.milestones) {
    m.hovered = m === nearestMilestone;
    m.terminal.update(time, dt, { hovered: m.hovered, discovered: m.discovered });
    m.marker.update(time, dt, m.discovered);
  }

  nearestOrb = null;
  let bestOrbDist = Infinity;
  for (const orb of worldData.collectibles.orbs) {
    if (orb.collected) continue;
    const dx = controller.object.position.x - orb.position.x;
    const dz = controller.object.position.z - orb.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= orb.radius && dist < bestOrbDist) {
      bestOrbDist = dist;
      nearestOrb = orb;
    }
  }
  worldData.collectibles.update(time, dt, nearestOrb);

  if (nearestMilestone && !hud.panelOpen) {
    const verb = nearestMilestone.discovered ? "Revisit" : nearestMilestone.prompt;
    hud.showPrompt(isTouch ? verb : `[ E ] ${verb}`);
    if (isTouch && touchEls.interactBtn) touchEls.interactBtn.hidden = false;
  } else if (nearestOrb && !hud.panelOpen) {
    hud.showPrompt(isTouch ? "Collect" : "[ E ] Collect Orb");
    if (isTouch && touchEls.interactBtn) touchEls.interactBtn.hidden = false;
  } else {
    hud.hidePrompt();
    if (isTouch && touchEls.interactBtn) touchEls.interactBtn.hidden = true;
  }

  composer.render();
}

animate();
