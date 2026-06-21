// ============================================================
// Setup.jsx — Team management tab
//
// Admins see full controls: edit names, add/remove members,
// grant/revoke admin, reset scores.
//
// Non-admins see a read-only list of the team (names + scores)
// so they can see who's on the roster, but can't change anything.
//
// Props:
//   team          — array of all team members
//   currentUser   — the logged-in member { id, name, is_admin }
//   onAdd         — fn(name)
//   onRename      — fn(id, name)
//   onRemove      — fn(id)
//   onResetScores — fn()
//   onToggleAdmin — fn(id, isAdmin)
// ============================================================

import { useState } from "react";

export default function Setup({ team, currentUser, onAdd, onRename, onRemove, onResetScores, onToggleAdmin }) {
  const [editId,        setEditId]        = useState(null);   // id of the row currently being edited
  const [editValue,     setEditValue]     = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState(null);   // id of member pending removal confirmation
  const [resetConfirm,  setResetConfirm]  = useState(false);

  const isAdmin = currentUser.is_admin;

  function startEdit(member) {
    setEditId(member.id);
    setEditValue(member.name);
    setRemoveConfirm(null); // close any open confirmation first
  }

  function saveEdit(id) {
    if (!editValue.trim()) return;
    onRename(id, editValue.trim());
    setEditId(null);
    setEditValue("");
  }

  function handleAdd() {
    if (!newMemberName.trim()) return;
    onAdd(newMemberName.trim());
    setNewMemberName("");
  }

  return (
    <div>

      {/* ── Team member list ──────────────────────────────── */}
      <div className="section-title">Team members</div>

      {team.map(m => (
        <div key={m.id} className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

          {editId === m.id ? (
            // ── Inline edit mode ─────────────────────────
            <>
              <input
                className="input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveEdit(m.id)}
                autoFocus
                style={{ flex: 1 }}
              />
              <button className="btn primary" style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => saveEdit(m.id)}>Save</button>
              <button className="btn"         style={{ padding: "6px 14px", flexShrink: 0 }} onClick={() => setEditId(null)}>✕</button>
            </>

          ) : removeConfirm === m.id ? (
            // ── Remove confirmation ───────────────────────
            <>
              <span style={{ flex: 1, fontSize: 12, color: "#c0392b" }}>Remove {m.name}?</span>
              <button className="btn danger" style={{ padding: "5px 12px", flexShrink: 0 }}
                onClick={() => { onRemove(m.id); setRemoveConfirm(null); }}>
                Remove
              </button>
              <button className="btn" style={{ padding: "5px 12px", flexShrink: 0 }}
                onClick={() => setRemoveConfirm(null)}>
                Cancel
              </button>
            </>

          ) : (
            // ── Normal display ────────────────────────────
            <>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1a2e2e" }}>{m.name}</span>
              <span style={{ fontSize: 11, color: "#9aa8a6", flexShrink: 0 }}>{m.score} pts</span>

              {/* Admin badge — visible to everyone so the team knows who can post OT */}
              {m.is_admin && (
                <span className="badge badge-gold" style={{ flexShrink: 0 }}>Admin</span>
              )}

              {/* Management controls — only admins see these */}
              {isAdmin && (
                <>
                  <button
                    className="btn"
                    style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }}
                    onClick={() => startEdit(m)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn danger"
                    style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }}
                    onClick={() => setRemoveConfirm(m.id)}
                  >
                    Remove
                  </button>
                  {/* Admins can grant/revoke admin for others, but not themselves
                      (prevents accidental lockout) */}
                  {m.id !== currentUser.id && (
                    <button
                      className={`btn ${m.is_admin ? "danger" : ""}`}
                      style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }}
                      onClick={() => onToggleAdmin(m.id, !m.is_admin)}
                    >
                      {m.is_admin ? "Revoke admin" : "Make admin"}
                    </button>
                  )}
                </>
              )}
            </>
          )}

        </div>
      ))}

      {/* ── Add a new member — admin only ─────────────────── */}
      {isAdmin && (
        <>
          <div className="section-title">Add a team member</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="Name or initials (e.g. JD)"
              value={newMemberName}
              onChange={e => setNewMemberName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              style={{ flex: 1 }}
            />
            <button
              className="btn primary"
              style={{ flexShrink: 0 }}
              onClick={handleAdd}
              disabled={!newMemberName.trim()}
            >
              Add
            </button>
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
