-- BHARAT 3D analytics (Cloudflare D1). Every API request, page view, sign-in/out and user action, with the visitor's
-- IP, Cloudflare geolocation, device and a readable message; one row per browser session.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,                 -- ISO time, UTC
  kind TEXT NOT NULL,               -- request | page | action | login | login_failed | logout | session_start
  session_id TEXT,
  user_email TEXT, user_name TEXT, role TEXT,
  ip TEXT, country TEXT, region TEXT, city TEXT, postal TEXT, lat REAL, lon REAL, timezone TEXT,
  asn INTEGER, isp TEXT, colo TEXT,
  browser TEXT, os TEXT, device TEXT, ua TEXT, referer TEXT,
  method TEXT, path TEXT, status INTEGER, ms INTEGER, bytes INTEGER,
  action TEXT, detail TEXT,
  message TEXT                      -- a readable sentence for people
);
CREATE INDEX IF NOT EXISTS events_at ON events(at);
CREATE INDEX IF NOT EXISTS events_kind_at ON events(kind, at);
CREATE INDEX IF NOT EXISTS events_session ON events(session_id, at);
CREATE INDEX IF NOT EXISTS events_user ON events(user_email, at);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_email TEXT, user_name TEXT, role TEXT,
  started_at TEXT, last_seen TEXT, ended_at TEXT, end_reason TEXT,
  ip TEXT, country TEXT, region TEXT, city TEXT, lat REAL, lon REAL, timezone TEXT, isp TEXT,
  browser TEXT, os TEXT, device TEXT, landing_path TEXT, referer TEXT,
  pages INTEGER DEFAULT 0, actions INTEGER DEFAULT 0, requests INTEGER DEFAULT 0, errors INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_email);
