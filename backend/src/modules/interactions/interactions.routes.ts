import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as c from "./interactions.controller";

const router = Router();
router.use(authenticate);

router.post("/like/:targetId",  c.like);
router.post("/pass/:targetId",  c.pass);
router.get ("/matches",         c.getMatches);

export default router;
