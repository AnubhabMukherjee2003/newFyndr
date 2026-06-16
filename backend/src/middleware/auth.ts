import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export interface JwtPayload {
  userId: string;
  role:   "USER" | "ADMIN";
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return next(new AppError(401, "No token provided"));

  try {
    const token   = header.split(" ")[1];
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user      = payload;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}
