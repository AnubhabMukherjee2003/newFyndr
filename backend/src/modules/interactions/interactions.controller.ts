import { Request, Response, NextFunction } from "express";
import * as interactionsService from "./interactions.service";

export async function like(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await interactionsService.like(req.user!.userId, req.params.targetId as string);
    res.json(result);
  } catch (e) { next(e); }
}

export async function pass(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await interactionsService.pass(req.user!.userId, req.params.targetId as string);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getMatches(req: Request, res: Response, next: NextFunction) {
  try {
    const matches = await interactionsService.getMatches(req.user!.userId);
    res.json(matches);
  } catch (e) { next(e); }
}
