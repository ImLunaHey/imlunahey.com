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

## v4 — multiple rooms (shipped)

Goal: stop being a single global room. Each room is its own DO instance,
URL routes match, navigator UI lets you hop between them.

- [x] **AtriumDO is now per-room** — the worker reads `?room=<id>` from
      the ws upgrade URL and uses it as the `idFromName` key, so each
      room is a fully isolated DO with its own peers + state. Bumped the
      worker.ts handler to validate the id (lowercase alnum + dash +
      underscore + dot, capped at 64 chars; falls back to `lobby`).
- [x] **Occupancy RPC + bulk endpoint** — added `getOccupancy()` to
      `AtriumDO` that walks `getWebSockets()` for helloed peers, and
      `/api/atrium-rooms?ids=lobby,cafe,garden` that fetches counts
      across N rooms in one request. Cheap navigator polling without
      opening a probe websocket per room.
- [x] **Routing** — converted `routes/_main/labs/atrium.tsx` to a
      folder with `index.tsx` (lobby, no roomId) + `$roomId.tsx`
      (everything else). Both render the same `AtriumPage` with
      `roomId` as a prop. The page reads the prop and passes it into
      the ws URL + theme lookup.
- [x] **Three pre-built public rooms** — `lobby` (phosphor green,
      default), `cafe` (amber-lit), `garden` (verdant). Each has its
      own floor + wall colour palette via the `THEMES` table. Theme is
      applied per-frame via a ref the render loop reads, so a room
      switch doesn't tear down the canvas effect.
- [x] **Custom rooms** — any URL like `/labs/atrium/<anything>` is a
      valid room. Defaults to the phosphor theme. The navigator shows a
      "currently · custom" row when the user is in a non-public room
      so they know it's not advertised.
- [x] **Navigator UI** — bottom-bar button shows `~/atrium/<room>`,
      click opens a small dropdown listing public rooms with live
      occupancy counts (polled every 5s). Each row is a TanStack Link;
      clicking it navigates without a full page reload — the ws
      effect's `[roomId]` deps fire, the old ws closes, the new ws
      opens to the new room's DO.
- [x] **Disabled `'displaced'` retry loop** — the dedup logic from
      v3.1 still applies cleanly because clientId is per-identity, not
      per-room. Walking between rooms doesn't displace yourself.

Ship criteria: open the page in two tabs, navigate one to `/cafe` and
one to `/garden`, see live occupancy counts on both, see only your
roommates in the canvas. ✓

## v5 — portal tiles (shipped)

Goal: walk-through doors instead of a dropdown. The navigator from v4
stays — portals just give the canvas an on-floor affordance for what
the URL already supports.

- [x] **`Portal` type + per-room `PORTALS` table** — `lobby` has two
      portals (south-east → café, south-west → garden); `cafe` and
      `garden` each have one back to the lobby. Tiles are at room-edge
      positions so they read visually as doors.
- [x] **Render** — pulsing tinted infill (in the destination room's
      wall colour, so you can read where you're going at a glance) +
      pulsing accent rim. Drawn between the rugs and the hover/sprites
      layers. Time read straight from `performance.now()` — no extra
      state.
- [x] **Arrival trigger** — fires only on the step-completion branch
      of `advanceWalk`, never on initial spawn. Avoids a bounce-loop
      where the avatar appears next to a portal in the destination room
      and immediately walks back. Combined with always respawning at
      `[5,5]` on `roomId` change for belt-and-braces.
- [x] **Hint integration** — clicking a portal sets the hint to
      "walking to → café (3 tiles)…"; arriving sets it to "warping to
      café…"; the hover state still uses the existing walkable / blocked
      colouring.
- [x] **Stable nav** — `useNavigate` from tanstack-router is stashed
      in a `navigateRef` so the long-lived tick callback can fire the
      navigation without React re-runs. `portalsRef` similarly so the
      tick reads the current room's portals each frame.

### v5.1 — per-room furniture (shipped)

The themes from v4 only changed floor + wall colors. Every room had the
same chairs/tables/rugs, which made the rooms feel like reskins of the
lobby. Per-room furniture layouts fix that.

- [x] Replaced the single `FURNITURE` constant with `ROOM_LAYOUTS:
      Record<string, Furniture[]>` plus a `DEFAULT_LAYOUT` for custom
      rooms (minimal so a fresh room doesn't look broken-empty).
- [x] **Lobby** kept its existing arrangement (chairs + tables NW,
      central rug, plants in two corners, lamp + crates).
- [x] **Café** is four bistro triplets (chair-table-chair) scattered
      around with warm-wood tones, two warm orange lamps on the
      side walls, and one central brown rug.
- [x] **Garden** has a plant border along the back + sides
      (alternating shades) with a small chair-table-chair seating
      cluster toward the front and a single accent lamp.
- [x] Every layout deliberately keeps `[5,5]` (spawn) and the room's
      portal tiles walkable.
- [x] Furniture + walkability live behind refs (`furnitureRef`,
      `walkableRef`) so the canvas effect doesn't tear down on a room
      change. The room-change effect swaps both refs synchronously
      before respawning the avatar, so the next click against the new
      walkable grid uses the right blockers.

## v6 — procedural identicon avatars (shipped)

Goal: stop avatars looking like identical colored rectangles, without
using any drawn or licensed asset packs. Pure deterministic rendering
keyed off the user's nickname.

- [x] **`identiconFor(seed)`** — djb2-ish hash on the user's nickname
      (handle when signed in, guest nickname otherwise) sliced into
      bit-fields: 8 eye styles, 8 mouth styles, 4 brow styles, 8 hair
      styles, hair colour from an 8-entry palette, face-feature colour
      from a 4-entry palette. Same nickname → same identicon, always.
- [x] **2D face features** — eyes / mouth / brows painted as small
      `ctx.fillRect` calls onto the head's south face (the face
      pointing at the viewer). Screen-space positions computed via
      bilinear interpolation of the four projected face corners, so
      features stay stuck to the head as the avatar walks/bobs.
- [x] **3D hair** — drawn as iso-box(es) on top of the head: flat top,
      tall hat, cap, spike, bow (two side-by-side boxes), pageboy
      (extends past head), antenna (thin tall + ball on top). Bald is
      a valid style (1 in 8). Composes naturally with the existing
      depth sort.
- [x] **No wire change** — identicons are computed locally on every
      client from the peer's nickname (which is already broadcast via
      hello/init/join). No new state to sync, no protocol bump.
- [x] **Self updates on rename** — `applyNickname` writes the new
      value into `stateRef.current.selfNickname` so the next render
      re-hashes; existing close+reconnect flow propagates the new name
      to peers.

Eye / mouth / brow / hair styles deliberately overlap visually in some
cases — that's fine. The point isn't that every distinct identity gets
a uniquely identifiable face, it's that two people are visually
distinguishable at a glance most of the time.

### v6.1 — labels on hover

The always-on nickname labels above every avatar partly covered the
new identicon faces. Hidden them by default; the tick computes which
avatar (if any) the cursor is over and fades that label in. Labels
also auto-show whenever a peer is mid-chat so you can see who's
speaking without having to hover them. Bubbles still always show
when chat lands.

Label transform also changed from `translate(-50%, 0)` to
`translate(-50%, -100%)` so when it does appear, it sits *above*
the anchor point — never overlapping the head.

## v7 — walk-to-sit + emotes (shipped)

Goal: stop atrium from being just a click-around chat box. Add verbs —
sit on chairs, wave/dance/jump.

- [x] **Walk-to-sit** — clicking a chair tile (which is non-walkable
      transit) routes A* to the closest walkable neighbour and remembers
      `sitOnArrival`. On step-completion the avatar snaps to a sitting
      pose: rendered AT the chair tile, body shrunk to 0.4 high sitting
      on the chair seat (z=0.5), head atop. Identicon stays — face +
      hair render the same in either pose.
- [x] **Stand-up implicit** — clicking any walkable tile while sitting
      first sends `{t:'sit', tile:null}` and clears local sitting state,
      then proceeds with the normal walk. The server also clears
      sitting on every walk message (so we never end up in a "walking
      while sitting" state even if a client misses the explicit sit
      clear).
- [x] **Wire bumps** — new `sit` (both directions): client sends
      `{t:'sit', tile|null}`, server broadcasts `{t:'sit', id, tile}`
      to others. New `emote` (both directions): client sends
      `{t:'emote', kind}`, server validates against the `wave/dance/jump`
      whitelist and broadcasts `{t:'emote', id, kind, at}` ephemerally.
      Init/join now carry `sitting` so a fresh client sees existing
      sitters in the right pose immediately.
- [x] **Three emotes triggered from chat** — typing `/wave`, `/dance`,
      or `/jump` in the chat input fires the emote locally + broadcasts;
      the chat is consumed (no bubble shown). Pure procedural canvas
      animations applied via `ctx.translate` around the avatar draw:
      `wave` sways side-to-side ~1.5s; `dance` bobs vertically + sways
      ~3s; `jump` is a single arc ~0.6s. Emote durations live in
      `EMOTE_DURATIONS` server-side validator + client renderer.
- [x] **Latency-compensated emote start** — server stamps `at` on the
      broadcast; receiver subtracts the latency from the local clock
      so two clients see the emote start at roughly the same wall time.
- [x] **AvatarDraw refactor** — `drawAvatar` now takes a config object
      (`{i, j, bob, bodyColor, headColor, seed, sitting}`) since the
      param list crossed the threshold of "more args than fingers".
      Cleaner for v8+ additions.

Verified end-to-end via two-client wire test: `sit` broadcasts the
tile to peers, `emote` broadcasts kind + at, init payloads carry
the `sitting` field. ✓

### v7.5 — persist previousRoom too — refresh spawns at entrance (shipped)

v7.4 only persisted the current room, so refresh restored the room
correctly but `previousRoomRef` was always null on cold mount and the
entrance-portal spawn fell through to the centre. Persist
`atrium-previous-room` alongside `atrium-current-room` and seed
`previousRoomRef` from it; effectively a refresh now behaves like a
portal walk into the current room — same spawn next to the entrance
portal you originally entered through.

Brand-new visitors still get null + centre spawn (no entrance to
spawn at). Same with deep links from outside the app on a fresh tab.

### v7.6 — server-side persistence in D1, written by the DO (shipped)

localStorage was never going to fix "I walked somewhere and refresh
puts me at the centre" because there's no `previousRoom` to consult
when nothing changed *between* rooms. Switched persistence to D1,
keyed by `guest:<clientId>`, written exclusively by `AtriumDO`.

- [x] D1 binding `ATRIUM_DB` declared in `wrangler.jsonc` with
      `database_name: atrium` and a placeholder `database_id` the
      operator fills in once via `wrangler d1 create atrium`. Migration
      lives at `migrations/atrium/0001_init.sql` creating
      `atrium_state(user_id PK, current_room, previous_room,
      position_json, updated_at)`.
- [x] `AtriumDO` is now the sole writer. It loads the user's previous
      saved state from D1 on `hello`, broadcasts it to the client in
      the new `init.you` field, and writes the user's current room +
      tile + sitting state on every `walk` and `sit` (fire-and-forget,
      so the broadcast doesn't wait on an edge round-trip).
- [x] Each attachment now carries `roomId` (read from the upgrade
      URL's `?room=` param) so the `webSocketMessage` D1 writes know
      which room to persist under, even after a hibernation wake
      where the original `fetch` context is gone.
- [x] Client side, all localStorage room/position bookkeeping is gone
      and the standalone `server/atrium-state.ts` server fns have
      been deleted. The client just reads `init.you.position` (already
      filtered to the current room by the DO) and uses it as the
      pending spawn — same shape as the old localStorage path but
      sourced from the server.
- [x] Failures degrade silently: the DO's `loadSavedState` and
      `saveCurrentState` both swallow exceptions, so a missing
      `database_id` or D1 outage just means the user spawns at the
      centre and nothing persists across reconnects. Functionally
      equivalent to v7.0 in that case.

Operator setup (one-time):
  1. `wrangler d1 create atrium` → copy the database_id into
     wrangler.jsonc.
  2. `wrangler d1 migrations apply atrium --local` (dev) /
     `--remote` (prod) to create the table.

### v7.4 — persist current room in localStorage (shipped)

After v7.3, refreshing `/labs/atrium` always dropped you back in the
lobby because the URL doesn't update as you walk. Added simple
localStorage persistence so refresh keeps you where you were.

- [x] On every room change, write `atrium-current-room` to
      localStorage (folded into the existing theme/portals effect).
- [x] On mount, `initialRoomFromStorage(initialRoom)` resolves the
      starting room: URL wins for explicit paths
      (`/labs/atrium/<id>`), then localStorage, then `'lobby'` for
      brand-new visitors.
- [x] Index route now passes no `initialRoom` prop, signalling "no
      explicit room — let storage decide". The `$roomId` route still
      passes the URL value, so deep links work and overwrite the
      stored room.

### v7.3 — room as internal state, URL is initial-only (shipped)

The "remount-safe" workaround in v7.2 was actually a symptom of the
wrong design — the URL changing on every room walk meant the component
remounted, which trashed every `useRef`, AND it meant typing a different
URL silently teleported you (which contradicts "you can only change
rooms by walking through portals").

Pivoted to: **room is internal `useState`, the URL is only an initial
hint**.

- [x] AtriumPage takes `initialRoom` (was `roomId`) which seeds a
      `useState<string>(initialRoom)`. The route files still pass the
      URL-derived room as the initial value, so deep links still drop
      you in the right room on first load.
- [x] Walking onto a portal now calls `setRoomRef.current(here.dest)`
      instead of `navigate()`. No URL change, no remount, just a
      single state update.
- [x] `useNavigate`, `navigateRef`, and the `if (here.dest === 'lobby')
      navigate-to-index else navigate-to-$roomId` branching are all
      gone.
- [x] `lastVisitedRoom` (the module-level singleton from v7.2) is back
      to being a normal `useRef` — safe now because the component
      doesn't remount on room change. Initial mount still gets a `null`
      previous room → fall back to `[5,5]`, which is the right
      behaviour for "you arrived here from outside".

### v7.2 — portal label z-order + remount-safe previous room (shipped)

Two follow-ups to v7.1:

- [x] **Portal labels were rendering UNDER furniture.** They were drawn
      inside the portal block (between rugs and sprites), so any tall
      furniture whose iso-box screen extent overlapped the label area
      would cover them once the sprite loop drew it. Specifically the
      lobby's crate at `[4,8]` sits at the same screen-x as the lobby's
      `[5,9]` portal and its base extends into the label's y-range.
      Moved label drawing to AFTER the sprite loop so labels always
      sit on top.
- [x] **Spawn-near-entrance was firing but `previousRoomRef` was
      always `null`** because `/labs/atrium` (index.tsx) and
      `/labs/atrium/$roomId` (separate route file) are *different*
      routes — TanStack remounts the AtriumPage component when crossing
      that boundary, wiping every `useRef` back to its initial value.
      Hoisted `previousRoom` to a module-level `let lastVisitedRoom`
      so it survives the remount. Also added a `prev !== roomId` guard
      so re-entering the same room doesn't try to find an entrance to
      itself.

### v7.1 — portal-only teleport + entrance spawn (shipped)

The bottom-bar navigator dropdown made it possible to skip the portal
tiles entirely (click "café" in the list and you were just there). That
broke the "atrium is a place you walk through" intent and gave portals
no real reason to exist. Two fixes:

- [x] **Navigator dropdown removed.** The bottom bar is now plain
      `~/atrium/<room>` text, no clickable list. Only walking onto a
      portal tile teleports between rooms in-app. URL deep links still
      work (typing `/labs/atrium/cafe` or refreshing) — those are
      distinct from a UI shortcut.
- [x] **Live occupancy now floats above each portal tile** as canvas
      text — `café · 3` etc. Fed by the same `/api/atrium-rooms` poll
      as before; the polling effect now writes into a ref instead of
      React state since the canvas renderer reads it each frame and we
      no longer need re-renders. Replaces the discoverability the
      dropdown provided.
- [x] **Spawn next to the entrance portal.** Track the previous room
      in `previousRoomRef`. On room change, find the portal in the new
      room whose `dest` matches the previous room (= the doorway you
      came through) and place the avatar on the first walkable
      cardinal neighbour of that portal tile. Falls back to `[5,5]`
      for first mount / URL deep links / rooms with no return portal.
      Prevents teleporting from feeling like falling out of the sky
      into the centre.

### v8.2 — per-chair facing direction (shipped)

Initial sit-then-face just hardcoded `S` everywhere — fine when every
chair was south-facing, wrong as soon as we wanted bistro pairs that
flank a table.

- [x] `Furniture` gets an optional `facing: Facing` field (defaults
      to S = back on north).
- [x] Chair drawing positions the back panel on the OPPOSITE side of
      `facing` (panel is thin along i for N/S facings, thin along j
      for E/W). Draw order picks back-then-seat or seat-then-back
      based on which has lower iso depth, so the back never gets
      hidden behind the seat from the wrong side.
- [x] Layouts updated: cafe's bistro triplets now have chairs facing
      each other across the table (E + W); same in the garden's
      seating cluster. Lobby chairs keep their default S.
- [x] **Every** sit-firing site looks up the chair's facing via the
      new `chairFacingAt(furniture, tile)` helper:
      immediate-sit on click, sit-on-arrival in tick, peer's `sit`
      message, init handler for self when restored sitting from D1,
      init + join handlers for peers reported as sitting. The shared
      `ROOM_LAYOUTS` table means all clients agree on facings without
      a wire-protocol bump.
- [x] Server's `sit` handler stops touching `att.facing` since
      everything's client-derived now.

### v8.1 — avatars face the way they walk (shipped)

After v8 the legs animated but everyone still looked perpetually
forward — felt like floating. The avatar's `facing` field was already
populated by `advanceWalk` (set whenever a step crosses a tile
boundary); just needed to actually use it in the renderer.

- [x] `drawFace` now takes `facing: Facing`. Computes face corners
      for either the **south** face (for `S`) or the **east** face
      (for `E`) of the head box and bilinear-paints the eyes / mouth /
      brows there. For `N` and `W` it returns early — those head
      faces are hidden in the iso projection, so the viewer naturally
      sees the back of the head + hair, which reads as "facing away".
- [x] `AvatarDraw` carries `facing`; renderScene passes
      `peer.facing` / `a.facing` from the existing avatar state.

## v9 — personal home rooms + furniture editor (shipped)

Goal: signed-in users get their own room they can decorate, share with
friends via URL.

- [x] **Personal room id** = `home-<did-with-colons-replaced>` (server
      validates the format strictly: `home-did-(plc|web)-...`). Guests
      don't get one — explicit per the user's spec; the "go home"
      button is only enabled when signed in.
- [x] **D1 layouts** at `migrations/atrium/0002_layouts.sql`:
      `atrium_layouts(room_id PK, owner_id, layout_json, updated_at)`.
      Stores the full furniture array as JSON. Whole-array writes on
      every edit (no incremental ops); rooms cap at 60 items.
- [x] **DO loads layout on hello** — the new `init.layout` field is
      `null` for hardcoded public rooms, the saved JSON for personal
      rooms with prior edits, or null for never-edited home rooms
      (client falls back to a friendly default starter via
      `furnitureFor` → `DEFAULT_LAYOUT`).
- [x] **Init also carries `isOwner`** — server compares the
      sanitised `clientId` to the room id's home suffix; client uses
      the flag to decide whether to show the edit toolbar.
- [x] **`editLayout` client → server message**, gated server-side on
      `isOwnerOfRoom`. Validates the array (kind whitelist, hex color
      regex, in-bounds tiles, optional facing in {N,S,E,W}, ≤ 60
      items) before upserting D1.
- [x] **`layout` server → client broadcast** to everyone in the room
      so visitors see the owner's edits in real time. Avatars
      standing on a tile that just became blocked are nudged to the
      room centre to avoid being stuck inside furniture.
- [x] **Edit toolbar UI** — shows when `inMyHome && isOwnerOfRoom`.
      Furniture palette (chair / table / plant / lamp / crate / rug)
      plus a remove tool. Click a tile in edit mode → place selected
      kind (or remove if existing matches the remove tool). Optimistic
      local update + ws send.
- [x] **"Go home" button** in the identity panel — disabled when
      signed out, takes you to your personal room when signed in.
- [x] **Bigger guest nickname pool** (50 × 50 = 2500 combinations,
      up from 10 × 10) since the v9.1 invite-by-nickname feature will
      need collisions to be rare.

### v9.1 — /home, autocomplete, evict on owner offline (shipped)

- [x] `/home` chat command warps a signed-in user to their personal
      room; for guests it shows "sign in to get a home room".
- [x] Slash-command autocomplete popup above the chat input. Opens
      whenever the draft starts with `/`, filters commands by prefix,
      hides signed-in-only commands from guests. Arrow keys to
      navigate, Tab to complete the highlighted entry, Esc to dismiss
      (clears the draft), Enter still submits whatever's in the input
      (so partial inputs fall through to plain chat for unknown
      commands). Mouse click on a row also completes (uses
      `onMouseDown` + preventDefault so the input doesn't lose focus
      and tear down the popup before the handler runs).
- [x] Server-side eviction: when an owner disconnects from a home
      room, schedule a 10s grace timer. Reconnect by the same
      clientId cancels it; after the grace expires, broadcast
      `{t:'evicted', reason}` to remaining peers and `ws.close()`
      their connections. Client receives `evicted`, sets
      `setRoom('lobby')` and shows a hint. Refreshes don't kick
      anyone (they reconnect well within the grace).
- [x] Wider guest nickname pool (50 × 50 = 2500) was a v9.0
      thing, kept for v9.2 invite uniqueness.

### v9.2 — invites (next)

- [ ] `/invite <name>` chat command — name = did, handle, or guest
      nickname. Resolves to a recipient_key, writes a row to a new
      `atrium_invites` table.
- [ ] User autocomplete for the `/invite ` argument — needs a global
      presence registry (cross-room) so we know who's online to
      suggest. Probably a separate `AtriumPresenceDO` that each room
      DO checks in/out of on hello/leave.
- [ ] Notification chip in the identity panel when the user has
      pending invites; click to accept (warps to inviter's room) or
      dismiss.
- [ ] Atproto handle → did resolution server-side for handle-based
      invites.

## v8 — walk-leg animation (shipped)

The body-stretch bob from v1 was the cheapest "you're walking" cue we
could get away with — it just made the body taller/shorter as you
moved. Replaced it with actual legs.

- [x] Two iso-box legs (`0.13 × 0.13 × 0.3`) at the avatar's base,
      offset ±0.08 along the i axis. Body sits on top, head on top of
      that. Identicon (face + hair) renders unchanged.
- [x] Walking alternate-lifts the legs on a 540ms sin cycle (one full
      cycle = two steps) by up to 0.1 tile units. The body rides up by
      the smaller of the two leg lifts, giving a real footstep bob
      without distorting the body shape.
- [x] Sit pose hides the legs (tucked under the chair seat) — body +
      head only.
- [x] `AvatarDraw` swaps `bob: number` for `walking: boolean` —
      drawAvatar now computes the phase from `performance.now()`
      itself, so `state.bob` is dead and the per-tick body-stretch
      math is gone too.
- [x] Emote `ctx.translate` offsets compose cleanly with legs (the
      whole avatar including legs translates together).
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
