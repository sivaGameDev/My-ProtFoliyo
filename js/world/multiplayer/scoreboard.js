// A floating screen hanging in open space past the platform's outer rim,
// showing the live shared tic-tac-toe match — so anyone exploring the
// station can see how the game is going, and who's hosting it, without
// walking up to the arcade cabinet and opening a panel. Redraws only when
// the shared session's state actually changes (event-driven, not per-frame).

import * as THREE from "three";
import { arcadeSession } from "./arcade-session.js";

const CANVAS_SIZE = 512;

function drawBoard(ctx, snapshot) {
  const s = CANVAS_SIZE;
  ctx.clearRect(0, 0, s, s);

  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#2a3450";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, s - 6, s - 6);

  ctx.textAlign = "center";
  ctx.fillStyle = "#5eead4";
  ctx.font = "bold 30px 'Segoe UI', sans-serif";
  ctx.fillText("LIVE ARCADE", s / 2, 46);

  ctx.font = "20px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#9aa4bf";
  if (!snapshot.connected) {
    ctx.fillText("Waiting for a match…", s / 2, 90);
  } else {
    const xName = snapshot.hostName || "Host";
    const oName = snapshot.playerNames.O || "open seat";
    ctx.fillStyle = "#5eead4";
    ctx.fillText(`X: ${xName}`, s / 2 - 110, 84);
    ctx.fillStyle = "#ffb454";
    ctx.fillText(`O: ${oName}`, s / 2 + 110, 84);
  }

  const boardTop = 116;
  const boardSize = 340;
  const cell = boardSize / 3;
  const left = (s - boardSize) / 2;

  ctx.strokeStyle = "#2a3450";
  ctx.lineWidth = 4;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(left + i * cell, boardTop);
    ctx.lineTo(left + i * cell, boardTop + boardSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left, boardTop + i * cell);
    ctx.lineTo(left + boardSize, boardTop + i * cell);
    ctx.stroke();
  }

  if (snapshot.connected && snapshot.board) {
    snapshot.board.forEach((mark, i) => {
      if (!mark) return;
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = left + col * cell + cell / 2;
      const cy = boardTop + row * cell + cell / 2;
      ctx.font = "bold 74px 'Segoe UI', sans-serif";
      ctx.fillStyle = mark === "X" ? "#5eead4" : "#ffb454";
      ctx.fillText(mark, cx, cy + 26);
    });
  }

  ctx.font = "22px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#e8ebf3";
  if (!snapshot.connected) {
    // already covered above
  } else if (snapshot.winner) {
    const winnerName = snapshot.winner === "X" ? snapshot.hostName : snapshot.playerNames.O;
    ctx.fillStyle = "#5eead4";
    ctx.fillText(`${winnerName || snapshot.winner} wins!`, s / 2, boardTop + boardSize + 44);
  } else {
    ctx.fillText(`${snapshot.turn}'s turn`, s / 2, boardTop + boardSize + 44);
  }
}

export function createScoreboard(position) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  drawBoard(ctx, arcadeSession.getSnapshot());

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);
  group.lookAt(0, position.y, 0);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
  );
  group.add(screen);

  const frame = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 1.86, 4),
    new THREE.MeshStandardMaterial({ color: 0x101010, emissive: 0xf472b6, emissiveIntensity: 0.9 })
  );
  frame.scale.set(1.02, 1.02, 1);
  frame.position.z = -0.01;
  group.add(frame);

  const glow = new THREE.PointLight(0xf472b6, 1.2, 6, 2);
  glow.position.z = 0.5;
  group.add(glow);

  arcadeSession.subscribe((snapshot) => {
    drawBoard(ctx, snapshot);
    texture.needsUpdate = true;
  });

  return group;
}
