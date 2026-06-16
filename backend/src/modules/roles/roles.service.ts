import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/errorHandler";

export async function createRole(data: {
  id?: string;
  roleName: string;
  assignedRoles: string[];
  profileTemplate: object;
  requireModules: object[];
  provideModules: object[];
}) {
  return prisma.roleSchema.create({
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
    const requireModules = (schema.requireModules as any[]) ?? [];
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
