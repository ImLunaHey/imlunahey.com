-- Atrium per-user session state.
--
-- One row per identity. user_id is either the user's atproto did
-- (signed-in) or `guest:<clientId>` for guests; the clientId itself
-- still lives in localStorage as the per-browser identity hint.
--
-- position_json is a JSON blob shaped like
--   { "room": "cafe", "tile": [3, 7], "sitting": null | [4, 5] }
-- so the renderer can restore the avatar to the exact tile it was on
-- at the time of the last write — not just the room.

CREATE TABLE atrium_state (
  user_id        TEXT PRIMARY KEY,
  current_room   TEXT NOT NULL,
  previous_room  TEXT,
  position_json  TEXT,
  updated_at     INTEGER NOT NULL
);

CREATE INDEX atrium_state_updated_at ON atrium_state(updated_at);
