// ============================================================
// Setup.jsx — Team management tab
//
// What admins see:
//   - Full team roster with edit/remove controls
//   - Add new team members
//   - Supervisor management (add/rename/remove admins)
//   - Score reset (danger zone)
//
// What team members see:
//   - Read-only team roster (names + scores only)
//
// Props:
//   team          — array of team members
//   admins        — array of supervisor accounts
//   currentUser   — { id, name, role } of the logged-in user
//   onAdd         — fn(name) add team member
//   onRename      — fn(id, name) rename team member
//   onRemove      — fn(id) remove team member
//   onResetScores — fn()
//   onAddAdmin    — fn(name) add supervisor
//   onRenameAdmin — fn(id, name) rename supervisor
//   onRemoveAdmin — fn(id) remove supervisor
// ============================================================

import { useState } from "react";

export default function Setup({
  team, admins, currentUser,
  onAdd, onRename, onRemove, onResetScores,
  onAddAdmin, onRenameAdmin, onRemoveAdmin,
}) {
  const [editMemberId,   setEditMemberId]   = useState(null);
  const [editMemberVal,  setEditMemberVal]  = useState("");
  const [newMemberName,  setNewMemberName]  = useState("");
  const [removeConfirm,  setRemoveConfirm]  = useState(null); // id of member pending removal

  const [editAdminId,    setEditAdminId]    = useState(null);
  const [editAdminVal,   setEditAdminVal]   = useState("");
  const [newAdminName,   setNewAdminName]   = useState("");
  const [removeAdminConfirm, setRemoveAdminConfirm] = useState(null);

  const [resetConfirm,   setResetConfirm]   = useState(false);

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

  function handleAddMember() {
    if (!newMemberName.trim()) return;
    onAdd(newMemberName.trim());
    setNewMemberName("");
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

  return (
    <div>

      {/* ── Team member list ──────────────────────────────── */}
      <div className="section-title">Team members</div>

      {team.map(m => (
        <div key={m.id} className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

          {isAdmin && editMemberId === m.id ? (
            // Inline edit mode
            <>
              <input className="input" value={editMemberVal} autoFocus style={{ flex: 1 }}
                onChange={e => setEditMemberVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveEditMember(m.id)}
              />
              <button className="btn primary" style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => saveEditMember(m.id)}>Save</button>
              <button className="btn"         style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => setEditMemberId(null)}>✕</button>
            </>

          ) : isAdmin && removeConfirm === m.id ? (
            // Remove confirmation
            <>
              <span style={{ flex: 1, fontSize: 12, color: "#c0392b" }}>Remove {m.name}?</span>
              <button className="btn danger" style={{ padding: "5px 12px", flexShrink: 0 }}
                onClick={() => { onRemove(m.id); setRemoveConfirm(null); }}>Remove</button>
              <button className="btn" style={{ padding: "5px 12px", flexShrink: 0 }}
                onClick={() => setRemoveConfirm(null)}>Cancel</button>
            </>

          ) : (
            // Normal display
            <>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1a2e2e" }}>{m.name}</span>
              <span style={{ fontSize: 11, color: "#9aa8a6", flexShrink: 0 }}>{m.score} pts</span>
              {/* Edit/remove controls — admin only */}
              {isAdmin && (
                <>
                  <button className="btn" style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }} onClick={() => startEditMember(m)}>Edit</button>
                  <button className="btn danger" style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }} onClick={() => setRemoveConfirm(m.id)}>Remove</button>
                </>
              )}
            </>
          )}

        </div>
      ))}

      {/* Add member — admin only */}
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
            <button className="btn primary" style={{ flexShrink: 0 }} onClick={handleAddMember} disabled={!newMemberName.trim()}>Add</button>
          </div>
        </>
      )}

      {/* ── Supervisor management — admin only ────────────── */}
      {/* Admins can add/rename/remove other supervisor accounts */}
      {isAdmin && (
        <>
          <hr className="divider" />
          <div className="section-title">Co-ordinators</div>

          {admins.map(a => (
            <div key={a.id} className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

              {editAdminId === a.id ? (
                // Inline edit mode
                <>
                  <input className="input" value={editAdminVal} autoFocus style={{ flex: 1 }}
                    onChange={e => setEditAdminVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveEditAdmin(a.id)}
                  />
                  <button className="btn primary" style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => saveEditAdmin(a.id)}>Save</button>
                  <button className="btn"         style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => setEditAdminId(null)}>✕</button>
                </>

              ) : removeAdminConfirm === a.id ? (
                // Remove confirmation — prevent removing yourself
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

          {/* Add a new supervisor */}
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

    </div>
  );
}
