// Thin view over the shared arcadeSession — the actual networking and game
// state live there (connected once, site-wide, during the loading screen),
// so this just renders whatever the session currently knows and forwards
// clicks back to it.

import { arcadeSession } from "./arcade-session.js";

function roleLabel(role, snapshot) {
  if (role === "X") return `X (${snapshot.hostName || "Host"})`;
  if (role === "O") return `O (${snapshot.playerNames.O || "open seat"})`;
  return "Spectating";
}

export function mountTicTacToe(container) {
  let built = false;

  function buildSkeleton() {
    container.innerHTML = `
      <div class="xo-game">
        <div class="xo-meta">
          <span class="xo-role" id="xoRole"></span>
          <span class="xo-turn" id="xoTurn"></span>
        </div>
        <div class="xo-board" id="xoBoard"></div>
        <p class="xo-result" id="xoResult" hidden></p>
        <div class="xo-actions">
          <button class="btn-enter xo-restart-btn" id="xoRestart" type="button" hidden>Play Again</button>
        </div>
        <p class="xo-status" id="xoSpectators"></p>
      </div>
    `;
    const board = container.querySelector("#xoBoard");
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "xo-cell";
      cell.dataset.index = String(i);
      cell.addEventListener("click", () => arcadeSession.move(i));
      board.appendChild(cell);
    }
    container.querySelector("#xoRestart").addEventListener("click", () => arcadeSession.restart());
    built = true;
  }

  function render(snapshot) {
    if (snapshot.connecting) {
      built = false;
      container.innerHTML = `<p class="xo-status">Connecting to the shared arcade lobby…</p>`;
      return;
    }
    if (!snapshot.connected) {
      built = false;
      container.innerHTML = `<p class="xo-status xo-status-error">Couldn't reach the arcade lobby. Try reopening this terminal.</p>`;
      return;
    }
    if (!built) buildSkeleton();

    const boardEl = container.querySelector("#xoBoard");
    const roleEl = container.querySelector("#xoRole");
    const turnEl = container.querySelector("#xoTurn");
    const resultEl = container.querySelector("#xoResult");
    const restartBtn = container.querySelector("#xoRestart");
    const spectatorsEl = container.querySelector("#xoSpectators");

    roleEl.textContent = `You: ${snapshot.role === "spectator" ? "Spectating" : snapshot.role}`;
    turnEl.textContent = snapshot.winner ? "" : `Turn: ${roleLabel(snapshot.turn, snapshot)}`;

    // The mark that will vanish next if that side moves again.
    const fadingX = snapshot.xMoves && snapshot.xMoves.length >= 3 ? snapshot.xMoves[0] : -1;
    const fadingO = snapshot.oMoves && snapshot.oMoves.length >= 3 ? snapshot.oMoves[0] : -1;

    [...boardEl.children].forEach((cell, i) => {
      cell.textContent = snapshot.board[i] || "";
      cell.classList.toggle("xo-cell-x", snapshot.board[i] === "X");
      cell.classList.toggle("xo-cell-o", snapshot.board[i] === "O");
      cell.classList.toggle("xo-cell-fading", i === fadingX || i === fadingO);
      cell.classList.toggle("xo-cell-winning", !!snapshot.winLine && snapshot.winLine.includes(i));
      cell.disabled = !!snapshot.board[i] || !!snapshot.winner || snapshot.role === "spectator" || !snapshot.role;
    });

    if (snapshot.winner) {
      resultEl.hidden = false;
      resultEl.textContent = `${roleLabel(snapshot.winner, snapshot)} wins!`;
      restartBtn.hidden = false;
    } else {
      resultEl.hidden = true;
      restartBtn.hidden = true;
    }

    spectatorsEl.textContent = snapshot.spectatorCount > 0 ? `${snapshot.spectatorCount} spectating` : "";
  }

  const unsubscribe = arcadeSession.subscribe(render);
  render(arcadeSession.getSnapshot());

  return function unmount() {
    unsubscribe();
  };
}
