import { Router } from "express";
import * as c from "./auth.controller";

const router = Router();
router.post("/register", c.register);
router.post("/login",    c.login);
router.post("/refresh",  c.refresh);

export default router;
