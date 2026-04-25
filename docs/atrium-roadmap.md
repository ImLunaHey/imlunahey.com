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

## v2 — multiplayer presence

Goal: see other people walking around the same room in real time, with
chat speech bubbles. No persistence yet — purely ephemeral.

- [ ] **Cloudflare durable object** as the room's authoritative state.
      One DO per room id; clients connect via websocket. The worker
      already exists at `src/worker.ts`, so adding a DO export + binding
      in `wrangler.jsonc` is the integration point.
- [ ] **Wire protocol** — small JSON messages: `{type:'join', avatar}`,
      `{type:'walk', path}`, `{type:'chat', text}`, `{type:'leave'}`.
      Server broadcasts state diffs back to every connected client.
- [ ] **Client websocket** — open in `Atrium.tsx`'s effect, reconcile
      remote avatars into the render loop. Each remote avatar uses the
      same `drawAvatar` primitive but with a different color.
- [ ] **Speech bubbles** — chat input pinned to the bottom of the canvas;
      message renders as a CSS bubble anchored to the speaker's screen
      position for ~5s. Word-wrap, max ~80 chars.
- [ ] **Identity** — at first just an anonymous nickname stored in
      localStorage. Atproto identity gets wired in v3.
- [ ] **Smooth interp for remote avatars** — server sends path; client
      reproduces the same step interpolation locally so movement looks
      natural even at low message rates.
- [ ] **Heartbeat / disconnect** — drop avatars after 30s of silence to
      handle dead clients without explicit leave.

Ship criteria: open the page in two browser tabs, see both avatars walk
around the same room, exchange chat messages.

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
