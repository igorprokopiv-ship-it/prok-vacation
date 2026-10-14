-- Soft reference from notes to trip-meta location ids (same pattern as day_id / stop_id).
ALTER TABLE note ADD COLUMN IF NOT EXISTS location_id TEXT;

CREATE INDEX IF NOT EXISTS note_location_idx ON note (trip_id, location_id)
  WHERE record_status = 'active' AND location_id IS NOT NULL;
