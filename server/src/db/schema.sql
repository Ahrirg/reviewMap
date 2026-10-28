-- Schema for the Kaunas community review map.
-- __CATEGORIES__ is substituted at load time from shared/categories.js so the
-- CHECK constraint can never drift from the application's category list.

CREATE TABLE IF NOT EXISTS markers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  latitude   REAL NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
  longitude  REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  category   TEXT NOT NULL CHECK (category IN (__CATEGORIES__)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  marker_id  INTEGER NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  user_name  TEXT NOT NULL CHECK (length(trim(user_name)) BETWEEN 1 AND 60),
  text       TEXT CHECK (text IS NULL OR length(text) <= 2000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  -- The config.conf account that wrote this, or NULL for rows that predate
  -- logins (seeded demo data, anything written before accounts existed).
  -- Ownership is decided on this column and never on user_name, which is only
  -- a display name and could collide with an account added later.
  author_account TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id     INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('image','video')),
  file_path     TEXT NOT NULL UNIQUE,
  original_name TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_marker   ON reviews(marker_id, created_at);
CREATE INDEX IF NOT EXISTS idx_media_review     ON media(review_id);
CREATE INDEX IF NOT EXISTS idx_markers_category ON markers(category);
CREATE INDEX IF NOT EXISTS idx_markers_latlon   ON markers(latitude, longitude);
