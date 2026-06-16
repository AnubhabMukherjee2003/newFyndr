import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

export function adminOnly(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN")
    return next(new AppError(403, "Admin access required"));
  next();
}
