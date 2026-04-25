-- Per-room furniture layouts for personal rooms.
--
-- One row per editable room. room_id is `home-<clientId>` for guest
-- personal rooms today; future signed-in users will key by `home-<did>`
-- (after we sanitise the colon).
--
-- owner_id is the user_id allowed to edit the layout — the server
-- checks this against the connecting client's identity before
-- accepting an editLayout message.
--
-- layout_json is the full furniture array as JSON. Whole-array writes
-- on every edit (no incremental ops); rooms have ≤ 30-ish items so the
-- payload stays tiny and the schema stays flat.

CREATE TABLE atrium_layouts (
  room_id     TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  layout_json TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX atrium_layouts_owner ON atrium_layouts(owner_id);
