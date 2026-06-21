// ============================================================
// PostOT.jsx — Post an overtime offer tab
//
// Lets supervisors/admins create a new OT opportunity.
// Only one offer can be active at a time — form is disabled
// while one is already open.
//
// Props:
//   activeOffer — current open offer (or null); blocks new posts
//   onPost      — fn({ desc, shiftTime, immediate }) called on submit
// ============================================================

import { useState } from "react";

// Preview the response window length based on the entered shift time.
// Mirrors the logic in App.jsx so the label is always accurate.
function getWindowHours(shiftTime) {
  const hoursUntil = (new Date(shiftTime) - Date.now()) / 3_600_000;
  if (hoursUntil >= 48) return 24;
  if (hoursUntil >= 24) return 12;
  return 4;
}

export default function PostOT({ activeOffer, onPost }) {
  const [desc,      setDesc]      = useState("");
  const [shiftTime, setShiftTime] = useState("");
  const [immediate, setImmediate] = useState(false);

  const blocked   = !!activeOffer; // can't post while one is active
  const canSubmit = !blocked && desc.trim() && (immediate || shiftTime);

  function handleSubmit() {
    if (!canSubmit) return;
    onPost({ desc, shiftTime, immediate });
    // Reset the form so it's clean if they come back to post another
    setDesc("");
    setShiftTime("");
    setImmediate(false);
  }

  return (
    <div>
      <div className="section-title">Post an overtime opportunity</div>

      {/* Warning if there's already an open offer */}
      {blocked && (
        <div className="warning-box">
          ⚠ There's already an active overtime offer. Go to the Board tab to close or cancel it first.
        </div>
      )}

      {/* ── Description ───────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <label>Description / shift details</label>
        <textarea
          className="input"
          rows={3}
          placeholder="e.g. Night shift cover Sat 31st, 10pm–6am"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          disabled={blocked}
          style={{ resize: "vertical" }}
        />
      </div>

      {/* ── Immediate cover checkbox ──────────────────────── */}
      {/* When ticked, hides the shift time picker and marks the offer
          as first-come-first-served (no score impact) */}
      <div style={{ marginBottom: 14 }}>
        <label className="checkbox-row" style={{ display: "flex" }}>
          <input
            type="checkbox"
            checked={immediate}
            onChange={e => setImmediate(e.target.checked)}
            disabled={blocked}
          />
          <span style={{ fontSize: 12, color: "#1a2e2e", letterSpacing: 0 }}>
            🚨 Immediate cover needed (first come first served, no score impact)
          </span>
        </label>
      </div>

      {/* ── Shift start time picker ───────────────────────── */}
      {/* Hidden when "immediate" is checked — shift time is irrelevant then */}
      {!immediate && (
        <div style={{ marginBottom: 16 }}>
          <label>Shift start date & time</label>
          <input
            type="datetime-local"
            className="input"
            value={shiftTime}
            onChange={e => setShiftTime(e.target.value)}
            disabled={blocked}
          />
          {/* Preview the response window length so the supervisor knows what they're setting */}
          {shiftTime && (
            <div style={{ fontSize: 11, color: "#042d2d", fontWeight: 600, marginTop: 6 }}>
              Response window: {getWindowHours(shiftTime)} hours
            </div>
          )}
        </div>
      )}

      <button className="btn primary" onClick={handleSubmit} disabled={!canSubmit}>
        Post overtime offer
      </button>
    </div>
  );
}
