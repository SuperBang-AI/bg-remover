-- ============================================================================
-- Stage 2 — accounts and credits
--
-- The ledger is the only source of truth. A balance is never stored as a
-- column; it is SUM(delta) over this table, so a partial write can never leave
-- the counter and the history disagreeing.
--
-- Apply with:
--   npx wrangler d1 execute bg-remover --local  --file migrations/0001_init.sql
--   npx wrangler d1 execute bg-remover --remote --file migrations/0001_init.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,            -- uuid, ours, never the Google sub
  google_sub    TEXT UNIQUE NOT NULL,        -- stable Google subject id
  email         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  created_at    INTEGER NOT NULL,            -- epoch ms
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS credits_ledger (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  delta      INTEGER NOT NULL,               -- +N purchase/bonus, -1 per successful removal
  reason     TEXT NOT NULL,                  -- signup_bonus | purchase | job_charge | job_refund | manual
  ref_id     TEXT,                           -- job id / order id / user id, used as the idempotency key
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON credits_ledger(user_id, created_at);

-- One row per (ref_id, reason): a job can be charged once and refunded once,
-- no matter how many times the request is retried.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_ref
  ON credits_ledger(ref_id, reason)
  WHERE ref_id IS NOT NULL;

-- The signup bonus is claimable exactly once per account, enforced by the
-- database rather than by a check-then-write in application code.
CREATE UNIQUE INDEX IF NOT EXISTS uq_signup_bonus
  ON credits_ledger(user_id)
  WHERE reason = 'signup_bonus';

CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL,                -- ok | failed
  input_bytes  INTEGER,
  input_format TEXT,
  provider     TEXT NOT NULL DEFAULT 'remove_bg',
  duration_ms  INTEGER,
  error_code   TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at DESC);
