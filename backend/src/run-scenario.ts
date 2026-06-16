import app from "./app";
import { prisma } from "./lib/prisma";

const BASE_URL = "http://localhost:4000/api";

// Roles definition
const ROLES = [
  {
    id: "founder-role-id",
    roleName: "Founder",
    assignedRoles: ["employee-role-id", "investor-role-id"],
    profileTemplate: {},
    requireModules: [
      {
        module_id: "skills-module-id",
        weight: 0.5,
        target_role: "employee-role-id",
        question: "Required skills",
        input_type: "MULTI_CHOICE",
        data_type: "VECTOR",
        match_type: "OVERLAP_MATCH",
        options: ["React", "Node", "Python"],
      },
      {
        module_id: "funding-module-id",
        weight: 0.5,
        target_role: "investor-role-id",
        question: "Seeking funding range",
        input_type: "RANGE_INPUT",
        data_type: "RANGE",
        match_type: "RANGE_MATCH",
      },
    ],
    provideModules: [
      {
        module_id: "industry-module-id",
        weight: 1.0,
        target_role: null,
        question: "Industry",
        input_type: "SINGLE_CHOICE",
        data_type: "TEXT",
        match_type: "EXACT_MATCH",
        options: ["FinTech", "HealthTech"],
      },
    ],
  },
  {
    id: "employee-role-id",
    roleName: "Employee",
    assignedRoles: ["founder-role-id"],
    profileTemplate: {},
    requireModules: [
      {
        module_id: "industry-module-id",
        weight: 1.0,
        target_role: "founder-role-id",
        question: "Preferred industry",
        input_type: "SINGLE_CHOICE",
        data_type: "TEXT",
        match_type: "EXACT_MATCH",
        options: ["FinTech", "HealthTech"],
      },
    ],
    provideModules: [
      {
        module_id: "skills-module-id",
        weight: 1.0,
        target_role: null,
        question: "Skills",
        input_type: "MULTI_CHOICE",
        data_type: "VECTOR",
        match_type: "OVERLAP_MATCH",
        options: ["React", "Node", "Python"],
      },
    ],
  },
  {
    id: "investor-role-id",
    roleName: "Investor",
    assignedRoles: ["founder-role-id"],
    profileTemplate: {},
    requireModules: [
      {
        module_id: "industry-module-id",
        weight: 1.0,
        target_role: "founder-role-id",
        question: "Preferred industries",
        input_type: "SINGLE_CHOICE",
        data_type: "TEXT",
        match_type: "EXACT_MATCH",
        options: ["FinTech", "HealthTech"],
      },
    ],
    provideModules: [
      {
        module_id: "funding-module-id",
        weight: 1.0,
        target_role: null,
        question: "Offered funding range",
        input_type: "RANGE_INPUT",
        data_type: "RANGE",
        match_type: "RANGE_MATCH",
      },
    ],
  },
  {
    id: "student-role-id",
    roleName: "Student",
    assignedRoles: ["teacher-role-id"],
    profileTemplate: {},
    requireModules: [
      {
        module_id: "subject-module-id",
        weight: 1.0,
        target_role: null, // Generic module
        question: "Subjects to learn",
        input_type: "MULTI_CHOICE",
        data_type: "VECTOR",
        match_type: "OVERLAP_MATCH",
        options: ["Math", "History"],
      },
    ],
    provideModules: [
      {
        module_id: "subject-module-id",
        weight: 1.0,
        target_role: null,
        question: "Subjects learned",
        input_type: "MULTI_CHOICE",
        data_type: "VECTOR",
        match_type: "OVERLAP_MATCH",
        options: ["Math", "History"],
      },
    ],
  },
  {
    id: "teacher-role-id",
    roleName: "Teacher",
    assignedRoles: ["student-role-id"],
    profileTemplate: {},
    requireModules: [
      {
        module_id: "subject-module-id",
        weight: 1.0,
        target_role: null, // Generic module
        question: "Subjects to teach",
        input_type: "MULTI_CHOICE",
        data_type: "VECTOR",
        match_type: "OVERLAP_MATCH",
        options: ["Math", "History"],
      },
    ],
    provideModules: [
      {
        module_id: "subject-module-id",
        weight: 1.0,
        target_role: null,
        question: "Subjects taught",
        input_type: "MULTI_CHOICE",
        data_type: "VECTOR",
        match_type: "OVERLAP_MATCH",
        options: ["Math", "History"],
      },
    ],
  },
];

// 10 Users definition
const USERS = [
  {
    name: "Founder High",
    email: "founder_high@test.com",
    roleId: "founder-role-id",
    answers: [
      { module_id: "skills-module-id", data: ["React", "Node"] },
      { module_id: "funding-module-id", data: { min: 100000, max: 500000 } },
      { module_id: "industry-module-id", data: ["FinTech"] },
    ],
  },
  {
    name: "Founder Low",
    email: "founder_low@test.com",
    roleId: "founder-role-id",
    answers: [
      { module_id: "skills-module-id", data: ["React", "Node"] },
      { module_id: "funding-module-id", data: { min: 100000, max: 500000 } },
      { module_id: "industry-module-id", data: ["HealthTech"] },
    ],
  },
  {
    name: "Employee High",
    email: "employee_high@test.com",
    roleId: "employee-role-id",
    answers: [
      { module_id: "industry-module-id", data: ["FinTech"] },
      { module_id: "skills-module-id", data: ["React", "Node"] },
    ],
  },
  {
    name: "Employee Low",
    email: "employee_low@test.com",
    roleId: "employee-role-id",
    answers: [
      { module_id: "industry-module-id", data: ["HealthTech"] },
      { module_id: "skills-module-id", data: ["Python"] },
    ],
  },
  {
    name: "Investor High",
    email: "investor_high@test.com",
    roleId: "investor-role-id",
    answers: [
      { module_id: "industry-module-id", data: ["FinTech"] },
      { module_id: "funding-module-id", data: { min: 200000, max: 400000 } },
    ],
  },
  {
    name: "Investor Low",
    email: "investor_low@test.com",
    roleId: "investor-role-id",
    answers: [
      { module_id: "industry-module-id", data: ["HealthTech"] },
      { module_id: "funding-module-id", data: { min: 10000, max: 50000 } },
    ],
  },
  {
    name: "Student High",
    email: "student_high@test.com",
    roleId: "student-role-id",
    answers: [
      { module_id: "subject-module-id", data: ["Math"] },
    ],
  },
  {
    name: "Student Low",
    email: "student_low@test.com",
    roleId: "student-role-id",
    answers: [
      { module_id: "subject-module-id", data: ["History"] },
    ],
  },
  {
    name: "Teacher High",
    email: "teacher_high@test.com",
    roleId: "teacher-role-id",
    answers: [
      { module_id: "subject-module-id", data: ["Math"] },
    ],
  },
  {
    name: "Teacher Low",
    email: "teacher_low@test.com",
    roleId: "teacher-role-id",
    answers: [
      { module_id: "subject-module-id", data: ["History"] },
    ],
  },
];

async function postJSON(url: string, body: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`POST ${url} failed with ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function getJSON(url: string, token: string) {
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GET ${url} failed with ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function executeScenario() {
  console.log("=== Running Scenario Integration Script ===");

  // 1. Clean DB tables (excluding the Admin user we seeded)
  console.log("Clearing old records...");
  await prisma.interaction.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { not: "admin@test.com" } } });
  await prisma.roleSchema.deleteMany({});

  // 2. Admin Login
  console.log("Logging in as Admin...");
  const adminLogin = await postJSON(`${BASE_URL}/auth/login`, {
    email: "admin@test.com",
    password: "adminpassword",
  });
  const adminToken = adminLogin.accessToken;
  console.log("Admin logged in successfully.");

  // 3. Create Roles
  console.log("Creating 5 roles schemas...");
  for (const roleDef of ROLES) {
    const createdRole = await postJSON(`${BASE_URL}/admin/roles`, roleDef, adminToken);
    console.log(`Created Role: ${createdRole.roleName} (ID: ${createdRole.id})`);
  }

  // 4. Register Users and Fill Modules
  console.log("Registering 10 users and filling modules...");
  const userTokens: Record<string, string> = {};

  for (const userDef of USERS) {
    // Register
    const regRes = await postJSON(`${BASE_URL}/auth/register`, {
      name: userDef.name,
      email: userDef.email,
      password: "password123",
    });
    const token = regRes.accessToken;
    userTokens[userDef.email] = token;

    // Assign Role
    await postJSON(`${BASE_URL}/users/me/role`, { roleSchemaId: userDef.roleId }, token);

    // Fill Modules
    await postJSON(`${BASE_URL}/users/me/modules`, { answers: userDef.answers }, token);

    console.log(`Registered and set up user: ${userDef.name} (${userDef.email})`);
  }

  // 5. Check Feeds
  console.log("\n=== Checking feeds for the roles ===");
  const usersToCheck = [
    { email: "founder_high@test.com", name: "Founder High" },
    { email: "employee_high@test.com", name: "Employee High" },
    { email: "student_high@test.com", name: "Student High" },
  ];

  for (const user of usersToCheck) {
    const token = userTokens[user.email];
    const feed = await getJSON(`${BASE_URL}/feed`, token);

    console.log(`\nFeed for ${user.name} (${user.email}):`);
    if (feed.length === 0) {
      console.log("  (Empty feed)");
    } else {
      console.log("  " + "Name".padEnd(20) + "Role".padEnd(15) + "Score".padEnd(10) + "Tier");
      console.log("  " + "-".repeat(55));
      for (const item of feed) {
        const candidateName = item.user.name;
        const candidateRole = item.user.roleSchema?.roleName || "Unknown";
        const score = item.score.toString();
        const tier = item.match_tier;
        console.log(`  ${candidateName.padEnd(20)}${candidateRole.padEnd(15)}${score.padEnd(10)}${tier}`);
      }
    }
  }

  console.log("\n=== Scenario execution completed successfully ===");
}

const server = app.listen(4000, async () => {
  try {
    await executeScenario();
  } catch (error) {
    console.error("Scenario execution failed:", error);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});
