import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as rolesService from "./roles.service";

const moduleEntrySchema = z.object({
  module_id: z.string(),
  data: z.any().nullable().optional(),
  weight: z.number(),
  target_role: z.string().nullable().optional(),
  question: z.string(),
  input_type: z.string(),
  options: z.array(z.string()).nullable().optional(),
  data_type: z.string(),
  match_type: z.string(),
});

const createRoleSchema = z.object({
  id: z.string().optional(),
  roleName: z.string().min(1, "roleName is required"),
  assignedRoles: z.array(z.string()).default([]),
  profileTemplate: z.record(z.string(), z.string()).default({}),
  requireModules: z.array(moduleEntrySchema).default([]),
  provideModules: z.array(moduleEntrySchema).default([]),
});

const updateRoleSchema = createRoleSchema.partial();

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createRoleSchema.parse(req.body);
    const role = await rolesService.createRole(data);
    res.status(201).json(role);
  } catch (e) { next(e); }
}

export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await rolesService.listRoles();
    res.json(roles);
  } catch (e) { next(e); }
}

export async function getRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.getRole(req.params.id as string);
    res.json(role);
  } catch (e) { next(e); }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateRoleSchema.parse(req.body);
    const role = await rolesService.updateRole(req.params.id as string, data);
    res.json(role);
  } catch (e) { next(e); }
}

export async function deleteRole(req: Request, res: Response, next: NextFunction) {
  try {
    await rolesService.deleteRole(req.params.id as string);
    res.json({ deleted: req.params.id });
  } catch (e) { next(e); }
}

export async function getHints(req: Request, res: Response, next: NextFunction) {
  try {
    const hints = await rolesService.getPropagationHints();
    res.json(hints);
  } catch (e) { next(e); }
}
