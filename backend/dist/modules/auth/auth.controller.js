"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
const zod_1 = require("zod");
const authService = __importStar(require("./auth.service"));
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(1, "Password is required"),
});
async function register(req, res, next) {
    try {
        const { name, email, password } = registerSchema.parse(req.body);
        const tokens = await authService.register(name, email, password);
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });
        res.status(201).json({ accessToken: tokens.accessToken });
    }
    catch (e) {
        next(e);
    }
}
async function login(req, res, next) {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const tokens = await authService.login(email, password);
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });
        res.json({ accessToken: tokens.accessToken });
    }
    catch (e) {
        next(e);
    }
}
async function refresh(req, res, next) {
    try {
        // Read from cookies (via cookie-parser) or fallback to request body
        const token = req.cookies?.refreshToken || req.body.refreshToken;
        if (!token) {
            res.status(400).json({ error: "Refresh token is required" });
            return;
        }
        const tokens = await authService.refresh(token);
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });
        res.json({ accessToken: tokens.accessToken });
    }
    catch (e) {
        next(e);
    }
}
