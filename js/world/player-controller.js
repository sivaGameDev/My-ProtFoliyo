import * as THREE from "three";

// Real browsers always populate e.code; this falls back to e.key so the
// controls stay functional in environments that only emit synthetic
// key events with a `key` property (e.g. some automated test drivers).
const KEY_MAP = {
  w: "KeyW",
  a: "KeyA",
  s: "KeyS",
  d: "KeyD",
  e: "KeyE",
  " ": "Space",
  shift: "ShiftLeft",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
};

function normalizeKeyToken(e) {
  if (e.code) return e.code;
  const key = (e.key || "").toLowerCase();
  return KEY_MAP[key] || e.key || "";
}

const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 4.2;
const RUN_SPEED = 7.4;
const ACCEL = 18;
const GRAVITY = -18;
const JUMP_SPEED = 6.2;
const MOUSE_SENS = 0.0022;
const TOUCH_LOOK_SENS = 0.006;

export class PlayerController {
  constructor({ camera, domElement, touchEls }) {
    this.camera = camera;
    this.dom = domElement;
    this.touchEls = touchEls || {};

    this.object = new THREE.Object3D();
    this.object.position.set(0, 0, 4);
    camera.position.set(0, EYE_HEIGHT, 0);
    camera.rotation.set(0, 0, 0);
    this.object.add(camera);

    this.yaw = Math.PI;
    this.pitch = 0;

    this.velocity = new THREE.Vector3();
    this.moveInput = { forward: 0, strafe: 0 };
    this.running = false;
    this.grounded = true;
    this.locked = false;

    this.keys = new Set();
    this.onInteract = null;

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
  }

  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      const token = normalizeKeyToken(e);
      this.keys.add(token);
      if (token === "ShiftLeft") this.running = true;
      if (token === "KeyE" && this.onInteract) this.onInteract();
      if (token === "Space") this._tryJump();
    });
    window.addEventListener("keyup", (e) => {
      const token = normalizeKeyToken(e);
      this.keys.delete(token);
      if (token === "ShiftLeft") this.running = false;
    });
  }

  _bindMouse() {
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * MOUSE_SENS;
      this.pitch -= e.movementY * MOUSE_SENS;
      this._clampPitch();
    });
  }

  requestLock() {
    const result = this.dom.requestPointerLock();
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  }

  exitLock() {
    document.exitPointerLock();
  }

  _clampPitch() {
    const limit = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  _tryJump() {
    if (this.grounded) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
    }
  }

  _bindTouch() {
    const { stick, stickKnob, look, interactBtn } = this.touchEls;
    if (!stick) return;

    let stickTouchId = null;
    let stickOrigin = { x: 0, y: 0 };

    stick.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      stickTouchId = t.identifier;
      const rect = stick.getBoundingClientRect();
      stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      e.preventDefault();
    });

    stick.addEventListener(
      "touchmove",
      (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== stickTouchId) continue;
          const dx = t.clientX - stickOrigin.x;
          const dy = t.clientY - stickOrigin.y;
          const max = 46;
          const len = Math.min(Math.hypot(dx, dy), max);
          const angle = Math.atan2(dy, dx);
          const nx = (Math.cos(angle) * len) / max;
          const ny = (Math.sin(angle) * len) / max;
          if (stickKnob) stickKnob.style.transform = `translate(-50%, -50%) translate(${nx * max}px, ${ny * max}px)`;
          this.moveInput.strafe = nx;
          this.moveInput.forward = -ny;
          e.preventDefault();
        }
      },
      { passive: false }
    );

    const releaseStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickTouchId) continue;
        stickTouchId = null;
        this.moveInput.forward = 0;
        this.moveInput.strafe = 0;
        if (stickKnob) stickKnob.style.transform = "translate(-50%, -50%)";
      }
    };
    stick.addEventListener("touchend", releaseStick);
    stick.addEventListener("touchcancel", releaseStick);

    if (look) {
      let lookTouchId = null;
      let last = { x: 0, y: 0 };

      look.addEventListener("touchstart", (e) => {
        const t = e.changedTouches[0];
        lookTouchId = t.identifier;
        last = { x: t.clientX, y: t.clientY };
        e.preventDefault();
      });

      look.addEventListener(
        "touchmove",
        (e) => {
          for (const t of e.changedTouches) {
            if (t.identifier !== lookTouchId) continue;
            const dx = t.clientX - last.x;
            const dy = t.clientY - last.y;
            last = { x: t.clientX, y: t.clientY };
            this.yaw -= dx * TOUCH_LOOK_SENS;
            this.pitch -= dy * TOUCH_LOOK_SENS;
            this._clampPitch();
            e.preventDefault();
          }
        },
        { passive: false }
      );

      const releaseLook = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === lookTouchId) lookTouchId = null;
        }
      };
      look.addEventListener("touchend", releaseLook);
      look.addEventListener("touchcancel", releaseLook);
    }

    if (interactBtn) {
      interactBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (this.onInteract) this.onInteract();
      });
    }
  }

  _keyboardInput() {
    let forward = 0;
    let strafe = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) strafe += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) strafe -= 1;
    return { forward, strafe };
  }

  update(dt, { colliders = [], worldBounds = 20 } = {}) {
    this.object.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    const kb = this._keyboardInput();
    const inputForward = kb.forward !== 0 ? kb.forward : this.moveInput.forward;
    const inputStrafe = kb.strafe !== 0 ? kb.strafe : this.moveInput.strafe;

    const speed = this.running ? RUN_SPEED : WALK_SPEED;
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    const targetVX = (-sinY * inputForward + cosY * inputStrafe) * speed;
    const targetVZ = (-cosY * inputForward - sinY * inputStrafe) * speed;

    this.velocity.x += (targetVX - this.velocity.x) * Math.min(1, ACCEL * dt);
    this.velocity.z += (targetVZ - this.velocity.z) * Math.min(1, ACCEL * dt);

    this.velocity.y += GRAVITY * dt;

    let nx = this.object.position.x + this.velocity.x * dt;
    let nz = this.object.position.z + this.velocity.z * dt;
    let ny = this.object.position.y + this.velocity.y * dt;

    if (ny <= 0) {
      ny = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }

    for (const c of colliders) {
      const dx = nx - c.x;
      const dz = nz - c.z;
      const minDist = c.radius + PLAYER_RADIUS;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist && dist > 0.0001) {
        const push = (minDist - dist) / dist;
        nx += dx * push;
        nz += dz * push;
      }
    }

    nx = Math.max(-worldBounds, Math.min(worldBounds, nx));
    nz = Math.max(-worldBounds, Math.min(worldBounds, nz));

    this.object.position.set(nx, ny, nz);
  }
}
