// ============================================================
// Board.jsx — Priority board tab
//
// Shows:
//   1. Recently auto-awarded offers (last 30 min) — green result banners
//   2. All currently open OT offers — each with response buttons,
//      team response list, and (for admins) award/cancel controls
//   3. Priority board — all active team members sorted by accumulated hours
//
// Multiple offers can be live simultaneously.
// Offers auto-close when the window expires or when all members have responded.
//
// Props:
//   team         — full array of team members (includes active flag)
//   history      — array of past closed offers
//   activeOffers — open offers + recently closed/cancelled (last 30 min)
//   currentUser  — { id, name, role }
//   onRespond    — fn(offerId, memberId, 'yes'|'no')
//   onCloseOT    — fn(offerId, winnerId)
//   onCancelOT   — fn(offerId)
// ============================================================

import { useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(ts) {
  if (!ts) return null;
  const days = Math.floor((Date.now() - new Date(ts)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// Format decimal hours as "8h 45m"
function fmtHours(h) {
  if (h == null) return "—";
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

// Format score (accumulated hours) for display
function fmtScore(s) {
  return Number(s || 0).toFixed(1);
}

// ─── Per-person history modal ─────────────────────────────────────────────

function MemberHistoryModal({ member, history, onClose }) {
  const theirShifts = history.filter(o => o.status === "closed" && o.winner_id === member.id);

  return (
    <div className="password-overlay" onClick={onClose}>
      <div className="password-box" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 18, fontWeight: 700, color: "#042d2d" }}>
              {member.name}
            </div>
            <div style={{ fontSize: 11, color: "#7a8c8a", marginTop: 2 }}>
              {theirShifts.length} OT shift{theirShifts.length !== 1 ? "s" : ""} worked · {fmtScore(member.score)} hrs
            </div>
          </div>
          <button className="btn" style={{ padding: "5px 10px" }} onClick={onClose}>✕</button>
        </div>

        {theirShifts.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9aa8a6", textAlign: "center", padding: "20px 0" }}>
            No overtime shifts recorded yet.
          </div>
        ) : (
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {theirShifts.map(o => (
              <div key={o.id} style={{ borderBottom: "1px solid #e1e8e6", padding: "10px 0" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2e2e" }}>{o.description}</div>
                <div style={{ fontSize: 11, color: "#7a8c8a", marginTop: 2 }}>
                  {o.shift_time ? `Shift: ${formatDate(o.shift_time)}` : `Awarded: ${formatDate(o.closed_at)}`}
                  {o.shift_hours != null && <span style={{ marginLeft: 8 }}>· {fmtHours(o.shift_hours)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recently awarded banner ──────────────────────────────────────────────
// Shown for offers that auto-closed in the last 30 min so the result is
// visible on the Board without needing to check History.

function RecentlyClosedCard({ offer, team }) {
  // Resolve winner name from the team array (avoids needing a FK join in the query)
  const winnerName = offer.winner_id ? team.find(m => m.id === offer.winner_id)?.name : null;
  const awarded    = offer.status === "closed" && !!winnerName;
  const cancelled  = offer.status === "cancelled" || !awarded;

  return (
    <div style={{
      background: awarded ? "#eef9f3" : "#fdf0ee",
      border: `1px solid ${awarded ? "#1f8a5f33" : "#c0392b33"}`,
      borderLeft: `4px solid ${awarded ? "#1f8a5f" : "#c0392b"}`,
      borderRadius: 4,
      padding: "12px 16px",
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: awarded ? "#1f8a5f" : "#c0392b", fontWeight: 700, marginBottom: 4 }}>
        {awarded ? "Awarded" : "No takers — cancelled"}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2e2e" }}>{offer.description}</div>
      {awarded && (
        <div style={{ fontSize: 13, color: "#1f8a5f", fontWeight: 600, marginTop: 4 }}>
          ✓ {winnerName}
          {offer.shift_hours != null && (
            <span style={{ fontWeight: 400, color: "#7a8c8a", marginLeft: 8 }}>· {fmtHours(offer.shift_hours)}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Single active offer card ─────────────────────────────────────────────
// One instance of this is rendered for each open OT offer.

function OfferCard({ offer, ranked, currentUser, currentUserIsActive, isAdmin, onRespond, onCloseOT, onCancelOT }) {
  const myResponse = offer.ot_responses?.find(r => r.member_id === currentUser.id);
  // changing=true shows the buttons again so the member can update their response
  const [changing, setChanging] = useState(false);

  // Window label shown at the top of the card
  let windowLabel = null;
  if (offer.closes_at) {
    const t = new Date(offer.closes_at);
    windowLabel = `⏱ Window closes: ${t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${t.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  } else {
    windowLabel = "⏱ No automatic window — award manually when ready";
  }

  // Shift time range display
  const shiftTimeLabel = (() => {
    if (!offer.shift_time) return null;
    const start = new Date(offer.shift_time);
    const startStr = start.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    if (offer.shift_end) {
      const end = new Date(offer.shift_end);
      const endStr = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const sameDay = start.toDateString() === end.toDateString();
      return sameDay ? `${startStr} – ${endStr}` : `${startStr} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${endStr}`;
    }
    return startStr;
  })();

  // Members who said yes, in priority order
  const yesResponders = (() => {
    const responses = offer.ot_responses ?? [];
    const yesMemberIds = new Set(responses.filter(r => r.answer === "yes").map(r => r.member_id));
    return ranked.filter(m => yesMemberIds.has(m.id));  // ranked is already sorted lowest score first
  })();

  // How many active members still haven't responded
  const respondedCount = offer.ot_responses?.length ?? 0;
  const pendingCount   = ranked.length - respondedCount;

  return (
    <div className="ot-alert" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0 }}>⚡ {offer.shift_type ? `${offer.shift_type} — ` : ""}{offer.description}</h3>
        {offer.shift_type && (
          <span className="badge badge-gold" style={{ flexShrink: 0 }}>{offer.shift_type}</span>
        )}
      </div>

      {/* Shift time and duration */}
      {shiftTimeLabel && (
        <div style={{ fontSize: 12, color: "#1a2e2e", marginTop: 6 }}>
          {shiftTimeLabel}
          {offer.shift_hours != null && (
            <span style={{ color: "#7a8c8a", marginLeft: 8 }}>· {fmtHours(offer.shift_hours)}</span>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#7a8c8a", marginTop: 4, marginBottom: 12 }}>
        {windowLabel}
        {pendingCount > 0 && (
          <span style={{ marginLeft: 10 }}>· {pendingCount} member{pendingCount !== 1 ? "s" : ""} yet to respond</span>
        )}
      </div>

      {/* ── Current user's response ───────────────────────── */}
      {currentUser.role === "member" && (
        <>
          <div className="section-title">Your response</div>
          {!currentUserIsActive ? (
            <div className="card" style={{ padding: "10px 14px", fontSize: 12, color: "#c0392b" }}>
              You are currently suspended from the overtime roster. Contact your co-ordinator.
            </div>
          ) : (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#1a2e2e" }}>
                {currentUser.name} <span style={{ color: "#9aa8a6" }}>(you)</span>
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {myResponse && !changing ? (
                  // auto_declined = roster said unavailable; show reason, no Change button
                  myResponse.auto_declined ? (
                    <div style={{ textAlign: "right" }}>
                      <span className="badge badge-grey">Auto-declined</span>
                      {myResponse.decline_reason && (
                        <div style={{ fontSize: 10, color: "#9aa8a6", marginTop: 3, maxWidth: 180, lineHeight: 1.4 }}>
                          {myResponse.decline_reason}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Manual response — show badge + option to change
                    <>
                      <span className={`badge ${myResponse.answer === "yes" ? "badge-green" : "badge-red"}`}>
                        {myResponse.answer === "yes" ? "✓ Opted in" : "✗ Declined"}
                      </span>
                      <button className="btn" style={{ padding: "3px 10px", fontSize: 11 }} onClick={() => setChanging(true)}>
                        Change
                      </button>
                    </>
                  )
                ) : (
                  <>
                    <button className="btn yes" style={{ padding: "5px 14px" }} onClick={() => { onRespond(currentUser.id, "yes"); setChanging(false); }}>Opt in</button>
                    <button className="btn no"  style={{ padding: "5px 14px" }} onClick={() => { onRespond(currentUser.id, "no");  setChanging(false); }}>Decline</button>
                    {changing && (
                      <button className="btn" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setChanging(false)}>Cancel</button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Team response list ────────────────────────────── */}
      {/* Co-ordinators see the full breakdown; members only see a count */}
      <div className="section-title">Team responses</div>
      {isAdmin ? (
        ranked.map(m => {
          const resp = offer.ot_responses?.find(r => r.member_id === m.id);
          return (
            <div key={m.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
              <span style={{ fontSize: 13, color: "#1a2e2e", fontWeight: 500 }}>
                {m.name}
                {m.id === currentUser.id && <span style={{ color: "#9aa8a6" }}> (you)</span>}
              </span>
              {resp ? (
                resp.auto_declined ? (
                  <div style={{ textAlign: "right" }}>
                    <span className="badge badge-grey">Auto-declined</span>
                    {resp.decline_reason && (
                      <div style={{ fontSize: 10, color: "#9aa8a6", marginTop: 2, maxWidth: 160, lineHeight: 1.3 }}>
                        {resp.decline_reason}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={`badge ${resp.answer === "yes" ? "badge-green" : "badge-red"}`}>
                    {resp.answer === "yes" ? "✓ In" : "✗ Declined"}
                  </span>
                )
              ) : (
                <span className="badge badge-grey">Waiting</span>
              )}
            </div>
          );
        })
      ) : (
        // Members only see a count — individual responses are co-ordinator only
        <div className="card" style={{ padding: "10px 14px", fontSize: 13, color: "#7a8c8a" }}>
          {offer.ot_responses?.length ?? 0} of {ranked.length} members responded
          {pendingCount > 0 && ` · ${pendingCount} still to reply`}
        </div>
      )}

      {/* ── Co-ordinator award section ────────────────────── */}
      {isAdmin && yesResponders.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title">Award shift (priority order)</div>
          {yesResponders.map((m, i) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>
                <span style={{ color: i === 0 ? "#042d2d" : "#9aa8a6", marginRight: 8, fontWeight: i === 0 ? 700 : 400 }}>
                  {i === 0 ? "★" : `${i + 1}.`}
                </span>
                {m.name} <span style={{ color: "#9aa8a6" }}>({fmtScore(m.score)} hrs)</span>
              </span>
              {i === 0 && (
                <button className="btn primary" style={{ padding: "5px 14px" }} onClick={() => onCloseOT(m.id)}>
                  Award
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && yesResponders.length === 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#9aa8a6" }}>
          No opt-ins yet — the system will auto-award when the window closes or everyone responds.
        </div>
      )}

      {/* Cancel — co-ordinator only */}
      {isAdmin && (
        <>
          <hr className="divider" />
          <button className="btn danger" style={{ fontSize: 10 }} onClick={onCancelOT}>
            Cancel this offer
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main Board component ─────────────────────────────────────────────────

export default function Board({ team, history, activeOffers, currentUser, onRespond, onCloseOT, onCancelOT }) {
  const [showExplainer,  setShowExplainer]  = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const isAdmin = currentUser.role === "admin";

  // Only active (non-suspended) members appear on the board and in offer responses
  const ranked = [...team]
    .filter(m => m.active !== false)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return new Date(a.last_ot || 0) - new Date(b.last_ot || 0);
    });

  // Check whether the logged-in team member is on the active roster
  const currentMemberRecord = team.find(m => m.id === currentUser.id);
  const currentUserIsActive = !currentMemberRecord || currentMemberRecord.active !== false;

  // Split into open offers and recently-closed result banners
  const openOffers     = activeOffers.filter(o => o.status === "open");
  const recentlyClosed = activeOffers.filter(o => o.status !== "open");

  return (
    <div>

      {/* ── Explainer toggle ───────────────────────────────── */}
      <button className="btn" style={{ marginBottom: 14, fontSize: 10 }} onClick={() => setShowExplainer(v => !v)}>
        {showExplainer ? "▲ Hide" : "▼ How does this work?"}
      </button>

      {showExplainer && (
        <div className="explainer-box">
          <h3>How the system works</h3>
          <p>
            <strong style={{ color: "#042d2d" }}>The basic idea:</strong> Overtime is offered fairly.
            Everyone gets a chance to respond. The person with the fewest accumulated hours gets priority.
          </p>
          <ul>
            <li>When overtime comes up, the co-ordinator posts it here with a response window.</li>
            <li>Tap <strong style={{ color: "#1f8a5f" }}>Opt in</strong> or <strong style={{ color: "#c0392b" }}>Decline</strong> — no racing to reply first.</li>
            <li>Once everyone has responded (or the window closes), the system automatically awards the shift to whoever opted in with the <strong style={{ color: "#042d2d" }}>lowest hours total</strong>.</li>
            <li>Your score increases by the length of each shift you work — longer shifts add more hours.</li>
          </ul>
          <p><strong style={{ color: "#042d2d" }}>Response windows:</strong></p>
          <ul>
            <li>Shift 72+ hrs away → 24 hour window</li>
            <li>Shift 48–72 hrs away → 12 hour window</li>
            <li>Shift under 48 hrs → no automatic window; co-ordinator awards manually</li>
          </ul>
        </div>
      )}

      {/* ── Recently awarded results ───────────────────────── */}
      {recentlyClosed.length > 0 && (
        <>
          <div className="section-title">Recently closed</div>
          {recentlyClosed.map(o => <RecentlyClosedCard key={o.id} offer={o} team={team} />)}
        </>
      )}

      {/* ── Open OT offers ─────────────────────────────────── */}
      {openOffers.length > 0 ? (
        openOffers.map(offer => (
          <OfferCard
            key={offer.id}
            offer={offer}
            ranked={ranked}
            currentUser={currentUser}
            currentUserIsActive={currentUserIsActive}
            isAdmin={isAdmin}
            onRespond={(memberId, answer) => onRespond(offer.id, memberId, answer)}
            onCloseOT={(winnerId) => onCloseOT(offer.id, winnerId)}
            onCancelOT={() => onCancelOT(offer.id)}
          />
        ))
      ) : recentlyClosed.length === 0 ? (
        <div className="card" style={{ color: "#9aa8a6", fontSize: 13 }}>
          No overtime offers currently active.
        </div>
      ) : null}

      {/* ── Priority board ─────────────────────────────────── */}
      <div className="section-title">Priority board — fewest hours goes first</div>
      {isAdmin && (
        <div style={{ fontSize: 11, color: "#9aa8a6", marginBottom: 10 }}>
          Tap a name to see their overtime history.
        </div>
      )}

      {ranked.map((m, i) => (
        <div
          key={m.id}
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 14, cursor: isAdmin ? "pointer" : "default" }}
          onClick={() => isAdmin && setSelectedMember(m)}
        >
          <div className={`rank-num ${i === 0 ? "top" : ""}`}>
            {String(i + 1).padStart(2, "0")}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, marginBottom: 3, fontWeight: 600, color: "#1a2e2e" }}>
              {m.name}
              {m.id === currentUser.id && <span style={{ fontSize: 11, color: "#9aa8a6", fontWeight: 400 }}> (you)</span>}
            </div>
            <div style={{ fontSize: 11, color: "#9aa8a6" }}>Last OT: {timeAgo(m.last_ot) ?? "never"}</div>
          </div>
          {/* Score = accumulated hours worked */}
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'Archivo', sans-serif",
              fontSize: 22, fontWeight: 800, lineHeight: 1,
              color: Number(m.score) === 0 ? "#1f8a5f" : Number(m.score) < 30 ? "#042d2d" : "#c0392b",
            }}>
              {fmtScore(m.score)}
            </div>
            <div style={{ fontSize: 9, color: "#9aa8a6", letterSpacing: 1, fontWeight: 600 }}>HRS</div>
          </div>
        </div>
      ))}

      {/* Per-person history modal */}
      {selectedMember && (
        <MemberHistoryModal
          member={selectedMember}
          history={history}
          onClose={() => setSelectedMember(null)}
        />
      )}

    </div>
  );
}
