import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "./auth.service";

const registerSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  email:    z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email:    z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const tokens = await authService.register(name, email, password);
    res.cookie("refreshToken", tokens.refreshToken, { 
      httpOnly: true, 
      sameSite: "strict", 
      secure: process.env.NODE_ENV === "production" 
    });
    res.status(201).json({ accessToken: tokens.accessToken });
  } catch (e) { next(e); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const tokens = await authService.login(email, password);
    res.cookie("refreshToken", tokens.refreshToken, { 
      httpOnly: true, 
      sameSite: "strict", 
      secure: process.env.NODE_ENV === "production" 
    });
    res.json({ accessToken: tokens.accessToken });
  } catch (e) { next(e); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    // Read from cookies (via cookie-parser) or fallback to request body
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) {
      res.status(400).json({ error: "Refresh token is required" });
      return;
    }
    const tokens = await authService.refresh(token);
    res.cookie("refreshToken", tokens.refreshToken, { 
      httpOnly: true, 
      sameSite: "strict", 
      secure: process.env.NODE_ENV === "production" 
    });
    res.json({ accessToken: tokens.accessToken });
  } catch (e) { next(e); }
}
