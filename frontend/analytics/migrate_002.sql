-- 26 Oct 2026: imported history (Render logs, backend activity, GitHub traffic) with de-duplication
ALTER TABLE events ADD COLUMN source TEXT;
ALTER TABLE events ADD COLUMN ext_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS events_ext ON events(ext_id);
CREATE TABLE IF NOT EXISTS daily_stats (day TEXT NOT NULL, source TEXT NOT NULL, metric TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', value REAL, PRIMARY KEY (day, source, metric, label));
