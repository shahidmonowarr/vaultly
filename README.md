# Vaultly

A file storage service where every upload is private by default and can be published
behind an unguessable link the owner controls.

Live demo: TBD
Demo account: `demo@vaultly.app` / `demo-password-2026`

## What it does

- Email and password accounts, with rotating refresh tokens held in httpOnly cookies
- Drag-and-drop uploads of files up to 512 MB, with per-file progress, retry and cancel
- A dashboard to rename, search, filter, delete and toggle each file between private and public
- Public files get a share page and a direct download link; making a file private again
  permanently invalidates the link that was handed out
- Private files are reachable only by their owner, through URLs that expire after five minutes

## How uploads work

This is the part worth reading first, because it drives most of the other decisions.

Files never pass through the application server. The browser asks the API to start an
upload, the API validates the request and hands back a set of presigned S3 URLs, and the
browser PUTs the chunks straight at object storage.

```
browser                        API                          object storage
   |  POST /api/v1/uploads      |                                  |
   |--------------------------->|  validate name, type, size,      |
   |                            |  quota; CreateMultipartUpload    |
   |                            |--------------------------------->|
   |  <-- partSize + signed URLs                                   |
   |                                                               |
   |  PUT part 1..N (3 at a time, retried on failure)              |
   |-------------------------------------------------------------->|
   |                                                               |
   |  POST /api/v1/uploads/:id/complete                            |
   |--------------------------->|  CompleteMultipartUpload,        |
   |                            |  HeadObject to confirm the size, |
   |                            |  sniff magic bytes, mark ready    |
```

Three things follow from this:

- A 500 MB upload costs the API two short JSON requests. There is no request body limit
  to work around and no memory pressure, which is also why the whole thing runs happily
  on serverless functions.
- A failed chunk is retried on its own instead of restarting the upload.
- The client is not trusted about what it uploaded. After the upload completes the server
  checks the object's real size against the size that was declared up front, and reads the
  first 4 KB back to sniff the actual file signature. A mismatch or an executable
  signature deletes the object and fails the request.

Rows are written as `pending` when the upload starts and only flip to `ready` after that
verification, so an abandoned upload never appears in anyone's dashboard.

## Security decisions

**Authorisation is a WHERE clause.** Ownership is part of every query rather than a check
performed after loading a row, so there is no code path that reads another user's record.
Requests for files that exist but belong to someone else return 404, not 403, so the API
cannot be used to confirm that a file id exists.

**Objects are never public.** The bucket has no public read access. Downloads go through
the API, which authorises the request and only then signs a URL that expires in five
minutes. Public sharing works the same way, keyed off a 22 character slug rather than the
file's database id, so links cannot be guessed or enumerated from an id.

**Downloads are always attachments.** Every download is served with
`Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`. Only a short
allowlist of formats — images, PDF, plain text, common audio and video — may render inline
on a share page, which keeps uploaded HTML or SVG from executing under the app's origin.
Executables and scripts are rejected by extension on the way in and by file signature
after the fact.

**Refresh tokens rotate and replay is detected.** Each login opens a token family. Every
refresh revokes the token it consumed and issues a new one in the same family. Presenting
a token that has already been used means it leaked, so the entire family is revoked and
both the attacker and the real user have to sign in again. Tokens are stored as SHA-256
hashes, so a database dump cannot be replayed.

**Passwords** are hashed with scrypt (N=16384, r=8, p=1) using Node's own crypto module.
Failed logins for unknown emails still perform a hash verification against a decoy digest,
so response timing does not reveal whether an account exists.

**Rate limits** live in Postgres rather than process memory, because serverless instances
do not share state. Registration, login (per address and per email), upload creation and
public downloads each have their own fixed window.

**CSRF.** Session cookies are `SameSite=Lax`, which keeps them off cross-site form posts,
and every mutating endpoint requires a JSON content type, which a simple form cannot send.
The refresh cookie is additionally scoped to `/api/v1/auth`, so it is never attached to
file or upload requests.

## API

All routes are under `/api/v1`. Errors share one envelope:
`{ "error": { "code", "message", "details"? } }`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create an account and open a session |
| POST | `/auth/login` | Open a session |
| POST | `/auth/refresh` | Rotate the refresh token |
| POST | `/auth/logout` | Revoke the current session |
| GET | `/auth/me` | Current user |
| GET | `/files` | List own files — `limit`, `cursor`, `search`, `visibility` |
| GET | `/files/:id` | One file |
| PATCH | `/files/:id` | Rename, or change visibility |
| DELETE | `/files/:id` | Delete the file and its object |
| GET | `/files/:id/download` | 302 to a signed, expiring URL |
| POST | `/uploads` | Start an upload, returns presigned part URLs |
| POST | `/uploads/:id/complete` | Verify and finalise an upload |
| DELETE | `/uploads/:id` | Abort an upload and release its parts |
| GET | `/share/:slug` | Public metadata for a shared file |
| GET | `/share/:slug/download` | Public download, `?inline=1` to preview |

Listing uses keyset pagination on `(created_at, id)` rather than `OFFSET`, so a page
boundary stays correct while new files are being uploaded. The cursor is opaque.

## Data model

```
users     id, email, password_hash, timestamps
sessions  id, user_id, family_id, token_hash, user_agent, expires_at, revoked_at
files     id, owner_id, storage_key, upload_id, name, mime_type, size_bytes, checksum,
          visibility, share_slug, status, download_count, timestamps, deleted_at
```

`files` has a partial index on `(owner_id, created_at DESC, id DESC)` limited to rows that
are not soft deleted, which is exactly the dashboard's query. `share_slug` is unique and
nullable, so a private file simply has no slug. Deletes are soft in the database and hard
in object storage: the row is kept for auditability, the bytes are not.

## Running it locally

Requires Node 20+ and Docker.

```bash
docker compose up -d          # Postgres on 5433, MinIO on 9000
cp .env.example .env          # then set AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed               # creates the bucket, its CORS policy and a demo account
npm run dev
```

The app runs at http://localhost:3000 and the MinIO console at http://localhost:9001
(`minioadmin` / `minioadmin`).

Generate a secret with `openssl rand -hex 32`.

## Environment

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | At least 32 characters; signs access tokens |
| `S3_ENDPOINT` | Omit for AWS S3; set for MinIO, R2 or B2 |
| `S3_PUBLIC_ENDPOINT` | The endpoint the browser can reach, if it differs |
| `S3_REGION`, `S3_BUCKET` | |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO |
| `MAX_FILE_SIZE_BYTES` | Default 512 MB |
| `USER_QUOTA_BYTES` | Default 2 GB per account |

The storage layer is plain S3 API calls, so any S3-compatible provider works without a
code change. The bucket needs a CORS rule that allows `PUT` from the app's origin and
exposes the `ETag` header; `npm run db:seed` applies one automatically where the provider
supports it.

## Tests

```bash
npm test
```

Unit tests cover password hashing, filename sanitisation and the file type rules.
Integration tests run against the Docker services and drive the real route handlers: they
cover registration and duplicate emails, the identical response for a wrong password and
an unknown account, refresh rotation including replay detection, a full upload through
MinIO, the size-mismatch rejection, cross-account access returning 404, and a share link
going dead when the file is made private.

## Deployment

The app deploys to any Node host. It is currently on Vercel with Neon for Postgres and an
S3-compatible bucket for objects. Because uploads bypass the server entirely, the
serverless request body limit never applies.

Run `npm run db:migrate` against the production database after deploying.

## Trade-offs and what I would do next

Access tokens are stateless and live for 15 minutes, so signing out does not invalidate an
access token that is already in flight — the refresh token is revoked immediately, which
caps the window at 15 minutes. Checking a session table on every request would close it,
at the cost of a database round trip per request. For this workload I chose the round trip
saved.

An upload that the browser abandons without calling the abort endpoint leaves a `pending`
row and orphaned S3 parts. They are invisible to the user and excluded from listings, but a
scheduled job should reap rows older than a day and call `AbortMultipartUpload`. That job
is the first thing I would add.

Other things left out deliberately: resumable uploads across page reloads (the part
manifest would need to be persisted client-side), virus scanning, folders, and per-link
expiry or passwords on shares. Search is a simple `ILIKE`, which is fine up to a point and
would want a trigram index or a `tsvector` column beyond it.
