// ============================================================
// History.jsx — Past overtime offers tab
//
// Shows a list of all closed and cancelled offers, most recent
// first. For each offer, displays:
//   - The description and type (planned / immediate / cancelled)
//   - Posted and closed dates
//   - Who was awarded the shift (if anyone)
//   - Yes/No response breakdown
//
// Props:
//   history — array of past OT offers from Supabase, including
//             winner: { name } and ot_responses: [...]
// ============================================================

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function History({ history, team, currentUser }) {
  // History is co-ordinator only — members see a locked message
  if (currentUser?.role !== "admin") {
    return (
      <div>
        <div className="section-title">Past overtime offers</div>
        <div className="card" style={{ fontSize: 13, color: "#9aa8a6", textAlign: "center", padding: "24px 16px" }}>
          🔒 OT history is visible to co-ordinators only.
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div>
        <div className="section-title">Past overtime offers</div>
        <div style={{ color: "#9aa8a6", fontSize: 12 }}>No history yet.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">Past overtime offers</div>

      {history.map(h => {
        const responses      = h.ot_responses ?? [];
        const autoDeclined   = responses.filter(r => r.auto_declined).length;
        const yesCount       = responses.filter(r => r.answer === "yes"  && !r.auto_declined).length;
        const noCount        = responses.filter(r => r.answer === "no"   && !r.auto_declined).length;
        const activeMembers  = team?.filter(m => m.active !== false).length ?? 0;
        // Eligible = active members minus anyone auto-declined (they couldn't respond)
        const eligible       = Math.max(0, activeMembers - autoDeclined);
        const responded      = yesCount + noCount;
        const noResponse     = Math.max(0, eligible - responded);
        // Resolve winner name from team prop (avoids needing a FK join in the query)
        const winnerName = h.winner_id ? team?.find(m => m.id === h.winner_id)?.name : null;

        return (
          <div key={h.id} className="card">

            {/* Description + shift type badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: 13, flex: 1, color: "#1a2e2e" }}>
                {h.description}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {h.shift_type && <span className="badge badge-gold">{h.shift_type}</span>}
                {h.status === "cancelled"
                  ? <span className="badge badge-red">Cancelled</span>
                  : <span className="badge badge-grey">Closed</span>
                }
              </div>
            </div>

            {/* Dates */}
            <div style={{ marginTop: 8, fontSize: 11, color: "#9aa8a6" }}>
              Posted: {formatDate(h.posted_at)} · Closed: {formatDate(h.closed_at)}
            </div>

            {/* Winner — only shown for closed (not cancelled) offers */}
            {winnerName && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#1f8a5f", fontWeight: 600 }}>
                ✓ Awarded to {winnerName}
                {/* Show shift duration (hours added to their total) */}
                {h.shift_hours != null && (
                  <span style={{ fontWeight: 400, color: "#7a8c8a", marginLeft: 6 }}>
                    · +{Number(h.shift_hours).toFixed(2)}h
                  </span>
                )}
              </div>
            )}

            {/* Response breakdown */}
            {responses.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#9aa8a6", display: "flex", flexWrap: "wrap", gap: "0 12px" }}>
                {yesCount   > 0 && <span style={{ color: "#1f8a5f" }}>✓ {yesCount} opted in</span>}
                {noCount    > 0 && <span>✗ {noCount} declined</span>}
                {autoDeclined > 0 && <span>⊘ {autoDeclined} auto-declined</span>}
                {noResponse > 0 && <span>— {noResponse} no response</span>}
              </div>
            )}

          </div>
        );
      })}
    </div>
  );
}
