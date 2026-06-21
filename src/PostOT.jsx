// ============================================================
// PostOT.jsx — Post an overtime offer tab
//
// Lets admins create a new planned OT opportunity.
// Only one offer can be active at a time.
//
// Response window rules:
//   72+ hours away  → 24 hour window
//   48–72 hours away → 12 hour window
//   Under 48 hours  → not accepted here, use WhatsApp instead
//
// Props:
//   activeOffer — current open offer (or null); blocks new posts
//   onPost      — fn({ desc, shiftTime, immediate }) called on submit
// ============================================================

import { useState } from "react";

// Returns the window length in hours, or null if the shift is too soon.
// Must match the logic in App.jsx exactly.
function getWindowHours(shiftTime) {
  const hoursUntil = (new Date(shiftTime) - Date.now()) / 3_600_000;
  if (hoursUntil >= 72) return 24;  // 3+ days away → 24 hour window
  if (hoursUntil >= 48) return 12;  // 2–3 days away → 12 hour window
  return null;                       // under 48h — blocked
}

export default function PostOT({ activeOffer, onPost }) {
  const [desc,      setDesc]      = useState("");
  const [shiftTime, setShiftTime] = useState("");
  const [immediate, setImmediate] = useState(false);

  const blocked = !!activeOffer; // can't post while another offer is already open

  // Check if the entered shift time is too soon (under 48h away)
  const tooSoon = !immediate && shiftTime && getWindowHours(shiftTime) === null;

  // All conditions that must be true before the Post button is enabled
  const canSubmit = !blocked && desc.trim() && (immediate || (shiftTime && !tooSoon));

  function handleSubmit() {
    if (!canSubmit) return;
    onPost({ desc, shiftTime, immediate });
    // Reset the form for the next post
    setDesc("");
    setShiftTime("");
    setImmediate(false);
  }

  return (
    <div>
      <div className="section-title">Post an overtime opportunity</div>

      {/* Warning: another offer already open */}
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
      {/* Immediate offers are first-come-first-served and bypass the window system */}
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
      {/* Hidden when "immediate" is checked */}
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

          {/* Show response window preview, or a warning if the shift is too soon */}
          {shiftTime && (
            tooSoon ? (
              <div style={{ fontSize: 11, color: "#c0392b", fontWeight: 600, marginTop: 6 }}>
                ⚠ This shift is less than 48 hours away — please use WhatsApp for short-notice cover.
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#042d2d", fontWeight: 600, marginTop: 6 }}>
                Response window: {getWindowHours(shiftTime)} hours
              </div>
            )
          )}
        </div>
      )}

      <button className="btn primary" onClick={handleSubmit} disabled={!canSubmit}>
        Post overtime offer
      </button>
    </div>
  );
}
