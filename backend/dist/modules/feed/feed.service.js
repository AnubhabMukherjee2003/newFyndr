"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFeed = getFeed;
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const matchingEngine_1 = require("../../engine/matchingEngine");
async function getFeed(userId) {
    const currentUser = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser)
        throw new errorHandler_1.AppError(404, "User not found");
    if (!currentUser.roleSchemaId)
        throw new errorHandler_1.AppError(400, "Assign a role before viewing feed");
    // Fetch all user IDs that the current user has already interacted with (LIKE, PASS, MATCH)
    const interactions = await prisma_1.prisma.interaction.findMany({
        where: { senderId: userId },
        select: { receiverId: true },
    });
    const excludedUserIds = [userId, ...interactions.map(i => i.receiverId)];
    // Fetch all other users who have a role assigned and haven't been interacted with yet
    const candidates = await prisma_1.prisma.user.findMany({
        where: {
            id: { notIn: excludedUserIds },
            roleSchemaId: { not: null },
        },
    });
    // Fetch all relevant role schemas in one query
    const roleIds = [
        currentUser.roleSchemaId,
        ...candidates.map(c => c.roleSchemaId),
    ];
    const schemas = await prisma_1.prisma.roleSchema.findMany({
        where: { id: { in: [...new Set(roleIds)] } },
    });
    const schemaMap = Object.fromEntries(schemas.map(s => [s.id, s]));
    // Shape data to match what the engine expects
    function toEngineUser(u) {
        const schema = schemaMap[u.roleSchemaId];
        return {
            id: u.id,
            name: u.name,
            email: u.email,
            role_schema_id: u.roleSchemaId,
            roleSchemaId: u.roleSchemaId,
            profile_data: u.profileData,
            profileData: u.profileData,
            module_data: u.moduleData,
            moduleData: u.moduleData,
            _schema: schema ? {
                id: schema.id,
                role_name: schema.roleName,
                roleName: schema.roleName,
                assigned_roles: schema.assignedRoles,
                assignedRoles: schema.assignedRoles,
                profile_template: schema.profileTemplate,
                profileTemplate: schema.profileTemplate,
                require_modules: schema.requireModules,
                requireModules: schema.requireModules,
                provide_modules: schema.provideModules,
                provideModules: schema.provideModules,
            } : undefined,
        };
    }
    const engineUser = toEngineUser(currentUser);
    const engineCandidates = candidates.map(toEngineUser);
    return (0, matchingEngine_1.generateFeed)(engineUser, engineCandidates);
}
