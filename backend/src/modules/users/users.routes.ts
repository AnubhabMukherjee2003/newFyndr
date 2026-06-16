import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as c from "./users.controller";

const router = Router();
router.use(authenticate);

router.get   ("/me",                c.getMe);
router.patch ("/me",                c.updateMe);
router.post  ("/me/role",           c.assignRole);
router.post  ("/me/modules",        c.fillModules);
router.delete("/me/modules/:id",    c.clearModule);

export default router;
