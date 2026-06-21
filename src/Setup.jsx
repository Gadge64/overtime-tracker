// ============================================================
// Setup.jsx — Team management tab
//
// Allows admins to:
//   - Rename existing team members (tap Edit)
//   - Add new team members
//   - Remove team members (with inline confirmation)
//   - Reset all scores to zero (end-of-quarter, with confirmation)
//
// Props:
//   team          — array of all team members
//   onAdd         — fn(name)
//   onRename      — fn(id, name)
//   onRemove      — fn(id)
//   onResetScores — fn()
// ============================================================

import { useState } from "react";

export default function Setup({ team, onAdd, onRename, onRemove, onResetScores }) {
  const [editId,         setEditId]         = useState(null);   // id of the row being edited
  const [editValue,      setEditValue]      = useState("");
  const [newMemberName,  setNewMemberName]  = useState("");
  const [removeConfirm,  setRemoveConfirm]  = useState(null);   // id of member pending removal
  const [resetConfirm,   setResetConfirm]   = useState(false);

  function startEdit(member) {
    setEditId(member.id);
    setEditValue(member.name);
    setRemoveConfirm(null); // close any open remove confirmation
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
        <div key={m.id} className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {editId === m.id ? (
            /* Inline edit mode */
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
            /* Inline remove confirmation */
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
            /* Normal display */
            <>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1a2e2e" }}>{m.name}</span>
              <span style={{ fontSize: 11, color: "#9aa8a6", flexShrink: 0 }}>{m.score} pts</span>
              <button className="btn"        style={{ padding: "5px 12px", fontSize: 10, flexShrink: 0 }} onClick={() => startEdit(m)}>Edit</button>
              <button className="btn danger" style={{ padding: "5px 12px", fontSize: 10, flexShrink: 0 }} onClick={() => setRemoveConfirm(m.id)}>Remove</button>
            </>
          )}

        </div>
      ))}

      {/* ── Add a new member ──────────────────────────────── */}
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

      {/* ── Danger zone ───────────────────────────────────── */}
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

    </div>
  );
}
