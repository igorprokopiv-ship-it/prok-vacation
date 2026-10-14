-- User research YouTube videos (vacation-wide or trip location) + per-user offline checklist.

CREATE TABLE IF NOT EXISTS video (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trip (id),
  location_id TEXT,
  youtube_id TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  body TEXT NOT NULL DEFAULT '',
  record_status TEXT NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active', 'deleted')),
  created_by TEXT,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_on_device TEXT,
  last_modified_by TEXT,
  last_modified_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_on_device TEXT
);

CREATE INDEX IF NOT EXISTS video_trip_idx ON video (trip_id)
  WHERE record_status = 'active';
CREATE INDEX IF NOT EXISTS video_location_idx ON video (trip_id, location_id)
  WHERE record_status = 'active' AND location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS video_modified_idx ON video (last_modified_on);

CREATE TABLE IF NOT EXISTS video_offline (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trip (id),
  video_id UUID NOT NULL REFERENCES video (id),
  user_name TEXT NOT NULL,
  downloaded_at TIMESTAMPTZ,
  record_status TEXT NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active', 'deleted')),
  created_by TEXT,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_on_device TEXT,
  last_modified_by TEXT,
  last_modified_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_on_device TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS video_offline_user_idx
  ON video_offline (video_id, user_name)
  WHERE record_status = 'active';
CREATE INDEX IF NOT EXISTS video_offline_trip_idx ON video_offline (trip_id)
  WHERE record_status = 'active';
CREATE INDEX IF NOT EXISTS video_offline_modified_idx ON video_offline (last_modified_on);
