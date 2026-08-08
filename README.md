# A.b.s.u.r.d. — API

Backend NestJS + MongoDB del juego de piedra, papel o tijera.

Combate **mejor de 5**: cada jugador empieza con 3 corazones y pierde uno por
ronda perdida. El primero que se queda sin corazones pierde. Los empates no
cuestan corazones.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # rellena MONGODB_URI y JWT_SECRET
npm run seed              # siembra los 10 avatares (idempotente)
npm run start:dev
```

`MONGODB_URI` es obligatoria — la app no arranca sin ella.

> **Seguridad:** el repositorio tenía una cadena de conexión de Atlas con
> usuario y contraseña reales en `.env.example`, `scripts/seed.ts`,
> `src/app.module.ts` e `Instructions.txt`. Se quitó de los tres primeros.
> Rota esas credenciales en Atlas y borra la línea de `Instructions.txt`.

## Autenticación

Todas las rutas exigen `Authorization: Bearer <token>` salvo las marcadas como
públicas. El token sale de `/auth/signup`, `/auth/login` o `/auth/guest`.

| Método | Ruta | Público | Descripción |
|---|---|---|---|
| POST | `/auth/signup` | sí | Registro con `name`, `email`, `password`, `age` opcional. Regala 600 créditos. |
| POST | `/auth/login` | sí | Login con correo y contraseña. |
| POST | `/auth/guest` | sí | Cuenta desechable para probar sin registrarse. |
| POST | `/auth/logout` | no | Cierra sesión (el cliente descarta el token). |
| GET | `/auth/me` | no | Perfil del usuario autenticado. |
| GET | `/auth/google` | sí | Inicia OAuth de Google (si está configurado). |
| GET | `/auth/google/callback` | sí | Callback de Google. |
| GET | `/auth/apple` | sí | Sin implementar todavía. |

Al iniciar sesión se actualiza la racha de días seguidos conectado.

## Usuarios

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/users/me` | Perfil completo: créditos, avatar, stats, colección, power ups, rachas. |
| GET | `/users/me/collection` | Avatares comprados. |
| GET | `/users/me/credits/history` | Historial de compras de créditos. |
| PATCH | `/users/me/avatar` | `{ avatarId }` — selecciona un avatar de la colección. |
| POST | `/users/me/avatars/purchase` | `{ avatarId }` — compra un avatar con créditos. |
| PATCH | `/users/me/credits` | `{ amount }` — añade créditos y lo registra. |

El primer avatar comprado se selecciona automáticamente.

## Avatares

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/avatars` | Catálogo completo. |
| GET | `/avatars/:id` | Un avatar. |

Cada avatar tiene `slug`, `name`, `tagline`, `ability`, `rarity`
(`comun` \| `raro` \| `epico` \| `legendario`), `price`, `weapons` y `sprites`.

## Combates

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/matches/join` | `{ powerUps? }` — entra a un combate abierto o crea uno. |
| POST | `/matches/private` | `{ powerUps? }` — crea sala privada, devuelve `roomCode`. |
| POST | `/matches/private/join` | `{ roomCode, powerUps? }` — entra con código. |
| GET | `/matches/active` | Combate en curso del usuario, para reconectar. |
| GET | `/matches/history?limit=20` | Combates terminados. |
| GET | `/matches/:id` | Estado de un combate. |
| POST | `/matches/:id/cancel` | Cancela la búsqueda de rival. |
| POST | `/matches/:id/forfeit` | Abandona: pierde y el rival gana. |
| POST | `/matches/:id/rematch` | Pide revancha del mismo combate. |
| POST | `/matches/:id/powerup` | `{ powerUpId }` — activa un power up. |

`powerUps` acepta hasta 3 identificadores. `vida` y `doble` se consumen al
entrar al combate; el resto al activarlos.

### WebSocket

Namespace `/match`, con `auth.token` y `query.matchId` en el handshake.

**El cliente emite:**

| Evento | Payload | Efecto |
|---|---|---|
| `choice` | `{ choice }` | Registra la jugada de la ronda. |
| `use_powerup` | `{ powerUpId }` | Activa un power up. |
| `forfeit` | — | Abandona el combate. |
| `ping` | — | Latido para no perder por inactividad. |

**El servidor emite:**

| Evento | Payload |
|---|---|
| `match_state` | `{ match, roundTimeout }` al conectar. |
| `player_joined` | `{ userId }` |
| `choice_locked` | `{ choice }` — solo a quien eligió. |
| `opponent_locked` | `{ userId }` — el rival ya eligió, sin revelar qué. |
| `round_result` | `{ round, match, gameOver, winnerId }` |
| `powerup_used` | `{ userId, powerUpId, match }` |
| `powerup_reveal` | `{ choice }` — solo a quien usó "Ojo Chismoso". |
| `opponent_disconnected` | `{ userId, graceMs }` |
| `opponent_reconnected` | `{ userId }` |
| `match_complete` | `{ match, winnerId, reason, unlocked }` |
| `error_message` | `{ message }` |

Reglas de tiempo: 20 s sugeridos por ronda, derrota tras 60 s de inactividad
total y 30 s de gracia para reconectar antes de perder por desconexión.

### Economía del combate

- 40 créditos por ronda ganada, se cobran aunque pierdas.
- 100 extra por ganar el combate, 20 de consolación por perderlo.
- Con **Doble o Nada** el total se duplica si ganas y es 0 si no.

## Power ups

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/powerups` | Catálogo con lo que ya posees y si te alcanzan los créditos. |
| GET | `/powerups/inventory` | Mapa `id -> cantidad`. |
| POST | `/powerups/purchase` | `{ powerUpId, quantity? }` |

| id | Nombre | Precio | Efecto |
|---|---|---|---|
| `escudo` | Escudo Absurdo | 300 | Bloquea el próximo corazón que perderías. |
| `critico` | Golpe Crítico | 500 | Ganas la siguiente ronda sí o sí. |
| `vida` | Vida Extra | 700 | Empiezas con 4 corazones. |
| `revelar` | Ojo Chismoso | 450 | Espía la jugada del rival una vez. |
| `curita` | Curita Mágica | 400 | Recupera 1 corazón. |
| `doble` | Doble o Nada | 600 | Doble premio si ganas, nada si pierdes. |

Si ambos jugadores usan Golpe Crítico en la misma ronda, se anulan y hay empate.

## Logros

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/achievements` | Catálogo con progreso, desbloqueo y si ya se reclamó. |
| POST | `/achievements/:id/claim` | Cobra los créditos de un logro desbloqueado. |

El progreso se recalcula solo después de cada combate. `match_complete` incluye
en `unlocked` los logros recién conseguidos por cada jugador.

## Ranking

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/rankings?limit=50` | `{ top, me }` ordenado por victorias, desempate por menos derrotas. |

`me` viene siempre, con la posición real aunque no esté en el top. Las cuentas
de invitado no aparecen.

## Torneos

Eliminación directa de 4 u 8 jugadores. El bracket se sortea al llenarse.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/tournaments` | Torneos públicos abiertos o en curso. |
| GET | `/tournaments/mine` | Torneos donde participas. |
| GET | `/tournaments/:id` | Detalle con bracket. |
| POST | `/tournaments` | `{ name, size?, isPrivate?, entryFee? }` |
| POST | `/tournaments/:id/join` | `{ joinCode? }` — el código hace falta si es privado. |
| POST | `/tournaments/:id/leave` | Salir antes de empezar; devuelve la entrada. |
| POST | `/tournaments/:id/play` | Crea o recupera el combate de tu cruce pendiente. |

Las entradas se acumulan en `prizePool` y se las lleva el campeón. Al terminar
un combate de torneo el bracket avanza solo.

## Limitaciones conocidas

- Las jugadas de la ronda en curso se guardan en memoria del proceso. Con más
  de una instancia haría falta Redis o moverlas al documento del combate.
- Apple Sign In está declarado pero sin implementar.
- `test/app.e2e-spec.ts` no compila por un desajuste de tipos de `supertest`;
  viene de antes de este refactor.
