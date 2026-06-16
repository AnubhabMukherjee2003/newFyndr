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
exports.createRole = createRole;
exports.listRoles = listRoles;
exports.getRole = getRole;
exports.updateRole = updateRole;
exports.deleteRole = deleteRole;
exports.getHints = getHints;
const zod_1 = require("zod");
const rolesService = __importStar(require("./roles.service"));
const moduleEntrySchema = zod_1.z.object({
    module_id: zod_1.z.string(),
    data: zod_1.z.any().nullable().optional(),
    weight: zod_1.z.number(),
    target_role: zod_1.z.string().nullable().optional(),
    question: zod_1.z.string(),
    input_type: zod_1.z.string(),
    options: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    data_type: zod_1.z.string(),
    match_type: zod_1.z.string(),
});
const createRoleSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    roleName: zod_1.z.string().min(1, "roleName is required"),
    assignedRoles: zod_1.z.array(zod_1.z.string()).default([]),
    profileTemplate: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).default({}),
    requireModules: zod_1.z.array(moduleEntrySchema).default([]),
    provideModules: zod_1.z.array(moduleEntrySchema).default([]),
});
const updateRoleSchema = createRoleSchema.partial();
async function createRole(req, res, next) {
    try {
        const data = createRoleSchema.parse(req.body);
        const role = await rolesService.createRole(data);
        res.status(201).json(role);
    }
    catch (e) {
        next(e);
    }
}
async function listRoles(req, res, next) {
    try {
        const roles = await rolesService.listRoles();
        res.json(roles);
    }
    catch (e) {
        next(e);
    }
}
async function getRole(req, res, next) {
    try {
        const role = await rolesService.getRole(req.params.id);
        res.json(role);
    }
    catch (e) {
        next(e);
    }
}
async function updateRole(req, res, next) {
    try {
        const data = updateRoleSchema.parse(req.body);
        const role = await rolesService.updateRole(req.params.id, data);
        res.json(role);
    }
    catch (e) {
        next(e);
    }
}
async function deleteRole(req, res, next) {
    try {
        await rolesService.deleteRole(req.params.id);
        res.json({ deleted: req.params.id });
    }
    catch (e) {
        next(e);
    }
}
async function getHints(req, res, next) {
    try {
        const hints = await rolesService.getPropagationHints();
        res.json(hints);
    }
    catch (e) {
        next(e);
    }
}
