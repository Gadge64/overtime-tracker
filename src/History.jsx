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

export default function History({ history }) {
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
        const yesCount = h.ot_responses?.filter(r => r.answer === "yes").length ?? 0;
        const noCount  = h.ot_responses?.filter(r => r.answer === "no").length ?? 0;

        return (
          <div key={h.id} className="card">

            {/* Description + type badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 13, flex: 1, marginRight: 12, color: "#1a2e2e" }}>
                {h.description}
              </div>
              {h.status === "cancelled"
                ? <span className="badge badge-red">Cancelled</span>
                : h.immediate
                ? <span className="badge badge-grey">Immediate</span>
                : <span className="badge badge-gold">Planned</span>
              }
            </div>

            {/* Dates */}
            <div style={{ marginTop: 8, fontSize: 11, color: "#9aa8a6" }}>
              Posted: {formatDate(h.posted_at)} · Closed: {formatDate(h.closed_at)}
            </div>

            {/* Winner — only shown for closed (not cancelled) offers */}
            {h.winner?.name && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#1f8a5f", fontWeight: 600 }}>
                ✓ Awarded to {h.winner.name}
              </div>
            )}

            {/* Response breakdown — now visible in history (was missing in the original app) */}
            {(yesCount > 0 || noCount > 0) && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#9aa8a6" }}>
                {yesCount} yes · {noCount} no
              </div>
            )}

          </div>
        );
      })}
    </div>
  );
}
