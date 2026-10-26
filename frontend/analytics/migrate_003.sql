-- Exact location: asked from the browser once the user has signed in. When allowed, the session's location is the
-- device position (GPS / Wi-Fi) with its street address; otherwise it stays the IP-based estimate.
ALTER TABLE sessions ADD COLUMN loc_source TEXT;      -- 'device' (permission given) | 'ip' (declined / unavailable)
ALTER TABLE sessions ADD COLUMN loc_accuracy_m REAL;
ALTER TABLE sessions ADD COLUMN address TEXT;
ALTER TABLE sessions ADD COLUMN postal TEXT;
