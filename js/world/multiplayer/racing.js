// Mount-based view for the racing panel: builds its own small Three.js scene
// (its own renderer, camera, track, car) inside the panel body, completely
// isolated from the main world's renderer and keyboard handling. Connects to
// the shared racingSession lazily — only while this panel is open — and
// disposes everything on unmount, matching the mountTicTacToe(container)
// contract used by the arcade panel.

import * as THREE from "three";
import { createGlassMaterial, createEmissiveTrimMaterial } from "../materials.js";
import { racingSession } from "./racing-session.js";
import { arcadeSession } from "./arcade-session.js";

const TRACK_WIDTH = 3.4;
const TRACK_SAMPLES = 240;

// A winding circuit — long straights, a sweeping right-hander, an S-chicane,
// and a tight hairpin — rather than a plain oval. Hand-placed waypoints fed
// through a closed Catmull-Rom spline, same idea as a real track map.
const TRACK_WAYPOINTS = [
  { x: -2, z: 9 },
  { x: 4, z: 9 },
  { x: 8, z: 6 },
  { x: 8, z: 2 },
  { x: 5, z: 0 },
  { x: 8, z: -2 },
  { x: 8, z: -6 },
  { x: 5, z: -9 },
  { x: 1, z: -7 },
  { x: -3, z: -9 },
  { x: -8, z: -6 },
  { x: -8, z: -1 },
  { x: -6, z: 3 },
  { x: -5, z: 7 },
];

// Waypoint indices that mark a turn — small apex marker blocks get planted
// just outside the track edge there, echoing the curve-marker convention
// from real track diagrams.
const MARKER_INDICES = [2, 4, 5, 7, 10];

const ACCEL = 5.5;
const MAX_SPEED = 8.5;
const FRICTION = 2.4;
const TURN_RATE = 2.6;
const DEFAULT_CAR_COLOR = 0xffffff;

const DRIVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

function buildRacingCurve() {
  const points = TRACK_WAYPOINTS.map((p) => new THREE.Vector3(p.x, 0, p.z));
  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
}

// A flat quad-strip ribbon following `pts` (a closed polyline), offset by
// `width`/2 on each side using the local perpendicular at each point.
function buildStripGeometry(pts, width, y = 0) {
  const n = pts.length;
  const positions = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const pNext = pts[(i + 1) % n];
    const pPrev = pts[(i - 1 + n) % n];
    const dirX = pNext.x - pPrev.x;
    const dirZ = pNext.z - pPrev.z;
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = -dirZ / len;
    const nz = dirX / len;
    const half = width / 2;
    positions.push(p.x + nx * half, y, p.z + nz * half);
    positions.push(p.x - nx * half, y, p.z - nz * half);
  }
  const indices = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = ((i + 1) % n) * 2;
    const d = ((i + 1) % n) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildCurveMarkers(waypoints, indices, material) {
  const group = new THREE.Group();
  const n = waypoints.length;
  indices.forEach((idx) => {
    const p = waypoints[idx];
    const pNext = waypoints[(idx + 1) % n];
    const pPrev = waypoints[(idx - 1 + n) % n];
    const dirX = pNext.x - pPrev.x;
    const dirZ = pNext.z - pPrev.z;
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = -dirZ / len;
    const nz = dirX / len;
    const outward = TRACK_WIDTH / 2 + 0.55;

    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.28), material);
    marker.position.set(p.x + nx * outward, 0.06, p.z + nz * outward);
    marker.rotation.y = Math.atan2(dirX, dirZ);
    group.add(marker);
  });
  return group;
}

function buildTrack() {
  const group = new THREE.Group();
  const curve = buildRacingCurve();
  const centerPoints = curve.getPoints(TRACK_SAMPLES).map((v) => ({ x: v.x, z: v.z }));

  const leftEdge = [];
  const rightEdge = [];
  const n = centerPoints.length;
  for (let i = 0; i < n; i++) {
    const p = centerPoints[i];
    const pNext = centerPoints[(i + 1) % n];
    const pPrev = centerPoints[(i - 1 + n) % n];
    const dirX = pNext.x - pPrev.x;
    const dirZ = pNext.z - pPrev.z;
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = -dirZ / len;
    const nz = dirX / len;
    const half = TRACK_WIDTH / 2;
    leftEdge.push({ x: p.x + nx * half, z: p.z + nz * half });
    rightEdge.push({ x: p.x - nx * half, z: p.z - nz * half });
  }

  const road = new THREE.Mesh(
    buildStripGeometry(centerPoints, TRACK_WIDTH),
    new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.85, metalness: 0.15, side: THREE.DoubleSide })
  );
  group.add(road);

  const edgeMat = createEmissiveTrimMaterial({ color: 0xf5f5f5, intensity: 1.2 });
  [leftEdge, rightEdge].forEach((edgePts) => {
    const edge = new THREE.Mesh(buildStripGeometry(edgePts, 0.14, 0.08), edgeMat);
    group.add(edge);
  });

  const markerMat = createEmissiveTrimMaterial({ color: 0xeceff1, intensity: 1.6 });
  group.add(buildCurveMarkers(TRACK_WAYPOINTS, MARKER_INDICES, markerMat));

  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.03;
  group.add(floor);

  return { group, centerPoints };
}

function buildCar(color) {
  const group = new THREE.Group();

  // Slightly reduced metalness (vs. the site's default fully-metallic
  // recipe) so a bright white/silver body still reads clearly under the
  // scene's modest lighting instead of going flat and dark.
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.95), bodyMaterial);
  body.position.y = 0.22;
  group.add(body);
  group.userData.bodyMaterial = bodyMaterial;

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.4), createGlassMaterial({ color: 0x88ccff, opacity: 0.5 }));
  cockpit.position.set(0, 0.36, -0.05);
  group.add(cockpit);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xcbd3da, metalness: 0.7, roughness: 0.4 });
  const wheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12);
  [
    [-0.27, 0.14, 0.32],
    [0.27, 0.14, 0.32],
    [-0.27, 0.14, -0.32],
    [0.27, 0.14, -0.32],
  ].forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.03), createEmissiveTrimMaterial({ color: 0xff3b3b, intensity: 2 }));
  tailLight.position.set(0, 0.24, 0.47);
  group.add(tailLight);

  const headLight = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.03), createEmissiveTrimMaterial({ color: 0xfff2c8, intensity: 1.4 }));
  headLight.position.set(0, 0.24, -0.47);
  group.add(headLight);

  return group;
}

function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

export function mountRacing(container) {
  container.innerHTML = `
    <div class="race-wrap">
      <div class="race-canvas-box"><canvas class="race-canvas"></canvas></div>
      <div class="race-hud">
        <span class="race-hud-speed" id="raceSpeed">0 KM/H</span>
        <span class="race-hud-drivers" id="raceDrivers"></span>
      </div>
      <p class="race-status" id="raceStatus">Connecting to the racing arena…</p>
    </div>
  `;

  const canvas = container.querySelector(".race-canvas");
  const box = container.querySelector(".race-canvas-box");
  const speedEl = container.querySelector("#raceSpeed");
  const driversEl = container.querySelector("#raceDrivers");
  const statusEl = container.querySelector("#raceStatus");

  canvas.setAttribute("tabindex", "0");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f19);
  scene.fog = new THREE.FogExp2(0x0b0f19, 0.03);

  scene.add(new THREE.AmbientLight(0x453d78, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(6, 10, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100);

  const { group: trackGroup, centerPoints } = buildTrack();
  scene.add(trackGroup);

  const car = buildCar(DEFAULT_CAR_COLOR);
  scene.add(car);

  const startPoint = centerPoints[0];
  const nextPoint = centerPoints[1];
  const startHeading = Math.atan2(nextPoint.x - startPoint.x, nextPoint.z - startPoint.z);
  const carState = { x: startPoint.x, z: startPoint.z, heading: startHeading, speed: 0 };
  car.position.set(carState.x, 0, carState.z);
  car.rotation.y = carState.heading;
  camera.position.set(
    carState.x - Math.sin(startHeading) * 3.4,
    1.7,
    carState.z - Math.cos(startHeading) * 3.4
  );

  const remoteCars = new Map(); // id -> { mesh, target: {x,z,heading} }

  const keys = new Set();
  function onKeyDown(e) {
    if (DRIVE_KEYS.has(e.code)) e.preventDefault();
    keys.add(e.code);
    e.stopPropagation();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
    e.stopPropagation();
  }
  function onCanvasClick() {
    canvas.focus();
  }
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("click", onCanvasClick);

  function resize() {
    const rect = box.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(box);

  let myColor = DEFAULT_CAR_COLOR;
  function syncRemoteCars(snapshot) {
    const self = snapshot.players.find((p) => p.isYou);
    if (self && self.color !== myColor) {
      myColor = self.color;
      car.userData.bodyMaterial.color.setHex(myColor);
    }

    const seen = new Set();
    snapshot.players.forEach((p) => {
      if (p.isYou) return;
      seen.add(p.id);
      let entry = remoteCars.get(p.id);
      if (!entry) {
        const mesh = buildCar(p.color);
        mesh.position.set(p.x, 0, p.z);
        mesh.rotation.y = p.heading;
        scene.add(mesh);
        entry = { mesh, target: { x: p.x, z: p.z, heading: p.heading } };
        remoteCars.set(p.id, entry);
      }
      entry.target.x = p.x;
      entry.target.z = p.z;
      entry.target.heading = p.heading;
    });
    remoteCars.forEach((entry, id) => {
      if (!seen.has(id)) {
        scene.remove(entry.mesh);
        disposeObject(entry.mesh);
        remoteCars.delete(id);
      }
    });
    driversEl.textContent = `${snapshot.players.length} on the circuit`;
  }

  const unsubscribe = racingSession.subscribe((snapshot) => {
    if (snapshot.connecting) {
      statusEl.hidden = false;
      statusEl.textContent = "Connecting to the racing arena…";
      return;
    }
    if (!snapshot.connected) {
      statusEl.hidden = false;
      statusEl.textContent = "Couldn't reach the racing arena. Try reopening this terminal.";
      return;
    }
    statusEl.hidden = true;
    syncRemoteCars(snapshot);
  });

  racingSession.connect({
    name: arcadeSession.playerName,
    onStatus: (text) => {
      statusEl.textContent = text;
    },
  });

  // Nearest point on the track's sampled centerline — used to keep the car
  // on the road regardless of how the path curves, instead of a simple
  // radial distance check.
  function nearestCenterPoint(x, z) {
    let bestDistSq = Infinity;
    let bestPoint = centerPoints[0];
    for (const p of centerPoints) {
      const dx = x - p.x;
      const dz = z - p.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPoint = p;
      }
    }
    return { point: bestPoint, dist: Math.sqrt(bestDistSq) };
  }

  let raf = null;
  let disposed = false;
  let lastTime = performance.now();

  function step() {
    if (disposed) return;
    raf = requestAnimationFrame(step);

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const throttle = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const steer = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) - (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);

    if (throttle !== 0) {
      carState.speed += throttle * ACCEL * dt;
    } else {
      const decel = FRICTION * dt;
      carState.speed = carState.speed > 0 ? Math.max(0, carState.speed - decel) : Math.min(0, carState.speed + decel);
    }
    carState.speed = Math.max(-MAX_SPEED * 0.5, Math.min(MAX_SPEED, carState.speed));

    if (Math.abs(carState.speed) > 0.05) {
      const speedFactor = Math.min(1, Math.abs(carState.speed) / MAX_SPEED + 0.3);
      carState.heading += steer * TURN_RATE * dt * speedFactor * Math.sign(carState.speed || 1);
    }

    carState.x += Math.sin(carState.heading) * carState.speed * dt;
    carState.z += Math.cos(carState.heading) * carState.speed * dt;

    // Keep the car on the road — soft clamp back toward the nearest point on
    // the track's centerline if it strays past the road's edge, and bleed
    // off some speed so straying off-line actually costs something.
    const { point, dist } = nearestCenterPoint(carState.x, carState.z);
    const maxDist = TRACK_WIDTH / 2 - 0.3;
    if (dist > maxDist) {
      const dx = carState.x - point.x;
      const dz = carState.z - point.z;
      const len = Math.hypot(dx, dz) || 1;
      carState.x = point.x + (dx / len) * maxDist;
      carState.z = point.z + (dz / len) * maxDist;
      carState.speed *= 0.6;
    }

    car.position.set(carState.x, 0, carState.z);
    car.rotation.y = carState.heading;

    // Chase camera: smoothly follow behind the car.
    const camDist = 3.4;
    const camHeight = 1.7;
    const behindX = carState.x - Math.sin(carState.heading) * camDist;
    const behindZ = carState.z - Math.cos(carState.heading) * camDist;
    const camLerp = 1 - Math.pow(0.001, dt);
    camera.position.x += (behindX - camera.position.x) * camLerp;
    camera.position.y += (camHeight - camera.position.y) * camLerp;
    camera.position.z += (behindZ - camera.position.z) * camLerp;
    camera.lookAt(carState.x, 0.3, carState.z);

    // Smoothly interpolate remote cars toward their latest broadcast
    // transform instead of snapping, same damping idiom as the collectible
    // orbs' bob/scale easing.
    const remoteLerp = 1 - Math.pow(0.0005, dt);
    remoteCars.forEach((entry) => {
      entry.mesh.position.x += (entry.target.x - entry.mesh.position.x) * remoteLerp;
      entry.mesh.position.z += (entry.target.z - entry.mesh.position.z) * remoteLerp;
      let dh = entry.target.heading - entry.mesh.rotation.y;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      entry.mesh.rotation.y += dh * remoteLerp;
    });

    racingSession.updateSelf({ x: carState.x, z: carState.z, heading: carState.heading, speed: carState.speed });

    speedEl.textContent = `${Math.round(Math.abs(carState.speed) * 22)} KM/H`;

    renderer.render(scene, camera);
  }

  resize();
  raf = requestAnimationFrame(step);

  return function unmount() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    unsubscribe();
    racingSession.disconnect();

    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("click", onCanvasClick);

    remoteCars.forEach((entry) => disposeObject(entry.mesh));
    remoteCars.clear();

    disposeObject(scene);
    renderer.dispose();
  };
}
