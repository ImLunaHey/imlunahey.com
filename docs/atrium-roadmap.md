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

## v3 — atproto persistence (shipped)

Goal: your avatar appearance follows you across devices. Identity =
your atproto did.

- [x] **OAuth sign-in** in `Atrium.tsx` using the existing
      `lib/oauth.ts`. Guest mode stays available — sign-in is opt-in.
      `ATRIUM_FIGURE_SCOPE` requests create / update / delete on
      `com.imlunahey.atrium.figure`; `ATRIUM_FURNITURE_SCOPE` requests
      the same on the furniture collection (kept in `ALL_SCOPES` so the
      hosted client metadata advertises them, but only figure scope is
      actually requested at sign-in time today).
- [x] **Custom lexicon: `com.imlunahey.atrium.figure`** at
      `lexicons/com/imlunahey/atrium/figure.json`. `key: literal:self`
      so each user has exactly one figure record. Required:
      bodyColor, headColor, createdAt. Optional: updatedAt. Future
      revisions will add hair / shirt / pants / hat layers — clients
      should ignore unknown properties.
- [x] **Custom lexicon: `com.imlunahey.atrium.furniture`** at
      `lexicons/com/imlunahey/atrium/furniture.json`. `key: tid`,
      one record per owned item. The lexicon is defined now so the
      v4 catalogue + room editor can write against a stable schema
      from the start. No UI in v3.
- [x] **Lexicon publish script** picks the new files up automatically
      — the existing `scripts/lexicons-publish.ts` walks every json
      file under `lexicons/`, so no edits needed beyond adding the
      files.
- [x] **Wire protocol bumped** — `color` split into `bodyColor` +
      `headColor` everywhere (hello/init/join). New `style` message
      (both directions) lets a client update its colors mid-session
      without reconnecting; server validates each color via a hex
      regex with fallbacks.
- [x] **Avatar customization UI** — top-right identity panel shows
      `guest · <nickname>` + sign-in button when signed out, or
      `@handle` + edit/sign-out when signed in. "edit avatar" opens
      a floating panel with two `<input type="color">` widgets. Save
      → `putRecord(rkey: 'self')` to the user's PDS, then a `style`
      broadcast so the change propagates to peers immediately.
- [x] **Auto-load on mount** — `getCurrentSession()` runs in a separate
      effect; on hit it fetches the figure record via XRPC
      `com.atproto.repo.getRecord` and applies the stored colors.
      No-record-yet is treated as "user starts with derived colors",
      not an error. Handle resolution rides the existing
      `useProfile` hook (same one PdfUploader uses).
- [x] **Identity → nickname** — when the profile resolves, nickname
      switches from the guest `adjective-noun` to the user's handle.
      Force-closes the ws to trigger reconnect, so peers re-init with
      the new nickname (the protocol only broadcasts nicknames on
      hello, not on a `rename` op — the close+reconnect is the
      cheapest way to propagate it without adding a new message type).
- [x] **Sign-out path** — agent.signOut() falls back to
      deleteStoredSession on failure. Mints a fresh guest nickname so
      the next session looks distinct, and resets colors to the
      derived guest defaults.

Ship criteria: customize your avatar, sign out, sign in on another
device, your avatar matches. ✓

### v3.1 — single-session enforcement (shipped)

Two tabs of the same browser used to render two avatars with the same
nickname (each tab is a separate ws session). Habbo did the same thing
that fixes this: a fresh hello with a known identity displaces the older
session.

- [x] Hello carries a `clientId` — the user's did when signed in,
      otherwise a stable per-browser uuid stashed in localStorage. Two
      tabs of the same browser as a guest share the localStorage id;
      two tabs of any browser signed into the same account share the did.
- [x] Server scans `getWebSockets()` on every hello; any other helloed
      socket with a matching `clientId` gets `close(4001, 'displaced…')`.
      The kick happens before the new init/join, and `init` filters out
      same-`clientId` siblings explicitly so the new client never
      transiently sees a ghost of itself.
- [x] Client recognises close code `4001`, switches the status badge to
      `another tab took over` (orange dot), and suppresses the
      auto-reconnect. A "take over" button reopens the ws, which kicks
      whichever tab last claimed the identity. This naturally walks the
      session between tabs without infinite displacement loops because
      only the tab the user is actively clicking in re-hellos.

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
