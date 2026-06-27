// ============================================================
// Roster.jsx — Personal calendar, Swap/UDR checker
//
// Visible to team members only (not co-ordinators, not when logged out).
//
// Shows the current user's shift schedule week by week from the
// roster_availability table. Lets them compare their schedule
// with a colleague's and send Swap or UDR requests.
//
// Swap: both engineers agree to cover each other's shifts on
//       different dates. Shifts don't need to be the same type
//       (e.g. SBY can swap with N).
// UDR:  Urgent Domestic Request — one engineer covers another's
//       shift with no reciprocal arrangement.
//
// Requests stay "pending" until the partner accepts or declines.
// Accepted requests are shown in both engineers' pending views.
//
// Props:
//   currentUser — { id, name, role }
//   team        — full array of team_members from Supabase
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── Date helpers ─────────────────────────────────────────────────────────

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// YYYY-MM-DD string for Supabase queries
function toISO(d) {
  return d.toISOString().slice(0, 10);
}

// "Sat 28 Jun" for display
function fmtDay(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// The Saturday that starts the roster week containing today + weekOffset weeks
function weekStartDate(weekOffset) {
  const d = new Date();
  d.setDate(d.getDate() + weekOffset * 7);
  d.setHours(0, 0, 0, 0);
  // Roster week runs Sat→Fri. (day+1)%7 gives days since last Saturday.
  const daysBack = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - daysBack);
  return d;
}

// ─── Shift display ────────────────────────────────────────────────────────

const DUTY_COLOUR = {
  R: "#1f8a5f", E: "#b7770d", "E*": "#b7770d", EW: "#b7770d",
  D1: "#2471a3", N: "#1a2e6e", NW: "#1a2e6e", SBY: "#7d3c98",
};

function shiftColour(duty, status) {
  if (status === "AL_SHIFT" || status === "AL_REST") return "#8e9e9b";
  if (status === "OT_RECORD")                        return "#c0922b";
  if (status === "COVER_ACTIVE" || status === "COVER_AVAILABLE") return "#16a085";
  return DUTY_COLOUR[duty] || "#7a8c8a";
}

function shiftLabel(duty, status) {
  if (status === "AL_SHIFT" || status === "AL_REST") return "A/L";
  if (status === "OT_RECORD")                        return "OT";
  if (status === "COVER_ACTIVE" || status === "COVER_AVAILABLE") return "Cover";
  return duty || "—";
}

function ShiftChip({ duty, status }) {
  return (
    <span style={{
      display: "inline-block",
      background: shiftColour(duty, status), color: "#fff",
      fontSize: 11, fontWeight: 700, fontFamily: "'Archivo', sans-serif",
      padding: "2px 7px", borderRadius: 3, letterSpacing: 0.5,
      minWidth: 34, textAlign: "center",
    }}>
      {shiftLabel(duty, status)}
    </span>
  );
}

// ─── Request modal ────────────────────────────────────────────────────────
// Shown when the user taps "Request →" on a day where they have a shift
// and the chosen colleague is free.

function RequestModal({ myDate, myDuty, dayLabel, partnerName, onConfirm, onClose }) {
  const [type, setType] = useState("swap");
  const [note, setNote] = useState("");

  return (
    <div className="password-overlay" onClick={onClose}>
      <div className="password-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 17, fontWeight: 700, color: "#042d2d", marginBottom: 4 }}>
          Request cover
        </div>
        <div style={{ fontSize: 12, color: "#7a8c8a", marginBottom: 16 }}>
          Asking <strong>{partnerName}</strong> to cover your <strong>{myDuty}</strong> on <strong>{dayLabel}</strong>.
        </div>

        {/* Swap vs UDR selector */}
        <div style={labelRow}>Request type</div>
        <div style={{ display: "flex", gap: 8, margin: "6px 0 4px" }}>
          <button className={`btn ${type === "swap" ? "primary" : ""}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setType("swap")}>
            Swap — reciprocal
          </button>
          <button className={`btn ${type === "udr" ? "primary" : ""}`}  style={{ flex: 1, fontSize: 12 }} onClick={() => setType("udr")}>
            UDR — one-way
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#9aa8a6", marginBottom: 14 }}>
          {type === "swap"
            ? "Reciprocal — the covering engineer banks a return shift, to be called in whenever suits them."
            : "Urgent Domestic Request — one-way cover, no return shift owed."}
        </div>

        {/* Optional note */}
        <div style={labelRow}>Note (optional)</div>
        <textarea
          className="input"
          rows={2}
          style={{ margin: "6px 0 14px", resize: "vertical" }}
          placeholder="Any context for your colleague…"
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn primary" style={{ flex: 1 }}
            onClick={() => onConfirm(type, note.trim() || null)}>
            Send request
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const labelRow = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#7a8c8a" };

// ─── Main Roster component ────────────────────────────────────────────────

export default function Roster({ currentUser, team }) {
  const [weekOffset,   setWeekOffset]   = useState(0);
  const [compareWith,  setCompareWith]  = useState("");    // engineer initials
  const [myRoster,     setMyRoster]     = useState({});    // date → { base_duty, status, ot_available }
  const [theirRoster,  setTheirRoster]  = useState({});    // same, for comparison engineer
  const [pendingReqs,  setPendingReqs]  = useState([]);
  const [requestModal, setRequestModal] = useState(null);  // { myDate, myDuty, dayLabel }
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState(null);

  const myInitials = currentUser.name;

  // Week boundaries — roster week is Sat→Fri
  const wStart   = weekStartDate(weekOffset);
  const weekEnd  = addDays(wStart, 6);
  const farEnd   = addDays(wStart, 27); // 4 weeks: used for swap return date picker
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wStart, i));
  const todayISO = toISO(new Date());

  // ── Data fetching ────────────────────────────────────────────────────────

  // Fetches my roster for the current week + 3 ahead (4 weeks total).
  // The extra weeks are used to find return dates when creating a swap request.
  const fetchMyRoster = useCallback(async () => {
    const { data } = await supabase
      .from("roster_availability")
      .select("date, base_duty, status, ot_available")
      .eq("engineer", myInitials)
      .gte("date", toISO(wStart))
      .lte("date", toISO(farEnd));
    const m = {};
    for (const r of (data || [])) m[r.date] = r;
    setMyRoster(m);
  }, [weekOffset, myInitials]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetches the comparison engineer's roster for the same 4-week window
  const fetchTheirRoster = useCallback(async () => {
    if (!compareWith) { setTheirRoster({}); return; }
    const { data } = await supabase
      .from("roster_availability")
      .select("date, base_duty, status, ot_available")
      .eq("engineer", compareWith)
      .gte("date", toISO(wStart))
      .lte("date", toISO(farEnd));
    const m = {};
    for (const r of (data || [])) m[r.date] = r;
    setTheirRoster(m);
  }, [weekOffset, compareWith]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPending = useCallback(async () => {
    const { data } = await supabase
      .from("swaps")
      .select("*")
      .or(`requester_id.eq.${currentUser.id},partner_id.eq.${currentUser.id}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingReqs(data || []);
  }, [currentUser.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyRoster(), fetchPending()]).finally(() => setLoading(false));
  }, [weekOffset, myInitials]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTheirRoster(); }, [compareWith, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss toast after 3.5s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Eligibility helpers ──────────────────────────────────────────────────

  // (No return date picker — banked swap, return is arranged informally later)

  // ── Actions ──────────────────────────────────────────────────────────────

  // For swaps the return date/duty are left null — the covering engineer banks the
  // reciprocal and calls it in whenever suits them. partner_date stays null until
  // the banked shift is eventually arranged outside the app.
  async function sendRequest(type, myDate, myDuty, note) {
    const partner = team.find(m => m.name === compareWith);
    if (!partner) return;
    const { error } = await supabase.from("swaps").insert({
      requester_id:   currentUser.id,
      partner_id:     partner.id,
      type,
      requester_date: myDate,
      requester_duty: myDuty,
      note:           note || null,
    });
    setRequestModal(null);
    if (error) { console.error("sendRequest:", error); setToast("Failed to send — try again."); }
    else { setToast("Request sent!"); fetchPending(); }
  }

  async function respondToRequest(id, status) {
    const { error } = await supabase
      .from("swaps")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setToast(status === "accepted" ? "Accepted." : "Declined.");
      fetchPending();
    }
  }

  // ── Coverage helper ──────────────────────────────────────────────────────

  // Returns: "they-cover-me" | "i-cover-them" | "both-free" | null
  function coverage(myEntry, theirEntry) {
    if (!myEntry || !theirEntry) return null;
    const myFree      = myEntry.ot_available;
    const theirFree   = theirEntry.ot_available;
    const myWorking   = !myFree   && myEntry.base_duty    !== "R";
    const theirWorking= !theirFree && theirEntry.base_duty !== "R";
    if (theirFree && myWorking)    return "they-cover-me";
    if (myFree && theirWorking)    return "i-cover-them";
    if (myFree && theirFree)       return "both-free";
    return null;
  }

  // ── Pending request display helper ───────────────────────────────────────

  function fmtDate(iso) {
    if (!iso) return null;
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <div style={{ color: "#9aa8a6", fontSize: 13, padding: 8 }}>Loading roster…</div>;

  return (
    <div>

      {/* Floating toast notification */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#042d2d", color: "#fff", padding: "10px 18px", borderRadius: 8,
          fontSize: 13, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}>
          {toast}
        </div>
      )}

      {/* ── Pending requests ─────────────────────────────────── */}
      {pendingReqs.length > 0 && (
        <>
          <div className="section-title">Pending requests</div>
          {pendingReqs.map(req => {
            const isMe      = req.requester_id === currentUser.id;
            const otherName = isMe
              ? team.find(m => m.id === req.partner_id)?.name
              : team.find(m => m.id === req.requester_id)?.name;

            return (
              <div key={req.id} className="card" style={{ borderLeft: "3px solid #c0922b" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#c0922b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  {req.type === "udr" ? "UDR" : "Swap"} · {isMe ? "sent" : "received"}
                </div>

                <div style={{ fontSize: 13, color: "#1a2e2e", lineHeight: 1.6 }}>
                  {isMe ? (
                    <>
                      You asked <strong>{otherName}</strong> to cover your <strong>{req.requester_duty}</strong> on <strong>{fmtDate(req.requester_date)}</strong>
                      {req.type === "swap" && (
                        <span style={{ color: "#7a8c8a" }}> — return shift banked with {otherName}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>{otherName}</strong> is asking you to cover their <strong>{req.requester_duty}</strong> on <strong>{fmtDate(req.requester_date)}</strong>
                      {req.type === "swap" && (
                        <span style={{ color: "#7a8c8a" }}> — you bank a return shift</span>
                      )}
                    </>
                  )}
                </div>

                {req.note && (
                  <div style={{ fontSize: 11, color: "#7a8c8a", marginTop: 4, fontStyle: "italic" }}>"{req.note}"</div>
                )}

                {!isMe ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn yes" style={{ padding: "5px 16px" }} onClick={() => respondToRequest(req.id, "accepted")}>Accept</button>
                    <button className="btn no"  style={{ padding: "5px 14px" }} onClick={() => respondToRequest(req.id, "declined")}>Decline</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "#9aa8a6", marginTop: 6 }}>Waiting for {otherName} to respond.</div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── Week navigator ────────────────────────────────────── */}
      <div className="section-title">My schedule</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button className="btn" style={{ padding: "4px 12px" }} onClick={() => setWeekOffset(w => w - 1)}>◀</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#042d2d" }}>
          {fmtDay(wStart)} – {fmtDay(weekEnd)}
        </div>
        <button className="btn" style={{ padding: "4px 12px" }} onClick={() => setWeekOffset(w => w + 1)}>▶</button>
      </div>

      {/* ── Schedule grid ─────────────────────────────────────── */}
      {compareWith ? (
        // Side-by-side comparison view
        <>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 44px 72px", gap: 6, padding: "4px 2px", borderBottom: "1px solid #e1e8e6", marginBottom: 4 }}>
            <div style={colHead}>Date</div>
            <div style={{ ...colHead, textAlign: "center" }}>{myInitials}</div>
            <div style={{ ...colHead, textAlign: "center" }}>{compareWith}</div>
            <div />
          </div>

          {weekDays.map(day => {
            const dateStr = toISO(day);
            const myE     = myRoster[dateStr];
            const theirE  = theirRoster[dateStr];
            const cov     = coverage(myE, theirE);
            const isToday = dateStr === todayISO;

            return (
              <div key={dateStr} style={{
                display: "grid", gridTemplateColumns: "1fr 44px 44px 72px",
                gap: 6, alignItems: "center", padding: "7px 2px",
                borderBottom: "1px solid #f0f3f2",
                background: isToday ? "#f5f9f7" : "transparent",
              }}>
                <div style={{ fontSize: 12, color: isToday ? "#042d2d" : "#475857", fontWeight: isToday ? 700 : 400 }}>
                  {fmtDay(day)}
                </div>
                <div style={{ textAlign: "center" }}>
                  {myE ? <ShiftChip duty={myE.base_duty} status={myE.status} /> : <span style={{ color: "#ccc", fontSize: 11 }}>—</span>}
                </div>
                <div style={{ textAlign: "center" }}>
                  {theirE ? <ShiftChip duty={theirE.base_duty} status={theirE.status} /> : <span style={{ color: "#ccc", fontSize: 11 }}>—</span>}
                </div>
                <div style={{ textAlign: "right" }}>
                  {/* "Request →" appears when they're free and I have a shift */}
                  {cov === "they-cover-me" && myE && (
                    <button
                      className="btn"
                      style={{ fontSize: 10, padding: "3px 8px", fontWeight: 700 }}
                      onClick={() => setRequestModal({ myDate: dateStr, myDuty: myE.base_duty, dayLabel: fmtDay(day) })}
                    >
                      Request →
                    </button>
                  )}
                  {cov === "i-cover-them"  && <span style={{ fontSize: 10, color: "#1f8a5f", fontWeight: 600 }}>You free</span>}
                  {cov === "both-free"     && <span style={{ fontSize: 10, color: "#9aa8a6" }}>Both free</span>}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        // Solo view — just my schedule for the week
        weekDays.map(day => {
          const dateStr = toISO(day);
          const entry   = myRoster[dateStr];
          const isToday = dateStr === todayISO;
          return (
            <div key={dateStr} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 2px", borderBottom: "1px solid #f0f3f2",
              background: isToday ? "#f5f9f7" : "transparent",
            }}>
              <div style={{ fontSize: 13, color: isToday ? "#042d2d" : "#475857", fontWeight: isToday ? 700 : 400 }}>
                {fmtDay(day)}
              </div>
              {entry
                ? <ShiftChip duty={entry.base_duty} status={entry.status} />
                : <span style={{ fontSize: 12, color: "#ccc" }}>Not in roster</span>}
            </div>
          );
        })
      )}

      {/* ── Compare / Swap / UDR section ─────────────────────── */}
      <div className="section-title" style={{ marginTop: 20 }}>Swap / UDR checker</div>
      <div className="card">
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475857", lineHeight: 1.6 }}>
          Pick a colleague to compare schedules. Tap <strong>Request →</strong> on any day
          where they're free and you have a shift to send a Swap or UDR request directly.
        </p>
        <select
          className="input"
          value={compareWith}
          onChange={e => setCompareWith(e.target.value)}
          style={{ marginBottom: compareWith ? 8 : 0 }}
        >
          <option value="">Select an engineer…</option>
          {team
            .filter(m => m.name !== myInitials && m.active !== false)
            .map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>

        {compareWith && (
          <div style={{ fontSize: 11, color: "#9aa8a6" }}>
            <strong style={{ color: "#042d2d" }}>Request →</strong> — they're free, could cover you ·{" "}
            <strong style={{ color: "#1f8a5f" }}>You free</strong> — you could cover them
          </div>
        )}
      </div>

      {/* ── Request modal ─────────────────────────────────────── */}
      {requestModal && (
        <RequestModal
          myDate={requestModal.myDate}
          myDuty={requestModal.myDuty}
          dayLabel={requestModal.dayLabel}
          partnerName={compareWith}
          onConfirm={(type, note) =>
            sendRequest(type, requestModal.myDate, requestModal.myDuty, note)
          }
          onClose={() => setRequestModal(null)}
        />
      )}
    </div>
  );
}

const colHead = { fontSize: 10, fontWeight: 700, color: "#7a8c8a", textTransform: "uppercase", letterSpacing: 1 };
