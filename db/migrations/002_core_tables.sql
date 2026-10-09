CREATE TABLE IF NOT EXISTS trip (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'archived')),
  cover_blob_sha TEXT,
  content_version TEXT NOT NULL DEFAULT '0',
  trip_document JSONB NOT NULL DEFAULT '{}'::jsonb,
  record_status TEXT NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active', 'deleted')),
  created_by TEXT,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_on_device TEXT,
  last_modified_by TEXT,
  last_modified_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_on_device TEXT
);

CREATE INDEX IF NOT EXISTS trip_status_idx ON trip (status) WHERE record_status = 'active';
CREATE INDEX IF NOT EXISTS trip_dates_idx ON trip (start_date, end_date);

CREATE TABLE IF NOT EXISTS content_blob (
  sha256 TEXT PRIMARY KEY,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  byte_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'file',
  created_on TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_content_file (
  trip_id UUID NOT NULL REFERENCES trip (id),
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL REFERENCES content_blob (sha256),
  kind TEXT NOT NULL DEFAULT 'file',
  PRIMARY KEY (trip_id, path)
);

CREATE TABLE IF NOT EXISTS trip_link (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trip (id),
  kind TEXT NOT NULL
    CHECK (kind IN ('immich_album', 'timelog_day', 'money_range', 'custom_url')),
  label TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  day_id TEXT,
  record_status TEXT NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active', 'deleted')),
  created_by TEXT,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_on_device TEXT,
  last_modified_by TEXT,
  last_modified_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_on_device TEXT
);

CREATE INDEX IF NOT EXISTS trip_link_trip_idx ON trip_link (trip_id)
  WHERE record_status = 'active';

CREATE TABLE IF NOT EXISTS note (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trip (id),
  day_id TEXT,
  stop_id TEXT,
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

CREATE INDEX IF NOT EXISTS note_trip_idx ON note (trip_id)
  WHERE record_status = 'active';
CREATE INDEX IF NOT EXISTS note_modified_idx ON note (last_modified_on);

CREATE TABLE IF NOT EXISTS plan_item (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trip (id),
  site_id TEXT,
  day_id TEXT,
  kind TEXT NOT NULL DEFAULT 'todo'
    CHECK (kind IN ('todo', 'packing', 'booking', 'site_edit')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  record_status TEXT NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active', 'deleted')),
  created_by TEXT,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_on_device TEXT,
  last_modified_by TEXT,
  last_modified_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_on_device TEXT
);

CREATE INDEX IF NOT EXISTS plan_item_trip_idx ON plan_item (trip_id)
  WHERE record_status = 'active';
CREATE INDEX IF NOT EXISTS plan_item_modified_idx ON plan_item (last_modified_on);
