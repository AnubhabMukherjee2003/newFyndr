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
    include: { roleSchema: true }
  });
}

export async function assignRole(userId: string, roleSchemaId: string) {
  const role = await prisma.roleSchema.findUnique({ where: { id: roleSchemaId } });
  if (!role) throw new AppError(404, `Role not found: ${roleSchemaId}`);

  return prisma.user.update({
    where: { id: userId },
    data:  { roleSchemaId, profileData: {}, moduleData: [] },
    include: { roleSchema: true }
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
  if (!role) throw new AppError(404, "Role schema not found");

  const allModules = [
    ...((role.requireModules as any[]) ?? []),
    ...((role.provideModules as any[]) ?? []),
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
    include: { roleSchema: true }
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
    include: { roleSchema: true }
  });
}
