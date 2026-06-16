"use strict";
// ============================================================
// Dynamic Role Matching Engine (TypeScript)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.USERS = exports.ROLE_SCHEMAS = exports.InputType = exports.MatchType = exports.DataType = void 0;
exports.createUser = createUser;
exports.getUser = getUser;
exports.getAllUsers = getAllUsers;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.assignRole = assignRole;
exports.getUserRole = getUserRole;
exports.getPendingModules = getPendingModules;
exports.fillModuleData = fillModuleData;
exports.fillModuleDataBatch = fillModuleDataBatch;
exports.clearModuleData = clearModuleData;
exports.overlapMatch = overlapMatch;
exports.numericMatch = numericMatch;
exports.rangeMatch = rangeMatch;
exports.compareModule = compareModule;
exports.mergeModuleData = mergeModuleData;
exports.matchModules = matchModules;
exports.calculateScore = calculateScore;
exports.getTargetedRoleIds = getTargetedRoleIds;
exports.isScoredCandidate = isScoredCandidate;
exports.alreadyMatched = alreadyMatched;
exports.alreadyLiked = alreadyLiked;
exports.generateFeed = generateFeed;
exports.generateFeedForUser = generateFeedForUser;
exports.getPropagationHints = getPropagationHints;
exports.createRole = createRole;
exports.updateRole = updateRole;
exports.deleteRole = deleteRole;
exports.getRole = getRole;
exports.getAllRoles = getAllRoles;
var DataType;
(function (DataType) {
    DataType["VECTOR"] = "VECTOR";
    DataType["BOOLEAN"] = "BOOLEAN";
    DataType["NUMERIC"] = "NUMERIC";
    DataType["RANGE"] = "RANGE";
    DataType["TEXT"] = "TEXT";
})(DataType || (exports.DataType = DataType = {}));
var MatchType;
(function (MatchType) {
    MatchType["OVERLAP_MATCH"] = "OVERLAP_MATCH";
    MatchType["EXACT_MATCH"] = "EXACT_MATCH";
    MatchType["BOOLEAN_MATCH"] = "BOOLEAN_MATCH";
    MatchType["NUMERIC_MATCH"] = "NUMERIC_MATCH";
    MatchType["RANGE_MATCH"] = "RANGE_MATCH";
})(MatchType || (exports.MatchType = MatchType = {}));
var InputType;
(function (InputType) {
    InputType["SINGLE_CHOICE"] = "SINGLE_CHOICE";
    InputType["MULTI_CHOICE"] = "MULTI_CHOICE";
    InputType["TEXT_INPUT"] = "TEXT_INPUT";
    InputType["NUMBER_INPUT"] = "NUMBER_INPUT";
    InputType["RANGE_INPUT"] = "RANGE_INPUT";
    InputType["BOOLEAN_TOGGLE"] = "BOOLEAN_TOGGLE";
})(InputType || (exports.InputType = InputType = {}));
// In-memory store for backwards compatibility / tests
exports.ROLE_SCHEMAS = {};
exports.USERS = {};
// Helper helpers to get mapped array/fields supporting both camelCase and snake_case
function getRequireModules(role) {
    return role.requireModules || role.require_modules || [];
}
function getProvideModules(role) {
    return role.provideModules || role.provide_modules || [];
}
function getAssignedRoles(role) {
    return role.assignedRoles || role.assigned_roles || [];
}
function getRoleSchemaId(user) {
    return user.roleSchemaId !== undefined ? user.roleSchemaId : (user.role_schema_id || null);
}
function getModuleData(user) {
    return user.moduleData || user.module_data || [];
}
// ------------------------------------------------------------
// User CRUD (backward compatibility / tests)
// ------------------------------------------------------------
function createUser(fields) {
    if (!fields.name || !fields.name.trim())
        throw new Error("name is required");
    if (!fields.email || !fields.email.trim())
        throw new Error("email is required");
    const emailLower = fields.email.toLowerCase().trim();
    const existing = Object.values(exports.USERS).find(u => u.email === emailLower);
    if (existing)
        throw new Error(`Email already registered: ${fields.email}`);
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const user = {
        id,
        name: fields.name.trim(),
        email: emailLower,
        role_schema_id: null,
        roleSchemaId: null,
        profile_data: {},
        profileData: {},
        module_data: [],
        moduleData: [],
    };
    exports.USERS[id] = user;
    return { ...user };
}
function getUser(id) {
    const user = exports.USERS[id];
    if (!user)
        throw new Error(`User not found: ${id}`);
    return { ...user };
}
function getAllUsers() {
    return Object.values(exports.USERS).map(u => ({ ...u }));
}
function updateUser(id, fields) {
    const user = exports.USERS[id];
    if (!user)
        throw new Error(`User not found: ${id}`);
    const allowed = ["name", "profile_data", "profileData"];
    for (const key of Object.keys(fields)) {
        if (!allowed.includes(key)) {
            throw new Error(`Field "${key}" cannot be updated via updateUser. Use assignRole or fillModuleData.`);
        }
    }
    if (fields.name !== undefined) {
        if (!fields.name.trim())
            throw new Error("name cannot be empty");
        user.name = fields.name.trim();
    }
    if (fields.profile_data !== undefined) {
        user.profile_data = { ...user.profile_data, ...fields.profile_data };
        user.profileData = { ...user.profileData, ...fields.profile_data };
    }
    if (fields.profileData !== undefined) {
        user.profile_data = { ...user.profile_data, ...fields.profileData };
        user.profileData = { ...user.profileData, ...fields.profileData };
    }
    return { ...user };
}
function deleteUser(id) {
    if (!exports.USERS[id])
        throw new Error(`User not found: ${id}`);
    delete exports.USERS[id];
    return { deleted: id };
}
// ------------------------------------------------------------
// Role assignment (backward compatibility / tests)
// ------------------------------------------------------------
function assignRole(userId, roleSchemaId) {
    const user = exports.USERS[userId];
    if (!user)
        throw new Error(`User not found: ${userId}`);
    const role = exports.ROLE_SCHEMAS[roleSchemaId];
    if (!role)
        throw new Error(`Role not found: ${roleSchemaId}`);
    user.role_schema_id = roleSchemaId;
    user.roleSchemaId = roleSchemaId;
    user.profile_data = {};
    user.profileData = {};
    user.module_data = [];
    user.moduleData = [];
    return { ...user };
}
function getUserRole(userId) {
    const user = exports.USERS[userId];
    if (!user)
        throw new Error(`User not found: ${userId}`);
    const roleId = getRoleSchemaId(user);
    if (!roleId)
        return null;
    return { ...exports.ROLE_SCHEMAS[roleId] };
}
function getPendingModules(userId) {
    const user = exports.USERS[userId];
    if (!user)
        throw new Error(`User not found: ${userId}`);
    const roleId = getRoleSchemaId(user);
    const role = roleId ? exports.ROLE_SCHEMAS[roleId] : null;
    if (!role)
        return { require_modules: [], provide_modules: [] };
    const filledIds = new Set(getModuleData(user).map(m => m.module_id));
    return {
        require_modules: getRequireModules(role).filter(m => !filledIds.has(m.module_id)),
        provide_modules: getProvideModules(role).filter(m => !filledIds.has(m.module_id)),
    };
}
// ------------------------------------------------------------
// Module data filling (backward compatibility / tests)
// ------------------------------------------------------------
function fillModuleData(userId, moduleId, data) {
    const user = exports.USERS[userId];
    if (!user)
        throw new Error(`User not found: ${userId}`);
    const roleId = getRoleSchemaId(user);
    const role = roleId ? exports.ROLE_SCHEMAS[roleId] : null;
    if (!role)
        throw new Error(`User ${userId} has no role assigned`);
    const allModules = [...getRequireModules(role), ...getProvideModules(role)];
    const moduleDef = allModules.find(m => m.module_id === moduleId);
    if (!moduleDef) {
        const roleName = role.roleName || role.role_name || roleId;
        throw new Error(`Module "${moduleId}" does not belong to role "${roleName}"`);
    }
    _validateModuleValue(moduleDef, data);
    const mData = getModuleData(user);
    const existing = mData.find(m => m.module_id === moduleId);
    if (existing) {
        existing.data = data;
    }
    else {
        mData.push({ module_id: moduleId, data });
    }
    user.module_data = mData;
    user.moduleData = mData;
    return { ...user };
}
function fillModuleDataBatch(userId, answers) {
    if (!Array.isArray(answers))
        throw new Error("answers must be an array");
    let user;
    for (const { module_id, data } of answers) {
        user = fillModuleData(userId, module_id, data);
    }
    return user ?? getUser(userId);
}
function clearModuleData(userId, moduleId) {
    const user = exports.USERS[userId];
    if (!user)
        throw new Error(`User not found: ${userId}`);
    const filtered = getModuleData(user).filter(m => m.module_id !== moduleId);
    user.module_data = filtered;
    user.moduleData = filtered;
    return { ...user };
}
function _validateModuleValue(moduleDef, data) {
    switch (moduleDef.input_type) {
        case InputType.MULTI_CHOICE:
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error(`Module "${moduleDef.module_id}" expects a non-empty array (MULTI_CHOICE)`);
            }
            break;
        case InputType.SINGLE_CHOICE:
            if (!Array.isArray(data) || data.length !== 1) {
                throw new Error(`Module "${moduleDef.module_id}" expects an array with exactly 1 item (SINGLE_CHOICE)`);
            }
            break;
        case InputType.TEXT_INPUT:
            if (typeof data !== "string" || !data.trim()) {
                throw new Error(`Module "${moduleDef.module_id}" expects a non-empty string (TEXT_INPUT)`);
            }
            break;
        case InputType.NUMBER_INPUT:
            if (typeof data !== "number" || isNaN(data)) {
                throw new Error(`Module "${moduleDef.module_id}" expects a number (NUMBER_INPUT)`);
            }
            break;
        case InputType.RANGE_INPUT:
            if (!data || typeof data.min !== "number" || typeof data.max !== "number" || data.min > data.max) {
                throw new Error(`Module "${moduleDef.module_id}" expects { min, max } with min <= max (RANGE_INPUT)`);
            }
            break;
        case InputType.BOOLEAN_TOGGLE:
            if (typeof data !== "boolean") {
                throw new Error(`Module "${moduleDef.module_id}" expects a boolean (BOOLEAN_TOGGLE)`);
            }
            break;
    }
}
// ------------------------------------------------------------
// Comparison algorithms
// ------------------------------------------------------------
function overlapMatch(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB))
        return 0;
    if (vecA.length === 0 || vecB.length === 0)
        return 0;
    const a = new Set(vecA.map(v => String(v).toLowerCase().trim()));
    const b = new Set(vecB.map(v => String(v).toLowerCase().trim()));
    const intersection = [...a].filter(v => b.has(v)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
}
function numericMatch(required, provided) {
    if (typeof required !== "number" || typeof provided !== "number")
        return 0;
    if (required === 0)
        return 1;
    return provided >= required ? 1 : Math.max(0, provided / required);
}
function rangeMatch(requiredRange, providedRange) {
    if (!requiredRange || !providedRange)
        return 0;
    const overlapMin = Math.max(requiredRange.min, providedRange.min);
    const overlapMax = Math.min(requiredRange.max, providedRange.max);
    const overlap = Math.max(0, overlapMax - overlapMin);
    const reqLen = requiredRange.max - requiredRange.min;
    return reqLen === 0 ? (overlap > 0 ? 1 : 0) : overlap / reqLen;
}
function compareModule(matchType, requireValue, provideValue) {
    switch (matchType) {
        case MatchType.OVERLAP_MATCH: return overlapMatch(requireValue, provideValue);
        case MatchType.EXACT_MATCH: return String(requireValue).toLowerCase() === String(provideValue).toLowerCase() ? 1 : 0;
        case MatchType.BOOLEAN_MATCH: return requireValue === provideValue ? 1 : 0;
        case MatchType.NUMERIC_MATCH: return numericMatch(requireValue, provideValue);
        case MatchType.RANGE_MATCH: return rangeMatch(requireValue, provideValue);
        default:
            console.warn(`Unsupported MatchType: ${matchType}`);
            return 0;
    }
}
// ------------------------------------------------------------
// Module matching
// ------------------------------------------------------------
function mergeModuleData(schemaModules, userModuleData) {
    const userMap = {};
    if (Array.isArray(userModuleData)) {
        for (const entry of userModuleData)
            userMap[entry.module_id] = entry.data;
    }
    return schemaModules.map(mod => ({ ...mod, data: userMap[mod.module_id] ?? null }));
}
function matchModules(requireModules, provideModules) {
    let score = 0, totalWeight = 0;
    for (const req of requireModules) {
        const prov = provideModules.find(p => p.module_id === req.module_id);
        if (!prov)
            continue;
        if (req.data == null)
            continue;
        if (prov.data == null)
            continue;
        score += compareModule(req.match_type, req.data, prov.data) * req.weight;
        totalWeight += req.weight;
    }
    return { score, totalWeight };
}
// ------------------------------------------------------------
// Scoring logic
// ------------------------------------------------------------
function calculateScore(currentUser, candidate) {
    const currentRoleId = getRoleSchemaId(currentUser);
    const candidateRoleId = getRoleSchemaId(candidate);
    if (!currentRoleId || !candidateRoleId)
        return 0;
    const currentRole = currentUser._schema || exports.ROLE_SCHEMAS[currentRoleId];
    const candidateRole = candidate._schema || exports.ROLE_SCHEMAS[candidateRoleId];
    if (!currentRole || !candidateRole)
        return 0;
    const requireModulesAll = mergeModuleData(getRequireModules(currentRole), getModuleData(currentUser));
    const requireModules = requireModulesAll.filter(req => req.target_role === candidateRoleId || req.target_role === null || req.target_role === undefined);
    const provideModules = mergeModuleData(getProvideModules(candidateRole), getModuleData(candidate));
    const { score, totalWeight } = matchModules(requireModules, provideModules);
    if (totalWeight === 0)
        return 0;
    return Math.round((score / totalWeight) * 100) / 100;
}
// ------------------------------------------------------------
// Feed Generation
// ------------------------------------------------------------
function getTargetedRoleIds(currentRoleSchema) {
    const ids = new Set();
    for (const mod of getRequireModules(currentRoleSchema)) {
        if (mod.target_role)
            ids.add(mod.target_role);
    }
    return ids;
}
function isScoredCandidate(currentRoleSchema, candidateRoleSchema) {
    const candidateProvideIds = new Set(getProvideModules(candidateRoleSchema).map(m => m.module_id));
    return getRequireModules(currentRoleSchema).some(req => (req.target_role === candidateRoleSchema.id || req.target_role === null || req.target_role === undefined)
        && candidateProvideIds.has(req.module_id));
}
// Stubs for feed generation, replaced with DB checks in service
function alreadyMatched(userA, userB) { return false; }
function alreadyLiked(userA, userB) { return false; }
function generateFeed(currentUser, allUsers) {
    const feed = [];
    const currentRoleId = getRoleSchemaId(currentUser);
    if (!currentRoleId) {
        console.error(`No role assigned to user: ${currentUser.id}`);
        return feed;
    }
    const currentRole = currentUser._schema || exports.ROLE_SCHEMAS[currentRoleId];
    if (!currentRole) {
        console.error(`Schema not found for role: ${currentRoleId}`);
        return feed;
    }
    const targetedRoleIds = getTargetedRoleIds(currentRole);
    const assignedRolesList = getAssignedRoles(currentRole);
    for (const candidate of allUsers) {
        if (candidate.id === currentUser.id)
            continue;
        const candidateRoleId = getRoleSchemaId(candidate);
        if (!candidateRoleId)
            continue;
        const candidateRole = candidate._schema || exports.ROLE_SCHEMAS[candidateRoleId];
        if (!candidateRole)
            continue;
        // TIER 1: candidate role must be in assigned_roles
        if (!assignedRolesList.includes(candidateRoleId))
            continue;
        if (alreadyMatched(currentUser, candidate))
            continue;
        if (alreadyLiked(currentUser, candidate))
            continue;
        // TIER 2: check if this candidate role is targeted via require_modules (specific or generic)
        const hasModuleMatch = isScoredCandidate(currentRole, candidateRole);
        // Score: run matching only when there's a module link; else 0
        const score = hasModuleMatch ? calculateScore(currentUser, candidate) : 0;
        feed.push({
            user: candidate,
            score,
            match_tier: hasModuleMatch ? "scored" : "base",
        });
    }
    // Sort: scored tier first, then base; then by score desc
    feed.sort((a, b) => {
        if (a.match_tier !== b.match_tier) {
            return a.match_tier === "scored" ? -1 : 1;
        }
        return b.score - a.score;
    });
    return feed.slice(0, 20);
}
function generateFeedForUser(userId) {
    const user = exports.USERS[userId];
    if (!user)
        throw new Error(`User not found: ${userId}`);
    return generateFeed(user, Object.values(exports.USERS));
}
// ------------------------------------------------------------
// Admin helpers
// ------------------------------------------------------------
function getPropagationHints() {
    const hints = [];
    for (const [, schema] of Object.entries(exports.ROLE_SCHEMAS)) {
        for (const mod of getRequireModules(schema)) {
            if (!mod.target_role)
                continue;
            const targetSchema = exports.ROLE_SCHEMAS[mod.target_role];
            const targetProvide = targetSchema ? getProvideModules(targetSchema) : [];
            const alreadyMirrored = targetProvide.some(p => p.module_id === mod.module_id);
            const sourceName = schema.roleName || schema.role_name || schema.id;
            const targetName = targetSchema ? (targetSchema.roleName || targetSchema.role_name) : mod.target_role;
            hints.push({
                source_role: sourceName,
                source_role_id: schema.id,
                module_id: mod.module_id,
                target_role_id: mod.target_role,
                target_role_name: targetName,
                already_mirrored: alreadyMirrored,
                action: alreadyMirrored
                    ? `✓ Already mirrored in ${targetName}.provideModules`
                    : `Add "${mod.module_id}" to ${targetName}.provideModules`,
            });
        }
    }
    return hints;
}
function createRole(schema) {
    if (!schema.id)
        throw new Error("schema.id is required");
    const roleName = schema.roleName || schema.role_name;
    if (!roleName)
        throw new Error("schema.roleName or schema.role_name is required");
    if (exports.ROLE_SCHEMAS[schema.id])
        throw new Error(`Role already exists: ${schema.id}`);
    exports.ROLE_SCHEMAS[schema.id] = {
        assigned_roles: [],
        assignedRoles: [],
        profile_template: {},
        profileTemplate: {},
        require_modules: [],
        requireModules: [],
        provide_modules: [],
        provideModules: [],
        ...schema,
    };
    return { ...exports.ROLE_SCHEMAS[schema.id] };
}
function updateRole(id, fields) {
    if (!exports.ROLE_SCHEMAS[id])
        throw new Error(`Role not found: ${id}`);
    Object.assign(exports.ROLE_SCHEMAS[id], fields);
    return { ...exports.ROLE_SCHEMAS[id] };
}
function deleteRole(id) {
    if (!exports.ROLE_SCHEMAS[id])
        throw new Error(`Role not found: ${id}`);
    const affected = Object.values(exports.USERS).filter(u => getRoleSchemaId(u) === id);
    if (affected.length > 0) {
        throw new Error(`Cannot delete role "${id}" — ${affected.length} user(s) still assigned to it`);
    }
    delete exports.ROLE_SCHEMAS[id];
    return { deleted: id };
}
function getRole(id) {
    if (!exports.ROLE_SCHEMAS[id])
        throw new Error(`Role not found: ${id}`);
    return { ...exports.ROLE_SCHEMAS[id] };
}
function getAllRoles() {
    return Object.values(exports.ROLE_SCHEMAS).map(r => ({ ...r }));
}
// Seed demo data
const _DEMO_SCHEMAS = {
    "student-role-id": {
        id: "student-role-id",
        role_name: "Student",
        roleName: "Student",
        assigned_roles: ["teacher-role-id", "freelancer-role-id"],
        assignedRoles: ["teacher-role-id", "freelancer-role-id"],
        profile_template: { college: "string", semester: "number" },
        profileTemplate: { college: "string", semester: "number" },
        require_modules: [
            {
                module_id: "learning-module-id",
                data: null,
                weight: 0.6,
                target_role: "teacher-role-id",
                question: "Choose what you want to learn",
                input_type: InputType.MULTI_CHOICE,
                options: ["History", "Geography", "Math", "Physics", "CS", "Chemistry"],
                data_type: DataType.VECTOR,
                match_type: MatchType.OVERLAP_MATCH,
            },
        ],
        requireModules: [
            {
                module_id: "learning-module-id",
                data: null,
                weight: 0.6,
                target_role: "teacher-role-id",
                question: "Choose what you want to learn",
                input_type: InputType.MULTI_CHOICE,
                options: ["History", "Geography", "Math", "Physics", "CS", "Chemistry"],
                data_type: DataType.VECTOR,
                match_type: MatchType.OVERLAP_MATCH,
            },
        ],
        provide_modules: [
            {
                module_id: "year-module-id",
                data: null,
                weight: 0.4,
                target_role: null,
                question: "Which year are you in?",
                input_type: InputType.SINGLE_CHOICE,
                options: ["1st", "2nd", "3rd", "4th"],
                data_type: DataType.VECTOR,
                match_type: MatchType.OVERLAP_MATCH,
            },
        ],
        provideModules: [
            {
                module_id: "year-module-id",
                data: null,
                weight: 0.4,
                target_role: null,
                question: "Which year are you in?",
                input_type: InputType.SINGLE_CHOICE,
                options: ["1st", "2nd", "3rd", "4th"],
                data_type: DataType.VECTOR,
                match_type: MatchType.OVERLAP_MATCH,
            },
        ],
    },
    "teacher-role-id": {
        id: "teacher-role-id",
        role_name: "Teacher",
        roleName: "Teacher",
        assigned_roles: ["student-role-id"],
        assignedRoles: ["student-role-id"],
        profile_template: { institution: "string", designation: "string" },
        profileTemplate: { institution: "string", designation: "string" },
        require_modules: [
            {
                module_id: "year-module-id",
                data: null,
                weight: 0.4,
                target_role: "student-role-id",
                question: "Which years do you want to teach?",
                input_type: InputType.MULTI_CHOICE,
                options: ["1st", "2nd", "3rd", "4th"],
                data_type: DataType.VECTOR,
                match_type: MatchType.OVERLAP_MATCH,
            },
        ],
        requireModules: [
            {
                module_id: "year-module-id",
                data: null,
                weight: 0.4,
                target_role: "student-role-id",
                question: "Which years do you want to teach?",
                input_type: InputType.MULTI_CHOICE,
                options: ["1st", "2nd", "3rd", "4th"],
                data_type: DataType.VECTOR,
                match_type: MatchType.OVERLAP_MATCH,
            },
        ],
        provide_modules: [
            {
                module_id: "learning-module-id",
                data: null,
                weight: 0.6,
                target_role: null,
                question: "Choose what you want to teach",
                input_type: InputType.MULTI_CHOICE,
                options: ["History", "Geography", "Math", "Physics", "CS", "Chemistry"],
                data_type: DataType.VECTOR,
                match_type: MatchType.OVERLAP_MATCH,
            },
        ],
        provideModules: [
            {
                module_id: "learning-module-id",
                data: null,
                weight: 0.6,
                target_role: null,
                question: "Choose what you want to teach",
                input_type: InputType.MULTI_CHOICE,
                options: ["History", "Geography", "Math", "Physics", "CS", "Chemistry"],
                data_type: DataType.VECTOR,
                match_type: MatchType.OVERLAP_MATCH,
            },
        ],
    },
    "founder-role-id": {
        id: "founder-role-id",
        role_name: "Founder",
        roleName: "Founder",
        assigned_roles: ["employee-role-id", "investor-role-id", "freelancer-role-id"],
        assignedRoles: ["employee-role-id", "investor-role-id", "freelancer-role-id"],
        profile_template: { startup_name: "string", website: "string", pitch_deck: "url" },
        profileTemplate: { startup_name: "string", website: "string", pitch_deck: "url" },
        require_modules: [
            {
                module_id: "skills-module-id",
                data: null, weight: 0.4,
                target_role: "employee-role-id",
                question: "What skills are you looking for?",
                input_type: InputType.MULTI_CHOICE,
                options: ["React", "Node", "Python", "Design", "Marketing", "DevOps"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
            {
                module_id: "experience-module-id",
                data: null, weight: 0.2,
                target_role: "employee-role-id",
                question: "Minimum years of experience required",
                input_type: InputType.NUMBER_INPUT, options: null,
                data_type: DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
            },
            {
                module_id: "funding-module-id",
                data: null, weight: 0.3,
                target_role: "investor-role-id",
                question: "Funding range you are seeking (USD)",
                input_type: InputType.RANGE_INPUT, options: null,
                data_type: DataType.RANGE, match_type: MatchType.RANGE_MATCH,
            },
            {
                module_id: "service-module-id",
                data: null, weight: 0.3,
                target_role: "freelancer-role-id",
                question: "What services do you need?",
                input_type: InputType.MULTI_CHOICE,
                options: ["Design", "Branding", "Legal", "Accounting", "Marketing"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
        ],
        requireModules: [
            {
                module_id: "skills-module-id",
                data: null, weight: 0.4,
                target_role: "employee-role-id",
                question: "What skills are you looking for?",
                input_type: InputType.MULTI_CHOICE,
                options: ["React", "Node", "Python", "Design", "Marketing", "DevOps"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
            {
                module_id: "experience-module-id",
                data: null, weight: 0.2,
                target_role: "employee-role-id",
                question: "Minimum years of experience required",
                input_type: InputType.NUMBER_INPUT, options: null,
                data_type: DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
            },
            {
                module_id: "funding-module-id",
                data: null, weight: 0.3,
                target_role: "investor-role-id",
                question: "Funding range you are seeking (USD)",
                input_type: InputType.RANGE_INPUT, options: null,
                data_type: DataType.RANGE, match_type: MatchType.RANGE_MATCH,
            },
            {
                module_id: "service-module-id",
                data: null, weight: 0.3,
                target_role: "freelancer-role-id",
                question: "What services do you need?",
                input_type: InputType.MULTI_CHOICE,
                options: ["Design", "Branding", "Legal", "Accounting", "Marketing"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
        ],
        provide_modules: [
            {
                module_id: "industry-module-id",
                data: null, weight: 0.2, target_role: null,
                question: "What industry is your startup in?",
                input_type: InputType.SINGLE_CHOICE,
                options: ["FinTech", "EdTech", "HealthTech", "SaaS", "E-Commerce", "Other"],
                data_type: DataType.TEXT, match_type: MatchType.EXACT_MATCH,
            },
            {
                module_id: "workmode-module-id",
                data: null, weight: 0.1, target_role: null,
                question: "Is the role remote?",
                input_type: InputType.BOOLEAN_TOGGLE, options: null,
                data_type: DataType.BOOLEAN, match_type: MatchType.BOOLEAN_MATCH,
            },
        ],
        provideModules: [
            {
                module_id: "industry-module-id",
                data: null, weight: 0.2, target_role: null,
                question: "What industry is your startup in?",
                input_type: InputType.SINGLE_CHOICE,
                options: ["FinTech", "EdTech", "HealthTech", "SaaS", "E-Commerce", "Other"],
                data_type: DataType.TEXT, match_type: MatchType.EXACT_MATCH,
            },
            {
                module_id: "workmode-module-id",
                data: null, weight: 0.1, target_role: null,
                question: "Is the role remote?",
                input_type: InputType.BOOLEAN_TOGGLE, options: null,
                data_type: DataType.BOOLEAN, match_type: MatchType.BOOLEAN_MATCH,
            },
        ],
    },
    "employee-role-id": {
        id: "employee-role-id",
        role_name: "Employee",
        roleName: "Employee",
        assigned_roles: ["founder-role-id", "freelancer-role-id"],
        assignedRoles: ["founder-role-id", "freelancer-role-id"],
        profile_template: { github: "url", portfolio: "url", resume: "url" },
        profileTemplate: { github: "url", portfolio: "url", resume: "url" },
        require_modules: [
            {
                module_id: "industry-module-id",
                data: null, weight: 0.2,
                target_role: "founder-role-id",
                question: "Which industry are you looking to work in?",
                input_type: InputType.SINGLE_CHOICE,
                options: ["FinTech", "EdTech", "HealthTech", "SaaS", "E-Commerce", "Other"],
                data_type: DataType.TEXT, match_type: MatchType.EXACT_MATCH,
            },
            {
                module_id: "workmode-module-id",
                data: null, weight: 0.1,
                target_role: "founder-role-id",
                question: "Do you prefer remote work?",
                input_type: InputType.BOOLEAN_TOGGLE, options: null,
                data_type: DataType.BOOLEAN, match_type: MatchType.BOOLEAN_MATCH,
            },
        ],
        requireModules: [
            {
                module_id: "industry-module-id",
                data: null, weight: 0.2,
                target_role: "founder-role-id",
                question: "Which industry are you looking to work in?",
                input_type: InputType.SINGLE_CHOICE,
                options: ["FinTech", "EdTech", "HealthTech", "SaaS", "E-Commerce", "Other"],
                data_type: DataType.TEXT, match_type: MatchType.EXACT_MATCH,
            },
            {
                module_id: "workmode-module-id",
                data: null, weight: 0.1,
                target_role: "founder-role-id",
                question: "Do you prefer remote work?",
                input_type: InputType.BOOLEAN_TOGGLE, options: null,
                data_type: DataType.BOOLEAN, match_type: MatchType.BOOLEAN_MATCH,
            },
        ],
        provide_modules: [
            {
                module_id: "skills-module-id",
                data: null, weight: 0.4, target_role: null,
                question: "What skills do you have?",
                input_type: InputType.MULTI_CHOICE,
                options: ["React", "Node", "Python", "Design", "Marketing", "DevOps"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
            {
                module_id: "experience-module-id",
                data: null, weight: 0.2, target_role: null,
                question: "Years of experience",
                input_type: InputType.NUMBER_INPUT, options: null,
                data_type: DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
            },
        ],
        provideModules: [
            {
                module_id: "skills-module-id",
                data: null, weight: 0.4, target_role: null,
                question: "What skills do you have?",
                input_type: InputType.MULTI_CHOICE,
                options: ["React", "Node", "Python", "Design", "Marketing", "DevOps"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
            {
                module_id: "experience-module-id",
                data: null, weight: 0.2, target_role: null,
                question: "Years of experience",
                input_type: InputType.NUMBER_INPUT, options: null,
                data_type: DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
            },
        ],
    },
    "investor-role-id": {
        id: "investor-role-id",
        role_name: "Investor",
        roleName: "Investor",
        assigned_roles: ["founder-role-id"],
        assignedRoles: ["founder-role-id"],
        profile_template: { investment_company: "string", linkedin: "url" },
        profileTemplate: { investment_company: "string", linkedin: "url" },
        require_modules: [
            {
                module_id: "industry-module-id",
                data: null, weight: 0.2,
                target_role: "founder-role-id",
                question: "Which industries do you invest in?",
                input_type: InputType.MULTI_CHOICE,
                options: ["FinTech", "EdTech", "HealthTech", "SaaS", "E-Commerce", "Other"],
                data_type: DataType.TEXT, match_type: MatchType.EXACT_MATCH,
            },
        ],
        requireModules: [
            {
                module_id: "industry-module-id",
                data: null, weight: 0.2,
                target_role: "founder-role-id",
                question: "Which industries do you invest in?",
                input_type: InputType.MULTI_CHOICE,
                options: ["FinTech", "EdTech", "HealthTech", "SaaS", "E-Commerce", "Other"],
                data_type: DataType.TEXT, match_type: MatchType.EXACT_MATCH,
            },
        ],
        provide_modules: [
            {
                module_id: "funding-module-id",
                data: null, weight: 0.3, target_role: null,
                question: "What funding range do you offer (USD)?",
                input_type: InputType.RANGE_INPUT, options: null,
                data_type: DataType.RANGE, match_type: MatchType.RANGE_MATCH,
            },
        ],
        provideModules: [
            {
                module_id: "funding-module-id",
                data: null, weight: 0.3, target_role: null,
                question: "What funding range do you offer (USD)?",
                input_type: InputType.RANGE_INPUT, options: null,
                data_type: DataType.RANGE, match_type: MatchType.RANGE_MATCH,
            },
        ],
    },
    "freelancer-role-id": {
        id: "freelancer-role-id",
        role_name: "Freelancer",
        roleName: "Freelancer",
        assigned_roles: ["founder-role-id", "employee-role-id", "student-role-id"],
        assignedRoles: ["founder-role-id", "employee-role-id", "student-role-id"],
        profile_template: { portfolio: "url", fiverr: "url", upwork: "url" },
        profileTemplate: { portfolio: "url", fiverr: "url", upwork: "url" },
        require_modules: [
            {
                module_id: "industry-module-id",
                data: null, weight: 0.2,
                target_role: "founder-role-id",
                question: "Which industry do you work in?",
                input_type: InputType.SINGLE_CHOICE,
                options: ["FinTech", "EdTech", "HealthTech", "SaaS", "E-Commerce", "Other"],
                data_type: DataType.TEXT, match_type: MatchType.EXACT_MATCH,
            },
        ],
        requireModules: [
            {
                module_id: "industry-module-id",
                data: null, weight: 0.2,
                target_role: "founder-role-id",
                question: "Which industry do you work in?",
                input_type: InputType.SINGLE_CHOICE,
                options: ["FinTech", "EdTech", "HealthTech", "SaaS", "E-Commerce", "Other"],
                data_type: DataType.TEXT, match_type: MatchType.EXACT_MATCH,
            },
        ],
        provide_modules: [
            {
                module_id: "skills-module-id",
                data: null, weight: 0.4, target_role: null,
                question: "What skills do you offer?",
                input_type: InputType.MULTI_CHOICE,
                options: ["React", "Node", "Python", "Design", "Marketing", "DevOps"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
            {
                module_id: "service-module-id",
                data: null, weight: 0.3, target_role: null,
                question: "What services do you provide?",
                input_type: InputType.MULTI_CHOICE,
                options: ["Design", "Branding", "Legal", "Accounting", "Marketing"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
            {
                module_id: "experience-module-id",
                data: null, weight: 0.2, target_role: null,
                question: "Years of experience",
                input_type: InputType.NUMBER_INPUT, options: null,
                data_type: DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
            },
        ],
        provideModules: [
            {
                module_id: "skills-module-id",
                data: null, weight: 0.4, target_role: null,
                question: "What skills do you offer?",
                input_type: InputType.MULTI_CHOICE,
                options: ["React", "Node", "Python", "Design", "Marketing", "DevOps"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
            {
                module_id: "service-module-id",
                data: null, weight: 0.3, target_role: null,
                question: "What services do you provide?",
                input_type: InputType.MULTI_CHOICE,
                options: ["Design", "Branding", "Legal", "Accounting", "Marketing"],
                data_type: DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
            },
            {
                module_id: "experience-module-id",
                data: null, weight: 0.2, target_role: null,
                question: "Years of experience",
                input_type: InputType.NUMBER_INPUT, options: null,
                data_type: DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
            },
        ],
    },
};
Object.assign(exports.ROLE_SCHEMAS, _DEMO_SCHEMAS);
