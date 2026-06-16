import { prisma }   from "../../lib/prisma";
import { AppError } from "../../middleware/errorHandler";

export async function like(senderId: string, receiverId: string) {
  if (senderId === receiverId) throw new AppError(400, "Cannot like yourself");

  // Verify receiver exists
  const receiverExists = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiverExists) throw new AppError(404, "Target user not found");

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
  if (senderId === receiverId) throw new AppError(400, "Cannot pass yourself");

  // Verify receiver exists
  const receiverExists = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiverExists) throw new AppError(404, "Target user not found");

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
