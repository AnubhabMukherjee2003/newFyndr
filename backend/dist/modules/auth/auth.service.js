"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../lib/prisma");
const env_1 = require("../../config/env");
const errorHandler_1 = require("../../middleware/errorHandler");
async function register(name, email, password) {
    const emailLower = email.toLowerCase().trim();
    const exists = await prisma_1.prisma.user.findUnique({ where: { email: emailLower } });
    if (exists)
        throw new errorHandler_1.AppError(409, "Email already registered");
    const passwordHash = await bcrypt_1.default.hash(password, 12);
    const user = await prisma_1.prisma.user.create({
        data: { name, email: emailLower, passwordHash },
    });
    return signTokens(user.id, user.role);
}
async function login(email, password) {
    const emailLower = email.toLowerCase().trim();
    const user = await prisma_1.prisma.user.findUnique({ where: { email: emailLower } });
    if (!user)
        throw new errorHandler_1.AppError(401, "Invalid credentials");
    const valid = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!valid)
        throw new errorHandler_1.AppError(401, "Invalid credentials");
    return signTokens(user.id, user.role);
}
async function refresh(refreshToken) {
    try {
        const payload = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET);
        // Verify user still exists
        const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user)
            throw new errorHandler_1.AppError(401, "User not found");
        return signTokens(user.id, user.role);
    }
    catch (e) {
        throw new errorHandler_1.AppError(401, "Invalid or expired refresh token");
    }
}
function signTokens(userId, role) {
    const accessToken = jsonwebtoken_1.default.sign({ userId, role }, env_1.env.JWT_ACCESS_SECRET, { expiresIn: env_1.env.JWT_ACCESS_EXPIRES_IN });
    const refreshToken = jsonwebtoken_1.default.sign({ userId, role }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN });
    return { accessToken, refreshToken };
}
