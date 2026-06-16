"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const errorHandler_1 = require("./errorHandler");
function authenticate(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
        return next(new errorHandler_1.AppError(401, "No token provided"));
    try {
        const token = header.split(" ")[1];
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
        req.user = payload;
        next();
    }
    catch {
        next(new errorHandler_1.AppError(401, "Invalid or expired token"));
    }
}
