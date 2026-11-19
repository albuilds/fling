<p align="center">
  <img src="assets/fling-logo.png" width="96" alt="Fling logo" />
</p>

# Fling

Fling is a cross-platform screen-capture and sharing application built for fast screenshots and short screen recordings. The Electron desktop client captures media, saves it locally, and can upload it to a Next.js web application where users manage captures and share expiring public links.

## Features

- Region and full-screen screenshots on any monitor, including the menu bar
- Region-based screen recording
- Runs quietly in the menu bar / system tray; appears in the Dock or taskbar only while its window is open
- Optional microphone and system audio recording
- Configurable keyboard shortcuts, recording quality, frame rate, and duration
- Local file saving and screenshot clipboard support
- Google sign-in with a browser-based desktop device authorization flow
- Uploads to S3-compatible object storage
- Authenticated capture dashboard with search, filtering, link copying, downloads, and deletion
- Public, expiring image and video share pages with social-media metadata

## Tech stack

| Area                 | Technology                       |
| -------------------- | -------------------------------- |
| Desktop              | Electron, TypeScript, HTML/CSS   |
| Web                  | Next.js 16, React, TypeScript    |
| Authentication       | Auth.js / NextAuth, Google OAuth |
| Database             | PostgreSQL, Prisma               |
| Storage              | S3-compatible object storage     |
| Local infrastructure | Docker Compose                   |
| Testing and CI       | Vitest, GitHub Actions           |

## Project structure

```text
fling/
├── .github/workflows/  # CI: typecheck, tests, and builds
├── apps/
│   ├── desktop/        # Electron capture client
│   │   └── src/
│   │       ├── main.ts     # Entry point
│   │       ├── preload.ts  # The only API pages can call
│   │       ├── app/        # Main process: windows, sign-in, uploads, capture
│   │       ├── scripts/    # Page scripts
│   │       ├── styles/     # Page styles
│   │       └── *.html      # Page markup
│   └── site/           # Next.js API, dashboard, and share pages
│       ├── app/            # Routes, pages, and styles
│       ├── lib/            # Shared server helpers
│       ├── prisma/         # Database schema and migrations
│       └── tests/          # Unit tests
├── LICENSE
└── README.md
```

## How it works

1. The user signs in to the website with Google.
2. The desktop app starts a device authorization request and opens the approval page in the browser.
3. After approval, the desktop app stores an encrypted device token using Electron's secure storage.
4. Screenshots or recordings are saved locally and, when selected, uploaded through the authenticated capture API.
5. Media is stored in S3-compatible storage while capture metadata is stored in PostgreSQL.
6. Fling returns a public share link that can be copied or opened automatically.

## Local development

### Prerequisites

- Node.js 22.12+ (or Node.js 20.19+ / 24+)
- npm
- Docker Desktop
- Google OAuth credentials
- An S3-compatible bucket, such as Backblaze B2 or Amazon S3

### 1. Configure the web application

```bash
cd apps/site
cp .env.example .env
npm install
```

Add the following values to `apps/site/.env`:

```dotenv
APP_BASE_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_SECRET=<random-secret>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
ALLOWED_EMAILS=

DATABASE_URL=postgres://postgres:password@localhost:5432/fling_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=fling_dev

S3_ENDPOINT=<s3-endpoint>
S3_REGION=<s3-region>
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY_ID=<access-key-id>
S3_SECRET_ACCESS_KEY=<secret-access-key>
S3_FORCE_PATH_STYLE=true

MAX_UPLOAD_BYTES=104857600
CLEANUP_SECRET=<random-secret>
```

`ALLOWED_EMAILS` is optional. Leave it blank to allow any Google account, or
provide a comma-separated list to restrict sign-in:

```dotenv
ALLOWED_EMAILS=you@example.com,friend@example.com
```

Create an OAuth web client in Google Cloud and register this local callback URL:

```text
http://localhost:3000/api/auth/callback/google
```

### 2. Start PostgreSQL and initialize Prisma

From `apps/site`:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
npx prisma generate
npx prisma migrate deploy
npm run dev
```

The website will be available at [http://localhost:3000](http://localhost:3000).

### 3. Start the desktop application

In another terminal:

```bash
cd apps/desktop
npm install
npm run dev
```

The desktop client uses `http://localhost:3000` by default. Set `FLING_API_URL` before starting it to use a different backend.

## Validation

```bash
npm --prefix apps/site run typecheck
npm --prefix apps/site test
npm --prefix apps/site run build
npm --prefix apps/desktop run build
```

GitHub Actions runs the same checks on every push to `main` and on pull
requests.

## Expired capture cleanup

Expired captures can be deleted with the cleanup service. First, add a secret to
`apps/site/.env` (you can generate one with `openssl rand -hex 32`):

```dotenv
CLEANUP_SECRET=<random-secret>
```

Run it manually with:

```bash
docker compose --profile maintenance run --rm cleanup
```

To run it every hour on the VPS, open the crontab with `crontab -e` and add:

```cron
17 * * * * cd /path/to/fling/apps/site && /usr/bin/docker compose --profile maintenance run --rm cleanup
```

Replace the path with the actual location of the project on the VPS.

## Troubleshooting

**Screenshots fail with "Failed to get sources" or come out blank (macOS).**
Fling needs Screen Recording permission and shows a dialog that opens the
right settings page. In development, macOS checks the app that launched Fling,
so enable your terminal or editor (for example, Visual Studio Code) under
System Settings → Privacy & Security → Screen & System Audio Recording, then
quit and reopen that app.

**"Access Denied" after Google sign-in.** `ALLOWED_EMAILS` is set and the
account's email isn't in it. Google may report an older address for a renamed
Gmail account; add both, or leave `ALLOWED_EMAILS` empty to allow anyone. In
development the blocked address is printed in the site logs.

**Changes to `.env` don't apply in Docker.** Containers read `.env` when they
are created. Run `docker compose -f docker-compose.dev.yml up -d` again to
recreate them.

**The desktop app says it can't reach the server.** Start the website first
(`http://localhost:3000`), then use **Try again**. A saved sign-in is kept
while the server is down.

## Current status

Fling is a working portfolio prototype. Screenshot and video capture, device sign-in, uploads, dashboard management, and public share pages are implemented.

## License

This project is available under the [MIT License](LICENSE).
