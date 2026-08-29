// Billboarded waypoint markers — a soft glowing dot that always faces the
// camera (THREE.Sprite is a billboard by construction), bobbing and pulsing
// to draw the eye toward an undiscovered terminal. Once that milestone is
// reached the animation settles into a calm static state and stops running
// — it did its job, no need to keep drawing attention to it.

import * as THREE from "three";

function createGlowTexture(color) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const hex = `#${new THREE.Color(color).getHexString()}`;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.25, hex);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createWaypointMarker({ color = 0xffffff, baseY = 3.3 } = {}) {
  const texture = createGlowTexture(color);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.55, 0.55, 1);
  sprite.position.y = baseY;

  const bobSeed = Math.random() * Math.PI * 2;
  let settled = false;

  function update(time, dt, discovered) {
    if (discovered) {
      if (settled) return;
      sprite.position.y = baseY;
      sprite.scale.set(0.32, 0.32, 1);
      material.opacity = 0.45;
      settled = true;
      return;
    }

    sprite.position.y = baseY + Math.sin(time * 1.8 + bobSeed) * 0.15;
    const pulse = 0.5 + Math.sin(time * 3 + bobSeed) * 0.08;
    sprite.scale.set(pulse, pulse, 1);
    material.opacity = 0.8 + Math.sin(time * 3 + bobSeed) * 0.2;
  }

  return { sprite, update };
}
