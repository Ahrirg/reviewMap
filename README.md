# Kauno bendruomenės žemėlapis — Kaunas Community Review Map

An interactive community map of Kaunas, Lithuania. Click anywhere on the map to drop a
categorised marker, then attach reviews with text, photos and videos. Who may add or delete
anything is decided by a plain-text accounts file, and everything is stored locally in SQLite and
on disk.

The interface is in Lithuanian; the code, comments and this document are in English.

## Features

- Leaflet map on OpenStreetMap tiles, opening on Kaunas at zoom 13, pannable worldwide.
- Left-click empty map to create a marker. Coordinates are taken from the click, never typed.
- Five categories with distinct colours and vector icons: Toletai, Kedes, Maistas, Vaizdas, Random.
- Single-click a marker for a preview popup, double-click for the full details drawer.
- Every marker has a `+` button for adding another review.
- Reviews carry their author's account name, optional text, up to five images and two videos.
- Videos play inline with native controls and can be seeked; images open in a lightbox.
- Legend doubles as a per-category filter with a "Rodyti visus" reset.
- Markers cluster automatically, so the map stays responsive with thousands of them.
- Log in with a password alone, or look around as a guest. A login lasts a month per browser.
- Three roles, listed in `config.conf`: admin, reviewer, and guest for anyone not logged in.
- Markers and reviews can be deleted, which also removes their files from disk.

## Requirements

- Node.js 22.12 or newer (developed on 22.23).
- npm 10 or newer.
- A C/C++ toolchain only if npm cannot fetch a prebuilt `better-sqlite3` binary for your platform.

No database server, no Docker, no cloud services, and no API keys.

## Installation

```bash
npm install
cp config.example.conf config.conf
chmod 600 config.conf
```

One install at the repository root covers both workspaces. Edit `config.conf` to set real names
and passwords before letting anyone else reach the server; without it the map is readable but
nobody can change anything.

## Development

```bash
npm run dev
```

| Service | URL |
| --- | --- |
| Frontend (Vite) | http://localhost:5173 |
| Backend (Express) | http://localhost:3001 |

Vite proxies `/api` and `/uploads` to the backend, so the frontend never hardcodes a backend URL.
Run the halves separately with `npm run dev:server` and `npm run dev:client`.

The database file and upload directories are created automatically on first boot.

## Production build

```bash
npm run build     # bundles the client into client/dist
npm start         # runs the API on port 3001
```

`npm run preview` serves the built client locally. To serve the built files from Express instead,
add a static handler for `client/dist` in `server/src/app.js`. Express 5 rejects a bare `'*'` route,
so the SPA fallback must be written as `app.get('/{*splat}', ...)`.

Configuration comes from the environment: `PORT`, `HOST`, `DB_PATH`, `MAX_IMAGE_BYTES`,
`MAX_VIDEO_BYTES`, `CONFIG_PATH`, `SESSION_SECRET`, `COOKIE_SECURE`, `TRUST_PROXY`. Accounts are
the exception and live in `config.conf`, because they are edited by hand.

Behind a reverse proxy that terminates TLS, set `TRUST_PROXY=1` so `req.ip` and `req.secure` mean
something: without it the login rate limit sees every visitor as the proxy, and the session cookie
never gets its `Secure` flag. `COOKIE_SECURE=1` forces that flag on regardless.

## Where things live

| What | Path |
| --- | --- |
| SQLite database | `data/app.db` (plus `-wal` and `-shm` while running) |
| Uploaded images | `uploads/images/` |
| Uploaded videos | `uploads/videos/` |
| Category definitions | `shared/categories.js`, imported by both client and server |
| Accounts | `config.conf` (gitignored; `config.example.conf` is the template) |
| Session cookie key | `data/session.key`, generated on first boot |

The database stores only metadata and relative file paths. Binary data is never written into SQLite.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Backend and frontend together |
| `npm run build` | Production client bundle |
| `npm start` | Backend only |
| `npm run seed` | Insert six sample Kaunas markers |
| `npm run seed 2000` | The samples plus 2000 random markers, for testing clustering |
| `npm run db:reset` | Delete the database, keeping uploaded files |
| `npm run db:reset -- --uploads` | Delete the database and every uploaded file |
| `npm run uploads:gc` | List uploaded files no review references |
| `npm run uploads:gc -- --clean` | Delete those orphaned files |

Seeding is never automatic. The application starts with an empty map and works without it.

### Resetting

Stop the server first, or an open connection will simply recreate the files.

```bash
npm run db:reset -- --uploads   # start completely fresh
npm run dev                     # the schema is recreated on boot
```

To clear uploads only, delete the contents of `uploads/images` and `uploads/videos`, then run
`npm run uploads:gc` to see which database rows now point at missing files.

## Accounts and roles

Everyone who reaches the server starts as a guest and can read the whole map. To change anything
you log in, and the login screen asks for a password and nothing else: the password *is* the
identity, so no two people may share one. This is the same idea as copyparty's account model.

Accounts live in `config.conf` at the repository root, one line per person:

```conf
[accounts]
Ahrirg: labai-slaptas, admin
Jonas:  obuolys42,     reviewer

[options]
session_days: 30
```

| Role | Add markers | Add reviews | Delete reviews | Delete markers |
| --- | --- | --- | --- | --- |
| `guest` (not logged in) | no | no | no | no |
| `reviewer` | yes | yes | their own only | no |
| `admin` | yes | yes | any | yes |

The name is what appears on that person's reviews; the review form no longer asks for one, and a
`userName` sent by a client is ignored. Deleting a marker takes all of its reviews with it, which
is why it is reserved for admins.

Format notes:

- Only whole lines can be comments (`#` or `;`), so a password may contain `#`.
- The name is split off at the first `:` and the role at the last `,`, so a password may contain
  both of those as well.
- `[accounts]` is the implicit section, so a bare list of `name: password, role` lines also works.
- `session_days` is how long a login is remembered on one browser. The default is 30.

The file is re-read within a second of being saved, with no restart. Changing a role applies to
anyone already logged in; changing a password or deleting a line logs that person out; renaming
someone also logs them out, because their cookie names the old account. A file that fails to parse
is a startup error at boot, but during a reload the previous accounts are kept and the problem is
logged, so a typo can never lock everyone out of a running server.

Passwords are stored in plain text, which is why `config.conf` is gitignored and should be
`chmod 600`. Sessions are signed cookies with no server-side store, so the way to revoke one
early is to change that person's password.

## API

All responses are JSON. Errors are always `{"error": "..."}`, with a `field` key when the problem
can be attributed to one input.

| Method | Path | Body | Needs | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | – | – | `{ok, uptime}` |
| `GET` | `/api/config` | – | – | Category list and map defaults |
| `GET` | `/api/session` | – | – | `{name, role, sessionDays}`; `name` is `null` for a guest |
| `POST` | `/api/session` | `{password}` | – | `{name, role}` and a month-long cookie |
| `DELETE` | `/api/session` | – | – | `204`, clears the cookie |
| `GET` | `/api/markers` | – | – | Every marker as a summary, including `reviewCount` |
| `GET` | `/api/markers/:id` | – | – | One marker with all reviews and media |
| `POST` | `/api/markers` | JSON or multipart | reviewer | `201` with the created marker |
| `POST` | `/api/markers/:id/reviews` | JSON or multipart | reviewer | `201` with `{review, reviewCount}` |
| `DELETE` | `/api/markers/:id` | – | admin | `204`, cascades reviews and deletes files |
| `DELETE` | `/api/reviews/:id` | – | author or admin | `204`, deletes its files |

Reads are open to everyone. A write without a session is `401`; a write the caller's role does not
allow is `403`. Wherever "reviewer" appears above, an admin qualifies too.

The map loads from a single `GET /api/markers` call. Reviews and media are fetched only when a
marker is opened, so the initial render stays fast no matter how many markers exist.

Multipart field names are `image` and `video`; both accept multiple files.

```bash
# Log in and keep the cookie; the author of everything below comes from it
curl -c jar.txt -X POST localhost:3001/api/session \
  -H 'content-type: application/json' -d '{"password":"obuolys42"}'

# Create a marker
curl -b jar.txt -X POST localhost:3001/api/markers -H 'content-type: application/json' \
  -d '{"latitude":54.8985,"longitude":23.9036,"category":"Maistas"}'

# Add a review with media
curl -b jar.txt -X POST localhost:3001/api/markers/1/reviews \
  -F 'text=Labai geras maistas.' \
  -F 'image=@photo.jpg' -F 'video=@clip.mp4'
```

## Database schema

Three tables with foreign keys enabled and `ON DELETE CASCADE`, so deleting a marker removes its
reviews, and deleting a review removes its media rows.

- `markers` — `id`, `latitude`, `longitude`, `category`, `created_at`
- `reviews` — `id`, `marker_id`, `user_name`, `text`, `created_at`, `author_account`
- `media` — `id`, `review_id`, `type` (`image` or `video`), `file_path`, `original_name`, `created_at`

`author_account` is the `config.conf` account that wrote the review, and it is what the
own-reviews-only delete rule is checked against. It is `NULL` for rows written before accounts
existed and for seeded demo data, so those are admin-only deletes; `user_name` is a display name
and is never used to decide permissions. Adding the column to a database that predates it happens
automatically at boot, so an existing `data/app.db` keeps working without a reset.

`CHECK` constraints mirror the server-side validation, and the category constraint is generated
from `shared/categories.js`. Changing the category list after the database exists is detected at
boot and reported rather than failing later at insert time.

## Uploads and validation

| Rule | Value |
| --- | --- |
| Image formats | JPEG, PNG, WebP, GIF, AVIF |
| Video formats | MP4, WebM, Ogg |
| Image size limit | 10 MB |
| Video size limit | 100 MB |
| Per review | 5 images, 2 videos |

Multer offers only one global size limit, so a custom storage engine counts bytes as they arrive
and aborts an oversized image mid-stream instead of writing it in full. Filenames are generated
from a timestamp and random bytes with an extension from the allowlist, so a client filename never
reaches the filesystem. Every rejected request deletes whatever it had already written, and
`npm run uploads:gc` reports anything that ever slips through.

The server independently validates coordinate ranges, category, name length, text length, MIME
type, extension and file size. Frontend checks exist only for fast feedback. All SQL uses
parameterised statements, and user text is rendered as React children, never as raw HTML.

## Notes on the interaction design

A double click is a meaningful gesture here, which makes the click handling less obvious than it
looks:

- Leaflet fires `click`, `click`, `dblclick` for one double click, so the map click handler waits
  260 ms and cancels if a `dblclick` arrives. Double-click zoom is turned off, since a near miss
  next to a marker would otherwise zoom unexpectedly.
- The preview popup is a single React-controlled `Popup`, not a child of a `Marker`. Binding a
  popup to a marker makes Leaflet auto-pan the map on the first click, moving the marker out from
  under the cursor so the second click lands elsewhere and the double click never completes.
- The popup tip is decorative and sits over the marker, so its pointer events are disabled.
  Otherwise an open preview would block the double click that opens the drawer.
- The legend, drawer and dialogs are plain DOM siblings of the map or portals to `document.body`,
  never Leaflet controls, so their clicks can never create a marker.

Category icons are inline SVG rather than emoji: a machine with no colour-emoji font installed
renders emoji as empty boxes, which is exactly what happened during development.

Leaflet's CSS is imported into its own cascade layer between Tailwind's `base` and `components`
layers. Tailwind's Preflight resets `img { max-width: 100% }`, which otherwise distorts map tiles.

## Project layout

```
ReviewMap/
├── config.example.conf      accounts template; copy to config.conf
├── shared/categories.js     one category list for both sides
├── server/src/
│   ├── app.js  index.js  config.js  validation.js  accounts.js
│   ├── db/       connection, schema, prepared statements
│   ├── middleware/  uploads, errors, session
│   ├── routes/   markers, reviews, session
│   └── services/ transactions, file handling
├── client/src/
│   ├── api/      fetch and XHR upload with progress
│   ├── components/  map, popup, drawer, dialogs, media, login screen
│   ├── hooks/    session, marker state, details cache, modal behaviour
│   └── lib/      icons, formatting, Leaflet setup
├── data/         app.db (gitignored)
└── uploads/      images and videos (gitignored)
```
