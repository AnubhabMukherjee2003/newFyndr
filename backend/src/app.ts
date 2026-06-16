import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes         from "./modules/auth/auth.routes";
import usersRoutes        from "./modules/users/users.routes";
import rolesRoutes        from "./modules/roles/roles.routes";
import feedRoutes         from "./modules/feed/feed.routes";
import interactionsRoutes from "./modules/interactions/interactions.routes";

const app = express();
app.use(cors({
  origin: env.CORS_ORIGIN.split(","),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth",         authRoutes);
app.use("/api/users",        usersRoutes);
app.use("/api/admin/roles",  rolesRoutes);
app.use("/api/feed",         feedRoutes);
app.use("/api/interactions", interactionsRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(env.PORT, () =>
    console.log(`Server running on port ${env.PORT}`)
  );
}

export default app;
