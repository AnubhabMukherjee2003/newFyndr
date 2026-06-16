import { useState, useEffect } from "react";
import "./App.css";

interface ModuleEntry {
  module_id: string;
  weight: number;
  target_role: string | null;
  question: string;
  input_type: string;
  options: string[] | null;
  data_type: string;
  match_type: string;
}

interface RoleSchema {
  id: string;
  roleName: string;
  assignedRoles: string[];
  profileTemplate: Record<string, string>;
  requireModules: ModuleEntry[];
  provideModules: ModuleEntry[];
}

interface PropagationHint {
  source_role: string;
  source_role_id: string;
  module_id: string;
  target_role_id: string;
  target_role_name: string;
  already_mirrored: boolean;
  action: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("admin_token"));
  const [activeTab, setActiveTab] = useState<"roles" | "hints">("roles");
  
  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Data states
  const [roles, setRoles] = useState<RoleSchema[]>([]);
  const [hints, setHints] = useState<PropagationHint[]>([]);
  const [loading, setLoading] = useState(false);

  // Editor Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null if creating
  const [roleIdField, setRoleIdField] = useState("");
  const [roleNameField, setRoleNameField] = useState("");
  const [assignedRolesField, setAssignedRolesField] = useState<string[]>([]);
  const [profileTemplateField, setProfileTemplateField] = useState<{ key: string; type: string }[]>([]);
  const [requireModulesField, setRequireModulesField] = useState<ModuleEntry[]>([]);
  const [provideModulesField, setProvideModulesField] = useState<ModuleEntry[]>([]);
  const [editorError, setEditorError] = useState("");

  // Load dashboard data when token changes
  useEffect(() => {
    if (token) {
      loadRoles();
      loadHints();
    }
  }, [token]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      localStorage.setItem("admin_token", data.accessToken);
      setToken(data.accessToken);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
  };

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/roles`, { headers: authHeaders() });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      console.error("Failed to load roles:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadHints = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/roles/hints`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHints(data);
      }
    } catch (err) {
      console.error("Failed to load hints:", err);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setRoleIdField("");
    setRoleNameField("");
    setAssignedRolesField([]);
    setProfileTemplateField([]);
    setRequireModulesField([]);
    setProvideModulesField([]);
    setEditorError("");
    setIsModalOpen(true);
  };

  const openEditModal = (role: RoleSchema) => {
    setEditingId(role.id);
    setRoleIdField(role.id);
    setRoleNameField(role.roleName);
    setAssignedRolesField(role.assignedRoles || []);
    
    // De-serialize profile template
    const pts = Object.entries(role.profileTemplate || {}).map(([key, type]) => ({
      key,
      type: type as string,
    }));
    setProfileTemplateField(pts);
    
    setRequireModulesField(role.requireModules || []);
    setProvideModulesField(role.provideModules || []);
    setEditorError("");
    setIsModalOpen(true);
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm(`Are you sure you want to delete role: ${id}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/roles/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete role schema");
        return;
      }
      loadRoles();
      loadHints();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveRole = async () => {
    setEditorError("");
    if (!roleNameField.trim()) {
      setEditorError("Role Name is required");
      return;
    }
    if (!editingId && !roleIdField.trim()) {
      setEditorError("Role ID is required for new roles");
      return;
    }

    // Serialize profile template
    const profileTemplate: Record<string, string> = {};
    for (const pt of profileTemplateField) {
      if (pt.key.trim()) {
        profileTemplate[pt.key.trim()] = pt.type;
      }
    }

    // Build payload
    const payload = {
      id: editingId ? undefined : roleIdField.trim(),
      roleName: roleNameField.trim(),
      assignedRoles: assignedRolesField,
      profileTemplate,
      requireModules: requireModulesField,
      provideModules: provideModulesField,
    };

    try {
      let url = `${API_BASE}/admin/roles`;
      let method = "POST";
      if (editingId) {
        url = `${API_BASE}/admin/roles/${editingId}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save role schema");
      }

      setIsModalOpen(false);
      loadRoles();
      loadHints();
    } catch (err: any) {
      setEditorError(err.message);
    }
  };

  // Helper additions/removals
  const addProfileField = () => {
    setProfileTemplateField([...profileTemplateField, { key: "", type: "string" }]);
  };

  const removeProfileField = (index: number) => {
    setProfileTemplateField(profileTemplateField.filter((_, i) => i !== index));
  };

  const updateProfileField = (index: number, key: string, val: string) => {
    const next = [...profileTemplateField];
    next[index] = { ...next[index], [key]: val };
    setProfileTemplateField(next);
  };

  const addModule = (type: "require" | "provide") => {
    const newMod: ModuleEntry = {
      module_id: "",
      weight: 0.5,
      target_role: null,
      question: "",
      input_type: "MULTI_CHOICE",
      options: null,
      data_type: "VECTOR",
      match_type: "OVERLAP_MATCH",
    };
    if (type === "require") {
      setRequireModulesField([...requireModulesField, newMod]);
    } else {
      setProvideModulesField([...provideModulesField, newMod]);
    }
  };

  const removeModule = (type: "require" | "provide", index: number) => {
    if (type === "require") {
      setRequireModulesField(requireModulesField.filter((_, i) => i !== index));
    } else {
      setProvideModulesField(provideModulesField.filter((_, i) => i !== index));
    }
  };

  const updateModule = (type: "require" | "provide", index: number, fieldName: keyof ModuleEntry, value: any) => {
    const list = type === "require" ? [...requireModulesField] : [...provideModulesField];
    list[index] = { ...list[index], [fieldName]: value };
    if (type === "require") {
      setRequireModulesField(list);
    } else {
      setProvideModulesField(list);
    }
  };

  const handleAssignedRolesToggle = (roleId: string) => {
    if (assignedRolesField.includes(roleId)) {
      setAssignedRolesField(assignedRolesField.filter(id => id !== roleId));
    } else {
      setAssignedRolesField([...assignedRolesField, roleId]);
    }
  };

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-card glass-panel">
          <h2><span className="neon-text">ADMIN PORTAL</span></h2>
          <p>Login to manage schemas and configuration</p>
          {loginError && <div style={{ color: "#f87171", marginBottom: "1rem", fontSize: "0.9rem" }}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                placeholder="admin@test.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" className="neon-btn login-btn">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="dashboard-header">
        <div>
          <h1>Matchmaking Engine <span className="neon-text">Admin</span></h1>
        </div>
        <div className="header-actions">
          <span className="user-badge">Administrator</span>
          <button onClick={handleLogout} className="secondary-btn" style={{ padding: "8px 16px" }}>Sign Out</button>
        </div>
      </header>

      <nav className="tab-navigation">
        <button 
          onClick={() => setActiveTab("roles")} 
          className={`tab-btn ${activeTab === "roles" ? "active" : ""}`}
        >
          Role Schemas
        </button>
        <button 
          onClick={() => setActiveTab("hints")} 
          className={`tab-btn ${activeTab === "hints" ? "active" : ""}`}
        >
          Propagation Hints
        </button>
      </nav>

      <main className="glass-panel panel-container">
        {activeTab === "roles" ? (
          <div>
            <div className="panel-header">
              <h2>Configured Role Schemas</h2>
              <button onClick={openCreateModal} className="neon-btn" style={{ padding: "10px 20px" }}>
                + Add Role Schema
              </button>
            </div>

            {loading ? (
              <p style={{ textAlign: "center", color: "#94a3b8" }}>Loading schemas...</p>
            ) : roles.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>No role schemas created yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Role Name</th>
                      <th>Assigned Matches</th>
                      <th>Require Modules</th>
                      <th>Provide Modules</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => (
                      <tr key={role.id}>
                        <td style={{ fontWeight: 600, color: "#cbd5e1" }}>{role.id}</td>
                        <td>{role.roleName}</td>
                        <td>
                          {role.assignedRoles.map(arId => {
                            const found = roles.find(r => r.id === arId);
                            return found ? found.roleName : arId;
                          }).join(", ") || <span style={{ color: "#64748b", fontStyle: "italic" }}>None</span>}
                        </td>
                        <td>{role.requireModules?.length || 0} modules</td>
                        <td>{role.provideModules?.length || 0} modules</td>
                        <td className="action-links">
                          <button onClick={() => openEditModal(role)} className="edit-link">Edit</button>
                          <button onClick={() => handleDeleteRole(role.id)} className="delete-link">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="panel-header">
              <h2>Propagation Analyzer Hints</h2>
            </div>
            {hints.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>All required modules are mirrored perfectly in targeted roles.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Source Role</th>
                      <th>Module ID</th>
                      <th>Target Role</th>
                      <th>Status</th>
                      <th>Action Hint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hints.map((hint, idx) => (
                      <tr key={idx}>
                        <td>{hint.source_role}</td>
                        <td style={{ color: "#a855f7", fontWeight: 500 }}>{hint.module_id}</td>
                        <td>{hint.target_role_name}</td>
                        <td>
                          {hint.already_mirrored ? (
                            <span className="hint-badge-mirrored">✓ Mirrored</span>
                          ) : (
                            <span className="hint-badge-missing">⚠ Missing</span>
                          )}
                        </td>
                        <td style={{ fontStyle: hint.already_mirrored ? "normal" : "italic", color: hint.already_mirrored ? "#94a3b8" : "#fde047" }}>
                          {hint.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Editor Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h2 className="modal-title neon-text">
              {editingId ? `Edit Role: ${roleNameField}` : "Create New Role Schema"}
            </h2>

            {editorError && <div style={{ color: "#f87171", marginBottom: "1.5rem" }}>{editorError}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className="form-group">
                <label>Unique ID</label>
                <input 
                  type="text" 
                  value={roleIdField} 
                  onChange={(e) => setRoleIdField(e.target.value)} 
                  disabled={!!editingId}
                  placeholder="e.g. founder-role-id"
                />
              </div>
              <div className="form-group">
                <label>Display Name</label>
                <input 
                  type="text" 
                  value={roleNameField} 
                  onChange={(e) => setRoleNameField(e.target.value)} 
                  placeholder="e.g. Founder"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Assigned Roles (Matches with)</label>
              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", background: "rgba(15, 23, 42, 0.4)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                {roles.filter(r => r.id !== roleIdField).map(r => (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.95rem" }}>
                    <input 
                      type="checkbox" 
                      checked={assignedRolesField.includes(r.id)} 
                      onChange={() => handleAssignedRolesToggle(r.id)}
                    />
                    {r.roleName} ({r.id})
                  </label>
                ))}
                {roles.filter(r => r.id !== roleIdField).length === 0 && (
                  <span style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.9rem" }}>Create another role first to match against.</span>
                )}
              </div>
            </div>

            {/* Profile Template fields */}
            <div className="form-group">
              <label>Profile Card Template (Static fields)</label>
              {profileTemplateField.map((pt, idx) => (
                <div key={idx} className="kv-row">
                  <input 
                    type="text" 
                    placeholder="Field name (e.g. college)" 
                    value={pt.key}
                    onChange={(e) => updateProfileField(idx, "key", e.target.value)}
                  />
                  <select 
                    value={pt.type} 
                    onChange={(e) => updateProfileField(idx, "type", e.target.value)}
                  >
                    <option value="string">String (Text)</option>
                    <option value="number">Number</option>
                    <option value="url">URL Link</option>
                  </select>
                  <button onClick={() => removeProfileField(idx)} className="remove-btn">Remove</button>
                </div>
              ))}
              <button onClick={addProfileField} className="secondary-btn" style={{ width: "fit-content", padding: "6px 12px", fontSize: "0.85rem" }}>
                + Add Profile Field
              </button>
            </div>

            {/* Required Modules */}
            <div className="form-group" style={{ marginTop: "1.5rem" }}>
              <label style={{ fontSize: "0.95rem", color: "#e2e8f0" }}>Require Modules (Questions users answer to filter feed)</label>
              {requireModulesField.map((mod, idx) => (
                <div key={idx} className="module-entry-card">
                  <div className="module-entry-header">
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Require Module #{idx+1}</span>
                    <button onClick={() => removeModule("require", idx)} className="remove-btn">Remove</button>
                  </div>
                  <div className="module-entry-grid">
                    <div className="form-group">
                      <label>Module ID</label>
                      <input 
                        type="text" 
                        value={mod.module_id} 
                        onChange={(e) => updateModule("require", idx, "module_id", e.target.value)}
                        placeholder="skills-module-id"
                      />
                    </div>
                    <div className="form-group">
                      <label>Weight (0.0 - 1.0)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={mod.weight} 
                        onChange={(e) => updateModule("require", idx, "weight", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Target Role (Subset of Matches)</label>
                      <select 
                        value={mod.target_role || ""} 
                        onChange={(e) => updateModule("require", idx, "target_role", e.target.value || null)}
                      >
                        <option value="">None (Generic A-&gt;B Match)</option>
                        {assignedRolesField.map(arId => (
                          <option key={arId} value={arId}>{roles.find(r => r.id === arId)?.roleName || arId}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>DataType</label>
                      <select 
                        value={mod.data_type} 
                        onChange={(e) => updateModule("require", idx, "data_type", e.target.value)}
                      >
                        <option value="VECTOR">VECTOR (Tags / Choices)</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                        <option value="NUMERIC">NUMERIC</option>
                        <option value="RANGE">RANGE (min-max)</option>
                        <option value="TEXT">TEXT (Exact Case-Insensitive)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>MatchType</label>
                      <select 
                        value={mod.match_type} 
                        onChange={(e) => updateModule("require", idx, "match_type", e.target.value)}
                      >
                        <option value="OVERLAP_MATCH">OVERLAP_MATCH</option>
                        <option value="EXACT_MATCH">EXACT_MATCH</option>
                        <option value="BOOLEAN_MATCH">BOOLEAN_MATCH</option>
                        <option value="NUMERIC_MATCH">NUMERIC_MATCH</option>
                        <option value="RANGE_MATCH">RANGE_MATCH</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Input Type</label>
                      <select 
                        value={mod.input_type} 
                        onChange={(e) => updateModule("require", idx, "input_type", e.target.value)}
                      >
                        <option value="MULTI_CHOICE">MULTI_CHOICE (Checkbox)</option>
                        <option value="SINGLE_CHOICE">SINGLE_CHOICE (Radio)</option>
                        <option value="TEXT_INPUT">TEXT_INPUT</option>
                        <option value="NUMBER_INPUT">NUMBER_INPUT</option>
                        <option value="RANGE_INPUT">RANGE_INPUT (Slider)</option>
                        <option value="BOOLEAN_TOGGLE">BOOLEAN_TOGGLE</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: "10px", marginBottom: 0 }}>
                    <label>Question Text</label>
                    <input 
                      type="text" 
                      value={mod.question} 
                      onChange={(e) => updateModule("require", idx, "question", e.target.value)}
                      placeholder="e.g. What programming languages do you want to learn?"
                    />
                  </div>
                  {(mod.input_type === "MULTI_CHOICE" || mod.input_type === "SINGLE_CHOICE") && (
                    <div className="form-group" style={{ marginTop: "10px", marginBottom: 0 }}>
                      <label>Options (Comma-separated)</label>
                      <input 
                        type="text" 
                        value={mod.options?.join(", ") || ""} 
                        onChange={(e) => updateModule("require", idx, "options", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        placeholder="e.g. React, Node, Python"
                      />
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => addModule("require")} className="secondary-btn add-entry-btn">
                + Add Require Module
              </button>
            </div>

            {/* Provided Modules */}
            <div className="form-group" style={{ marginTop: "1.5rem" }}>
              <label style={{ fontSize: "0.95rem", color: "#e2e8f0" }}>Provide Modules (Attributes users offer to match targets)</label>
              {provideModulesField.map((mod, idx) => (
                <div key={idx} className="module-entry-card">
                  <div className="module-entry-header">
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Provide Module #{idx+1}</span>
                    <button onClick={() => removeModule("provide", idx)} className="remove-btn">Remove</button>
                  </div>
                  <div className="module-entry-grid">
                    <div className="form-group">
                      <label>Module ID</label>
                      <input 
                        type="text" 
                        value={mod.module_id} 
                        onChange={(e) => updateModule("provide", idx, "module_id", e.target.value)}
                        placeholder="skills-module-id"
                      />
                    </div>
                    <div className="form-group">
                      <label>Weight (0.0 - 1.0)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={mod.weight} 
                        onChange={(e) => updateModule("provide", idx, "weight", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Target Role (Always null for provides)</label>
                      <input type="text" value="None (Generic)" disabled />
                    </div>
                    <div className="form-group">
                      <label>DataType</label>
                      <select 
                        value={mod.data_type} 
                        onChange={(e) => updateModule("provide", idx, "data_type", e.target.value)}
                      >
                        <option value="VECTOR">VECTOR (Tags / Choices)</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                        <option value="NUMERIC">NUMERIC</option>
                        <option value="RANGE">RANGE (min-max)</option>
                        <option value="TEXT">TEXT (Exact Case-Insensitive)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>MatchType</label>
                      <select 
                        value={mod.match_type} 
                        onChange={(e) => updateModule("provide", idx, "match_type", e.target.value)}
                      >
                        <option value="OVERLAP_MATCH">OVERLAP_MATCH</option>
                        <option value="EXACT_MATCH">EXACT_MATCH</option>
                        <option value="BOOLEAN_MATCH">BOOLEAN_MATCH</option>
                        <option value="NUMERIC_MATCH">NUMERIC_MATCH</option>
                        <option value="RANGE_MATCH">RANGE_MATCH</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Input Type</label>
                      <select 
                        value={mod.input_type} 
                        onChange={(e) => updateModule("provide", idx, "input_type", e.target.value)}
                      >
                        <option value="MULTI_CHOICE">MULTI_CHOICE (Checkbox)</option>
                        <option value="SINGLE_CHOICE">SINGLE_CHOICE (Radio)</option>
                        <option value="TEXT_INPUT">TEXT_INPUT</option>
                        <option value="NUMBER_INPUT">NUMBER_INPUT</option>
                        <option value="RANGE_INPUT">RANGE_INPUT (Slider)</option>
                        <option value="BOOLEAN_TOGGLE">BOOLEAN_TOGGLE</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: "10px", marginBottom: 0 }}>
                    <label>Question Text</label>
                    <input 
                      type="text" 
                      value={mod.question} 
                      onChange={(e) => updateModule("provide", idx, "question", e.target.value)}
                      placeholder="e.g. What programming languages do you know?"
                    />
                  </div>
                  {(mod.input_type === "MULTI_CHOICE" || mod.input_type === "SINGLE_CHOICE") && (
                    <div className="form-group" style={{ marginTop: "10px", marginBottom: 0 }}>
                      <label>Options (Comma-separated)</label>
                      <input 
                        type="text" 
                        value={mod.options?.join(", ") || ""} 
                        onChange={(e) => updateModule("provide", idx, "options", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        placeholder="e.g. React, Node, Python"
                      />
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => addModule("provide")} className="secondary-btn add-entry-btn">
                + Add Provide Module
              </button>
            </div>

            <div className="modal-buttons">
              <button onClick={() => setIsModalOpen(false)} className="secondary-btn">Cancel</button>
              <button onClick={handleSaveRole} className="neon-btn">Save Role Schema</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
