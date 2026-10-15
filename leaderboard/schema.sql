CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  at TEXT NOT NULL,
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS scores_by_score ON scores (score DESC);
CREATE INDEX IF NOT EXISTS scores_by_ip_time ON scores (ip_hash, at);
