import bcrypt from "bcrypt";
import jwt    from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { env }    from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { JwtPayload } from "../../middleware/auth";

export async function register(name: string, email: string, password: string) {
  const emailLower = email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email: emailLower } });
  if (exists) throw new AppError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email: emailLower, passwordHash },
  });

  return signTokens(user.id, user.role as "USER" | "ADMIN");
}

export async function login(email: string, password: string) {
  const emailLower = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: emailLower } });
  if (!user) throw new AppError(401, "Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, "Invalid credentials");

  return signTokens(user.id, user.role as "USER" | "ADMIN");
}

export async function refresh(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
    // Verify user still exists
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AppError(401, "User not found");
    
    return signTokens(user.id, user.role as "USER" | "ADMIN");
  } catch (e) {
    throw new AppError(401, "Invalid or expired refresh token");
  }
}

function signTokens(userId: string, role: "USER" | "ADMIN") {
  const accessToken = jwt.sign(
    { userId, role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
  );
  const refreshToken = jwt.sign(
    { userId, role },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
  return { accessToken, refreshToken };
}
