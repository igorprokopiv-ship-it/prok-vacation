-- Migration bookkeeping (also bootstrapped in server/app.py run_migrations).
CREATE TABLE IF NOT EXISTS schema_migration (
  filename TEXT PRIMARY KEY,
  applied_on TIMESTAMPTZ NOT NULL DEFAULT now()
);
