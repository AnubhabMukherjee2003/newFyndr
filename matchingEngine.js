// ============================================================
// Dynamic Role Matching Engine
// ============================================================
//
// Core rules:
//   - Engine starts blank. Admin creates roles and modules.
//   - module_data lives INSIDE require_modules / provide_modules
//     on each RoleSchema.
//
// Feed scoring — two tiers:
//   TIER 1 (base):   candidate role is in currentUser.assigned_roles
//                    → always appears in feed, score = 0 if no module match
//   TIER 2 (scored): A.require_module has target_role === candidate.role_id
//                    AND that module_id exists in candidate.provide_modules
//                    → full module comparison runs, score > 0
//
//   target_role: null on a require_module means it does NOT drive
//   feed targeting — it contributes to score only if the candidate
//   already qualifies via assigned_roles.
//
// Scoring direction: always from currentUser's perspective (A→B).
//   A generates feed → scores how well each candidate satisfies A's requires.
//   B generates feed → scores how well each candidate satisfies B's requires.
//
// User shape:
//   { id, name, email, role_schema_id, profile_data, module_data[] }
//   module_data: [{ module_id, data }]  — user's filled answers
// ============================================================


// ------------------------------------------------------------
// DataType — what kind of value is stored in a module's data field
// ------------------------------------------------------------
const DataType = Object.freeze({
  VECTOR:  "VECTOR",   // string[] — multi/single choice tags
  BOOLEAN: "BOOLEAN",  // boolean
  NUMERIC: "NUMERIC",  // number
  RANGE:   "RANGE",    // { min, max }
  TEXT:    "TEXT",     // string — exact match
});

// ------------------------------------------------------------
// MatchType — algorithm used to compare require.data vs provide.data
// ------------------------------------------------------------
const MatchType = Object.freeze({
  OVERLAP_MATCH: "OVERLAP_MATCH", // VECTOR  — Jaccard intersection/union
  EXACT_MATCH:   "EXACT_MATCH",   // TEXT    — strict equality (case-insensitive)
  BOOLEAN_MATCH: "BOOLEAN_MATCH", // BOOLEAN — must be equal
  NUMERIC_MATCH: "NUMERIC_MATCH", // NUMERIC — provided >= required, else decay
  RANGE_MATCH:   "RANGE_MATCH",   // RANGE   — overlap / required length
});

// ------------------------------------------------------------
// InputType — how a module is rendered in the UI at signup/edit
// ------------------------------------------------------------
const InputType = Object.freeze({
  SINGLE_CHOICE:  "SINGLE_CHOICE",  // radio     → data: string[] length 1
  MULTI_CHOICE:   "MULTI_CHOICE",   // checkbox  → data: string[]
  TEXT_INPUT:     "TEXT_INPUT",     // text box  → data: string
  NUMBER_INPUT:   "NUMBER_INPUT",   // stepper   → data: number
  RANGE_INPUT:    "RANGE_INPUT",    // slider    → data: { min, max }
  BOOLEAN_TOGGLE: "BOOLEAN_TOGGLE", // switch    → data: boolean
});


// ============================================================
// RoleSchema store  (admin-managed, starts empty)
//
// Each RoleSchema:
// {
//   id:               string
//   role_name:        string
//   assigned_roles:   string[]     — role ids that appear in this role's feed
//   profile_template: object       — static profile fields (name→type)
//   require_modules:  ModuleEntry[]
//   provide_modules:  ModuleEntry[]
// }
//
// ModuleEntry (inside require_modules / provide_modules):
// {
//   module_id:   string      — unique module identifier
//   data:        null        — always null in schema; filled per-user
//   weight:      number      — scoring weight (relative, not required to sum to 1)
//   target_role: string|null — if set on a require_module: this module drives
//                              feed targeting for that role. The candidate must
//                              have this module_id in their provide_modules to
//                              get a scored entry. null = no feed targeting.
//   question:    string      — prompt shown to user
//   input_type:  InputType
//   options:     string[]|null — choices for SINGLE/MULTI_CHOICE, else null
//   data_type:   DataType
//   match_type:  MatchType
// }
// ============================================================

const ROLE_SCHEMAS = {};   // populated via createRole()


// ============================================================
// Demo seed data — illustrates the schema
// In production this comes from the database, not hardcoded.
// ============================================================

const _DEMO_SCHEMAS = {

  "student-role-id": {
    id:               "student-role-id",
    role_name:        "Student",
    assigned_roles:   ["teacher-role-id", "freelancer-role-id"],
    profile_template: { college: "string", semester: "number" },
    require_modules: [
      {
        module_id:   "learning-module-id",
        data:        null,
        weight:      0.6,
        // target_role drives feed: Student feed shows Teachers because
        // this require_module targets "teacher-role-id"
        target_role: "teacher-role-id",
        question:    "Choose what you want to learn",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["History","Geography","Math","Physics","CS","Chemistry"],
        data_type:   DataType.VECTOR,
        match_type:  MatchType.OVERLAP_MATCH,
      },
    ],
    provide_modules: [
      {
        // Mirrored from Teacher.require_modules[year-module-id] (target_role: student)
        // Admin added this manually after seeing the propagation hint
        module_id:   "year-module-id",
        data:        null,
        weight:      0.4,
        target_role: null,   // provide_modules never drive feed targeting
        question:    "Which year are you in?",
        input_type:  InputType.SINGLE_CHOICE,
        options:     ["1st","2nd","3rd","4th"],
        data_type:   DataType.VECTOR,
        match_type:  MatchType.OVERLAP_MATCH,
      },
    ],
  },

  "teacher-role-id": {
    id:               "teacher-role-id",
    role_name:        "Teacher",
    assigned_roles:   ["student-role-id"],
    profile_template: { institution: "string", designation: "string" },
    require_modules: [
      {
        module_id:   "year-module-id",
        data:        null,
        weight:      0.4,
        // target_role drives feed: Teacher feed shows Students
        // Propagation hint: admin should add year-module-id to Student.provide_modules
        target_role: "student-role-id",
        question:    "Which years do you want to teach?",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["1st","2nd","3rd","4th"],
        data_type:   DataType.VECTOR,
        match_type:  MatchType.OVERLAP_MATCH,
      },
    ],
    provide_modules: [
      {
        module_id:   "learning-module-id",
        data:        null,
        weight:      0.6,
        target_role: null,
        question:    "Choose what you want to teach",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["History","Geography","Math","Physics","CS","Chemistry"],
        data_type:   DataType.VECTOR,
        match_type:  MatchType.OVERLAP_MATCH,
      },
    ],
  },

  "founder-role-id": {
    id:               "founder-role-id",
    role_name:        "Founder",
    assigned_roles:   ["employee-role-id","investor-role-id","freelancer-role-id"],
    profile_template: { startup_name: "string", website: "string", pitch_deck: "url" },
    require_modules: [
      {
        module_id:   "skills-module-id",
        data:        null, weight: 0.4,
        target_role: "employee-role-id",
        question:    "What skills are you looking for?",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["React","Node","Python","Design","Marketing","DevOps"],
        data_type:   DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
      },
      {
        module_id:   "experience-module-id",
        data:        null, weight: 0.2,
        target_role: "employee-role-id",
        question:    "Minimum years of experience required",
        input_type:  InputType.NUMBER_INPUT, options: null,
        data_type:   DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
      },
      {
        module_id:   "funding-module-id",
        data:        null, weight: 0.3,
        target_role: "investor-role-id",
        question:    "Funding range you are seeking (USD)",
        input_type:  InputType.RANGE_INPUT, options: null,
        data_type:   DataType.RANGE, match_type: MatchType.RANGE_MATCH,
      },
      {
        module_id:   "service-module-id",
        data:        null, weight: 0.3,
        target_role: "freelancer-role-id",
        question:    "What services do you need?",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["Design","Branding","Legal","Accounting","Marketing"],
        data_type:   DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
      },
    ],
    provide_modules: [
      {
        module_id:   "industry-module-id",
        data:        null, weight: 0.2, target_role: null,
        question:    "What industry is your startup in?",
        input_type:  InputType.SINGLE_CHOICE,
        options:     ["FinTech","EdTech","HealthTech","SaaS","E-Commerce","Other"],
        data_type:   DataType.TEXT, match_type: MatchType.EXACT_MATCH,
      },
      {
        module_id:   "workmode-module-id",
        data:        null, weight: 0.1, target_role: null,
        question:    "Is the role remote?",
        input_type:  InputType.BOOLEAN_TOGGLE, options: null,
        data_type:   DataType.BOOLEAN, match_type: MatchType.BOOLEAN_MATCH,
      },
    ],
  },

  "employee-role-id": {
    id:               "employee-role-id",
    role_name:        "Employee",
    assigned_roles:   ["founder-role-id","freelancer-role-id"],
    profile_template: { github: "url", portfolio: "url", resume: "url" },
    require_modules: [
      {
        module_id:   "industry-module-id",
        data:        null, weight: 0.2,
        target_role: "founder-role-id",
        question:    "Which industry are you looking to work in?",
        input_type:  InputType.SINGLE_CHOICE,
        options:     ["FinTech","EdTech","HealthTech","SaaS","E-Commerce","Other"],
        data_type:   DataType.TEXT, match_type: MatchType.EXACT_MATCH,
      },
      {
        module_id:   "workmode-module-id",
        data:        null, weight: 0.1,
        target_role: "founder-role-id",
        question:    "Do you prefer remote work?",
        input_type:  InputType.BOOLEAN_TOGGLE, options: null,
        data_type:   DataType.BOOLEAN, match_type: MatchType.BOOLEAN_MATCH,
      },
    ],
    provide_modules: [
      {
        module_id:   "skills-module-id",
        data:        null, weight: 0.4, target_role: null,
        question:    "What skills do you have?",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["React","Node","Python","Design","Marketing","DevOps"],
        data_type:   DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
      },
      {
        module_id:   "experience-module-id",
        data:        null, weight: 0.2, target_role: null,
        question:    "Years of experience",
        input_type:  InputType.NUMBER_INPUT, options: null,
        data_type:   DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
      },
    ],
  },

  "investor-role-id": {
    id:               "investor-role-id",
    role_name:        "Investor",
    assigned_roles:   ["founder-role-id"],
    profile_template: { investment_company: "string", linkedin: "url" },
    require_modules: [
      {
        module_id:   "industry-module-id",
        data:        null, weight: 0.2,
        target_role: "founder-role-id",
        question:    "Which industries do you invest in?",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["FinTech","EdTech","HealthTech","SaaS","E-Commerce","Other"],
        data_type:   DataType.TEXT, match_type: MatchType.EXACT_MATCH,
      },
    ],
    provide_modules: [
      {
        module_id:   "funding-module-id",
        data:        null, weight: 0.3, target_role: null,
        question:    "What funding range do you offer (USD)?",
        input_type:  InputType.RANGE_INPUT, options: null,
        data_type:   DataType.RANGE, match_type: MatchType.RANGE_MATCH,
      },
    ],
  },

  "freelancer-role-id": {
    id:               "freelancer-role-id",
    role_name:        "Freelancer",
    assigned_roles:   ["founder-role-id","employee-role-id","student-role-id"],
    profile_template: { portfolio: "url", fiverr: "url", upwork: "url" },
    require_modules: [
      {
        module_id:   "industry-module-id",
        data:        null, weight: 0.2,
        target_role: "founder-role-id",
        question:    "Which industry do you work in?",
        input_type:  InputType.SINGLE_CHOICE,
        options:     ["FinTech","EdTech","HealthTech","SaaS","E-Commerce","Other"],
        data_type:   DataType.TEXT, match_type: MatchType.EXACT_MATCH,
      },
    ],
    provide_modules: [
      {
        module_id:   "skills-module-id",
        data:        null, weight: 0.4, target_role: null,
        question:    "What skills do you offer?",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["React","Node","Python","Design","Marketing","DevOps"],
        data_type:   DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
      },
      {
        module_id:   "service-module-id",
        data:        null, weight: 0.3, target_role: null,
        question:    "What services do you provide?",
        input_type:  InputType.MULTI_CHOICE,
        options:     ["Design","Branding","Legal","Accounting","Marketing"],
        data_type:   DataType.VECTOR, match_type: MatchType.OVERLAP_MATCH,
      },
      {
        module_id:   "experience-module-id",
        data:        null, weight: 0.2, target_role: null,
        question:    "Years of experience",
        input_type:  InputType.NUMBER_INPUT, options: null,
        data_type:   DataType.NUMERIC, match_type: MatchType.NUMERIC_MATCH,
      },
    ],
  },
};

// Load demo schemas into the live store
Object.assign(ROLE_SCHEMAS, _DEMO_SCHEMAS);


// ============================================================
// User store  (in-memory — replace with DB in production)
// ============================================================

const USERS = {};   // id → User

// User shape:
// {
//   id:             string
//   name:           string
//   email:          string          (unique)
//   role_schema_id: string|null     (null until role is assigned)
//   profile_data:   object          (dynamic fields per profile_template)
//   module_data:    ModuleAnswer[]  (user's filled answers)
// }
//
// ModuleAnswer: { module_id: string, data: any }


// ------------------------------------------------------------
// User CRUD
// ------------------------------------------------------------

function createUser({ name, email }) {
  if (!name || !name.trim())  throw new Error("name is required");
  if (!email || !email.trim()) throw new Error("email is required");

  const existing = Object.values(USERS).find(u => u.email === email.toLowerCase().trim());
  if (existing) throw new Error(`Email already registered: ${email}`);

  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const user = {
    id,
    name:           name.trim(),
    email:          email.toLowerCase().trim(),
    role_schema_id: null,
    profile_data:   {},
    module_data:    [],
  };

  USERS[id] = user;
  return { ...user };
}

function getUser(id) {
  const user = USERS[id];
  if (!user) throw new Error(`User not found: ${id}`);
  return { ...user };
}

function getAllUsers() {
  return Object.values(USERS).map(u => ({ ...u }));
}

function updateUser(id, fields) {
  const user = USERS[id];
  if (!user) throw new Error(`User not found: ${id}`);

  // Only allow safe top-level field updates this way
  const allowed = ["name", "profile_data"];
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key))
      throw new Error(`Field "${key}" cannot be updated via updateUser. Use assignRole or fillModuleData.`);
  }

  if (fields.name !== undefined) {
    if (!fields.name.trim()) throw new Error("name cannot be empty");
    user.name = fields.name.trim();
  }
  if (fields.profile_data !== undefined) {
    user.profile_data = { ...user.profile_data, ...fields.profile_data };
  }

  return { ...user };
}

function deleteUser(id) {
  if (!USERS[id]) throw new Error(`User not found: ${id}`);
  delete USERS[id];
  return { deleted: id };
}


// ------------------------------------------------------------
// Role assignment
// ------------------------------------------------------------

// Assign a role to a user.
// Clears existing module_data since the new role has different modules.
function assignRole(userId, roleSchemaId) {
  const user = USERS[userId];
  if (!user) throw new Error(`User not found: ${userId}`);

  const role = ROLE_SCHEMAS[roleSchemaId];
  if (!role) throw new Error(`Role not found: ${roleSchemaId}`);

  user.role_schema_id = roleSchemaId;
  user.profile_data   = {};
  user.module_data    = [];

  return { ...user };
}

// Returns the full role schema for a user, or null if no role assigned
function getUserRole(userId) {
  const user = USERS[userId];
  if (!user) throw new Error(`User not found: ${userId}`);
  if (!user.role_schema_id) return null;
  return { ...ROLE_SCHEMAS[user.role_schema_id] };
}

// Returns the module questions the user still needs to fill,
// split by require_modules and provide_modules.
function getPendingModules(userId) {
  const user = USERS[userId];
  if (!user) throw new Error(`User not found: ${userId}`);

  const role = ROLE_SCHEMAS[user.role_schema_id];
  if (!role) return { require_modules: [], provide_modules: [] };

  const filledIds = new Set(user.module_data.map(m => m.module_id));

  return {
    require_modules: role.require_modules.filter(m => !filledIds.has(m.module_id)),
    provide_modules: role.provide_modules.filter(m => !filledIds.has(m.module_id)),
  };
}


// ------------------------------------------------------------
// Module data filling
// ------------------------------------------------------------

// Fill or update a single module answer for a user.
// Validates that the module belongs to their role (either side).
function fillModuleData(userId, moduleId, data) {
  const user = USERS[userId];
  if (!user) throw new Error(`User not found: ${userId}`);

  const role = ROLE_SCHEMAS[user.role_schema_id];
  if (!role) throw new Error(`User ${userId} has no role assigned`);

  const allModules = [...role.require_modules, ...role.provide_modules];
  const moduleDef  = allModules.find(m => m.module_id === moduleId);
  if (!moduleDef)
    throw new Error(`Module "${moduleId}" does not belong to role "${role.role_name}"`);

  _validateModuleValue(moduleDef, data);

  const existing = user.module_data.find(m => m.module_id === moduleId);
  if (existing) {
    existing.data = data;
  } else {
    user.module_data.push({ module_id: moduleId, data });
  }

  return { ...user };
}

// Fill multiple modules at once: [{ module_id, data }, ...]
function fillModuleDataBatch(userId, answers) {
  if (!Array.isArray(answers)) throw new Error("answers must be an array");
  let user;
  for (const { module_id, data } of answers) {
    user = fillModuleData(userId, module_id, data);
  }
  return user ?? getUser(userId);
}

// Clear a user's answer for a specific module (e.g. if they want to re-answer)
function clearModuleData(userId, moduleId) {
  const user = USERS[userId];
  if (!user) throw new Error(`User not found: ${userId}`);
  user.module_data = user.module_data.filter(m => m.module_id !== moduleId);
  return { ...user };
}

function _validateModuleValue(moduleDef, data) {
  switch (moduleDef.input_type) {
    case InputType.MULTI_CHOICE:
      if (!Array.isArray(data) || data.length === 0)
        throw new Error(`Module "${moduleDef.module_id}" expects a non-empty array (MULTI_CHOICE)`);
      break;
    case InputType.SINGLE_CHOICE:
      if (!Array.isArray(data) || data.length !== 1)
        throw new Error(`Module "${moduleDef.module_id}" expects an array with exactly 1 item (SINGLE_CHOICE)`);
      break;
    case InputType.TEXT_INPUT:
      if (typeof data !== "string" || !data.trim())
        throw new Error(`Module "${moduleDef.module_id}" expects a non-empty string (TEXT_INPUT)`);
      break;
    case InputType.NUMBER_INPUT:
      if (typeof data !== "number" || isNaN(data))
        throw new Error(`Module "${moduleDef.module_id}" expects a number (NUMBER_INPUT)`);
      break;
    case InputType.RANGE_INPUT:
      if (!data || typeof data.min !== "number" || typeof data.max !== "number" || data.min > data.max)
        throw new Error(`Module "${moduleDef.module_id}" expects { min, max } with min <= max (RANGE_INPUT)`);
      break;
    case InputType.BOOLEAN_TOGGLE:
      if (typeof data !== "boolean")
        throw new Error(`Module "${moduleDef.module_id}" expects a boolean (BOOLEAN_TOGGLE)`);
      break;
  }
}


// ============================================================
// Comparison engine
// ============================================================

function overlapMatch(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  if (vecA.length === 0 || vecB.length === 0) return 0;
  const a = new Set(vecA.map(v => String(v).toLowerCase().trim()));
  const b = new Set(vecB.map(v => String(v).toLowerCase().trim()));
  const intersection = [...a].filter(v => b.has(v)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function numericMatch(required, provided) {
  if (typeof required !== "number" || typeof provided !== "number") return 0;
  if (required === 0) return 1;
  return provided >= required ? 1 : Math.max(0, provided / required);
}

function rangeMatch(requiredRange, providedRange) {
  if (!requiredRange || !providedRange) return 0;
  const overlapMin = Math.max(requiredRange.min, providedRange.min);
  const overlapMax = Math.min(requiredRange.max, providedRange.max);
  const overlap    = Math.max(0, overlapMax - overlapMin);
  const reqLen     = requiredRange.max - requiredRange.min;
  return reqLen === 0 ? (overlap > 0 ? 1 : 0) : overlap / reqLen;
}

function compareModule(matchType, requireValue, provideValue) {
  switch (matchType) {
    case MatchType.OVERLAP_MATCH:  return overlapMatch(requireValue, provideValue);
    case MatchType.EXACT_MATCH:    return String(requireValue).toLowerCase() === String(provideValue).toLowerCase() ? 1 : 0;
    case MatchType.BOOLEAN_MATCH:  return requireValue === provideValue ? 1 : 0;
    case MatchType.NUMERIC_MATCH:  return numericMatch(requireValue, provideValue);
    case MatchType.RANGE_MATCH:    return rangeMatch(requireValue, provideValue);
    default:
      console.warn(`Unsupported MatchType: ${matchType}`);
      return 0;
  }
}


// ============================================================
// Module engine
// ============================================================

// Merge schema definitions with a user's filled answers
function mergeModuleData(schemaModules, userModuleData) {
  const userMap = {};
  if (Array.isArray(userModuleData)) {
    for (const entry of userModuleData) userMap[entry.module_id] = entry.data;
  }
  return schemaModules.map(mod => ({ ...mod, data: userMap[mod.module_id] ?? null }));
}

// Score currentUser's require_modules against candidate's provide_modules.
// Returns { score, totalWeight }
function matchModules(requireModules, provideModules) {
  let score = 0, totalWeight = 0;

  for (const req of requireModules) {
    const prov = provideModules.find(p => p.module_id === req.module_id);
    if (!prov)            continue;  // candidate doesn't provide this module
    if (req.data  == null) continue; // current user hasn't answered yet
    if (prov.data == null) continue; // candidate hasn't answered yet

    score       += compareModule(req.match_type, req.data, prov.data) * req.weight;
    totalWeight += req.weight;
  }

  return { score, totalWeight };
}


// ============================================================
// Score engine
// Single direction: how well does candidate satisfy currentUser?
// ============================================================

function calculateScore(currentUser, candidate) {
  const currentRole   = ROLE_SCHEMAS[currentUser.role_schema_id];
  const candidateRole = ROLE_SCHEMAS[candidate.role_schema_id];
  if (!currentRole || !candidateRole) return 0;

  const requireModules = mergeModuleData(currentRole.require_modules, currentUser.module_data);
  const provideModules = mergeModuleData(candidateRole.provide_modules, candidate.module_data);

  const { score, totalWeight } = matchModules(requireModules, provideModules);
  if (totalWeight === 0) return 0;

  return Math.round((score / totalWeight) * 100) / 100;
}


// ============================================================
// Feed engine
// ============================================================

// Returns the set of role ids that currentRole targets via
// require_modules[].target_role (non-null entries only).
function getTargetedRoleIds(currentRoleSchema) {
  const ids = new Set();
  for (const mod of currentRoleSchema.require_modules) {
    if (mod.target_role) ids.add(mod.target_role);
  }
  return ids;
}

// Does the current role have at least one require_module targeting
// the candidate's role, AND the candidate provides that module_id?
function isScoredCandidate(currentRoleSchema, candidateRoleSchema) {
  const candidateProvideIds = new Set(candidateRoleSchema.provide_modules.map(m => m.module_id));
  return currentRoleSchema.require_modules.some(
    req => req.target_role === candidateRoleSchema.id && candidateProvideIds.has(req.module_id)
  );
}

// Stubs — replace with real DB queries
function alreadyMatched(userA, userB) { return false; }
function alreadyLiked(userA, userB)   { return false; }

// Generate feed for currentUser from a list of candidates.
// Accepts User objects (with module_data already on them).
// Two-tier scoring:
//   - Candidate role in assigned_roles → included, score via matchModules
//   - If no module match → score = 0 (still included, shown last)
function generateFeed(currentUser, allUsers) {
  const feed = [];

  const currentRole = ROLE_SCHEMAS[currentUser.role_schema_id];
  if (!currentRole) {
    console.error(`No role assigned to user: ${currentUser.id}`);
    return feed;
  }

  const targetedRoleIds = getTargetedRoleIds(currentRole);

  for (const candidate of allUsers) {
    if (candidate.id === currentUser.id) continue;

    const candidateRole = ROLE_SCHEMAS[candidate.role_schema_id];
    if (!candidateRole) continue;

    // TIER 1: candidate role must be in assigned_roles
    if (!currentRole.assigned_roles.includes(candidateRole.id)) continue;

    if (alreadyMatched(currentUser, candidate)) continue;
    if (alreadyLiked(currentUser, candidate))   continue;

    // TIER 2: check if this candidate role is targeted via require_modules
    const isTargeted = targetedRoleIds.has(candidateRole.id);
    const hasModuleMatch = isTargeted && isScoredCandidate(currentRole, candidateRole);

    // Score: run matching only when there's a module link; else 0
    const score = hasModuleMatch ? calculateScore(currentUser, candidate) : 0;

    feed.push({
      user:          candidate,
      score,
      // Signals to the frontend whether this is a module-matched result
      // or just a role-assigned result with no module overlap yet
      match_tier:    hasModuleMatch ? "scored" : "base",
    });
  }

  // Scored entries first, then base; within each tier sort by score desc
  feed.sort((a, b) => {
    if (a.match_tier !== b.match_tier)
      return a.match_tier === "scored" ? -1 : 1;
    return b.score - a.score;
  });

  return feed.slice(0, 20);
}

// Convenience: generate feed for a user by id, pulling all users from the store
function generateFeedForUser(userId) {
  const user = USERS[userId];
  if (!user) throw new Error(`User not found: ${userId}`);
  return generateFeed(user, Object.values(USERS));
}


// ============================================================
// Admin helpers
// ============================================================

// List all propagation hints:
// When a require_module has target_role set, admin should manually
// mirror it on the target role's provide_modules side.
function getPropagationHints() {
  const hints = [];
  for (const [, schema] of Object.entries(ROLE_SCHEMAS)) {
    for (const mod of schema.require_modules) {
      if (!mod.target_role) continue;
      const targetSchema = ROLE_SCHEMAS[mod.target_role];
      const alreadyMirrored = targetSchema?.provide_modules.some(p => p.module_id === mod.module_id);
      hints.push({
        source_role:      schema.role_name,
        source_role_id:   schema.id,
        module_id:        mod.module_id,
        target_role_id:   mod.target_role,
        target_role_name: targetSchema?.role_name ?? mod.target_role,
        already_mirrored: alreadyMirrored ?? false,
        action:           alreadyMirrored
          ? `✓ Already mirrored in ${targetSchema?.role_name}.provide_modules`
          : `Add "${mod.module_id}" to ${targetSchema?.role_name ?? mod.target_role}.provide_modules`,
      });
    }
  }
  return hints;
}

// CRUD for roles (admin)
function createRole(schema) {
  if (!schema.id)        throw new Error("schema.id is required");
  if (!schema.role_name) throw new Error("schema.role_name is required");
  if (ROLE_SCHEMAS[schema.id]) throw new Error(`Role already exists: ${schema.id}`);
  ROLE_SCHEMAS[schema.id] = {
    assigned_roles:   [],
    profile_template: {},
    require_modules:  [],
    provide_modules:  [],
    ...schema,
  };
  return { ...ROLE_SCHEMAS[schema.id] };
}

function updateRole(id, fields) {
  if (!ROLE_SCHEMAS[id]) throw new Error(`Role not found: ${id}`);
  Object.assign(ROLE_SCHEMAS[id], fields);
  return { ...ROLE_SCHEMAS[id] };
}

function deleteRole(id) {
  if (!ROLE_SCHEMAS[id]) throw new Error(`Role not found: ${id}`);
  // Check no users are on this role
  const affected = Object.values(USERS).filter(u => u.role_schema_id === id);
  if (affected.length > 0)
    throw new Error(`Cannot delete role "${id}" — ${affected.length} user(s) still assigned to it`);
  delete ROLE_SCHEMAS[id];
  return { deleted: id };
}

function getRole(id) {
  if (!ROLE_SCHEMAS[id]) throw new Error(`Role not found: ${id}`);
  return { ...ROLE_SCHEMAS[id] };
}

function getAllRoles() {
  return Object.values(ROLE_SCHEMAS).map(r => ({ ...r }));
}


// ============================================================
// Exports
// ============================================================

module.exports = {
  // Enums
  DataType,
  MatchType,
  InputType,

  // User CRUD
  createUser,
  getUser,
  getAllUsers,
  updateUser,
  deleteUser,

  // Role management (user-facing)
  assignRole,
  getUserRole,
  getPendingModules,

  // Module data
  fillModuleData,
  fillModuleDataBatch,
  clearModuleData,

  // Feed
  generateFeed,
  generateFeedForUser,

  // Score (exposed for testing / ranking UI)
  calculateScore,
  compareModule,
  matchModules,
  mergeModuleData,
  isScoredCandidate,
  getTargetedRoleIds,

  // Admin — roles
  createRole,
  updateRole,
  deleteRole,
  getRole,
  getAllRoles,
  getPropagationHints,

  // Stores (for tests / admin inspection)
  ROLE_SCHEMAS,
  USERS,
};
