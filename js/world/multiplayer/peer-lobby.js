// Thin lobby wrapper over PeerJS (window.Peer, loaded as a classic script in
// index.html before this module runs). PeerJS's free public broker is only
// used to exchange WebRTC connection info ("signaling") — actual game data
// travels peer-to-peer once connected, so no server of ours is involved.
//
// Model: whoever hosts runs the authoritative game state. Joiners send
// "intents" (e.g. a move) to the host; the host validates and broadcasts the
// resulting state to everyone. Up to `maxPeers` total participants per lobby
// (host included).

const ID_PREFIX = "siva-arcade-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function randomCode(length = 4) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export class PeerLobby extends EventTarget {
  constructor({ maxPeers = 4 } = {}) {
    super();
    this.maxPeers = maxPeers;
    this.peer = null;
    this.isHost = false;
    this.code = null;
    this.connections = new Map(); // peerId -> DataConnection (host only)
    this.hostConnection = null; // client only
    this.closed = false;
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  get peerCount() {
    return this.isHost ? this.connections.size + 1 : this.connections.size ? 2 : 1;
  }

  // Pass `code` to claim a specific, known room id (used by the
  // auto-discovery pool); omit it to get a random one (manual hosting).
  async hostLobby(code) {
    if (typeof window.Peer !== "function") {
      throw new Error("PeerJS failed to load — multiplayer is unavailable.");
    }
    this.isHost = true;
    this.code = code || randomCode();
    this.peer = new window.Peer(ID_PREFIX + this.code, { debug: 0 });

    return new Promise((resolve, reject) => {
      const onOpen = () => {
        this.peer.on("connection", (conn) => this._acceptConnection(conn));
        resolve(this.code);
      };
      this.peer.once("open", onOpen);
      this.peer.once("error", (err) => {
        this._emit("error", { message: this._friendlyError(err) });
        reject(err);
      });
    });
  }

  _acceptConnection(conn) {
    if (this.connections.size >= this.maxPeers - 1) {
      conn.on("open", () => {
        conn.send({ type: "__lobby_full__" });
        setTimeout(() => conn.close(), 200);
      });
      return;
    }
    conn.on("open", () => {
      this.connections.set(conn.peer, conn);
      this._emit("peer-joined", { peerId: conn.peer, count: this.peerCount });
    });
    conn.on("data", (data) => {
      this._emit("data", { peerId: conn.peer, data });
    });
    conn.on("close", () => {
      this.connections.delete(conn.peer);
      this._emit("peer-left", { peerId: conn.peer, count: this.peerCount });
    });
  }

  async joinLobby(code) {
    if (typeof window.Peer !== "function") {
      throw new Error("PeerJS failed to load — multiplayer is unavailable.");
    }
    this.isHost = false;
    this.code = code.trim();
    this.peer = new window.Peer({ debug: 0 });

    return new Promise((resolve, reject) => {
      this.peer.once("open", () => {
        const conn = this.peer.connect(ID_PREFIX + this.code, { reliable: true });
        this.hostConnection = conn;

        const timeout = setTimeout(() => {
          reject(new Error("No response from that lobby code — check it and try again."));
        }, 8000);

        conn.once("open", () => {
          clearTimeout(timeout);
          resolve();
        });
        conn.on("data", (data) => {
          if (data && data.type === "__lobby_full__") {
            this._emit("error", { message: "That lobby is full (4/4)." });
            this.close();
            return;
          }
          this._emit("data", { peerId: conn.peer, data });
        });
        conn.on("close", () => {
          this._emit("host-left", {});
        });
        conn.once("error", (err) => {
          clearTimeout(timeout);
          reject(new Error(this._friendlyError(err)));
        });
      });
      this.peer.once("error", (err) => {
        this._emit("error", { message: this._friendlyError(err) });
        reject(err);
      });
    });
  }

  // Host: broadcast to every connected peer. Client: send to the host.
  send(data) {
    if (this.isHost) {
      this.connections.forEach((conn) => conn.send(data));
    } else if (this.hostConnection) {
      this.hostConnection.send(data);
    }
  }

  _friendlyError(err) {
    const type = err && err.type;
    if (type === "peer-unavailable") return "That lobby code doesn't exist.";
    if (type === "network" || type === "server-error" || type === "socket-error") {
      return "Couldn't reach the multiplayer service — check your connection and try again.";
    }
    return "Something went wrong setting up multiplayer.";
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    if (this.hostConnection) this.hostConnection.close();
    if (this.peer) this.peer.destroy();
  }
}
