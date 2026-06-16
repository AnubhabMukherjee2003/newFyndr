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
exports.getMe = getMe;
exports.updateMe = updateMe;
exports.assignRole = assignRole;
exports.fillModules = fillModules;
exports.clearModule = clearModule;
const zod_1 = require("zod");
const usersService = __importStar(require("./users.service"));
const updateMeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    profileData: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
const assignRoleSchema = zod_1.z.object({
    roleSchemaId: zod_1.z.string().min(1, "roleSchemaId is required"),
});
const answerEntrySchema = zod_1.z.object({
    module_id: zod_1.z.string().min(1),
    data: zod_1.z.any(),
});
const fillModulesSchema = zod_1.z.object({
    answers: zod_1.z.array(answerEntrySchema).min(1, "At least one answer must be provided"),
});
async function getMe(req, res, next) {
    try {
        const user = await usersService.getMe(req.user.userId);
        res.json(user);
    }
    catch (e) {
        next(e);
    }
}
async function updateMe(req, res, next) {
    try {
        const data = updateMeSchema.parse(req.body);
        const user = await usersService.updateMe(req.user.userId, data);
        res.json(user);
    }
    catch (e) {
        next(e);
    }
}
async function assignRole(req, res, next) {
    try {
        const { roleSchemaId } = assignRoleSchema.parse(req.body);
        const user = await usersService.assignRole(req.user.userId, roleSchemaId);
        res.json(user);
    }
    catch (e) {
        next(e);
    }
}
async function fillModules(req, res, next) {
    try {
        const { answers } = fillModulesSchema.parse(req.body);
        const user = await usersService.fillModules(req.user.userId, answers);
        res.json(user);
    }
    catch (e) {
        next(e);
    }
}
async function clearModule(req, res, next) {
    try {
        const user = await usersService.clearModule(req.user.userId, req.params.id);
        res.json(user);
    }
    catch (e) {
        next(e);
    }
}
