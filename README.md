# Absurd API

NestJS API for the Absurd rock-paper-scissors game: users, avatars, matches (REST + WebSocket), auth, and credits.

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `JWT_SECRET`, and optional OAuth vars. On Railway, set these in the service environment (Railway sets `PORT` for you).
2. Install and run:
   ```bash
   npm install
   npm run start:dev
   ```
3. API base URL: `http://localhost:3000` (or `PORT` from env).

### Seed data

To create 4 avatars and 10 users (all with password `password123`):

```bash
npm run seed
```

- **Avatars:** Blaze (5 credits), Frost (8), Shadow (12), Titan (15).
- **Users:** alice@example.com … jack@example.com. First 7 have the Blaze avatar; first 4 also have Frost. Re-run only works on an empty DB; clear `avatars` and `users` collections to re-seed.

## Endpoints

All routes except health and auth (signup/login/OAuth) require a valid JWT in the `Authorization: Bearer <token>` header.

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Health check. Returns `{ ok: true, service: 'absurd-api' }`. |

### Auth

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/auth/signup` | No | `{ name, email, password }` | Register with email/password. Returns `{ access_token, user }`. |
| POST | `/auth/login` | No | `{ email, password }` | Login. Returns `{ access_token, user }`. |
| POST | `/auth/logout` | Yes | - | Logout (client should discard token). |
| GET | `/auth/me` | Yes | - | Current user profile (same as `GET /users/me`). |
| GET | `/auth/google` | No | - | Redirect to Google OAuth. |
| GET | `/auth/google/callback` | No | - | Google OAuth callback. Returns token + user when configured. |
| GET | `/auth/apple` | No | - | Placeholder; returns 501 until Apple Sign In is configured. |
| GET | `/auth/apple/callback` | No | - | Placeholder; returns 501. |

### Users

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| GET | `/users/me` | Yes | - | Current user (profile, credits, stats, collection, avatar). |
| PATCH | `/users/me/avatar` | Yes | `{ avatarId }` | Set active avatar (must be in collection). |
| POST | `/users/me/avatars/purchase` | Yes | `{ avatarId }` | Purchase avatar with credits; adds to collection. |
| PATCH | `/users/me/credits` | Yes | `{ amount }` | Add credits and record purchase history. |

### Avatars

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/avatars` | Yes | List all avatars. |
| GET | `/avatars/:id` | Yes | Get one avatar by ID. |

### Matches

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/matches/join` | Yes | Create a new match or join one in "Searching". Requires user to have an avatar. Returns match (with `_id`). |
| GET | `/matches/:id` | Yes | Get match by ID (rounds, status, players, log). |

### WebSocket (Matches)

- **Namespace:** `/match`
- **URL:** `http://localhost:3000` (same origin) or `ws://localhost:3000` for WS.
- **Query params:** `matchId`, `token` (JWT) — or pass `token` in auth object when connecting.
- **Events:**
  - **Client → Server:** `choice` with payload `{ choice: 'rock' | 'paper' | 'scissors' }`.
  - **Server → Client:** `match_state` (initial match on join), `round_result` (after both chose), `match_complete` (game over or forfeit by inactivity).

Rules: first to 3 round wins wins the match. If a player is inactive for 1 minute, they forfeit and the opponent wins.

## Models (summary)

- **User:** name, email, password (optional), credits (default 10), avatar (ref), stats (wins, draws, loses), collection (avatar, price, timestamp).
- **Avatar:** name, weapons (rock/paper/scissors: title, description, images, settings), sprites (profile, base, attack, damage), stats, price.
- **Match:** player1, player2 (userId, avatarId), rounds[], matchWinner, status (Searching | In progress | Complete), log[], timestamp.

## Deploy on Railway

You can run the API on [Railway](https://railway.com) **with or without Docker**.

### Option A: Without Docker (recommended)

1. Create a new project on Railway and add a service from your repo (or use `railway init` + `railway up`).
2. Railway will use `railway.toml` to run `npm run build` and `npm run start:prod`. No Docker needed.
3. Set **environment variables** in the Railway service:
   - `MONGODB_URI` – your MongoDB connection string (e.g. Atlas).
   - `JWT_SECRET` – strong secret for production.
   - `JWT_EXPIRES_IN` – optional (default `7d`).
   - `PORT` – set automatically by Railway; the app already uses `process.env.PORT ?? 3000`.
   - For Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` = `https://<your-railway-domain>/auth/google/callback`.
4. Deploy. Railway will assign a public URL; use it as the API base (and for WebSocket: `wss://<your-domain>`).

### Option B: With Docker

1. In the Railway service, set the **builder** to **Dockerfile** (in the service settings or by having a `Dockerfile` in the repo and selecting it).
2. Set the same environment variables as above.
3. Deploy. Railway builds the image from the Dockerfile and runs the app.

The repo includes both `railway.toml` (for non-Docker) and a `Dockerfile` (optional, for a reproducible container build).

## Postman

Import `postman/absurd-api.postman_collection.json` and set the collection variable `baseUrl` (e.g. `http://localhost:3000`) and `token` after login (or use a pre-request script to login and set `token`).
