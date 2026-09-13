// A floating screen hanging in open space past the platform's outer rim,
// showing who's currently on the racing circuit — same canvas-texture
// technique as the tic-tac-toe scoreboard, redrawn only when the shared
// session's state actually changes (event-driven, not per-frame).

import * as THREE from "three";
import { racingSession } from "./racing-session.js";

const CANVAS_SIZE = 512;

function colorToHex(hexNumber) {
  return "#" + (hexNumber || 0x5eead4).toString(16).padStart(6, "0");
}

function drawBoard(ctx, snapshot) {
  const s = CANVAS_SIZE;
  ctx.clearRect(0, 0, s, s);

  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#2a3450";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, s - 6, s - 6);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff5240";
  ctx.font = "bold 30px 'Segoe UI', sans-serif";
  ctx.fillText("RACING ARENA", s / 2, 60);

  ctx.font = "20px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#9aa4bf";

  const players = snapshot.connected ? snapshot.players : [];
  if (players.length === 0) {
    ctx.fillText("No drivers yet — be the first!", s / 2, 110);
  } else {
    ctx.fillText(`${players.length} driver${players.length === 1 ? "" : "s"} on the circuit`, s / 2, 110);
  }

  const listTop = 160;
  const rowHeight = 46;
  players.slice(0, 4).forEach((p, i) => {
    const y = listTop + i * rowHeight;

    ctx.fillStyle = colorToHex(p.color);
    ctx.beginPath();
    ctx.arc(s / 2 - 130, y - 8, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = "#e8ebf3";
    ctx.font = "22px 'Segoe UI', sans-serif";
    ctx.fillText(p.name || "Guest", s / 2 - 108, y);
    ctx.textAlign = "center";
  });

  ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#9aa4bf";
  ctx.fillText("Walk up and press E to join the race", s / 2, s - 30);
}

export function createRacingBoard(position) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  drawBoard(ctx, racingSession.getSnapshot());

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);
  group.lookAt(0, position.y, 0);

  const BOARD_SCALE = 1.7;
  const visuals = new THREE.Group();
  visuals.scale.setScalar(BOARD_SCALE);
  group.add(visuals);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
  );
  visuals.add(screen);

  const frame = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 1.86, 4),
    new THREE.MeshStandardMaterial({ color: 0x101010, emissive: 0xff5240, emissiveIntensity: 0.9 })
  );
  frame.scale.set(1.02, 1.02, 1);
  frame.position.z = -0.01;
  visuals.add(frame);

  const glow = new THREE.PointLight(0xff5240, 1.2, 6 * BOARD_SCALE, 2);
  glow.position.z = 0.5;
  visuals.add(glow);

  racingSession.subscribe((snapshot) => {
    drawBoard(ctx, snapshot);
    texture.needsUpdate = true;
  });

  return group;
}
