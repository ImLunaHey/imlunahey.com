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
const DEFAULT_COLOR = '#6aeaa0';

type Tile = readonly [number, number];
type Facing = 'N' | 'S' | 'E' | 'W';

type PeerState = {
  id: string;
  nickname: string;
  color: string;
  tile: Tile;
  facing: Facing;
};

type Attachment = PeerState & { helloed: boolean };

type ClientMsg =
  | { t: 'hello'; nickname?: unknown; color?: unknown }
  | { t: 'walk'; from?: unknown; path?: unknown }
  | { t: 'chat'; text?: unknown };

type ServerMsg =
  | { t: 'init'; selfId: string; peers: PeerState[] }
  | { t: 'join'; peer: PeerState }
  | { t: 'walk'; id: string; from: Tile; path: Tile[]; at: number }
  | { t: 'chat'; id: string; text: string; at: number }
  | { t: 'leave'; id: string };

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

function safeColor(s: unknown): string {
  if (typeof s !== 'string') return DEFAULT_COLOR;
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : DEFAULT_COLOR;
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
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const att: Attachment = {
      id: crypto.randomUUID(),
      nickname: 'anon',
      color: DEFAULT_COLOR,
      tile: DEFAULT_TILE,
      facing: 'S',
      helloed: false,
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
        att.color = safeColor(parsed.color);
        att.helloed = true;
        ws.serializeAttachment(att);
        const peers = this.peerList(ws);
        this.sendTo(ws, { t: 'init', selfId: att.id, peers });
        this.broadcastExcept(ws, { t: 'join', peer: this.peerStateOf(att) });
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
        ws.serializeAttachment(att);
        this.broadcastExcept(ws, { t: 'walk', id: att.id, from, path, at: Date.now() });
        break;
      }
      case 'chat': {
        if (!att.helloed) return;
        const text = safeChat(parsed.text);
        if (!text) return;
        this.broadcastExcept(ws, { t: 'chat', id: att.id, text, at: Date.now() });
        break;
      }
    }
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
      color: att.color,
      tile: att.tile,
      facing: att.facing,
    };
  }

  private peerList(except: WebSocket): PeerState[] {
    const out: PeerState[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.helloed) out.push(this.peerStateOf(a));
    }
    return out;
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
}

function inferFacing(to: Tile, from: Tile): Facing | null {
  if (to[0] > from[0]) return 'E';
  if (to[0] < from[0]) return 'W';
  if (to[1] > from[1]) return 'S';
  if (to[1] < from[1]) return 'N';
  return null;
}
