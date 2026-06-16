import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as c from "./feed.controller";

const router = Router();
router.use(authenticate);
router.get("/", c.getFeed);

export default router;
