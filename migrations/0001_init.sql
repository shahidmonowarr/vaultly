CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE file_visibility AS ENUM ('private', 'public');
CREATE TYPE file_status AS ENUM ('pending', 'ready');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- One row per issued refresh token. Rotation revokes the old row and inserts a new
-- one in the same family, which is what makes replay of a stolen token detectable.
CREATE TABLE sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  family_id  uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_family_idx ON sessions (family_id);

CREATE TABLE files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  storage_key    text NOT NULL UNIQUE,
  upload_id      text,
  name           text NOT NULL,
  mime_type      text NOT NULL,
  size_bytes     bigint NOT NULL,
  checksum       text,
  visibility     file_visibility NOT NULL DEFAULT 'private',
  share_slug     text UNIQUE,
  status         file_status NOT NULL DEFAULT 'pending',
  download_count integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX files_owner_listing_idx ON files (owner_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE rate_limits (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer NOT NULL DEFAULT 0
);
