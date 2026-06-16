"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOnly = adminOnly;
const errorHandler_1 = require("./errorHandler");
function adminOnly(req, _res, next) {
    if (req.user?.role !== "ADMIN")
        return next(new errorHandler_1.AppError(403, "Admin access required"));
    next();
}
