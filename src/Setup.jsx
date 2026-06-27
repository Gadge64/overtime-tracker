// ============================================================
// Setup.jsx — Team management tab
//
// What co-ordinators (admins) see:
//   - Full team roster with edit / suspend / remove controls
//   - Add new team member — auto-generates a 4-digit PIN and shows it once
//   - Suspend / unsuspend members from OT consideration
//   - Co-ordinator account management (add / rename / remove)
//   - Score reset (danger zone)
//   - Change my password
//
// What team members see:
//   - Read-only team roster (names + scores only)
//
// Props:
//   team                 — array of team members (includes pin, active fields)
//   admins               — array of co-ordinator accounts
//   currentUser          — { id, name, role } of the logged-in user
//   onAdd                — async fn(name, pin) → true/false
//   onRename             — fn(id, name)
//   onRemove             — fn(id)
//   onToggleMemberActive — fn(id, active) suspend/unsuspend from OT roster
//   onResetScores        — fn()
//   onAddAdmin           — fn(name)
//   onRenameAdmin        — fn(id, name)
//   onRemoveAdmin        — fn(id)
//   onChangeAdminPassword — fn(id, hash) → true/false
// ============================================================

import { useState } from "react";

// Hashes a plain-text password with SHA-256 using the browser's Web Crypto API.
// Must match the same function used in App.jsx (AuthScreen) for logins to work.
async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generates a random 4-digit PIN, zero-padded (e.g. "0471").
// Called whenever a new team member is added so the co-ordinator can pass it to them.
function generatePin() {
  return Math.floor(Math.random() * 10000).toString().padStart(4, "0");
}

export default function Setup({
  team, admins, currentUser,
  onAdd, onRename, onRemove, onToggleMemberActive, onResetScores,
  onAddAdmin, onRenameAdmin, onRemoveAdmin, onChangeAdminPassword,
}) {
  const [editMemberId,   setEditMemberId]   = useState(null);
  const [editMemberVal,  setEditMemberVal]  = useState("");
  const [newMemberName,  setNewMemberName]  = useState("");
  const [removeConfirm,  setRemoveConfirm]  = useState(null); // id of member pending removal
  const [addingMember,   setAddingMember]   = useState(false); // prevents double-submit on Add

  // After a new member is added, store { name, pin } here so the PIN can be shown once
  const [newMemberPin,   setNewMemberPin]   = useState(null);

  const [editAdminId,    setEditAdminId]    = useState(null);
  const [editAdminVal,   setEditAdminVal]   = useState("");
  const [newAdminName,   setNewAdminName]   = useState("");
  const [removeAdminConfirm, setRemoveAdminConfirm] = useState(null);

  const [resetConfirm,   setResetConfirm]   = useState(false);

  // Password change form — only relevant for the logged-in co-ordinator
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg,     setPasswordMsg]     = useState(null); // { ok: bool, text: string }
  const [savingPassword,  setSavingPassword]  = useState(false);

  const isAdmin = currentUser.role === "admin";

  // ── Team member edit helpers ─────────────────────────────

  function startEditMember(m) {
    setEditMemberId(m.id);
    setEditMemberVal(m.name);
    setRemoveConfirm(null);
  }

  function saveEditMember(id) {
    if (!editMemberVal.trim()) return;
    onRename(id, editMemberVal.trim());
    setEditMemberId(null);
    setEditMemberVal("");
  }

  // Create the new member in the DB with a fresh auto-generated PIN,
  // then reveal that PIN to the co-ordinator in a one-time modal.
  async function handleAddMember() {
    if (!newMemberName.trim() || addingMember) return;
    const pin = generatePin();
    setAddingMember(true);
    const ok = await onAdd(newMemberName.trim(), pin);
    setAddingMember(false);
    if (ok !== false) {
      // Show the PIN so the co-ordinator can pass it to the new member.
      // This is the only time the PIN is displayed — there is no "view PIN" feature.
      setNewMemberPin({ name: newMemberName.trim(), pin });
      setNewMemberName("");
    }
  }

  // ── Admin edit helpers ───────────────────────────────────

  function startEditAdmin(a) {
    setEditAdminId(a.id);
    setEditAdminVal(a.name);
    setRemoveAdminConfirm(null);
  }

  function saveEditAdmin(id) {
    if (!editAdminVal.trim()) return;
    onRenameAdmin(id, editAdminVal.trim());
    setEditAdminId(null);
    setEditAdminVal("");
  }

  function handleAddAdmin() {
    if (!newAdminName.trim()) return;
    onAddAdmin(newAdminName.trim());
    setNewAdminName("");
  }

  // ── Password change handler ──────────────────────────────

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "Passwords don't match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ ok: false, text: "Password must be at least 6 characters." });
      return;
    }
    setSavingPassword(true);
    const hash = await hashPassword(newPassword);
    const ok = await onChangeAdminPassword(currentUser.id, hash);
    setSavingPassword(false);
    if (ok) {
      setPasswordMsg({ ok: true, text: "Password updated successfully." });
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordMsg({ ok: false, text: "Something went wrong. Try again." });
    }
  }

  return (
    <div>

      {/* ── Team member list ──────────────────────────────── */}
      <div className="section-title">Team members</div>

      {team.map(m => (
        <div key={m.id} className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

          {isAdmin && editMemberId === m.id ? (
            // Inline rename mode
            <>
              <input className="input" value={editMemberVal} autoFocus style={{ flex: 1 }}
                onChange={e => setEditMemberVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveEditMember(m.id)}
              />
              <button className="btn primary" style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => saveEditMember(m.id)}>Save</button>
              <button className="btn"         style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => setEditMemberId(null)}>✕</button>
            </>

          ) : isAdmin && removeConfirm === m.id ? (
            // Remove confirmation step — prevents accidental deletes
            <>
              <span style={{ flex: 1, fontSize: 12, color: "#c0392b" }}>Remove {m.name}? This deletes their account and history.</span>
              <button className="btn danger" style={{ padding: "5px 12px", flexShrink: 0 }}
                onClick={() => { onRemove(m.id); setRemoveConfirm(null); }}>Remove</button>
              <button className="btn" style={{ padding: "5px 12px", flexShrink: 0 }}
                onClick={() => setRemoveConfirm(null)}>Cancel</button>
            </>

          ) : (
            // Normal display row
            <>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: m.active === false ? "#9aa8a6" : "#1a2e2e" }}>
                {m.name}
                {/* Visual indicator when a member is suspended from OT */}
                {m.active === false && (
                  <span style={{ fontSize: 10, fontWeight: 400, color: "#c0392b", marginLeft: 6 }}>(suspended)</span>
                )}
              </span>
              <span style={{ fontSize: 11, color: "#9aa8a6", flexShrink: 0 }}>{m.score} pts</span>

              {/* Admin-only controls */}
              {isAdmin && (
                <>
                  {/* Suspend/unsuspend — keeps account and history, just removes from OT pool */}
                  <button
                    className={`btn ${m.active === false ? "primary" : ""}`}
                    style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }}
                    onClick={() => onToggleMemberActive(m.id, m.active !== false)}
                    title={m.active === false ? "Add back to OT roster" : "Remove from OT roster (keeps account)"}
                  >
                    {m.active === false ? "Unsuspend" : "Suspend"}
                  </button>
                  <button className="btn" style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }} onClick={() => startEditMember(m)}>Edit</button>
                  <button className="btn danger" style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }} onClick={() => setRemoveConfirm(m.id)}>Remove</button>
                </>
              )}
            </>
          )}

        </div>
      ))}

      {/* ── Add member — admin only ───────────────────────── */}
      {/* A 4-digit PIN is auto-generated and shown to the co-ordinator after adding */}
      {isAdmin && (
        <>
          <div className="section-title">Add a team member</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="Name or initials (e.g. JD)"
              value={newMemberName}
              onChange={e => setNewMemberName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddMember()}
              style={{ flex: 1 }}
            />
            <button
              className="btn primary"
              style={{ flexShrink: 0 }}
              onClick={handleAddMember}
              disabled={!newMemberName.trim() || addingMember}
            >
              {addingMember ? "Adding…" : "Add"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#9aa8a6", marginTop: 6 }}>
            A PIN will be generated automatically — write it down and pass it to the new member.
          </div>
        </>
      )}

      {/* ── Co-ordinator management — admin only ─────────── */}
      {isAdmin && (
        <>
          <hr className="divider" />
          <div className="section-title">Co-ordinators</div>

          {admins.map(a => (
            <div key={a.id} className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

              {editAdminId === a.id ? (
                <>
                  <input className="input" value={editAdminVal} autoFocus style={{ flex: 1 }}
                    onChange={e => setEditAdminVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveEditAdmin(a.id)}
                  />
                  <button className="btn primary" style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => saveEditAdmin(a.id)}>Save</button>
                  <button className="btn"         style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => setEditAdminId(null)}>✕</button>
                </>

              ) : removeAdminConfirm === a.id ? (
                // Prevent co-ordinators from removing their own account
                a.id === currentUser.id ? (
                  <>
                    <span style={{ flex: 1, fontSize: 12, color: "#c0392b" }}>You can't remove your own account.</span>
                    <button className="btn" style={{ padding: "5px 12px", flexShrink: 0 }} onClick={() => setRemoveAdminConfirm(null)}>OK</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 12, color: "#c0392b" }}>Remove {a.name}?</span>
                    <button className="btn danger" style={{ padding: "5px 12px", flexShrink: 0 }}
                      onClick={() => { onRemoveAdmin(a.id); setRemoveAdminConfirm(null); }}>Remove</button>
                    <button className="btn" style={{ padding: "5px 12px", flexShrink: 0 }}
                      onClick={() => setRemoveAdminConfirm(null)}>Cancel</button>
                  </>
                )

              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1a2e2e" }}>{a.name}</span>
                  <span className="badge badge-gold" style={{ flexShrink: 0 }}>Co-ordinator</span>
                  <button className="btn" style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }} onClick={() => startEditAdmin(a)}>Edit</button>
                  <button className="btn danger" style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }} onClick={() => setRemoveAdminConfirm(a.id)}>Remove</button>
                </>
              )}

            </div>
          ))}

          {/* Add a new co-ordinator */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              className="input"
              placeholder="New co-ordinator name"
              value={newAdminName}
              onChange={e => setNewAdminName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddAdmin()}
              style={{ flex: 1 }}
            />
            <button className="btn primary" style={{ flexShrink: 0 }} onClick={handleAddAdmin} disabled={!newAdminName.trim()}>Add</button>
          </div>
        </>
      )}

      {/* ── Change password — only shown to the logged-in co-ordinator ── */}
      <hr className="divider" />
      <div className="section-title">Change my password</div>
      <form onSubmit={handleChangePassword}>
        <input
          className="input"
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={e => { setNewPassword(e.target.value); setPasswordMsg(null); }}
          style={{ marginBottom: 8 }}
        />
        <input
          className="input"
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); setPasswordMsg(null); }}
          style={{ marginBottom: 8 }}
        />
        {/* Green = success, red = validation error */}
        {passwordMsg && (
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: passwordMsg.ok ? "#1f8a5f" : "#c0392b" }}>
            {passwordMsg.text}
          </div>
        )}
        <button
          className="btn primary"
          type="submit"
          disabled={!newPassword || !confirmPassword || savingPassword}
        >
          {savingPassword ? "Saving…" : "Update password"}
        </button>
      </form>

      {/* ── Danger zone — admin only ───────────────────────── */}
      {isAdmin && (
        <>
          <hr className="divider" />
          <div className="section-title">Danger zone</div>

          {!resetConfirm ? (
            <button className="btn danger" onClick={() => setResetConfirm(true)}>
              Reset all scores to zero
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#c0392b" }}>Are you sure? This resets everyone to 0 pts.</span>
              <button className="btn danger" onClick={() => { onResetScores(); setResetConfirm(false); }}>Yes, reset</button>
              <button className="btn"        onClick={() => setResetConfirm(false)}>Cancel</button>
            </div>
          )}

          <div style={{ fontSize: 11, color: "#9aa8a6", marginTop: 8 }}>
            Use this every 3 months so old history doesn't disadvantage people forever.
          </div>
        </>
      )}

      {/* ── PIN reveal modal ─────────────────────────────────
          Shown once after a new member is added. The PIN is only visible here —
          the co-ordinator must note it down and hand it to the new team member.
          There is no way to look it up again after dismissing this modal.       */}
      {newMemberPin && (
        <div className="password-overlay" onClick={() => setNewMemberPin(null)}>
          <div className="password-box" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 18, fontWeight: 700, color: "#042d2d", marginBottom: 4 }}>
              Member added!
            </div>
            <div style={{ fontSize: 13, color: "#475857", marginBottom: 20 }}>
              <strong>{newMemberPin.name}</strong> has been added. Their login PIN is below —
              pass it to them now.{" "}
              <strong style={{ color: "#c0392b" }}>This is only shown once.</strong>
            </div>

            {/* Large display of the 4-digit PIN */}
            <div style={{
              background: "#f5f7f6",
              border: "1px solid #e1e8e6",
              borderRadius: 6,
              padding: "16px 0",
              textAlign: "center",
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#7a8c8a", marginBottom: 8, fontWeight: 700 }}>
                PIN for {newMemberPin.name}
              </div>
              <div style={{
                fontFamily: "'Archivo', sans-serif",
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: 14,
                color: "#042d2d",
              }}>
                {newMemberPin.pin}
              </div>
            </div>

            <button className="btn primary" style={{ width: "100%" }} onClick={() => setNewMemberPin(null)}>
              Done — I've noted the PIN
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
