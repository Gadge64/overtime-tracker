// ============================================================
// PostOT.jsx — Post an overtime offer tab
//
// The co-ordinator picks a shift date, then selects a preset
// (filtered to what's valid on that day) or enters times manually.
// The form calculates shift duration and response window automatically.
//
// Multiple offers can be live at the same time — there is no "one offer
// at a time" restriction.
//
// Shift presets and their valid days (0=Sun … 6=Sat):
//   E     Mon–Thu   13:30–22:15  (8h 45m)
//   D1    Mon–Fri   08:00–16:30  (8h 30m)
//   N     Tue–Fri   22:00–08:15† (10h 15m)
//   EW    Sat–Sun   08:00–20:15  (12h 15m)
//   NW    Sat–Mon   20:00–08:15† (12h 15m)
//   SBY   Mon–Fri   08:00–13:30  (5h 30m)
//   E*    Fri only  13:30–20:15  (6h 45m)
//   CONT  Any day   13:30–22:15  (8h 45m, contingency)
//   † overnight: shift end is on the following calendar day
//
// Props:
//   onPost — fn({ desc, shiftType, shiftStart, shiftEnd, shiftHours })
// ============================================================

import { useState, useEffect } from "react";

// ─── Preset definitions ───────────────────────────────────────────────────
// days: JS getDay() values — 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

const PRESETS = [
  { type: "E",    label: "E",    start: "13:30", end: "22:15", overnight: false, days: [1,2,3,4]        },
  { type: "D1",   label: "D1",   start: "08:00", end: "16:30", overnight: false, days: [1,2,3,4,5]      },
  { type: "N",    label: "N",    start: "22:00", end: "08:15", overnight: true,  days: [2,3,4,5]        },
  { type: "EW",   label: "EW",   start: "08:00", end: "20:15", overnight: false, days: [0,6]            },
  { type: "NW",   label: "NW",   start: "20:00", end: "08:15", overnight: true,  days: [6,0,1]          },
  { type: "SBY",  label: "SBY",  start: "08:00", end: "13:30", overnight: false, days: [1,2,3,4,5]      },
  { type: "E*",   label: "E*",   start: "13:30", end: "20:15", overnight: false, days: [5]              },
  { type: "CONT", label: "CONT", start: "13:30", end: "22:15", overnight: false, days: [0,1,2,3,4,5,6]  },
];

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ─── Helpers ──────────────────────────────────────────────────────────────

// Decimal hours between two "HH:MM" strings.
// overnight=true adds 24h to the end time for shifts crossing midnight.
function calcHours(startStr, endStr, overnight) {
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins   = eh * 60 + em;
  if (overnight || endMins <= startMins) endMins += 1440;
  return (endMins - startMins) / 60;
}

// "8.75" → "8h 45m"
function fmtHours(h) {
  if (h == null || isNaN(h)) return "";
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

// Build a full JS Date from a "YYYY-MM-DD" date string and "HH:MM" time string.
// nextDay=true adds one calendar day (for overnight shift end times).
function buildDate(dateStr, timeStr, nextDay = false) {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(dateStr);          // midnight local time on that date
  if (nextDay) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
}

// Response window: how long members have to reply (based on how far off the shift is)
function getWindowHours(shiftStart) {
  const hoursUntil = (shiftStart - Date.now()) / 3_600_000;
  if (hoursUntil >= 72) return 24;
  if (hoursUntil >= 48) return 12;
  return null; // under 48h — show a warning but still allow posting
}

// ─── Component ────────────────────────────────────────────────────────────

export default function PostOT({ onPost }) {
  const [shiftDate,   setShiftDate]   = useState("");       // "YYYY-MM-DD"
  const [selection,   setSelection]   = useState(null);     // preset type string, or "manual"
  const [manualStart, setManualStart] = useState("08:00");  // "HH:MM" for manual entry
  const [manualEnd,   setManualEnd]   = useState("16:30");  // "HH:MM" for manual entry
  const [desc,        setDesc]        = useState("");
  // Short window for shifts under 48h away — coordinator picks 30min/1h/2h
  const [shortWindow, setShortWindow] = useState(null);

  // Day of week for the chosen date (0=Sun … 6=Sat)
  const dayOfWeek = shiftDate ? new Date(shiftDate).getDay() : null;

  // Presets available on the selected day
  const availablePresets = dayOfWeek != null
    ? PRESETS.filter(p => p.days.includes(dayOfWeek))
    : [];

  // The full preset object for the current selection (null if manual or nothing picked)
  const activePreset = selection && selection !== "manual"
    ? PRESETS.find(p => p.type === selection) ?? null
    : null;

  // Derived shift times and hours
  const shiftStart  = shiftDate && activePreset ? buildDate(shiftDate, activePreset.start) : null;
  const shiftEnd    = shiftDate && activePreset ? buildDate(shiftDate, activePreset.end, activePreset.overnight) : null;
  const manualStartDate = shiftDate && selection === "manual" ? buildDate(shiftDate, manualStart) : null;
  const manualEndDate   = shiftDate && selection === "manual" ? buildDate(shiftDate, manualEnd, calcHours(manualStart, manualEnd, false) <= 0) : null;
  const effectiveStart  = activePreset ? shiftStart : manualStartDate;
  const effectiveEnd    = activePreset ? shiftEnd   : manualEndDate;
  const shiftHours      = activePreset
    ? calcHours(activePreset.start, activePreset.end, activePreset.overnight)
    : (selection === "manual" ? calcHours(manualStart, manualEnd, false) : null);

  const windowHours = effectiveStart ? getWindowHours(effectiveStart) : null;
  const tooSoon     = effectiveStart && windowHours === null;

  // Auto-fill description when a preset and date are both selected
  useEffect(() => {
    if (shiftDate && activePreset) {
      const d = new Date(shiftDate);
      const formatted = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      setDesc(`${activePreset.type} shift – ${formatted}`);
    }
  }, [shiftDate, selection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection if it's no longer valid for the newly chosen day
  useEffect(() => {
    if (selection && selection !== "manual") {
      const still = PRESETS.find(p => p.type === selection);
      if (still && dayOfWeek != null && !still.days.includes(dayOfWeek)) {
        setSelection(null);
        setDesc("");
      }
    }
  }, [shiftDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // tooSoon offers are allowed if the coordinator picks a short window
  const canSubmit = !!shiftDate && !!selection && !!desc.trim() && shiftHours > 0 && (!tooSoon || shortWindow !== null);

  // Effective window: calculated for planned offers, coordinator-chosen for short-notice
  const effectiveWindowHours = tooSoon ? shortWindow : windowHours;

  function handleSubmit() {
    if (!canSubmit) return;
    onPost({
      desc:        desc.trim(),
      shiftType:   selection === "manual" ? "manual" : activePreset.type,
      shiftStart:  effectiveStart.toISOString(),
      shiftEnd:    effectiveEnd.toISOString(),
      shiftHours:  Math.round(shiftHours * 100) / 100,
      windowHours: effectiveWindowHours,  // pass explicit window so postOT doesn't recalculate
    });
    setShiftDate("");
    setSelection(null);
    setManualStart("08:00");
    setManualEnd("16:30");
    setDesc("");
    setShortWindow(null);
  }

  return (
    <div>
      <div className="section-title">Post an overtime opportunity</div>

      {/* ── Step 1: Pick shift date ───────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <label>Shift date</label>
        <input
          type="date"
          className="input"
          value={shiftDate}
          onChange={e => { setShiftDate(e.target.value); setSelection(null); setDesc(""); }}
        />
        {shiftDate && (
          <div style={{ fontSize: 11, color: "#7a8c8a", marginTop: 4 }}>
            {DAY_NAMES[dayOfWeek]} — {availablePresets.length} preset{availablePresets.length !== 1 ? "s" : ""} available
          </div>
        )}
      </div>

      {/* ── Step 2: Choose preset or manual ──────────────── */}
      {shiftDate && (
        <div style={{ marginBottom: 16 }}>
          <label>Shift type</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {availablePresets.map(p => (
              <button
                key={p.type}
                className={`btn ${selection === p.type ? "primary" : ""}`}
                style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700 }}
                onClick={() => setSelection(p.type)}
              >
                {p.label}
                <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>
                  {p.start}–{p.end}{p.overnight ? "†" : ""}
                </span>
              </button>
            ))}
            {/* Manual is always available */}
            <button
              className={`btn ${selection === "manual" ? "primary" : ""}`}
              style={{ padding: "8px 14px", fontSize: 13 }}
              onClick={() => { setSelection("manual"); setDesc(""); }}
            >
              Manual
            </button>
          </div>

          {/* Show details for the selected preset */}
          {activePreset && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: "#f5f7f6", borderRadius: 4, border: "1px solid #e1e8e6" }}>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#7a8c8a", fontWeight: 700 }}>Start</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#042d2d", fontFamily: "'Archivo', sans-serif" }}>{activePreset.start}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#7a8c8a", fontWeight: 700 }}>End</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#042d2d", fontFamily: "'Archivo', sans-serif" }}>
                    {activePreset.end}{activePreset.overnight ? " (+1 day)" : ""}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#7a8c8a", fontWeight: 700 }}>Duration</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#042d2d", fontFamily: "'Archivo', sans-serif" }}>{fmtHours(shiftHours)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Manual time entry */}
          {selection === "manual" && (
            <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label>Start time</label>
                <input type="time" className="input" value={manualStart} onChange={e => setManualStart(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label>End time</label>
                <input type="time" className="input" value={manualEnd} onChange={e => setManualEnd(e.target.value)} />
              </div>
              {shiftHours > 0 && (
                <div style={{ alignSelf: "flex-end", paddingBottom: 2 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#7a8c8a", fontWeight: 700, marginBottom: 4 }}>Duration</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#042d2d", fontFamily: "'Archivo', sans-serif" }}>{fmtHours(shiftHours)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Description ───────────────────────────── */}
      {selection && (
        <div style={{ marginBottom: 14 }}>
          <label>Description</label>
          <textarea
            className="input"
            rows={2}
            placeholder="e.g. E shift – Mon 15th Jul (covering for GD)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>
      )}

      {/* ── Response window & warnings ────────────────────── */}
      {effectiveStart && (
        <div style={{ marginBottom: 14 }}>
          {tooSoon ? (
            // Short-notice: coordinator picks a quick response window instead of being blocked
            <div>
              <div className="warning-box" style={{ marginBottom: 10 }}>
                ⚠ This shift is less than 48 hours away. Pick a short response window below.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[0.5, 1, 2, 4].map(h => (
                  <button
                    key={h}
                    className={`btn ${shortWindow === h ? "primary" : ""}`}
                    style={{ padding: "6px 14px", fontSize: 12 }}
                    onClick={() => setShortWindow(h)}
                  >
                    {h < 1 ? "30 min" : `${h}h`}
                  </button>
                ))}
              </div>
              {shortWindow !== null && (
                <div style={{ fontSize: 11, color: "#042d2d", fontWeight: 600, marginTop: 8 }}>
                  Window closes: {new Date(Date.now() + shortWindow * 3_600_000).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#042d2d", fontWeight: 600 }}>
              Response window: {windowHours}h — closes {new Date(Date.now() + windowHours * 3_600_000).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      )}

      <button className="btn primary" onClick={handleSubmit} disabled={!canSubmit}>
        Post overtime offer
      </button>

      {/* footnote for overnight shifts */}
      {availablePresets.some(p => p.overnight) && shiftDate && (
        <div style={{ fontSize: 10, color: "#9aa8a6", marginTop: 10 }}>† overnight — shift ends on the following calendar day</div>
      )}
    </div>
  );
}
