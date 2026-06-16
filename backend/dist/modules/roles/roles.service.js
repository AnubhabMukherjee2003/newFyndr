"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRole = createRole;
exports.listRoles = listRoles;
exports.getRole = getRole;
exports.updateRole = updateRole;
exports.deleteRole = deleteRole;
exports.getPropagationHints = getPropagationHints;
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
async function createRole(data) {
    return prisma_1.prisma.roleSchema.create({
        data: {
            ...(data.id && { id: data.id }),
            roleName: data.roleName,
            assignedRoles: data.assignedRoles,
            profileTemplate: data.profileTemplate,
            requireModules: data.requireModules,
            provideModules: data.provideModules,
        }
    });
}
async function listRoles() {
    return prisma_1.prisma.roleSchema.findMany({ orderBy: { createdAt: "asc" } });
}
async function getRole(id) {
    const role = await prisma_1.prisma.roleSchema.findUnique({ where: { id } });
    if (!role)
        throw new errorHandler_1.AppError(404, `Role not found: ${id}`);
    return role;
}
async function updateRole(id, data) {
    await getRole(id);
    return prisma_1.prisma.roleSchema.update({ where: { id }, data });
}
async function deleteRole(id) {
    await getRole(id);
    const usersOnRole = await prisma_1.prisma.user.count({ where: { roleSchemaId: id } });
    if (usersOnRole > 0)
        throw new errorHandler_1.AppError(400, `Cannot delete role — ${usersOnRole} user(s) still assigned`);
    return prisma_1.prisma.roleSchema.delete({ where: { id } });
}
async function getPropagationHints() {
    const roles = await prisma_1.prisma.roleSchema.findMany();
    const roleMap = Object.fromEntries(roles.map(r => [r.id, r]));
    const hints = [];
    for (const schema of roles) {
        const requireModules = schema.requireModules ?? [];
        for (const mod of requireModules) {
            if (!mod.target_role)
                continue;
            const target = roleMap[mod.target_role];
            const provideModules = (target?.provideModules ?? []);
            const mirrored = provideModules.some(p => p.module_id === mod.module_id);
            hints.push({
                source_role: schema.roleName,
                source_role_id: schema.id,
                module_id: mod.module_id,
                target_role_id: mod.target_role,
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
