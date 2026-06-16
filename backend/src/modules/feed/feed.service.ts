import { prisma }        from "../../lib/prisma";
import { AppError }      from "../../middleware/errorHandler";
import { generateFeed }  from "../../engine/matchingEngine";

export async function getFeed(userId: string) {
  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!currentUser)       throw new AppError(404, "User not found");
  if (!currentUser.roleSchemaId) throw new AppError(400, "Assign a role before viewing feed");

  // Fetch all user IDs that the current user has already interacted with (LIKE, PASS, MATCH)
  const interactions = await prisma.interaction.findMany({
    where: { senderId: userId },
    select: { receiverId: true },
  });
  const excludedUserIds = [userId, ...interactions.map(i => i.receiverId)];

  // Fetch all other users who have a role assigned and haven't been interacted with yet
  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: excludedUserIds },
      roleSchemaId: { not: null },
    },
  });

  // Fetch all relevant role schemas in one query
  const roleIds = [
    currentUser.roleSchemaId,
    ...candidates.map(c => c.roleSchemaId!),
  ];
  
  const schemas = await prisma.roleSchema.findMany({
    where: { id: { in: [...new Set(roleIds)] } },
  });
  const schemaMap = Object.fromEntries(schemas.map(s => [s.id, s]));

  // Shape data to match what the engine expects
  function toEngineUser(u: any) {
    const schema = schemaMap[u.roleSchemaId!];
    return {
      id:             u.id,
      name:           u.name,
      email:          u.email,
      role_schema_id: u.roleSchemaId,
      roleSchemaId:   u.roleSchemaId,
      profile_data:   u.profileData as object,
      profileData:    u.profileData as object,
      module_data:    u.moduleData  as { module_id: string; data: unknown }[],
      moduleData:     u.moduleData  as { module_id: string; data: unknown }[],
      _schema:        schema ? {
        id:              schema.id,
        role_name:       schema.roleName,
        roleName:        schema.roleName,
        assigned_roles:  schema.assignedRoles,
        assignedRoles:   schema.assignedRoles,
        profile_template:schema.profileTemplate as any,
        profileTemplate: schema.profileTemplate as any,
        require_modules: schema.requireModules as any[],
        requireModules:  schema.requireModules as any[],
        provide_modules: schema.provideModules as any[],
        provideModules:  schema.provideModules as any[],
      } : undefined,
    };
  }

  const engineUser       = toEngineUser(currentUser);
  const engineCandidates = candidates.map(toEngineUser);

  return generateFeed(engineUser as any, engineCandidates as any);
}
