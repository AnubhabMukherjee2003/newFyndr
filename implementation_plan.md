# Dynamic Role Matching Engine — Implementation Guide

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (or a Neon / Railway connection string)
- pnpm or npm

---

## Step 1 — Project setup

```bash
mkdir matching-backend && cd matching-backend
pnpm init
pnpm add express prisma @prisma/client bcrypt jsonwebtoken zod dotenv
pnpm add -D typescript ts-node-dev @types/express @types/bcrypt @types/jsonwebtoken @types/node
npx tsc --init
npx prisma init
```

`tsconfig.json` — key settings:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

`package.json` scripts:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "migrate": "prisma migrate dev",
    "generate": "prisma generate"
  }
}
```

---

## Step 2 — Environment config

`.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/matching_db"
JWT_ACCESS_SECRET="your-access-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=4000
```

`src/config/env.ts`:
```typescript
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  DATABASE_URL:          z.string().url(),
  JWT_ACCESS_SECRET:     z.string().min(32),
  JWT_REFRESH_SECRET:    z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN:z.string().default("7d"),
  PORT:                  z.coerce.number().default(4000),
});

export const env = envSchema.parse(process.env);
```

---

## Step 3 — Prisma schema

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String      @id @default(cuid())
  name         String
  email        String      @unique
  passwordHash String
  role         UserRole    @default(USER)
  roleSchemaId String?
  roleSchema   RoleSchema? @relation(fields: [roleSchemaId], references: [id])
  profileData  Json        @default("{}")
  moduleData   Json        @default("[]")
  createdAt    DateTime    @default(now())

  sentInteractions     Interaction[] @relation("Sender")
  receivedInteractions Interaction[] @relation("Receiver")
}

enum UserRole {
  USER
  ADMIN
}

model RoleSchema {
  id              String   @id @default(cuid())
  roleName        String
  assignedRoles   String[]
  profileTemplate Json     @default("{}")
  requireModules  Json     @default("[]")
  provideModules  Json     @default("[]")
  createdAt       DateTime @default(now())
  users           User[]
}

model Interaction {
  id         String          @id @default(cuid())
  senderId   String
  receiverId String
  type       InteractionType
  createdAt  DateTime        @default(now())

  sender   User @relation("Sender",   fields: [senderId],   references: [id])
  receiver User @relation("Receiver", fields: [receiverId], references: [id])

  @@unique([senderId, receiverId])
}

enum InteractionType {
  LIKE
  PASS
  MATCH
}
```

Run the migration:
```bash
pnpm migrate --name init
```

---

## Step 4 — Prisma singleton

`src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["query", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

## Step 5 — Express app

`src/app.ts`:
```typescript
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes         from "./modules/auth/auth.routes";
import usersRoutes        from "./modules/users/users.routes";
import rolesRoutes        from "./modules/roles/roles.routes";
import feedRoutes         from "./modules/feed/feed.routes";
import interactionsRoutes from "./modules/interactions/interactions.routes";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth",         authRoutes);
app.use("/api/users",        usersRoutes);
app.use("/api/admin/roles",  rolesRoutes);
app.use("/api/feed",         feedRoutes);
app.use("/api/interactions", interactionsRoutes);

app.use(errorHandler);

app.listen(env.PORT, () =>
  console.log(`Server running on port ${env.PORT}`)
);

export default app;
```

---

## Step 6 — Middleware

`src/middleware/errorHandler.ts`:
```typescript
import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err instanceof AppError ? err.statusCode : 500;
  res.status(status).json({ error: err.message });
}
```

`src/middleware/auth.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export interface JwtPayload {
  userId: string;
  role:   "USER" | "ADMIN";
}

declare global {
  namespace Express {
    interface Request { user: JwtPayload; }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return next(new AppError(401, "No token provided"));

  try {
    const token   = header.split(" ")[1];
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user      = payload;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}
```

`src/middleware/adminOnly.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

export function adminOnly(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN")
    return next(new AppError(403, "Admin access required"));
  next();
}
```

---

## Step 7 — Auth module

`src/modules/auth/auth.service.ts`:
```typescript
import bcrypt from "bcrypt";
import jwt    from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { env }    from "../../config/env";
import { AppError } from "../../middleware/errorHandler";

export async function register(name: string, email: string, password: string) {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new AppError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  return signTokens(user.id, user.role as "USER" | "ADMIN");
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, "Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, "Invalid credentials");

  return signTokens(user.id, user.role as "USER" | "ADMIN");
}

function signTokens(userId: string, role: "USER" | "ADMIN") {
  const accessToken = jwt.sign(
    { userId, role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
  const refreshToken = jwt.sign(
    { userId, role },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
  return { accessToken, refreshToken };
}
```

`src/modules/auth/auth.controller.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "./auth.service";

const registerSchema = z.object({
  name:     z.string().min(1),
  email:    z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const tokens = await authService.register(name, email, password);
    res.cookie("refreshToken", tokens.refreshToken, { httpOnly: true, sameSite: "strict" });
    res.status(201).json({ accessToken: tokens.accessToken });
  } catch (e) { next(e); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const tokens = await authService.login(email, password);
    res.cookie("refreshToken", tokens.refreshToken, { httpOnly: true, sameSite: "strict" });
    res.json({ accessToken: tokens.accessToken });
  } catch (e) { next(e); }
}
```

`src/modules/auth/auth.routes.ts`:
```typescript
import { Router } from "express";
import * as c from "./auth.controller";

const router = Router();
router.post("/register", c.register);
router.post("/login",    c.login);
export default router;
```

---

## Step 8 — Roles module (admin)

`src/modules/roles/roles.service.ts`:
```typescript
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/errorHandler";

export async function createRole(data: {
  roleName: string;
  assignedRoles: string[];
  profileTemplate: object;
  requireModules: object[];
  provideModules: object[];
}) {
  return prisma.roleSchema.create({ data });
}

export async function listRoles() {
  return prisma.roleSchema.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getRole(id: string) {
  const role = await prisma.roleSchema.findUnique({ where: { id } });
  if (!role) throw new AppError(404, `Role not found: ${id}`);
  return role;
}

export async function updateRole(id: string, data: Partial<{
  roleName: string;
  assignedRoles: string[];
  profileTemplate: object;
  requireModules: object[];
  provideModules: object[];
}>) {
  await getRole(id);
  return prisma.roleSchema.update({ where: { id }, data });
}

export async function deleteRole(id: string) {
  await getRole(id);
  const usersOnRole = await prisma.user.count({ where: { roleSchemaId: id } });
  if (usersOnRole > 0)
    throw new AppError(400, `Cannot delete role — ${usersOnRole} user(s) still assigned`);
  return prisma.roleSchema.delete({ where: { id } });
}

export async function getPropagationHints() {
  const roles = await prisma.roleSchema.findMany();
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]));
  const hints = [];

  for (const schema of roles) {
    const requireModules = schema.requireModules as any[];
    for (const mod of requireModules) {
      if (!mod.target_role) continue;
      const target = roleMap[mod.target_role];
      const provideModules = (target?.provideModules ?? []) as any[];
      const mirrored = provideModules.some(p => p.module_id === mod.module_id);
      hints.push({
        source_role:      schema.roleName,
        source_role_id:   schema.id,
        module_id:        mod.module_id,
        target_role_id:   mod.target_role,
        target_role_name: target?.roleName ?? mod.target_role,
        already_mirrored: mirrored,
        action: mirrored
          ? `✓ Already mirrored in ${target?.roleName}.provideModules`
          : `Add "${mod.module_id}" to ${target?.roleName ?? mod.target_role}.provideModules`,
      });
    }
  }
  return hints;
}
```

`src/modules/roles/roles.routes.ts`:
```typescript
import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { adminOnly }    from "../../middleware/adminOnly";
import * as c from "./roles.controller";

const router = Router();
router.use(authenticate, adminOnly);

router.post  ("/",         c.createRole);
router.get   ("/",         c.listRoles);
router.get   ("/hints",    c.getHints);
router.get   ("/:id",      c.getRole);
router.patch ("/:id",      c.updateRole);
router.delete("/:id",      c.deleteRole);

export default router;
```

---

## Step 9 — Users module

`src/modules/users/users.service.ts`:
```typescript
import { prisma }   from "../../lib/prisma";
import { AppError } from "../../middleware/errorHandler";

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleSchema: true },
  });
  if (!user) throw new AppError(404, "User not found");
  return user;
}

export async function updateMe(userId: string, data: { name?: string; profileData?: object }) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name        && { name: data.name }),
      ...(data.profileData && { profileData: data.profileData }),
    },
  });
}

export async function assignRole(userId: string, roleSchemaId: string) {
  const role = await prisma.roleSchema.findUnique({ where: { id: roleSchemaId } });
  if (!role) throw new AppError(404, `Role not found: ${roleSchemaId}`);

  return prisma.user.update({
    where: { id: userId },
    data:  { roleSchemaId, profileData: {}, moduleData: [] },
  });
}

export async function fillModules(
  userId: string,
  answers: { module_id: string; data: unknown }[]
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");
  if (!user.roleSchemaId) throw new AppError(400, "No role assigned yet");

  const role = await prisma.roleSchema.findUnique({ where: { id: user.roleSchemaId } });
  const allModules = [
    ...((role!.requireModules as any[]) ?? []),
    ...((role!.provideModules as any[]) ?? []),
  ];
  const validIds = new Set(allModules.map((m: any) => m.module_id));

  for (const answer of answers) {
    if (!validIds.has(answer.module_id))
      throw new AppError(400, `Module "${answer.module_id}" does not belong to your role`);
  }

  const existing = (user.moduleData as any[]) ?? [];
  const merged   = [...existing];

  for (const answer of answers) {
    const idx = merged.findIndex((m: any) => m.module_id === answer.module_id);
    if (idx >= 0) merged[idx] = answer;
    else merged.push(answer);
  }

  return prisma.user.update({
    where: { id: userId },
    data:  { moduleData: merged },
  });
}

export async function clearModule(userId: string, moduleId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  const filtered = ((user.moduleData as any[]) ?? [])
    .filter((m: any) => m.module_id !== moduleId);

  return prisma.user.update({
    where: { id: userId },
    data:  { moduleData: filtered },
  });
}
```

`src/modules/users/users.routes.ts`:
```typescript
import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as c from "./users.controller";

const router = Router();
router.use(authenticate);

router.get   ("/me",                c.getMe);
router.patch ("/me",                c.updateMe);
router.post  ("/me/role",           c.assignRole);
router.post  ("/me/modules",        c.fillModules);
router.delete("/me/modules/:id",    c.clearModule);

export default router;
```

---

## Step 10 — Feed module

`src/modules/feed/feed.service.ts`:
```typescript
import { prisma }        from "../../lib/prisma";
import { AppError }      from "../../middleware/errorHandler";
import { generateFeed }  from "../../engine/matchingEngine";

export async function getFeed(userId: string) {
  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!currentUser)       throw new AppError(404, "User not found");
  if (!currentUser.roleSchemaId) throw new AppError(400, "Assign a role before viewing feed");

  // fetch all other users who have a role assigned
  const candidates = await prisma.user.findMany({
    where: { id: { not: userId }, roleSchemaId: { not: null } },
  });

  // fetch all role schemas in one query
  const roleIds = [
    currentUser.roleSchemaId,
    ...candidates.map(c => c.roleSchemaId!),
  ];
  const schemas = await prisma.roleSchema.findMany({
    where: { id: { in: [...new Set(roleIds)] } },
  });
  const schemaMap = Object.fromEntries(schemas.map(s => [s.id, s]));

  // shape data to match what the engine expects
  function toEngineUser(u: typeof currentUser) {
    const schema = schemaMap[u.roleSchemaId!];
    return {
      id:             u.id,
      name:           u.name,
      email:          u.email,
      role_schema_id: u.roleSchemaId,
      profile_data:   u.profileData as object,
      module_data:    u.moduleData  as { module_id: string; data: unknown }[],
      _schema:        schema,    // attached for engine use
    };
  }

  const engineUser       = toEngineUser(currentUser);
  const engineCandidates = candidates.map(toEngineUser);

  return generateFeed(engineUser as any, engineCandidates as any);
}
```

`src/modules/feed/feed.routes.ts`:
```typescript
import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as c from "./feed.controller";

const router = Router();
router.use(authenticate);
router.get("/", c.getFeed);
export default router;
```

---

## Step 11 — Interactions module

`src/modules/interactions/interactions.service.ts`:
```typescript
import { prisma }   from "../../lib/prisma";
import { AppError } from "../../middleware/errorHandler";

export async function like(senderId: string, receiverId: string) {
  if (senderId === receiverId) throw new AppError(400, "Cannot like yourself");

  // upsert the like
  await prisma.interaction.upsert({
    where:  { senderId_receiverId: { senderId, receiverId } },
    create: { senderId, receiverId, type: "LIKE" },
    update: { type: "LIKE" },
  });

  // check if the other side already liked back → create MATCH for both
  const reverse = await prisma.interaction.findUnique({
    where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
  });

  if (reverse?.type === "LIKE") {
    await prisma.$transaction([
      prisma.interaction.update({
        where: { senderId_receiverId: { senderId, receiverId } },
        data:  { type: "MATCH" },
      }),
      prisma.interaction.update({
        where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
        data:  { type: "MATCH" },
      }),
    ]);
    return { matched: true };
  }

  return { matched: false };
}

export async function pass(senderId: string, receiverId: string) {
  await prisma.interaction.upsert({
    where:  { senderId_receiverId: { senderId, receiverId } },
    create: { senderId, receiverId, type: "PASS" },
    update: { type: "PASS" },
  });
  return { passed: true };
}

export async function getMatches(userId: string) {
  return prisma.interaction.findMany({
    where:   { senderId: userId, type: "MATCH" },
    include: { receiver: { select: { id: true, name: true, email: true, profileData: true } } },
  });
}
```

`src/modules/interactions/interactions.routes.ts`:
```typescript
import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as c from "./interactions.controller";

const router = Router();
router.use(authenticate);

router.post("/like/:targetId",  c.like);
router.post("/pass/:targetId",  c.pass);
router.get ("/matches",         c.getMatches);

export default router;
```

---

## Response shapes

### Auth
```json
{ "accessToken": "eyJ..." }
```

### Feed item
```json
{
  "user": { "id": "...", "name": "Alice", "profileData": {} },
  "score": 0.75,
  "match_tier": "scored"
}
```

### Interaction
```json
{ "matched": true }
```

### Error
```json
{ "error": "Email already registered" }
```

---

## Testing endpoints (curl)

```bash
# register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"password123"}'

# login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"password123"}'

# assign role (use token from login)
curl -X POST http://localhost:4000/api/users/me/role \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"roleSchemaId":"<id>"}'

# fill modules
curl -X POST http://localhost:4000/api/users/me/modules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"answers":[{"module_id":"learning-module-id","data":["Math","Physics"]}]}'

# get feed
curl http://localhost:4000/api/feed \
  -H "Authorization: Bearer <token>"
```
