import { Request, Response, NextFunction } from "express";
import * as feedService from "./feed.service";

export async function getFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const feed = await feedService.getFeed(req.user!.userId);
    res.json(feed);
  } catch (e) { next(e); }
}
