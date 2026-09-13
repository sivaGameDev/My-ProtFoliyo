// A single shared, site-wide racing session — same auto-discovery pattern as
// the tic-tac-toe arcade (join the first room with space, host the first
// empty one), but with its own separate room-id pool so the two features
// never collide with each other. Unlike the arcade, this only connects when
// a player actually opens the racing panel (not on site load), so visitors
// who never race don't pick up a second background peer connection.
//
// Networking model: every peer runs its own car physics locally (for
// responsive, lag-free driving) and sends its transform to the host at a
// throttled ~10Hz tick; the host relays every player's latest transform to
// everyone, itself included, on the same tick. The host is a relay hub, not
// an authoritative physics simulator — full server-validated physics is out
// of scope for this demo-level arcade racer with no real backend to check
// against.

import { PeerLobby } from "./peer-lobby.js";

const ROOM_IDS = ["race-1", "race-2", "race-3", "race-4", "race-5"];
const JOIN_TIMEOUT = 5000;
const BROADCAST_INTERVAL = 100;
const CAR_COLORS = [0xffffff, 0xd8dee6, 0xb8c2cc, 0xeceff1]; // bright white/silver, one shade per driver

function freshTransform() {
  return { x: 0, z: 0, heading: 0, speed: 0 };
}

class RacingSessionImpl {
  constructor() {
    this.lobby = null;
    this.roomId = null;
    this.playerName = "Guest";
    this.players = new Map(); // "host" | peerId -> { name, color, x, z, heading, speed }
    this.names = new Map(); // host only: peerId -> display name
    this.colors = new Map(); // host only: peerId -> assigned color
    this._myId = null; // client only: our own peerId, learned from the host's last "state" message
    this.listeners = new Set();
    this.connected = false;
    this.connecting = false;
    this._lastBroadcast = 0;
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  _notify() {
    this.listeners.forEach((cb) => cb(this.getSnapshot()));
  }

  get isHost() {
    return this.lobby && this.lobby.isHost;
  }

  getSnapshot() {
    const selfKey = this.isHost ? "host" : this._myId;
    return {
      connected: this.connected,
      connecting: this.connecting,
      roomId: this.roomId,
      players: [...this.players.entries()].map(([id, p]) => ({ id, ...p, isYou: id === selfKey })),
    };
  }

  async connect({ name, onStatus } = {}) {
    this.playerName = (name || "").trim() || "Guest";
    this.connecting = true;
    this._notify();

    for (const roomId of ROOM_IDS) {
      onStatus && onStatus(`Searching for an open circuit (${roomId})…`);
      try {
        const lobby = new PeerLobby({ maxPeers: 4 });
        await this._tryJoin(lobby, roomId);
        this._attachAsClient(lobby, roomId);
        onStatus && onStatus(`Joined a live race in ${roomId}.`);
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
            onStatus && onStatus(`Hosting a new circuit (${roomId}).`);
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

    onStatus && onStatus("The racing arena is full right now — try again later.");
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
    this.players.set("host", { name: this.playerName, color: CAR_COLORS[0], ...freshTransform() });

    lobby.addEventListener("peer-joined", (e) => {
      const used = new Set([CAR_COLORS[0], ...this.colors.values()]); // CAR_COLORS[0] is always the host's own color
      const color = CAR_COLORS.find((c) => !used.has(c)) || CAR_COLORS[(this.colors.size + 1) % CAR_COLORS.length];
      this.colors.set(e.detail.peerId, color);
    });

    lobby.addEventListener("peer-left", (e) => {
      this.colors.delete(e.detail.peerId);
      this.names.delete(e.detail.peerId);
      this.players.delete(e.detail.peerId);
      this._broadcastState();
      this._notify();
    });

    lobby.addEventListener("data", (e) => {
      const msg = e.detail.data;
      if (!msg) return;
      if (msg.type === "hello") {
        this.names.set(e.detail.peerId, (msg.name || "").trim() || "Guest");
        this.players.set(e.detail.peerId, {
          name: this.names.get(e.detail.peerId),
          color: this.colors.get(e.detail.peerId) || CAR_COLORS[0],
          ...freshTransform(),
        });
        this._broadcastState();
        this._notify();
      } else if (msg.type === "transform") {
        const existing = this.players.get(e.detail.peerId);
        if (!existing) return;
        existing.x = msg.x;
        existing.z = msg.z;
        existing.heading = msg.heading;
        existing.speed = msg.speed;
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
        this._myId = msg.yourId;
        this.players = new Map(msg.players.map((p) => [p.id, p]));
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

  // Called every frame by the racing view with the local car's current
  // transform; the actual network send is throttled internally.
  updateSelf(transform) {
    if (this.isHost) {
      const self = this.players.get("host");
      if (self) Object.assign(self, transform);
    }

    const now = performance.now();
    if (now - this._lastBroadcast < BROADCAST_INTERVAL) return;
    this._lastBroadcast = now;

    if (this.isHost) {
      this._broadcastState();
    } else if (this.lobby) {
      this.lobby.send({ type: "transform", ...transform });
    }
    this._notify();
  }

  _broadcastState() {
    if (!this.isHost) return;
    const allPlayers = [...this.players.entries()].map(([id, p]) => ({ id, ...p }));
    this.lobby.connections.forEach((conn, peerId) => {
      conn.send({ type: "state", yourId: peerId, players: allPlayers });
    });
  }

  disconnect() {
    if (this.lobby) this.lobby.close();
    this.lobby = null;
    this.connected = false;
    this.connecting = false;
    this.players.clear();
    this.names.clear();
    this.colors.clear();
    this._myId = null;
    this._notify();
  }
}

export const racingSession = new RacingSessionImpl();
