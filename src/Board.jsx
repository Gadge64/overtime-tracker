// ============================================================
// Board.jsx — Priority board tab
//
// Shows two things:
//   1. Active OT offer (if one exists) — with yes/no response
//      buttons for the current user, a full team response list,
//      and an "Award" button for whoever has priority.
//   2. Priority board — all team members sorted by score, so
//      everyone can see who's next in line.
//
// Props:
//   team        — array of team members (already sorted by score)
//   activeOffer — the open OT offer from Supabase, or null
//   currentUser — { id, name } of the person using this device
//   onRespond   — fn(memberId, 'yes'|'no')
//   onCloseOT   — fn(winnerId) — awards the shift
//   onCancelOT  — fn() — cancels without awarding
// ============================================================

import { useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Returns a human-readable "how long ago" string for the priority board
function timeAgo(ts) {
  if (!ts) return null;
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function Board({ team, activeOffer, currentUser, onRespond, onCloseOT, onCancelOT }) {
  const [showExplainer, setShowExplainer] = useState(false);

  // Sort team by score ascending, last_ot ascending as tiebreaker.
  // Supabase already returns them sorted, but we re-sort client-side
  // so the board stays correct while realtime updates are in flight.
  const ranked = [...team].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return new Date(a.last_ot || 0) - new Date(b.last_ot || 0);
  });

  // Build the window close label shown under the offer heading
  let windowLabel = null;
  if (activeOffer?.immediate) {
    windowLabel = "🚨 IMMEDIATE — First come, first served (no scores affected)";
  } else if (activeOffer?.closes_at) {
    const t = new Date(activeOffer.closes_at);
    windowLabel = `⏱ Window closes: ${t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${t.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }

  // Find the current user's response to the active offer (if any)
  const myResponse = activeOffer?.ot_responses?.find(r => r.member_id === currentUser.id);

  // Build yes-responders list.
  // IMPORTANT: sorting differs by offer type:
  //   - Planned OT  → sort by score rank (lowest score = highest priority)
  //   - Immediate OT → sort by responded_at (first to say yes wins)
  // This fixes a bug in the original app where immediate offers used score
  // order instead of response-time order.
  const yesResponders = (() => {
    if (!activeOffer) return [];

    const responses = activeOffer.ot_responses ?? [];
    const yesMemberIds = new Set(
      responses.filter(r => r.answer === "yes").map(r => r.member_id)
    );
    const yesMembers = ranked.filter(m => yesMemberIds.has(m.id));

    if (activeOffer.immediate) {
      // First come, first served — sort by the time they responded
      return yesMembers.sort((a, b) => {
        const aTime = responses.find(r => r.member_id === a.id)?.responded_at;
        const bTime = responses.find(r => r.member_id === b.id)?.responded_at;
        return new Date(aTime) - new Date(bTime);
      });
    }

    // Planned OT — already in score order from `ranked`
    return yesMembers;
  })();

  return (
    <div>

      {/* ── "How does this work?" toggle ───────────────────── */}
      <button
        className="btn"
        style={{ marginBottom: 14, fontSize: 10 }}
        onClick={() => setShowExplainer(v => !v)}
      >
        {showExplainer ? "▲ Hide" : "▼ How does this work?"}
      </button>

      {showExplainer && (
        <div className="explainer-box">
          <h3>How the system works</h3>
          <p>
            <strong style={{ color: "#042d2d" }}>The basic idea:</strong> Overtime is offered
            fairly. Everyone gets a chance to respond. The person who has done the least recent
            overtime gets priority.
          </p>
          <ul>
            <li>When overtime comes up, it's posted here with a response window.</li>
            <li>Tap <strong style={{ color: "#1f8a5f" }}>Yes</strong> or <strong style={{ color: "#c0392b" }}>No</strong> — no racing to reply first.</li>
            <li>When the window closes, whoever said Yes with the <strong style={{ color: "#042d2d" }}>lowest score</strong> gets it.</li>
          </ul>
          <p><strong style={{ color: "#042d2d" }}>Scores:</strong></p>
          <ul>
            <li>+1 point if you <strong style={{ color: "#042d2d" }}>take a shift</strong> — you move down the priority list</li>
            <li>0 points for everything else — declining, not responding, missing out. No penalties.</li>
          </ul>
          <p><strong style={{ color: "#042d2d" }}>Response windows:</strong></p>
          <ul>
            <li>Shift 72+ hrs away → 24 hour window</li>
            <li>Shift 48–72 hrs away → 12 hour window</li>
            <li>Shift under 48 hrs → handled on WhatsApp, not posted here</li>
            <li>🚨 Immediate cover needed → first come first served, scores unaffected</li>
          </ul>
          <p style={{ color: "#7a8c8a", fontSize: 11 }}>
            Scores reset every 3 months so nothing carries on forever.
          </p>
        </div>
      )}

      {/* ── Active OT offer ───────────────────────────────── */}
      {activeOffer && (
        <div className="ot-alert">
          <h3>⚡ OVERTIME AVAILABLE</h3>
          <div style={{ fontSize: 13, marginBottom: 6, color: "#1a2e2e" }}>
            {activeOffer.description}
          </div>
          <div style={{ fontSize: 11, color: "#7a8c8a", marginBottom: 12 }}>
            {windowLabel}
          </div>

          {/* ── Current user's response buttons ──────────── */}
          {/* Admins are not eligible for OT — only team members get response buttons */}
          {currentUser.role === "member" && (
            <>
              <div className="section-title">Your response</div>
              <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                <span style={{ fontSize: 13, color: "#1a2e2e", fontWeight: 500 }}>
                  {currentUser.name} <span style={{ color: "#9aa8a6" }}>(you)</span>
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {myResponse ? (
                    <span className={`badge ${myResponse.answer === "yes" ? "badge-green" : "badge-red"}`}>
                      {myResponse.answer === "yes" ? "✓ Yes" : "✗ No"}
                    </span>
                  ) : (
                    <>
                      <button className="btn yes" style={{ padding: "5px 12px" }} onClick={() => onRespond(currentUser.id, "yes")}>Yes</button>
                      <button className="btn no"  style={{ padding: "5px 12px" }} onClick={() => onRespond(currentUser.id, "no")}>No</button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Full team response status ─────────────────── */}
          {/* Shows everyone's status so the supervisor knows who still needs to respond */}
          <div className="section-title">Team responses</div>
          {ranked.map(m => {
            const resp = activeOffer.ot_responses?.find(r => r.member_id === m.id);
            return (
              <div
                key={m.id}
                className="card"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}
              >
                <span style={{ fontSize: 13, color: "#1a2e2e", fontWeight: 500 }}>
                  {m.name}
                  {m.id === currentUser.id && <span style={{ color: "#9aa8a6" }}> (you)</span>}
                </span>
                {resp ? (
                  <span className={`badge ${resp.answer === "yes" ? "badge-green" : "badge-red"}`}>
                    {resp.answer === "yes" ? "✓ Yes" : "✗ No"}
                  </span>
                ) : (
                  <span className="badge badge-grey">Waiting</span>
                )}
              </div>
            );
          })}

          {/* ── Award section — planned offers ───────────── */}
          {!activeOffer.immediate && yesResponders.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="section-title">Close window & award shift</div>
              <div style={{ fontSize: 11, color: "#7a8c8a", marginBottom: 10 }}>
                Priority order (lowest score first):
              </div>
              {yesResponders.map((m, i) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12 }}>
                    <span style={{ color: i === 0 ? "#042d2d" : "#9aa8a6", marginRight: 8, fontWeight: i === 0 ? 700 : 400 }}>
                      {i === 0 ? "★" : `${i + 1}.`}
                    </span>
                    {m.name} <span style={{ color: "#9aa8a6" }}>({m.score} pts)</span>
                  </span>
                  {/* Only show Award for the top-priority person */}
                  {i === 0 && (
                    <button className="btn primary" style={{ padding: "5px 14px" }} onClick={() => onCloseOT(m.id)}>
                      Award
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Award section — immediate offers ─────────── */}
          {/* Immediate = first to say yes wins, regardless of score */}
          {activeOffer.immediate && (
            <div style={{ marginTop: 14 }}>
              <div className="section-title">Award to first responder</div>
              {yesResponders.length > 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#1f8a5f", fontWeight: 600 }}>
                    {yesResponders[0].name} responded first
                  </span>
                  <button className="btn primary" onClick={() => onCloseOT(yesResponders[0].id)}>
                    Award
                  </button>
                </div>
              ) : (
                <div style={{ color: "#9aa8a6", fontSize: 12 }}>No responses yet</div>
              )}
            </div>
          )}

          <hr className="divider" />
          <button className="btn danger" style={{ fontSize: 10 }} onClick={onCancelOT}>
            Cancel this offer
          </button>
        </div>
      )}

      {/* ── Priority board ────────────────────────────────── */}
      <div className="section-title">Priority board — lowest score goes first</div>
      {ranked.map((m, i) => (
        <div key={m.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className={`rank-num ${i === 0 ? "top" : ""}`}>
            {String(i + 1).padStart(2, "0")}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, marginBottom: 3, fontWeight: 600, color: "#1a2e2e" }}>
              {m.name}
              {m.id === currentUser.id && <span style={{ fontSize: 11, color: "#9aa8a6", fontWeight: 400 }}> (you)</span>}
            </div>
            <div style={{ fontSize: 11, color: "#9aa8a6" }}>
              Last OT: {timeAgo(m.last_ot) ?? "never"}
            </div>
          </div>
          {/* Score — colour-coded: green=0, teal=low, red=high */}
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'Archivo', sans-serif",
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1,
              color: m.score === 0 ? "#1f8a5f" : m.score < 4 ? "#042d2d" : "#c0392b",
            }}>
              {m.score}
            </div>
            <div style={{ fontSize: 9, color: "#9aa8a6", letterSpacing: 1, fontWeight: 600 }}>PTS</div>
          </div>
        </div>
      ))}

    </div>
  );
}
