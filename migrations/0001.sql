CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  store_code TEXT NOT NULL,
  meal_code TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('open','full','ordered','picked-up','expired')),
  created_at INTEGER NOT NULL,
  deadline INTEGER NOT NULL,
  ended_at INTEGER,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS groups_board ON groups(store_code, state, deadline);
CREATE INDEX IF NOT EXISTS groups_retention ON groups(ended_at);
CREATE TABLE IF NOT EXISTS join_events (device_id TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS join_events_window ON join_events(device_id, at);
