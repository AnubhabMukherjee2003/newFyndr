"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const matchingEngine_1 = require("./matchingEngine");
// ── harness ──────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(label, fn) {
    try {
        fn();
        console.log(`  ✓  ${label}`);
        passed++;
    }
    catch (e) {
        console.error(`  ✗  ${label}\n     ${e.message}`);
        failed++;
    }
}
function assert(cond, msg) { if (!cond)
    throw new Error(msg ?? "assertion failed"); }
function assertEqual(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${m ?? ""}\n     expected: ${JSON.stringify(b)}\n     got:      ${JSON.stringify(a)}`); }
function assertClose(a, b, tol = 0.05, m) { if (Math.abs(a - b) > tol)
    throw new Error(`${m ?? ""} expected≈${b} got ${a}`); }
function assertThrows(fn, msg) {
    try {
        fn();
        throw new Error("Expected an error but none was thrown");
    }
    catch (e) {
        if (e.message === "Expected an error but none was thrown")
            throw e;
    }
}
// ── Enums ─────────────────────────────────────────────────────
console.log("\n── Enums ────────────────────────────────────────────────────────");
test("DataType values match", () => assert(matchingEngine_1.DataType.VECTOR === "VECTOR"));
test("MatchType values match", () => assert(matchingEngine_1.MatchType.OVERLAP_MATCH === "OVERLAP_MATCH"));
test("InputType values match", () => assert(matchingEngine_1.InputType.MULTI_CHOICE === "MULTI_CHOICE"));
test("InputType has all 6 keys", () => {
    ["SINGLE_CHOICE", "MULTI_CHOICE", "TEXT_INPUT", "NUMBER_INPUT", "RANGE_INPUT", "BOOLEAN_TOGGLE"]
        .forEach(k => assert(matchingEngine_1.InputType[k] === k, `Missing InputType.${k}`));
});
// ── User CRUD ─────────────────────────────────────────────────
console.log("\n── User CRUD ────────────────────────────────────────────────────");
let alice = {};
let bob = {};
let carol = {};
test("createUser returns user with id, name, email", () => {
    alice = (0, matchingEngine_1.createUser)({ name: "Alice", email: "alice@test.com" });
    assert(alice.id, "no id");
    assertEqual(alice.name, "Alice");
    assertEqual(alice.email, "alice@test.com");
    assertEqual(getRoleSchemaId(alice), null);
    assertEqual(getModuleData(alice), []);
});
test("createUser duplicate email throws", () => {
    assertThrows(() => (0, matchingEngine_1.createUser)({ name: "Alice2", email: "alice@test.com" }));
});
test("createUser missing name throws", () => {
    assertThrows(() => (0, matchingEngine_1.createUser)({ name: "", email: "x@x.com" }));
});
test("getUser returns correct user", () => {
    const u = (0, matchingEngine_1.getUser)(alice.id);
    assertEqual(u.email, "alice@test.com");
});
test("getUser unknown id throws", () => {
    assertThrows(() => (0, matchingEngine_1.getUser)("nonexistent-id"));
});
test("getAllUsers returns array", () => {
    bob = (0, matchingEngine_1.createUser)({ name: "Bob", email: "bob@test.com" });
    carol = (0, matchingEngine_1.createUser)({ name: "Carol", email: "carol@test.com" });
    const all = (0, matchingEngine_1.getAllUsers)();
    assert(all.length >= 3, `Expected ≥3, got ${all.length}`);
});
test("updateUser name", () => {
    const updated = (0, matchingEngine_1.updateUser)(alice.id, { name: "Alice A" });
    assertEqual(updated.name, "Alice A");
});
test("updateUser rejects role_schema_id directly", () => {
    assertThrows(() => (0, matchingEngine_1.updateUser)(alice.id, { role_schema_id: "student-role-id" }));
});
test("deleteUser removes from store", () => {
    const ghost = (0, matchingEngine_1.createUser)({ name: "Ghost", email: "ghost@test.com" });
    (0, matchingEngine_1.deleteUser)(ghost.id);
    assertThrows(() => (0, matchingEngine_1.getUser)(ghost.id));
});
// ── Role assignment ───────────────────────────────────────────
console.log("\n── Role assignment ──────────────────────────────────────────────");
test("assignRole sets role_schema_id and clears module_data", () => {
    const u = (0, matchingEngine_1.assignRole)(alice.id, "student-role-id");
    assertEqual(getRoleSchemaId(u), "student-role-id");
    assertEqual(getModuleData(u), []);
});
test("assignRole unknown role throws", () => {
    assertThrows(() => (0, matchingEngine_1.assignRole)(alice.id, "fake-role-id"));
});
test("getUserRole returns role schema", () => {
    const role = (0, matchingEngine_1.getUserRole)(alice.id);
    assert(role);
    assertEqual(role.roleName || role.role_name, "Student");
});
test("getUserRole returns null when no role", () => {
    const dave = (0, matchingEngine_1.createUser)({ name: "Dave", email: "dave@test.com" });
    assertEqual((0, matchingEngine_1.getUserRole)(dave.id), null);
    (0, matchingEngine_1.deleteUser)(dave.id);
});
test("getPendingModules returns all modules before filling", () => {
    const pending = (0, matchingEngine_1.getPendingModules)(alice.id);
    assert(pending.require_modules.length > 0, "Expected pending require_modules");
    assert(pending.provide_modules.length > 0, "Expected pending provide_modules");
});
// ── Module data filling ───────────────────────────────────────
console.log("\n── Module data filling ──────────────────────────────────────────");
test("fillModuleData stores answer", () => {
    const u = (0, matchingEngine_1.fillModuleData)(alice.id, "learning-module-id", ["Math", "Physics"]);
    const entry = getModuleData(u).find((m) => m.module_id === "learning-module-id");
    assert(entry, "module_data entry missing");
    assertEqual(entry.data, ["Math", "Physics"]);
});
test("fillModuleData updates existing answer", () => {
    const u = (0, matchingEngine_1.fillModuleData)(alice.id, "learning-module-id", ["CS"]);
    const entry = getModuleData(u).find((m) => m.module_id === "learning-module-id");
    assertEqual(entry.data, ["CS"]);
});
test("fillModuleData rejects module not in role", () => {
    assertThrows(() => (0, matchingEngine_1.fillModuleData)(alice.id, "funding-module-id", { min: 0, max: 100 }));
});
test("fillModuleData validation: SINGLE_CHOICE must be array of 1", () => {
    assertThrows(() => (0, matchingEngine_1.fillModuleData)(alice.id, "year-module-id", ["1st", "2nd"]));
});
test("fillModuleData validation: MULTI_CHOICE must be non-empty array", () => {
    assertThrows(() => (0, matchingEngine_1.fillModuleData)(alice.id, "learning-module-id", []));
});
test("fillModuleData SINGLE_CHOICE valid", () => {
    const u = (0, matchingEngine_1.fillModuleData)(alice.id, "year-module-id", ["2nd"]);
    const e = getModuleData(u).find((m) => m.module_id === "year-module-id");
    assertEqual(e.data, ["2nd"]);
});
test("getPendingModules empty after all modules filled", () => {
    const pending = (0, matchingEngine_1.getPendingModules)(alice.id);
    assertEqual(pending.require_modules.length, 0, "require should be empty");
    assertEqual(pending.provide_modules.length, 0, "provide should be empty");
});
test("fillModuleDataBatch fills multiple at once", () => {
    (0, matchingEngine_1.assignRole)(bob.id, "teacher-role-id");
    const u = (0, matchingEngine_1.fillModuleDataBatch)(bob.id, [
        { module_id: "year-module-id", data: ["1st", "2nd", "4th"] },
        { module_id: "learning-module-id", data: ["Math", "CS", "Chemistry"] },
    ]);
    assertEqual(getModuleData(u).length, 2);
});
test("clearModuleData removes an answer", () => {
    const u = (0, matchingEngine_1.clearModuleData)(alice.id, "year-module-id");
    assert(!getModuleData(u).find((m) => m.module_id === "year-module-id"), "year should be cleared");
});
// Restore alice's year module for feed tests
(0, matchingEngine_1.fillModuleData)(alice.id, "year-module-id", ["2nd"]);
// Restore learning to ["Math","Physics"]
(0, matchingEngine_1.fillModuleData)(alice.id, "learning-module-id", ["Math", "Physics"]);
// ── compareModule / matchModules ──────────────────────────────
console.log("\n── compareModule / matchModules ─────────────────────────────────");
test("OVERLAP identical → 1", () => assertClose((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.OVERLAP_MATCH, ["Math", "Physics"], ["Math", "Physics"]), 1.0));
test("OVERLAP no match → 0", () => assertClose((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.OVERLAP_MATCH, ["Math"], ["History"]), 0.0));
test("OVERLAP partial → 1/3", () => assertClose((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.OVERLAP_MATCH, ["Math", "Physics"], ["Physics", "Chemistry"]), 1 / 3, 0.01));
test("OVERLAP case-insensitive", () => assertClose((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.OVERLAP_MATCH, ["math"], ["Math"]), 1.0));
test("EXACT match → 1", () => assertEqual((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.EXACT_MATCH, "FinTech", "fintech"), 1));
test("EXACT no match → 0", () => assertEqual((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.EXACT_MATCH, "FinTech", "EdTech"), 0));
test("BOOLEAN same → 1", () => assertEqual((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.BOOLEAN_MATCH, true, true), 1));
test("BOOLEAN diff → 0", () => assertEqual((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.BOOLEAN_MATCH, true, false), 0));
test("NUMERIC provided >= req → 1", () => assertEqual((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.NUMERIC_MATCH, 3, 5), 1));
test("NUMERIC provided < req → decay", () => assertClose((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.NUMERIC_MATCH, 4, 2), 0.5, 0.01));
test("RANGE full overlap → 1", () => assertClose((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.RANGE_MATCH, { min: 100000, max: 500000 }, { min: 50000, max: 1000000 }), 1.0));
test("RANGE no overlap → 0", () => assertClose((0, matchingEngine_1.compareModule)(matchingEngine_1.MatchType.RANGE_MATCH, { min: 500000, max: 1000000 }, { min: 0, max: 200000 }), 0.0));
test("matchModules returns { score, totalWeight }", () => {
    const req = (0, matchingEngine_1.mergeModuleData)(matchingEngine_1.ROLE_SCHEMAS["student-role-id"].require_modules || [], [{ module_id: "learning-module-id", data: ["Math", "Physics"] }]);
    const prov = (0, matchingEngine_1.mergeModuleData)(matchingEngine_1.ROLE_SCHEMAS["teacher-role-id"].provide_modules || [], [{ module_id: "learning-module-id", data: ["Math", "CS", "Chemistry"] }]);
    const r = (0, matchingEngine_1.matchModules)(req, prov);
    assert("score" in r && "totalWeight" in r);
    assert(r.totalWeight > 0, "totalWeight should be > 0");
    assert(r.score > 0, "score should be > 0");
});
test("matchModules skips null data", () => {
    const req = (0, matchingEngine_1.mergeModuleData)(matchingEngine_1.ROLE_SCHEMAS["student-role-id"].require_modules || [], []); // no answers
    const prov = (0, matchingEngine_1.mergeModuleData)(matchingEngine_1.ROLE_SCHEMAS["teacher-role-id"].provide_modules || [], [{ module_id: "learning-module-id", data: ["Math"] }]);
    const r = (0, matchingEngine_1.matchModules)(req, prov);
    assertEqual(r.totalWeight, 0, "unfilled require should give weight=0");
});
// ── getTargetedRoleIds / isScoredCandidate ────────────────────
console.log("\n── Feed targeting logic ─────────────────────────────────────────");
test("getTargetedRoleIds for Student returns teacher-role-id", () => {
    const ids = (0, matchingEngine_1.getTargetedRoleIds)(matchingEngine_1.ROLE_SCHEMAS["student-role-id"]);
    assert(ids.has("teacher-role-id"), "should target teacher");
});
test("isScoredCandidate: Student→Teacher true (learning-module-id shared)", () => {
    assert((0, matchingEngine_1.isScoredCandidate)(matchingEngine_1.ROLE_SCHEMAS["student-role-id"], matchingEngine_1.ROLE_SCHEMAS["teacher-role-id"]));
});
test("isScoredCandidate: Founder→Teacher false (no shared module)", () => {
    assert(!(0, matchingEngine_1.isScoredCandidate)(matchingEngine_1.ROLE_SCHEMAS["founder-role-id"], matchingEngine_1.ROLE_SCHEMAS["teacher-role-id"]));
});
// ── generateFeed two-tier ─────────────────────────────────────
console.log("\n── generateFeed two-tier scoring ────────────────────────────────");
// Set up Carol as a teacher with no module overlap (History only)
(0, matchingEngine_1.assignRole)(carol.id, "teacher-role-id");
(0, matchingEngine_1.fillModuleDataBatch)(carol.id, [
    { module_id: "year-module-id", data: ["3rd"] },
    { module_id: "learning-module-id", data: ["History"] },
]);
test("Student feed includes Teacher Bob (scored tier)", () => {
    const feed = (0, matchingEngine_1.generateFeed)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getAllUsers)());
    const item = feed.find((i) => i.user.id === bob.id);
    assert(item, "Teacher Bob missing from Student feed");
    assertEqual(item.match_tier, "scored");
    assert(item.score > 0, `Expected score > 0, got ${item.score}`);
});
test("Student feed includes Teacher Carol (scored tier, score=0 — module linked but no subject overlap)", () => {
    const feed = (0, matchingEngine_1.generateFeed)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getAllUsers)());
    const item = feed.find((i) => i.user.id === carol.id);
    assert(item, "Teacher Carol missing from Student feed");
    assertEqual(item.match_tier, "scored", "Carol is scored tier — module_id link exists");
    assertEqual(item.score, 0, "Score should be 0 — no subject overlap");
});
test("Scored tier entries appear before base tier", () => {
    const feed = (0, matchingEngine_1.generateFeed)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getAllUsers)());
    const firstBase = feed.findIndex((i) => i.match_tier === "base");
    const lastScored = feed.map((i) => i.match_tier).lastIndexOf("scored");
    if (firstBase !== -1 && lastScored !== -1)
        assert(lastScored < firstBase, "All scored entries should precede base entries");
});
test("Feed excludes self", () => {
    const feed = (0, matchingEngine_1.generateFeed)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getAllUsers)());
    assert(!feed.some((i) => i.user.id === alice.id), "User should not see themselves");
});
test("Feed excludes roles not in assigned_roles", () => {
    const frank = (0, matchingEngine_1.createUser)({ name: "Frank", email: "frank@test.com" });
    (0, matchingEngine_1.assignRole)(frank.id, "founder-role-id");
    const feed = (0, matchingEngine_1.generateFeed)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getAllUsers)());
    assert(!feed.some((i) => i.user.id === frank.id), "Founder should not appear in Student feed");
    (0, matchingEngine_1.deleteUser)(frank.id);
});
test("Feed is sorted: scored desc, then base desc", () => {
    const feed = (0, matchingEngine_1.generateFeed)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getAllUsers)());
    const scored = feed.filter((i) => i.match_tier === "scored");
    const base = feed.filter((i) => i.match_tier === "base");
    for (let i = 1; i < scored.length; i++)
        assert(scored[i].score <= scored[i - 1].score, "Scored not sorted desc");
    for (let i = 1; i < base.length; i++)
        assert(base[i].score <= base[i - 1].score, "Base not sorted desc");
});
test("Feed capped at 20", () => {
    const extras = [];
    for (let i = 0; i < 25; i++) {
        const u = (0, matchingEngine_1.createUser)({ name: `Teacher${i}`, email: `t${i}@test.com` });
        (0, matchingEngine_1.assignRole)(u.id, "teacher-role-id");
        extras.push(u);
    }
    const feed = (0, matchingEngine_1.generateFeed)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getAllUsers)());
    assert(feed.length <= 20, `Expected ≤20, got ${feed.length}`);
    extras.forEach(u => (0, matchingEngine_1.deleteUser)(u.id));
});
test("generateFeedForUser works by userId", () => {
    const feed = (0, matchingEngine_1.generateFeedForUser)(alice.id);
    assert(Array.isArray(feed));
});
test("generateFeedForUser throws for unknown user", () => {
    assertThrows(() => (0, matchingEngine_1.generateFeedForUser)("no-such-user"));
});
// ── calculateScore ────────────────────────────────────────────
console.log("\n── calculateScore ───────────────────────────────────────────────");
test("Student→Teacher score 0..1", () => {
    const s = (0, matchingEngine_1.calculateScore)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getUser)(bob.id));
    assert(s >= 0 && s <= 1, `out of range: ${s}`);
});
test("Student→Teacher(overlap) > Student→Teacher(no overlap)", () => {
    const s1 = (0, matchingEngine_1.calculateScore)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getUser)(bob.id));
    const s2 = (0, matchingEngine_1.calculateScore)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getUser)(carol.id));
    assert(s1 > s2, `Expected ${s1} > ${s2}`);
});
test("calculateScore: [Math,Physics] vs [Math,CS,Chem] ≈ 0.25", () => {
    const s = (0, matchingEngine_1.calculateScore)((0, matchingEngine_1.getUser)(alice.id), (0, matchingEngine_1.getUser)(bob.id));
    assertClose(s, 0.25, 0.05, "Student→Teacher score");
});
// ── Admin role CRUD ───────────────────────────────────────────
console.log("\n── Admin role CRUD ──────────────────────────────────────────────");
test("createRole adds to ROLE_SCHEMAS", () => {
    (0, matchingEngine_1.createRole)({ id: "mentor-role-id", roleName: "Mentor", assignedRoles: [] });
    assert(matchingEngine_1.ROLE_SCHEMAS["mentor-role-id"], "role not found after create");
});
test("createRole duplicate id throws", () => {
    assertThrows(() => (0, matchingEngine_1.createRole)({ id: "mentor-role-id", roleName: "Mentor2" }));
});
test("updateRole updates fields", () => {
    const r = (0, matchingEngine_1.updateRole)("mentor-role-id", { roleName: "Senior Mentor" });
    assertEqual(r.roleName, "Senior Mentor");
});
test("getRole returns correct role", () => {
    const r = (0, matchingEngine_1.getRole)("mentor-role-id");
    assertEqual(r.roleName, "Senior Mentor");
});
test("getAllRoles includes demo + new role", () => {
    const roles = (0, matchingEngine_1.getAllRoles)();
    assert(roles.length >= 7, `Expected ≥7 roles, got ${roles.length}`);
});
test("deleteRole with no users succeeds", () => {
    const r = (0, matchingEngine_1.deleteRole)("mentor-role-id");
    assertEqual(r.deleted, "mentor-role-id");
    assertThrows(() => (0, matchingEngine_1.getRole)("mentor-role-id"));
});
test("deleteRole with assigned users throws", () => {
    assertThrows(() => (0, matchingEngine_1.deleteRole)("student-role-id")); // alice is on this role
});
// ── Propagation hints ─────────────────────────────────────────
console.log("\n── getPropagationHints ──────────────────────────────────────────");
test("returns array", () => assert(Array.isArray((0, matchingEngine_1.getPropagationHints)())));
test("Teacher year-module-id hint targets student-role-id", () => {
    const h = (0, matchingEngine_1.getPropagationHints)().find((h) => h.module_id === "year-module-id" && h.source_role === "Teacher");
    assert(h, "hint missing");
    assertEqual(h.target_role_id, "student-role-id");
});
test("already_mirrored is true for year-module-id (Student has it in provide)", () => {
    const h = (0, matchingEngine_1.getPropagationHints)().find((h) => h.module_id === "year-module-id" && h.source_role === "Teacher");
    assert(h.already_mirrored, "Should show as already mirrored");
});
test("every hint has an action string", () => {
    (0, matchingEngine_1.getPropagationHints)().forEach((h) => assert(typeof h.action === "string" && h.action.length > 0));
});
// ── target_role: null does not drive feed ─────────────────────
console.log("\n── target_role: null does not drive feed ────────────────────────");
test("Freelancer feed includes Student (in assigned_roles) at base tier if no module link", () => {
    const erin = (0, matchingEngine_1.createUser)({ name: "Erin", email: "erin@test.com" });
    (0, matchingEngine_1.assignRole)(erin.id, "freelancer-role-id");
    (0, matchingEngine_1.fillModuleDataBatch)(erin.id, [
        { module_id: "industry-module-id", data: ["FinTech"] },
        { module_id: "skills-module-id", data: ["React", "Design"] },
        { module_id: "service-module-id", data: ["Design", "Branding"] },
        { module_id: "experience-module-id", data: 3 },
    ]);
    const feed = (0, matchingEngine_1.generateFeed)((0, matchingEngine_1.getUser)(erin.id), (0, matchingEngine_1.getAllUsers)());
    const studentItem = feed.find((i) => i.user.id === alice.id);
    assert(studentItem, "Student should appear in Freelancer feed (assigned_roles)");
    assertEqual(studentItem.match_tier, "base", "Should be base tier — no targeted require_module for student");
    assertEqual(studentItem.score, 0);
    (0, matchingEngine_1.deleteUser)(erin.id);
});
// Helper functions for schema mapping
function getRoleSchemaId(user) {
    return user.roleSchemaId !== undefined ? user.roleSchemaId : (user.role_schema_id || null);
}
function getModuleData(user) {
    return user.moduleData || user.module_data || [];
}
// ── summary ───────────────────────────────────────────────────
console.log(`\n${"─".repeat(56)}`);
console.log(`  ${passed} passed   ${failed} failed   ${passed + failed} total`);
console.log("─".repeat(56) + "\n");
if (failed > 0)
    process.exit(1);
