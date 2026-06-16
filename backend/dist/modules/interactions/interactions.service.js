"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.like = like;
exports.pass = pass;
exports.getMatches = getMatches;
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
async function like(senderId, receiverId) {
    if (senderId === receiverId)
        throw new errorHandler_1.AppError(400, "Cannot like yourself");
    // Verify receiver exists
    const receiverExists = await prisma_1.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiverExists)
        throw new errorHandler_1.AppError(404, "Target user not found");
    // upsert the like
    await prisma_1.prisma.interaction.upsert({
        where: { senderId_receiverId: { senderId, receiverId } },
        create: { senderId, receiverId, type: "LIKE" },
        update: { type: "LIKE" },
    });
    // check if the other side already liked back → create MATCH for both
    const reverse = await prisma_1.prisma.interaction.findUnique({
        where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
    });
    if (reverse?.type === "LIKE") {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.interaction.update({
                where: { senderId_receiverId: { senderId, receiverId } },
                data: { type: "MATCH" },
            }),
            prisma_1.prisma.interaction.update({
                where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
                data: { type: "MATCH" },
            }),
        ]);
        return { matched: true };
    }
    return { matched: false };
}
async function pass(senderId, receiverId) {
    if (senderId === receiverId)
        throw new errorHandler_1.AppError(400, "Cannot pass yourself");
    // Verify receiver exists
    const receiverExists = await prisma_1.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiverExists)
        throw new errorHandler_1.AppError(404, "Target user not found");
    await prisma_1.prisma.interaction.upsert({
        where: { senderId_receiverId: { senderId, receiverId } },
        create: { senderId, receiverId, type: "PASS" },
        update: { type: "PASS" },
    });
    return { passed: true };
}
async function getMatches(userId) {
    return prisma_1.prisma.interaction.findMany({
        where: { senderId: userId, type: "MATCH" },
        include: { receiver: { select: { id: true, name: true, email: true, profileData: true } } },
    });
}
