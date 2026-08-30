CREATE TABLE folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  parent_id  uuid REFERENCES folders (id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX folders_owner_parent_idx ON folders (owner_id, parent_id)
  WHERE deleted_at IS NULL;

-- Two folders with the same name cannot sit side by side. The root is parent_id IS NULL,
-- which a plain unique index would not constrain, so the key folds NULL into a sentinel.
CREATE UNIQUE INDEX folders_unique_name_per_parent
  ON folders (owner_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE deleted_at IS NULL;

ALTER TABLE files
  ADD COLUMN folder_id uuid REFERENCES folders (id) ON DELETE CASCADE;

CREATE INDEX files_folder_idx ON files (owner_id, folder_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
