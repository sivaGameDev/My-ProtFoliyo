// Procedural, texture-free "space station" material + backdrop recipes.
// Nothing here is fetched — the skybox is a hand-written hash-noise starfield
// plus nebula glow shader, so there are no image assets to load at all.

import * as THREE from "three";

export function createGlassMaterial({ color = 0x88ccff, opacity = 0.25 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.0,
    roughness: 0.1,
    transparent: true,
    opacity,
    clearcoat: 1.0,
    envMapIntensity: 1.0,
    depthWrite: false,
  });
}

export function createMetalMaterial({ color = 0xaeb4bd, roughness = 0.4 } = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1.0, roughness, envMapIntensity: 1.1 });
}

export function createEmissiveTrimMaterial({ color = 0x5eead4, intensity = 2 } = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0x101010,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.0,
    roughness: 0.4,
  });
}

export function createParticleField({
  count = 260,
  innerRadius = 3.4,
  spread = 2.4,
  color = 0x5eead4,
  size = 0.035,
  opacity = 0.7,
} = {}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = innerRadius + Math.random() * spread;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true });
  return new THREE.Points(geometry, material);
}

export function createSignatureLighting(scene, { keyColor = 0x5eead4, keyIntensity = 2, rimColor = 0xffb454, rimIntensity = 1.1 } = {}) {
  const ambient = new THREE.AmbientLight(0x453d78, 1.7);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(keyColor, keyIntensity * 0.6);
  keyLight.position.set(10, 16, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -16;
  keyLight.shadow.camera.right = 16;
  keyLight.shadow.camera.top = 16;
  keyLight.shadow.camera.bottom = -16;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 50;
  keyLight.shadow.bias = -0.0015;
  scene.add(keyLight);

  const rimLight = new THREE.HemisphereLight(rimColor, keyColor, rimIntensity * 0.5);
  scene.add(rimLight);

  return { ambient, keyLight, rimLight };
}

// A single large inverted sphere with a hash-noise starfield + two soft
// directional nebula glows. One draw call, no lighting cost.
export function createSpaceSkybox({ radius = 120, nebulaColorA = 0x5eead4, nebulaColorB = 0xffb454 } = {}) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uNebulaA: { value: new THREE.Color(nebulaColorA) },
      uNebulaB: { value: new THREE.Color(nebulaColorB) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uNebulaA;
      uniform vec3 uNebulaB;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vDir);

        float h = dir.y * 0.5 + 0.5;
        vec3 color = mix(vec3(0.015, 0.02, 0.045), vec3(0.035, 0.05, 0.09), h);

        float neb1 = pow(max(dot(dir, normalize(vec3(0.6, 0.35, -0.7))), 0.0), 4.2);
        float neb2 = pow(max(dot(dir, normalize(vec3(-0.55, -0.25, 0.8))), 0.0), 5.5);
        color += uNebulaA * neb1 * 0.3;
        color += uNebulaB * neb2 * 0.24;

        float field = hash(floor(dir * 420.0));
        float star = smoothstep(0.9865, 1.0, field);
        float twinkle = hash(floor(dir * 420.0) + 7.0);
        color += vec3(star) * mix(0.6, 1.0, twinkle);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), material);
}
