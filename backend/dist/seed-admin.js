"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./lib/prisma");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function main() {
    const email = "admin@test.com";
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log("Admin user already exists.");
        return;
    }
    const passwordHash = await bcrypt_1.default.hash("adminpassword", 12);
    const admin = await prisma_1.prisma.user.create({
        data: {
            name: "Admin",
            email,
            passwordHash,
            role: "ADMIN",
        },
    });
    console.log("Admin user created successfully:", admin.email);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
