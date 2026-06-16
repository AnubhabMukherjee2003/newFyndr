import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { adminOnly }    from "../../middleware/adminOnly";
import * as c from "./roles.controller";

const router = Router();

// Allow any authenticated user to view the list of roles so they can choose a profile
router.get("/", authenticate, c.listRoles);

// Admin-only routes
router.use(authenticate, adminOnly);
router.post  ("/",         c.createRole);
router.get   ("/hints",    c.getHints);
router.get   ("/:id",      c.getRole);
router.patch ("/:id",      c.updateRole);
router.delete("/:id",      c.deleteRole);

export default router;
