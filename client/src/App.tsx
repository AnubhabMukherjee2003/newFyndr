import { useState, useEffect } from "react";
import "./App.css";

interface ModuleAnswer {
  module_id: string;
  data: any;
}

interface User {
  id: string;
  name: string;
  email: string;
  roleSchemaId: string | null;
  profileData: Record<string, any>;
  moduleData: ModuleAnswer[];
  roleSchema?: {
    id: string;
    roleName: string;
    profileTemplate: Record<string, string>;
    requireModules: any[];
    provideModules: any[];
  } | null;
}

interface FeedItem {
  user: User;
  score: number;
  match_tier: "scored" | "base";
}

interface Match {
  id: string;
  receiver: {
    id: string;
    name: string;
    email: string;
    profileData: Record<string, any>;
  };
}

interface RoleSchema {
  id: string;
  roleName: string;
  profileTemplate: Record<string, string>;
  requireModules: any[];
  provideModules: any[];
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("user_token"));
  const [activeTab, setActiveTab] = useState<"feed" | "profile">("feed");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Auth fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Data states
  const [me, setMe] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleSchema[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  
  // Profile setups
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [profileForm, setProfileForm] = useState<Record<string, any>>({});
  const [answersForm, setAnswersForm] = useState<Record<string, any>>({});
  const [profileMsg, setProfileMsg] = useState("");

  // Match overlay
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [matchedUserName, setMatchedUserName] = useState("");

  useEffect(() => {
    if (token) {
      loadProfile();
      loadRoles();
      loadMatches();
    }
  }, [token]);

  useEffect(() => {
    if (me?.roleSchemaId) {
      loadFeed();
    }
  }, [me]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = authMode === "login" ? "login" : "register";
    const payload = authMode === "login" ? { email, password } : { name, email, password };

    try {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }
      localStorage.setItem("user_token", data.accessToken);
      setToken(data.accessToken);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user_token");
    setToken(null);
    setMe(null);
    setFeed([]);
    setMatches([]);
  };

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, { headers: authHeaders() });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMe(data);
        setSelectedRoleId(data.roleSchemaId || "");
        setProfileForm(data.profileData || {});
        
        // Populate answers form state
        const answersMap: Record<string, any> = {};
        for (const ans of data.moduleData || []) {
          answersMap[ans.module_id] = ans.data;
        }
        setAnswersForm(answersMap);
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  const loadRoles = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/roles`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch (err) {
      console.error("Failed to load roles:", err);
    }
  };

  const loadFeed = async () => {
    try {
      const res = await fetch(`${API_BASE}/feed`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFeed(data);
        setFeedIndex(0);
      }
    } catch (err) {
      console.error("Failed to load feed:", err);
    }
  };

  const loadMatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/interactions/matches`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
      }
    } catch (err) {
      console.error("Failed to load matches:", err);
    }
  };

  const handleRoleSelection = async (roleId: string) => {
    setSelectedRoleId(roleId);
    setProfileMsg("");
    try {
      const res = await fetch(`${API_BASE}/users/me/role`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ roleSchemaId: roleId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMe(updated);
        setProfileForm({});
        setAnswersForm({});
        setProfileMsg("Role assigned successfully! Now fill in your profile and module answers below.");
      }
    } catch (err: any) {
      setProfileMsg("Error setting role: " + err.message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg("");
    try {
      // 1. Save Static Profile Template data
      const profRes = await fetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ profileData: profileForm }),
      });

      if (!profRes.ok) {
        throw new Error("Failed to save profile details");
      }

      // 2. Format and Save Modules answers batch
      const answers = Object.entries(answersForm).map(([module_id, data]) => ({
        module_id,
        data,
      })).filter(a => a.data !== undefined && a.data !== "");

      if (answers.length > 0) {
        const modRes = await fetch(`${API_BASE}/users/me/modules`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ answers }),
        });
        if (!modRes.ok) {
          const err = await modRes.json();
          throw new Error(err.error || "Failed to save module answers");
        }
      }

      setProfileMsg("Profile details saved successfully!");
      loadProfile();
    } catch (err: any) {
      setProfileMsg("Error saving: " + err.message);
    }
  };

  const handleSwipe = async (targetId: string, action: "like" | "pass") => {
    try {
      const res = await fetch(`${API_BASE}/interactions/${action}/${targetId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        if (action === "like" && data.matched) {
          const matchedUser = feed[feedIndex].user;
          setMatchedUserName(matchedUser.name);
          setShowMatchOverlay(true);
          loadMatches();
        }
        setFeedIndex(prev => prev + 1);
      }
    } catch (err) {
      console.error("Failed to submit interaction:", err);
    }
  };

  const currentCandidate = feed[feedIndex];

  // Helper dynamic input render
  const renderModuleInput = (mod: any) => {
    const value = answersForm[mod.module_id];

    switch (mod.input_type) {
      case "MULTI_CHOICE": {
        const currentVals: string[] = Array.isArray(value) ? value : [];
        const handleCheckboxChange = (opt: string, checked: boolean) => {
          let next;
          if (checked) {
            next = [...currentVals, opt];
          } else {
            next = currentVals.filter(v => v !== opt);
          }
          setAnswersForm({ ...answersForm, [mod.module_id]: next });
        };
        return (
          <div className="tag-list">
            {(mod.options || []).map((opt: string) => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.9rem" }}>
                <input 
                  type="checkbox"
                  checked={currentVals.includes(opt)}
                  onChange={(e) => handleCheckboxChange(opt, e.target.checked)}
                />
                {opt}
              </label>
            ))}
          </div>
        );
      }

      case "SINGLE_CHOICE":
        return (
          <select 
            value={Array.isArray(value) ? value[0] || "" : value || ""} 
            onChange={(e) => setAnswersForm({ ...answersForm, [mod.module_id]: [e.target.value] })}
            style={{ width: "100%" }}
          >
            <option value="">Select option...</option>
            {(mod.options || []).map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case "TEXT_INPUT":
        return (
          <input 
            type="text" 
            value={value || ""} 
            onChange={(e) => setAnswersForm({ ...answersForm, [mod.module_id]: e.target.value })}
            placeholder="Type your answer..."
            style={{ width: "100%" }}
          />
        );

      case "NUMBER_INPUT":
        return (
          <input 
            type="number" 
            value={value ?? ""} 
            onChange={(e) => setAnswersForm({ ...answersForm, [mod.module_id]: parseFloat(e.target.value) || 0 })}
            placeholder="Type a number..."
            style={{ width: "100%" }}
          />
        );

      case "RANGE_INPUT": {
        const minVal = value?.min ?? 0;
        const maxVal = value?.max ?? 0;
        return (
          <div style={{ display: "flex", gap: "10px" }}>
            <input 
              type="number" 
              placeholder="Min value" 
              value={minVal || ""}
              onChange={(e) => setAnswersForm({ ...answersForm, [mod.module_id]: { min: parseFloat(e.target.value) || 0, max: maxVal } })}
              style={{ flex: 1 }}
            />
            <input 
              type="number" 
              placeholder="Max value" 
              value={maxVal || ""}
              onChange={(e) => setAnswersForm({ ...answersForm, [mod.module_id]: { min: minVal, max: parseFloat(e.target.value) || 0 } })}
              style={{ flex: 1 }}
            />
          </div>
        );
      }

      case "BOOLEAN_TOGGLE":
        return (
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={!!value} 
              onChange={(e) => setAnswersForm({ ...answersForm, [mod.module_id]: e.target.checked })}
            />
            Yes / Enable
          </label>
        );

      default:
        return null;
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card glass-panel">
          <div className="auth-tabs">
            <button 
              onClick={() => setAuthMode("login")} 
              className={`auth-tab ${authMode === "login" ? "active" : ""}`}
            >
              Login
            </button>
            <button 
              onClick={() => setAuthMode("signup")} 
              className={`auth-tab ${authMode === "signup" ? "active" : ""}`}
            >
              Sign Up
            </button>
          </div>

          <h2>Welcome to <span className="neon-gradient-text">newfyndr</span></h2>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            Discover dynamic role connections and matchmaker algorithms
          </p>

          {authError && <div style={{ color: "#f87171", marginBottom: "1rem", fontSize: "0.9rem" }}>{authError}</div>}

          <form onSubmit={handleAuth}>
            {authMode === "signup" && (
              <div className="form-field">
                <label>Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Alice Cooper" 
                  required 
                />
              </div>
            )}
            <div className="form-field">
              <label>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="e.g. alice@test.com" 
                required 
              />
            </div>
            <div className="form-field">
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
              />
            </div>
            <button type="submit" className="neon-action-btn" style={{ width: "100%", padding: "12px", fontSize: "1rem", marginTop: "1rem" }}>
              {authMode === "login" ? "Login" : "Register"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h1>new<span className="neon-gradient-text">fyndr</span></h1>
        <nav className="nav-actions">
          <button 
            onClick={() => setActiveTab("feed")} 
            className={`tab-btn ${activeTab === "feed" ? "active" : ""}`}
          >
            Matchmaker Deck
          </button>
          <button 
            onClick={() => setActiveTab("profile")} 
            className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
          >
            My Profile
          </button>
          <button onClick={handleLogout} className="secondary-btn" style={{ padding: "6px 14px", fontSize: "0.9rem" }}>
            Sign Out
          </button>
        </nav>
      </header>

      {activeTab === "feed" ? (
        <div className="tinder-layout">
          {/* Tinder Deck */}
          <div className="card-deck">
            {!me?.roleSchemaId ? (
              <div className="glass-panel" style={{ padding: "2rem", textAlign: "center" }}>
                <h3>Configure Your Profile</h3>
                <p style={{ color: "#94a3b8" }}>You need to set your Role in the Profile tab before you can see candidates.</p>
                <button onClick={() => setActiveTab("profile")} className="neon-action-btn" style={{ padding: "10px 20px" }}>
                  Go to Profile Setup
                </button>
              </div>
            ) : !currentCandidate ? (
              <div className="glass-panel" style={{ padding: "2rem", textAlign: "center" }}>
                <h3>No Candidates Left</h3>
                <p style={{ color: "#94a3b8" }}>You have viewed all candidates matching your role schema. Check back later!</p>
                <button onClick={loadFeed} className="secondary-btn" style={{ padding: "8px 16px" }}>
                  Refresh Feed
                </button>
              </div>
            ) : (
              <div>
                <div className="tinder-card glass-panel">
                  <div className="score-badge">
                    {Math.round(currentCandidate.score * 100)}% Match
                  </div>

                  <div className="card-avatar-section">
                    <div className="avatar-circle">
                      {currentCandidate.user.name.charAt(0)}
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.4rem" }}>{currentCandidate.user.name}</h2>
                      <span className={`match-tier-badge tier-${currentCandidate.match_tier}`}>
                        {currentCandidate.match_tier} tier
                      </span>
                    </div>
                  </div>

                  <div className="card-details-scroll">
                    {/* Render static profile fields */}
                    {Object.entries(currentCandidate.user.profileData || {}).length > 0 && (
                      <div className="detail-section">
                        <label>About Profile</label>
                        <div className="detail-grid">
                          {Object.entries(currentCandidate.user.profileData).map(([k, v]) => (
                            <div key={k} style={{ fontSize: "0.9rem" }}>
                              <span style={{ color: "#94a3b8", fontWeight: 500 }}>{k}:</span> {v}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Render module answers */}
                    {(currentCandidate.user.moduleData || []).map((ans) => (
                      <div key={ans.module_id} className="detail-section">
                        <label>Answers: {ans.module_id}</label>
                        {Array.isArray(ans.data) ? (
                          <div className="tag-list">
                            {ans.data.map((tag) => (
                              <span key={tag} className="tag-pill match-hit">{tag}</span>
                            ))}
                          </div>
                        ) : typeof ans.data === "object" && ans.data !== null ? (
                          <span className="tag-pill match-hit">Range: {ans.data.min} - {ans.data.max}</span>
                        ) : (
                          <span className="tag-pill match-hit">{String(ans.data)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="deck-actions">
                  <button 
                    onClick={() => handleSwipe(currentCandidate.user.id, "pass")} 
                    className="swipe-button pass-btn"
                  >
                    ✕
                  </button>
                  <button 
                    onClick={() => handleSwipe(currentCandidate.user.id, "like")} 
                    className="swipe-button like-btn"
                  >
                    ♥
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Matches */}
          <div className="glass-panel sidebar-matches">
            <h3>Mutual Matches</h3>
            {matches.length === 0 ? (
              <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.95rem" }}>
                No mutual matches yet. Keep liking candidates!
              </p>
            ) : (
              matches.map((m) => (
                <div key={m.id} className="match-item">
                  <div className="avatar-circle" style={{ width: "40px", height: "40px", fontSize: "1rem" }}>
                    {m.receiver.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{m.receiver.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{m.receiver.email}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel setup-container">
          <h2 className="setup-title neon-gradient-text">Profile Setup</h2>

          {profileMsg && (
            <div style={{ 
              padding: "10px", 
              background: "rgba(59, 130, 246, 0.15)", 
              border: "1px solid rgba(59, 130, 246, 0.3)", 
              borderRadius: "8px", 
              marginBottom: "1.5rem",
              color: "#60a5fa",
              fontSize: "0.9rem" 
            }}>
              {profileMsg}
            </div>
          )}

          {/* Role schema selection */}
          <div className="form-field">
            <label>My Assigned Role</label>
            <select 
              value={selectedRoleId} 
              onChange={(e) => handleRoleSelection(e.target.value)}
            >
              <option value="">Choose a Role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.roleName}</option>
              ))}
            </select>
          </div>

          {me?.roleSchema && (
            <form onSubmit={handleSaveProfile} style={{ marginTop: "2rem" }}>
              {/* Render dynamic profile fields based on the selected role's profileTemplate */}
              {Object.entries(me.roleSchema.profileTemplate || {}).length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                  <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>Profile Card Fields</h3>
                  {Object.entries(me.roleSchema.profileTemplate).map(([fieldName, fieldType]) => (
                    <div key={fieldName} className="form-field">
                      <label>{fieldName} ({fieldType})</label>
                      <input 
                        type={fieldType === "number" ? "number" : "text"} 
                        value={profileForm[fieldName] || ""}
                        onChange={(e) => setProfileForm({ ...profileForm, [fieldName]: fieldType === "number" ? parseFloat(e.target.value) || 0 : e.target.value })}
                        placeholder={`Enter your ${fieldName}...`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Render dynamic require/provide module questions */}
              {([...(me.roleSchema.requireModules || []), ...(me.roleSchema.provideModules || [])]).length > 0 && (
                <div>
                  <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>Matchmaker Answers</h3>
                  {me.roleSchema.requireModules.map((mod) => (
                    <div key={mod.module_id} className="question-card">
                      <div className="question-text">{mod.question} (Required module: {mod.module_id})</div>
                      {renderModuleInput(mod)}
                    </div>
                  ))}
                  {me.roleSchema.provideModules.map((mod) => (
                    <div key={mod.module_id} className="question-card">
                      <div className="question-text">{mod.question} (Provided module: {mod.module_id})</div>
                      {renderModuleInput(mod)}
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" className="neon-action-btn" style={{ width: "100%", padding: "12px", marginTop: "1rem" }}>
                Save Profile & Answers
              </button>
            </form>
          )}
        </div>
      )}

      {/* Match Alert Overlay */}
      {showMatchOverlay && (
        <div className="match-alert-overlay">
          <div className="match-alert-box glass-panel">
            <h2>It's a <span className="neon-gradient-text">Match!</span></h2>
            <p>You and {matchedUserName} have liked each other.</p>

            <div className="match-avatars">
              <div className="match-avatar-circle">{me?.name.charAt(0)}</div>
              <div className="match-avatar-circle neon-pink">{matchedUserName.charAt(0)}</div>
            </div>

            <button onClick={() => setShowMatchOverlay(false)} className="neon-action-btn" style={{ padding: "10px 20px" }}>
              Keep Swiping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
