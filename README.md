# Fling

Fling is a cross-platform screen-capture and sharing application built for fast screenshots and short screen recordings. The Electron desktop client captures media, saves it locally, and can upload it to a Next.js web application where users manage captures and share expiring public links.

## Features

- Region and full-screen screenshots
- Region-based screen recording
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
| Web                  | Next.js 15, React, TypeScript    |
| Authentication       | Auth.js / NextAuth, Google OAuth |
| Database             | PostgreSQL, Prisma               |
| Storage              | S3-compatible object storage     |
| Local infrastructure | Docker Compose                   |

## Project structure

```text
fling/
├── apps/
│   ├── desktop/    # Electron capture client
│   └── site/       # Next.js API, dashboard, and share pages
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

- Node.js 22+
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
npm --prefix apps/site run build
npm --prefix apps/desktop run build
```

## Current status

Fling is a working portfolio prototype. Screenshot and video capture, device sign-in, uploads, dashboard management, and public share pages are implemented.

## License

This project is available under the [MIT License](LICENSE).
