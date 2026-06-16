"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = getMe;
exports.updateMe = updateMe;
exports.assignRole = assignRole;
exports.fillModules = fillModules;
exports.clearModule = clearModule;
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
async function getMe(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: { roleSchema: true },
    });
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found");
    return user;
}
async function updateMe(userId, data) {
    return prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            ...(data.name && { name: data.name }),
            ...(data.profileData && { profileData: data.profileData }),
        },
        include: { roleSchema: true }
    });
}
async function assignRole(userId, roleSchemaId) {
    const role = await prisma_1.prisma.roleSchema.findUnique({ where: { id: roleSchemaId } });
    if (!role)
        throw new errorHandler_1.AppError(404, `Role not found: ${roleSchemaId}`);
    return prisma_1.prisma.user.update({
        where: { id: userId },
        data: { roleSchemaId, profileData: {}, moduleData: [] },
        include: { roleSchema: true }
    });
}
async function fillModules(userId, answers) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found");
    if (!user.roleSchemaId)
        throw new errorHandler_1.AppError(400, "No role assigned yet");
    const role = await prisma_1.prisma.roleSchema.findUnique({ where: { id: user.roleSchemaId } });
    if (!role)
        throw new errorHandler_1.AppError(404, "Role schema not found");
    const allModules = [
        ...(role.requireModules ?? []),
        ...(role.provideModules ?? []),
    ];
    const validIds = new Set(allModules.map((m) => m.module_id));
    for (const answer of answers) {
        if (!validIds.has(answer.module_id))
            throw new errorHandler_1.AppError(400, `Module "${answer.module_id}" does not belong to your role`);
    }
    const existing = user.moduleData ?? [];
    const merged = [...existing];
    for (const answer of answers) {
        const idx = merged.findIndex((m) => m.module_id === answer.module_id);
        if (idx >= 0)
            merged[idx] = answer;
        else
            merged.push(answer);
    }
    return prisma_1.prisma.user.update({
        where: { id: userId },
        data: { moduleData: merged },
        include: { roleSchema: true }
    });
}
async function clearModule(userId, moduleId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found");
    const filtered = (user.moduleData ?? [])
        .filter((m) => m.module_id !== moduleId);
    return prisma_1.prisma.user.update({
        where: { id: userId },
        data: { moduleData: filtered },
        include: { roleSchema: true }
    });
}
