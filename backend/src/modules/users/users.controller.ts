import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as usersService from "./users.service";

const updateMeSchema = z.object({
  name:        z.string().min(1).optional(),
  profileData: z.record(z.string(), z.any()).optional(),
});

const assignRoleSchema = z.object({
  roleSchemaId: z.string().min(1, "roleSchemaId is required"),
});

const answerEntrySchema = z.object({
  module_id: z.string().min(1),
  data:      z.any(),
});

const fillModulesSchema = z.object({
  answers: z.array(answerEntrySchema).min(1, "At least one answer must be provided"),
});

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getMe(req.user!.userId);
    res.json(user);
  } catch (e) { next(e); }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateMeSchema.parse(req.body);
    const user = await usersService.updateMe(req.user!.userId, data);
    res.json(user);
  } catch (e) { next(e); }
}

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { roleSchemaId } = assignRoleSchema.parse(req.body);
    const user = await usersService.assignRole(req.user!.userId, roleSchemaId);
    res.json(user);
  } catch (e) { next(e); }
}

export async function fillModules(req: Request, res: Response, next: NextFunction) {
  try {
    const { answers } = fillModulesSchema.parse(req.body);
    const user = await usersService.fillModules(req.user!.userId, answers);
    res.json(user);
  } catch (e) { next(e); }
}

export async function clearModule(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.clearModule(req.user!.userId, req.params.id as string);
    res.json(user);
  } catch (e) { next(e); }
}
