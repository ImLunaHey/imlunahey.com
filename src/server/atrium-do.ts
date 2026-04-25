import { DurableObject } from 'cloudflare:workers';

/**
 * AtriumDO — one instance per atrium room, holding the live websocket
 * conversation between every client currently in that room.
 *
 * Uses Cloudflare's hibernatable websocket API: the DO can suspend while
 * connections are idle and is woken on incoming messages. Per-WS state
 * lives in `serializeAttachment` so it survives hibernation cycles.
 *
 * Wire protocol (JSON, both directions):
 *
 *   client → server:
 *     { t: 'hello', nickname, color }
 *     { t: 'walk',  from, path }
 *     { t: 'chat',  text }
 *
 *   server → client:
 *     { t: 'init',  selfId, peers }   (sent in response to hello)
 *     { t: 'join',  peer }            (broadcast to OTHERS when a peer joins)
 *     { t: 'walk',  id, from, path, at }
 *     { t: 'chat',  id, text, at }
 *     { t: 'leave', id }
 *
 *  `at` is server's `Date.now()` so clients can latency-compensate the
 *  remote walk start time.
 */

const ROOM_SIZE = 10;
const MAX_NICK = 24;
const MAX_CHAT = 200;
const MAX_PATH = 64;
const DEFAULT_TILE: Tile = [5, 5];
const DEFAULT_BODY_COLOR = '#6aeaa0';
const DEFAULT_HEAD_COLOR = '#f3d7b0';

type Tile = readonly [number, number];
type Facing = 'N' | 'S' | 'E' | 'W';

type PeerState = {
  id: string;
  nickname: string;
  bodyColor: string;
  headColor: string;
  tile: Tile;
  facing: Facing;
  /** When set, this peer is sitting on the chair at this tile and should
   *  be rendered there (slightly smaller, on the chair seat) instead of
   *  at `tile` (which is the adjacent walkable tile they walked to). */
  sitting: Tile | null;
};

type Attachment = PeerState & {
  helloed: boolean;
  /** Stable per-identity id used to dedupe sessions: the user's did when
   *  signed in, otherwise a per-browser id from localStorage. Defaults to
   *  the per-ws random id, which makes every connection its own identity
   *  (i.e. dedup is a no-op for clients that don't send a clientId). */
  clientId: string;
  /** The room this DO instance represents. Set from the upgrade URL on
   *  accept and copied into every attachment so D1 writes from
   *  webSocketMessage handlers (which fire on hibernation wake without
   *  a fresh fetch context) know which room to persist under. */
  roomId: string;
};

/** Persistent atrium row in D1 (`atrium_state`). The DO is the only
 *  writer; clients read indirectly via the `you` field of `init`. */
type SavedState = {
  currentRoom: string;
  position: { tile: Tile; sitting: Tile | null } | null;
};

type ClientMsg =
  | { t: 'hello'; nickname?: unknown; bodyColor?: unknown; headColor?: unknown; clientId?: unknown }
  | { t: 'walk'; from?: unknown; path?: unknown }
  | { t: 'chat'; text?: unknown }
  | { t: 'style'; bodyColor?: unknown; headColor?: unknown }
  | { t: 'sit'; tile?: unknown }
  | { t: 'emote'; kind?: unknown };

type ServerMsg =
  | { t: 'init'; selfId: string; peers: PeerState[]; you: SavedState | null }
  | { t: 'join'; peer: PeerState }
  | { t: 'walk'; id: string; from: Tile; path: Tile[]; at: number }
  | { t: 'chat'; id: string; text: string; at: number }
  | { t: 'style'; id: string; bodyColor: string; headColor: string }
  | { t: 'sit'; id: string; tile: Tile | null }
  | { t: 'emote'; id: string; kind: string; at: number }
  | { t: 'leave'; id: string };

const EMOTE_KINDS = ['wave', 'dance', 'jump'] as const;

function isTile(x: unknown): x is Tile {
  return (
    Array.isArray(x) &&
    x.length === 2 &&
    Number.isInteger(x[0]) &&
    Number.isInteger(x[1]) &&
    x[0] >= 0 &&
    x[0] < ROOM_SIZE &&
    x[1] >= 0 &&
    x[1] < ROOM_SIZE
  );
}

/** Drop ASCII control chars (U+0000–U+001F and DEL) from untrusted text
 *  before it leaves the server. Done by char iteration to avoid the
 *  no-control-regex lint rule, which here would be flagging exactly the
 *  thing we mean to do. */
function stripControl(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x20 && c !== 0x7f) out += s[i];
  }
  return out;
}

function safeNick(s: unknown): string {
  if (typeof s !== 'string') return 'anon';
  const cleaned = stripControl(s).replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, MAX_NICK) || 'anon';
}

function safeColor(s: unknown, fallback: string): string {
  if (typeof s !== 'string') return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

function safeChat(s: unknown): string {
  if (typeof s !== 'string') return '';
  return stripControl(s).trim().slice(0, MAX_CHAT);
}

export class AtriumDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const url = new URL(request.url);
    const roomId = (url.searchParams.get('room') ?? '').toLowerCase() || 'lobby';
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const id = crypto.randomUUID();
    const att: Attachment = {
      id,
      nickname: 'anon',
      bodyColor: DEFAULT_BODY_COLOR,
      headColor: DEFAULT_HEAD_COLOR,
      tile: DEFAULT_TILE,
      facing: 'S',
      sitting: null,
      helloed: false,
      clientId: id, // safe default: each connection is its own identity until hello says otherwise
      roomId,
    };
    server.serializeAttachment(att);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return;
    let parsed: ClientMsg;
    try {
      parsed = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object' || typeof parsed.t !== 'string') return;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;

    switch (parsed.t) {
      case 'hello': {
        att.nickname = safeNick(parsed.nickname);
        att.bodyColor = safeColor(parsed.bodyColor, DEFAULT_BODY_COLOR);
        att.headColor = safeColor(parsed.headColor, DEFAULT_HEAD_COLOR);
        att.helloed = true;
        if (typeof parsed.clientId === 'string' && parsed.clientId.length > 0 && parsed.clientId.length <= 200) {
          att.clientId = parsed.clientId;
        }
        // Load this user's previous saved state from D1 BEFORE we
        // overwrite their attachment tile/sitting — if they were last
        // in this same room the client should respawn them at the
        // saved tile (refresh case).
        const saved = await this.loadSavedState(att.clientId);
        if (saved && saved.currentRoom === att.roomId && saved.position) {
          att.tile = saved.position.tile;
          att.sitting = saved.position.sitting;
        }
        ws.serializeAttachment(att);
        // Persist the user's current room (D1 reflects "where this user
        // is right now"). Tile + sitting follow whatever the client's
        // walk/sit messages establish, so write them with the att values
        // we just settled on.
        await this.saveCurrentState(att);
        // Habbo-style dedup: a fresh hello with a clientId we already
        // recognise displaces the older session.
        for (const other of this.ctx.getWebSockets()) {
          if (other === ws) continue;
          const oa = other.deserializeAttachment() as Attachment | null;
          if (!oa?.helloed) continue;
          if (oa.clientId !== att.clientId) continue;
          try {
            other.close(4001, 'displaced by newer session');
          } catch {
            /* ignore — the close handler will cleanup either way */
          }
        }
        // build init excluding any sibling tab from the same identity
        // (close() is async-ish, so the displaced socket might still be
        // in getWebSockets() for a moment).
        const peers: PeerState[] = [];
        for (const other of this.ctx.getWebSockets()) {
          if (other === ws) continue;
          const oa = other.deserializeAttachment() as Attachment | null;
          if (!oa?.helloed) continue;
          if (oa.clientId === att.clientId) continue;
          peers.push(this.peerStateOf(oa));
        }
        this.sendTo(ws, { t: 'init', selfId: att.id, peers, you: saved });
        this.broadcastExcept(ws, { t: 'join', peer: this.peerStateOf(att) });
        break;
      }
      case 'style': {
        if (!att.helloed) return;
        att.bodyColor = safeColor(parsed.bodyColor, att.bodyColor);
        att.headColor = safeColor(parsed.headColor, att.headColor);
        ws.serializeAttachment(att);
        this.broadcastExcept(ws, {
          t: 'style',
          id: att.id,
          bodyColor: att.bodyColor,
          headColor: att.headColor,
        });
        break;
      }
      case 'walk': {
        if (!att.helloed) return;
        if (!isTile(parsed.from) || !Array.isArray(parsed.path)) return;
        if (parsed.path.length === 0 || parsed.path.length > MAX_PATH) return;
        for (const t of parsed.path) if (!isTile(t)) return;
        const from = parsed.from as Tile;
        const path = parsed.path as Tile[];
        att.tile = path[path.length - 1];
        att.facing = inferFacing(path[path.length - 1], path.length >= 2 ? path[path.length - 2] : from) ?? att.facing;
        // walking implicitly stands the avatar up — keep server state honest
        att.sitting = null;
        ws.serializeAttachment(att);
        this.broadcastExcept(ws, { t: 'walk', id: att.id, from, path, at: Date.now() });
        // Fire-and-forget D1 write — don't make the broadcast wait on
        // an edge round-trip; failures here just mean the next
        // walk/sit will try again.
        void this.saveCurrentState(att).catch(() => {});
        break;
      }
      case 'chat': {
        if (!att.helloed) return;
        const text = safeChat(parsed.text);
        if (!text) return;
        this.broadcastExcept(ws, { t: 'chat', id: att.id, text, at: Date.now() });
        break;
      }
      case 'sit': {
        if (!att.helloed) return;
        const tile: Tile | null = isTile(parsed.tile) ? (parsed.tile as Tile) : null;
        att.sitting = tile;
        ws.serializeAttachment(att);
        this.broadcastExcept(ws, { t: 'sit', id: att.id, tile });
        void this.saveCurrentState(att).catch(() => {});
        break;
      }
      case 'emote': {
        if (!att.helloed) return;
        if (typeof parsed.kind !== 'string') return;
        if (!(EMOTE_KINDS as readonly string[]).includes(parsed.kind)) return;
        // ephemeral — no state stored, just broadcast
        this.broadcastExcept(ws, { t: 'emote', id: att.id, kind: parsed.kind, at: Date.now() });
        break;
      }
    }
  }

  /** RPC: how many helloed peers are currently in this room. The
   *  navigator UI calls this for every public room every few seconds.
   *  Cheaper than opening a probe websocket. */
  async getOccupancy(): Promise<number> {
    let n = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.helloed) n += 1;
    }
    return n;
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket): void {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.helloed) return;
    this.broadcastExcept(ws, { t: 'leave', id: att.id });
  }

  private peerStateOf(att: Attachment): PeerState {
    return {
      id: att.id,
      nickname: att.nickname,
      bodyColor: att.bodyColor,
      headColor: att.headColor,
      tile: att.tile,
      facing: att.facing,
      sitting: att.sitting,
    };
  }

  private sendTo(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // peer is gone; cleanup happens via webSocketClose
    }
  }

  private broadcastExcept(except: WebSocket, msg: ServerMsg): void {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(s);
      } catch {
        // ignore per-peer send failures
      }
    }
  }

  // --- D1 persistence ----------------------------------------------------
  // The DO is the only writer to atrium_state. Clients see persisted
  // state via the `you` field on `init`; everything else flows through
  // the existing walk/sit messages, which we mirror to D1 fire-and-forget.

  private async loadSavedState(clientId: string): Promise<SavedState | null> {
    if (!clientId) return null;
    try {
      const row = await this.env.ATRIUM_DB
        .prepare('SELECT current_room, position_json FROM atrium_state WHERE user_id = ?')
        .bind(`guest:${clientId}`)
        .first<{ current_room: string; position_json: string | null }>();
      if (!row) return null;
      let position: SavedState['position'] = null;
      if (row.position_json) {
        try {
          const parsed = JSON.parse(row.position_json) as { tile?: unknown; sitting?: unknown };
          if (isTile(parsed.tile)) {
            const sitting = isTile(parsed.sitting) ? (parsed.sitting as Tile) : null;
            position = { tile: parsed.tile as Tile, sitting };
          }
        } catch {
          /* corrupted blob — ignore */
        }
      }
      return { currentRoom: row.current_room, position };
    } catch {
      // D1 outage / binding missing in dev — degrade gracefully to "no
      // saved state". The user just spawns at the centre instead of
      // their last spot; everything else still works.
      return null;
    }
  }

  private async saveCurrentState(att: Attachment): Promise<void> {
    if (!att.clientId) return;
    const position = { tile: att.tile, sitting: att.sitting };
    try {
      await this.env.ATRIUM_DB
        .prepare(`
          INSERT INTO atrium_state (user_id, current_room, previous_room, position_json, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            current_room  = excluded.current_room,
            position_json = excluded.position_json,
            updated_at    = excluded.updated_at
        `)
        .bind(
          `guest:${att.clientId}`,
          att.roomId,
          null,
          JSON.stringify(position),
          Date.now(),
        )
        .run();
    } catch {
      /* swallow — next walk/sit will retry */
    }
  }
}

function inferFacing(to: Tile, from: Tile): Facing | null {
  if (to[0] > from[0]) return 'E';
  if (to[0] < from[0]) return 'W';
  if (to[1] > from[1]) return 'S';
  if (to[1] < from[1]) return 'N';
  return null;
}
