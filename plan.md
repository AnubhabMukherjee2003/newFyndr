# Dynamic Role Matching Engine — Project Plan

## Overview

A fully dynamic matchmaking backend where an admin defines roles, modules, and matching rules at runtime. Users sign up, get assigned a role, fill in their module data, and receive a scored feed of relevant candidates.

---

## Goals

- Admin can create, update, and delete role schemas with require/provide modules at runtime — no code changes needed
- Users can register, pick a role, fill profile + module data, and view a scored feed
- Feed is two-tiered: module-matched candidates score higher, role-assigned candidates appear as base
- Like / pass / match state is tracked and filters the feed
- All data is type-safe end to end (TypeScript + Prisma + Zod)

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js | Engine already in JS/TS |
| Framework | Express | Lightweight, full control |
| Language | TypeScript | Type safety across engine + API |
| ORM | Prisma | Type-safe DB access + migrations |
| Database | PostgreSQL | JSONB for dynamic module data, relational for users/interactions |
| Auth | JWT (self-managed) | No third-party dependency, access + refresh token pattern |
| Validation | Zod | Runtime schema validation on all request bodies |
| Password | bcrypt | Industry standard hashing |

---

## Data Model

### User
```
id             cuid (PK)
name           string
email          string (unique)
passwordHash   string
role           enum USER | ADMIN
roleSchemaId   string? (FK → RoleSchema)
profileData    JSON   { [field]: value }
moduleData     JSON   [{ module_id, data }]
createdAt      datetime
```

### RoleSchema
```
id              cuid (PK)
roleName        string
assignedRoles   string[]   — array of RoleSchema ids
profileTemplate JSON       — { fieldName: type }
requireModules  JSON       — ModuleEntry[]
provideModules  JSON       — ModuleEntry[]
createdAt       datetime
```

### Interaction
```
id          cuid (PK)
senderId    string (FK → User)
receiverId  string (FK → User)
type        enum LIKE | PASS | MATCH
createdAt   datetime

unique(senderId, receiverId)
```

### ModuleEntry (JSON shape, not a table)
```
module_id   string
data        null (schema) | any (user-filled)
weight      number
target_role string | null
question    string
input_type  enum
options     string[] | null
data_type   enum
match_type  enum
```

---

## API Surface

### Auth
```
POST /api/auth/register   — name, email, password → token
POST /api/auth/login      — email, password → token
POST /api/auth/refresh    — refresh token → new access token
```

### Users (authenticated)
```
GET    /api/users/me                — own profile
PATCH  /api/users/me                — update name / profileData
POST   /api/users/me/role           — assign a role schema
POST   /api/users/me/modules        — fill module answers (batch)
DELETE /api/users/me/modules/:id    — clear one module answer
```

### Feed (authenticated)
```
GET /api/feed   — scored, sorted feed for the current user
```

### Interactions (authenticated)
```
POST /api/interactions/like/:targetId
POST /api/interactions/pass/:targetId
GET  /api/interactions/matches       — all mutual matches
```

### Admin (authenticated + ADMIN role)
```
POST   /api/admin/roles           — create role schema
GET    /api/admin/roles           — list all role schemas
GET    /api/admin/roles/:id       — get one
PATCH  /api/admin/roles/:id       — update
DELETE /api/admin/roles/:id       — delete (fails if users assigned)
GET    /api/admin/roles/hints     — propagation hints
```

---

## Matching Engine

The engine (`src/engine/matchingEngine.ts`) stays **pure** — no database calls inside it. The feed service loads data from Prisma, deserializes JSON fields into typed objects, and hands them to the engine.

### Feed tiers

| Tier | Condition | Score |
|---|---|---|
| Scored (Tier 2) | Candidate role targeted by a require_module AND provides that module_id | > 0 (weighted Jaccard / numeric / range / boolean / exact) |
| Base (Tier 1) | Candidate role in assigned_roles but no module link | 0 |

### Match algorithms

| MatchType | DataType | Algorithm |
|---|---|---|
| OVERLAP_MATCH | VECTOR | Jaccard intersection / union |
| EXACT_MATCH | TEXT | Case-insensitive equality |
| BOOLEAN_MATCH | BOOLEAN | Strict equality |
| NUMERIC_MATCH | NUMERIC | provided ≥ required → 1, else decay |
| RANGE_MATCH | RANGE | overlap / required length |

---

## Auth Design

- **Access token** — JWT, 15 minute expiry, payload `{ userId, role }`
- **Refresh token** — JWT, 7 day expiry, stored in httpOnly cookie
- `auth` middleware verifies access token on every protected route, attaches `req.user`
- `adminOnly` middleware checks `req.user.role === ADMIN`, used on all `/api/admin/*` routes

---

## Build Order

1. Project setup — TypeScript, ESLint, Prisma init
2. Prisma schema + first migration
3. Auth module — register, login, refresh, middleware
4. Roles module — admin CRUD + propagation hints
5. Users module — assignRole, fillModuleData, profile update
6. Feed module — bridge engine to Prisma data
7. Interactions module — like, pass, match derivation

---

## Out of Scope (MVP)

- Email verification
- Password reset flow
- Push notifications
- Feed caching (Redis)
- Rate limiting
- Pagination (feed is capped at 20)
- File uploads (profile photos)
