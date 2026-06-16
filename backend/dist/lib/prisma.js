"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const env_1 = require("../config/env");
const globalForPrisma = globalThis;
let prismaInstance;
if (globalForPrisma.prisma) {
    prismaInstance = globalForPrisma.prisma;
}
else {
    const pool = new pg_1.Pool({ connectionString: env_1.env.DATABASE_URL });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    prismaInstance = new client_1.PrismaClient({ adapter, log: ["query", "error"] });
    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = prismaInstance;
    }
}
exports.prisma = prismaInstance;
