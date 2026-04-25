# Atrium roadmap

`/labs/atrium` — isometric pixel-art hangout. v1 is the solo single-room
walker that's already shipped. Everything below is deferred work.

## v1 — solo room (shipped)

- [x] 2:1 dimetric canvas2d renderer with depth-sorted painter's algorithm
- [x] 10×10 floor + two back walls
- [x] Procedural furniture (chair, table, plant, lamp, crate, rug) drawn
      from composed iso-boxes — no sprite assets
- [x] Procedurally-drawn avatar (body + head iso-boxes)
- [x] Click-to-walk with A* pathfinding around blocking furniture
- [x] Hover tile highlight (green for walkable, red for blocked)
- [x] Walk animation (sub-tile interp + height bob)

## v2 — multiplayer presence (shipped)

Goal: see other people walking around the same room in real time, with
chat speech bubbles. No persistence yet — purely ephemeral.

- [x] **AtriumDO** at `src/server/atrium-do.ts` — one DO instance per
      room (currently a single `global-v1` room), uses Cloudflare's
      hibernatable websocket API so the DO can suspend while connections
      are idle. Per-WS state lives in `serializeAttachment` so it
      survives hibernation cycles.
- [x] **Wire protocol** (JSON, both directions). Client → server:
      `{t:'hello', nickname, color}`, `{t:'walk', from, path}`,
      `{t:'chat', text}`. Server → client: `{t:'init', selfId, peers}`,
      `{t:'join', peer}`, `{t:'walk', id, from, path, at}`,
      `{t:'chat', id, text, at}`, `{t:'leave', id}`. Sender doesn't
      receive its own walks/chats back (handled optimistically client-side).
      Inputs validated server-side (tile bounds, path length cap, color
      regex, nickname/chat control-char strip).
- [x] **Worker integration** — websocket upgrade intercepted in
      `src/worker.ts` BEFORE TanStack's serverEntry sees it (the runtime
      strips the `webSocket` field from Response init that CF needs for
      the 101 upgrade). DO binding + v2 migration added to
      `wrangler.jsonc`.
- [x] **Client websocket** — separate `useEffect` opens ws, sends
      `hello`, dispatches incoming messages. Reconnect with exponential
      backoff (1s → 30s) on close. Click handler now sends `walk` after
      updating local state optimistically.
- [x] **Remote avatars** — `Peer` type extends `Avatar`, every peer is
      walked through the same `advanceWalk` interpolator the local
      avatar uses. Server-sent `at` timestamp lets us start the
      interpolation slightly in the past to compensate for latency.
      Drawn with the peer's own color via the extended `drawAvatar`.
- [x] **Identity** — nickname stored in `localStorage`
      (`atrium-nickname`), randomly minted on first visit
      (`adjective-noun` pattern, e.g. `cosy-lemur`). Body color
      deterministically derived from nickname via djb2 hash → HSL.
- [x] **Speech bubbles + nickname labels** — DOM overlay layer per
      avatar, position updated every frame via direct
      `style.transform = translate(x, y)` (no React re-renders during
      walks). Bubble shows on chat receive, auto-clears after 5s.
- [x] **Connection status badge** — top-left of canvas, shows
      `connecting…` / `connected · N peers` / `reconnecting…` with a
      coloured pulse dot.

Ship criteria: open the page in two browser tabs, see both avatars walk
around the same room, exchange chat messages. ✓

## v3 — atproto persistence

Goal: your avatar appearance and furniture inventory follow you across
devices. Identity = your atproto did.

- [ ] **OAuth sign-in** using the existing `lib/oauth.ts` (same flow
      whtwnd / pdf-uploader / list-cleaner already use). Guest mode
      stays available — sign-in is opt-in to unlock customization.
- [ ] **Custom lexicon: `com.imlunahey.atrium.figure`** — a single
      record-per-user holding avatar style choices: body color, head
      color, hat (later), shirt (later), pants (later). Read on join,
      written on save.
- [ ] **Custom lexicon: `com.imlunahey.atrium.furniture`** — one record
      per owned furniture item: kind, color, optional name. Inventory
      is the user's collection of these records.
- [ ] **Lexicon publish script** — add a new entry to
      `scripts/lexicons-publish.ts` so the schemas live on
      `com.imlunahey.atrium.*` paths the way our other lexicons do.
- [ ] **Avatar customization UI** — small panel: pick body color,
      head color. Save → write the figure record. Loads on next visit.
- [ ] **Persistent presence color** — your avatar shows up in the same
      colors for everyone in the room.

Ship criteria: customize your avatar, sign out, sign in on another
device, your avatar matches.

## v4+ — depth

Once v2 + v3 are solid, the door opens to a long tail of features.

- [ ] **Multiple rooms** — portal tiles that warp you to a different
      room id. URL becomes `/labs/atrium/<roomId>`. A "lobby" room
      lists active public rooms.
- [ ] **Room editor** — click-drag to place / remove furniture from
      your inventory in a room you own. Persisted as a per-room layout
      record.
- [ ] **Friends from bsky follows** — your bluesky follow graph
      becomes your atrium friends list. Show "X is in room Y" presence
      indicators when friends are online.
- [ ] **Catalogue** — browse + acquire furniture items. v1 is just a
      "freebie" catalogue; later, perhaps an actual currency system.
- [ ] **Nicer avatar art** — the moment identity matters, art matters
      too. Hand-draw a small modular sprite set in Aseprite (1 body × 4
      hairs × 4 shirts × 4 pants × 4 directions ≈ 30 sprites) and
      runtime-recolor via HSL shift for variety.
- [ ] **Walk-to-sit** — clicking a chair walks the avatar to the tile
      next to it and snaps them into a sitting pose.
- [ ] **Emotes** — short canvas animations (wave, dance, sleep)
      triggered by chat commands like `/wave`.

## Notes / decisions log

- **Procedural-only furniture is a permanent v1+ choice**, not a
  placeholder for "real" art. The geometric look fits the site's CRT
  aesthetic. Avatar art is the only place where hand-drawn sprites
  earn their keep (v4+ task above).
- **Cloudflare DO over generic websocket** because the rest of the
  site already deploys to Workers — no new infra to operate.
- **Per-room DO, not global DO** — sharding by room scales naturally
  and isolates blast radius if one room goes wrong.
- **Atproto identity, not a custom user table** — the whole site
  already runs on atproto. Adding a separate auth system would be
  the wrong kind of feature creep.
