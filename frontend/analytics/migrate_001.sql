-- 26 Oct 2026: returning visitors and device profiles
ALTER TABLE events ADD COLUMN visitor_id TEXT;
ALTER TABLE sessions ADD COLUMN visitor_id TEXT;
ALTER TABLE sessions ADD COLUMN profile TEXT;
ALTER TABLE sessions ADD COLUMN is_returning INTEGER;
CREATE INDEX IF NOT EXISTS events_visitor ON events(visitor_id, at);
