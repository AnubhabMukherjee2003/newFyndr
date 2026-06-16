"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const roles_routes_1 = __importDefault(require("./modules/roles/roles.routes"));
const feed_routes_1 = __importDefault(require("./modules/feed/feed.routes"));
const interactions_routes_1 = __importDefault(require("./modules/interactions/interactions.routes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use("/api/auth", auth_routes_1.default);
app.use("/api/users", users_routes_1.default);
app.use("/api/admin/roles", roles_routes_1.default);
app.use("/api/feed", feed_routes_1.default);
app.use("/api/interactions", interactions_routes_1.default);
app.use(errorHandler_1.errorHandler);
if (process.env.NODE_ENV !== "test") {
    app.listen(env_1.env.PORT, () => console.log(`Server running on port ${env_1.env.PORT}`));
}
exports.default = app;
