// Occasional shooting stars streaking across the skybox. A small fixed pool
// of THREE.Line segments (head + tail point, recomputed each frame while
// active) — cheap, no billboarding/rotation math needed since a line between
// two 3D points always renders correctly from any camera angle.

import * as THREE from "three";

const TRAIL_LENGTH = 3.2;

export class ShootingStarField {
  constructor(scene, { count = 3, skyRadius = 120, color = 0xffffff } = {}) {
    this.skyRadius = skyRadius;
    this.stars = [];

    for (let i = 0; i < count; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.stars.push({
        line,
        active: false,
        t: 0,
        duration: 1,
        start: new THREE.Vector3(),
        dir: new THREE.Vector3(),
        speed: 0,
      });
    }

    this._nextSpawn = 1.5 + Math.random() * 2.5;
  }

  _spawnOne(star) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.PI * 0.12 + Math.random() * Math.PI * 0.35;
    const r = this.skyRadius * 0.85;
    const pos = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );

    const tangent = new THREE.Vector3(-pos.z, 0.3, pos.x).normalize();
    const dir = tangent.applyAxisAngle(pos.clone().normalize(), (Math.random() - 0.5) * 1.4).normalize();

    star.start.copy(pos);
    star.dir.copy(dir);
    star.speed = 40 + Math.random() * 28;
    star.t = 0;
    star.duration = 0.6 + Math.random() * 0.4;
    star.active = true;
    star.line.visible = true;
  }

  update(dt) {
    this._nextSpawn -= dt;
    if (this._nextSpawn <= 0) {
      const free = this.stars.find((s) => !s.active);
      if (free) this._spawnOne(free);
      this._nextSpawn = 2.5 + Math.random() * 4.5;
    }

    this.stars.forEach((star) => {
      if (!star.active) return;
      star.t += dt;
      const p = star.t / star.duration;
      if (p >= 1) {
        star.active = false;
        star.line.visible = false;
        return;
      }

      const head = star.start.clone().addScaledVector(star.dir, star.speed * star.t);
      const tail = head.clone().addScaledVector(star.dir, -TRAIL_LENGTH);
      const positions = star.line.geometry.attributes.position;
      positions.setXYZ(0, tail.x, tail.y, tail.z);
      positions.setXYZ(1, head.x, head.y, head.z);
      positions.needsUpdate = true;

      const fade = p < 0.2 ? p / 0.2 : p > 0.75 ? (1 - p) / 0.25 : 1;
      star.line.material.opacity = fade * 0.85;
    });
  }
}
