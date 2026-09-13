// A single shared, site-wide multiplayer session: on load, the site tries a
// small pool of well-known room ids in order — join the first one that has
// space, or claim (host) the first one that's empty. No manual "host/join"
// step for the visitor; this is what "first to load is host" actually means
// in practice, extended to a handful of rooms instead of just one so the
// arcade doesn't hard-cap the whole site at 4 concurrent visitors.
//
// Game rules: classic 3-in-a-row tic-tac-toe, but each side only ever has 3
// marks on the board — placing a 4th removes that side's oldest mark first
// (the "vanishing" variant from the reference file).

import { PeerLobby } from "./peer-lobby.js";

const ROOM_IDS = ["room-1", "room-2", "room-3", "room-4", "room-5"];
const MAX_MARKS = 3;
const JOIN_TIMEOUT = 5000;

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line };
  }
  return { winner: null, line: null };
}

function freshBoardState() {
  return { board: Array(9).fill(null), turn: "X", winner: null, winLine: null, xMoves: [], oMoves: [] };
}

class ArcadeSessionImpl {
  constructor() {
    this.lobby = null;
    this.roomId = null;
    this.playerName = "Guest";
    this.role = "spectator";
    this.roles = new Map(); // host only: peerId -> 'O' | 'spectator'
    this.names = new Map(); // host only: peerId -> display name
    this.state = freshBoardState();
    this.hostName = "";
    this._oName = "";
    this._spectatorCount = 0;
    this.listeners = new Set();
    this.connected = false;
    this.connecting = false;
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  _notify() {
    this.listeners.forEach((cb) => cb(this.getSnapshot()));
  }

  getSnapshot() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      roomId: this.roomId,
      role: this.role,
      board: this.state.board,
      turn: this.state.turn,
      winner: this.state.winner,
      winLine: this.state.winLine,
      xMoves: this.state.xMoves,
      oMoves: this.state.oMoves,
      hostName: this.hostName,
      playerNames: {
        X: this.hostName,
        O: this.isHost ? this._nameFor(this._oPeerId()) : this._oName || "",
      },
      spectatorCount: this.isHost ? [...this.roles.values()].filter((r) => r === "spectator").length : this._spectatorCount || 0,
      isHost: this.isHost,
    };
  }

  get isHost() {
    return this.lobby && this.lobby.isHost;
  }

  _oPeerId() {
    for (const [peerId, r] of this.roles.entries()) if (r === "O") return peerId;
    return null;
  }

  _nameFor(peerId) {
    return (peerId && this.names.get(peerId)) || "";
  }

  async connect({ name, onStatus } = {}) {
    this.playerName = (name || "").trim() || "Guest";
    this.connecting = true;
    this._notify();

    for (const roomId of ROOM_IDS) {
      onStatus && onStatus(`Searching for an open lobby (${roomId})…`);
      try {
        const lobby = new PeerLobby({ maxPeers: 4 });
        await this._tryJoin(lobby, roomId);
        this._attachAsClient(lobby, roomId);
        onStatus && onStatus(`Joined a live match in ${roomId}.`);
        this.connecting = false;
        this._notify();
        return;
      } catch (err) {
        if (err && err.reason === "full") {
          continue; // try the next room
        }
        if (err && err.reason === "unavailable") {
          // Nobody is hosting this id — claim it.
          try {
            const lobby = new PeerLobby({ maxPeers: 4 });
            await lobby.hostLobby(roomId);
            this._attachAsHost(lobby, roomId);
            onStatus && onStatus(`Hosting a new lobby (${roomId}).`);
            this.connecting = false;
            this._notify();
            return;
          } catch (hostErr) {
            if (hostErr && hostErr.type === "unavailable-id") {
              // Someone else claimed it a moment before us — join instead.
              try {
                const lobby = new PeerLobby({ maxPeers: 4 });
                await this._tryJoin(lobby, roomId);
                this._attachAsClient(lobby, roomId);
                this.connecting = false;
                this._notify();
                return;
              } catch {
                continue;
              }
            }
            continue;
          }
        }
        continue; // any other network hiccup — try the next room
      }
    }

    onStatus && onStatus("The arcade is full right now — try again later.");
    this.connecting = false;
    this._notify();
  }

  _tryJoin(lobby, roomId) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject({ reason: "timeout" });
      }, JOIN_TIMEOUT);

      lobby
        .joinLobby(roomId)
        .then(() => {
          if (settled) return;
          // The connection is open at the WebRTC level, but the host still
          // needs a brief moment to signal "full" if that's the case —
          // don't declare success until that window passes.
          setTimeout(() => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          }, 250);
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (err && err.type === "peer-unavailable") reject({ reason: "unavailable" });
          else reject({ reason: "error", err });
        });

      lobby.addEventListener("error", (e) => {
        if (settled) return;
        if (e.detail && e.detail.message && e.detail.message.includes("full")) {
          settled = true;
          clearTimeout(timer);
          reject({ reason: "full" });
        }
      });
    });
  }

  _attachAsHost(lobby, roomId) {
    this.lobby = lobby;
    this.roomId = roomId;
    this.role = "X";
    this.hostName = this.playerName;
    this.state = freshBoardState();

    lobby.addEventListener("peer-joined", (e) => {
      const hasO = [...this.roles.values()].includes("O");
      this.roles.set(e.detail.peerId, hasO ? "spectator" : "O");
      this._broadcastState();
      this._notify();
    });

    lobby.addEventListener("peer-left", (e) => {
      const leftRole = this.roles.get(e.detail.peerId);
      this.roles.delete(e.detail.peerId);
      this.names.delete(e.detail.peerId);
      if (leftRole === "O") {
        const spectator = [...this.roles.entries()].find(([, r]) => r === "spectator");
        if (spectator) this.roles.set(spectator[0], "O");
      }
      this._broadcastState();
      this._notify();
    });

    lobby.addEventListener("data", (e) => {
      const msg = e.detail.data;
      if (!msg) return;
      if (msg.type === "hello") {
        this.names.set(e.detail.peerId, (msg.name || "").trim() || "Guest");
        this._broadcastState();
        this._notify();
      } else if (msg.type === "move") {
        this._applyMoveAsHost(e.detail.peerId, msg.index);
      } else if (msg.type === "restart") {
        this.state = freshBoardState();
        this._broadcastState();
        this._notify();
      }
    });

    this.connected = true;
  }

  _attachAsClient(lobby, roomId) {
    this.lobby = lobby;
    this.roomId = roomId;

    lobby.addEventListener("data", (e) => {
      const msg = e.detail.data;
      if (!msg) return;
      if (msg.type === "state") {
        this.state = {
          board: msg.state.board,
          turn: msg.state.turn,
          winner: msg.state.winner,
          winLine: msg.state.winLine,
          xMoves: msg.state.xMoves || [],
          oMoves: msg.state.oMoves || [],
        };
        this.role = msg.yourRole;
        this.hostName = msg.hostName;
        this._oName = msg.oName;
        this._spectatorCount = msg.spectatorCount;
        this._notify();
      }
    });

    lobby.addEventListener("host-left", () => {
      this.connected = false;
      this._notify();
    });

    lobby.send({ type: "hello", name: this.playerName });
    this.connected = true;
  }

  _applyMoveAsHost(peerId, index) {
    const moverRole = peerId ? this.roles.get(peerId) : "X";
    this._applyMove(index, moverRole);
  }

  _applyMove(index, moverRole) {
    if (!moverRole || moverRole === "spectator") return;
    if (this.state.winner) return;
    if (this.state.turn !== moverRole) return;
    if (this.state.board[index]) return;

    const moves = moverRole === "X" ? this.state.xMoves : this.state.oMoves;
    if (moves.length >= MAX_MARKS) {
      const oldest = moves.shift();
      this.state.board[oldest] = null;
    }
    this.state.board[index] = moverRole;
    moves.push(index);

    const { winner, line } = checkWinner(this.state.board);
    this.state.winner = winner;
    this.state.winLine = line;
    if (!winner) this.state.turn = moverRole === "X" ? "O" : "X";

    this._broadcastState();
    this._notify();
  }

  _broadcastState() {
    if (!this.isHost) return;
    const spectatorCount = [...this.roles.values()].filter((r) => r === "spectator").length;
    const oName = this._nameFor(this._oPeerId());
    this.lobby.connections.forEach((conn, peerId) => {
      const yourRole = this.roles.get(peerId) || "spectator";
      conn.send({
        type: "state",
        state: {
          board: this.state.board,
          turn: this.state.turn,
          winner: this.state.winner,
          winLine: this.state.winLine,
          xMoves: this.state.xMoves,
          oMoves: this.state.oMoves,
        },
        yourRole,
        hostName: this.hostName,
        oName,
        spectatorCount,
      });
    });
  }

  move(index) {
    if (this.isHost) {
      this._applyMove(index, this.role);
    } else if (this.lobby) {
      this.lobby.send({ type: "move", index });
    }
  }

  restart() {
    if (this.isHost) {
      this.state = freshBoardState();
      this._broadcastState();
      this._notify();
    } else if (this.lobby) {
      this.lobby.send({ type: "restart" });
    }
  }
}

export const arcadeSession = new ArcadeSessionImpl();
