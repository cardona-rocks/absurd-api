# Absurd API

NestJS API for the Absurd rock-paper-scissors game: users, avatars, matches (REST + WebSocket), auth, and credits.

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `JWT_SECRET`, and optional OAuth vars.
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

## Postman

Import `postman/absurd-api.postman_collection.json` and set the collection variable `baseUrl` (e.g. `http://localhost:3000`) and `token` after login (or use a pre-request script to login and set `token`).
