// ============================================================
// About.jsx — Explains how the overtime system works
//
// Written for team members who are new to the app or want a
// refresher. Covers scoring, response windows, and tiebreakers.
// ============================================================

export default function About() {
  return (
    <div style={{ paddingBottom: 32 }}>

      {/* ── Intro ─────────────────────────────────────────── */}
      <div className="section-title">What is this?</div>
      <div className="card">
        <p style={p}>
          This app manages planned overtime offers for the AirNav SMC shift team.
          When a shift becomes available with enough notice, the co-ordinator posts
          it here. Everyone on the team gets a chance to respond, and the person
          who has done the least overtime gets priority — no racing to reply first.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          <strong style={teal}>WhatsApp is still used</strong> for short-notice cover
          (shifts starting less than 48 hours away). This app only handles planned
          offers where there is enough time for a fair response window.
        </p>
      </div>

      {/* ── The tabs ──────────────────────────────────────── */}
      <div className="section-title">The tabs</div>
      <div className="card">
        <Row label="Board"    text="The main screen. Shows the priority list and any active OT offer. This is where you tap Yes or No when overtime is available." />
        <Row label="Post OT"  text="Co-ordinators use this to post a new planned overtime opportunity. Fill in the shift details and submit — the team can then respond." />
        <Row label="History"  text="A log of all past overtime offers, who was awarded each one, and how many people said yes or no." />
        <Row label="Setup"    text="Manage the team roster — add, rename, or remove members. Co-ordinator accounts are also managed here." />
      </div>

      {/* ── Scoring ───────────────────────────────────────── */}
      <div className="section-title">How scoring works</div>
      <div className="card">
        <p style={p}>
          Everyone starts on <strong style={teal}>0 points</strong>. The lower your
          score, the higher your priority for the next shift.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e1e8e6" }}>
              <th style={th}>What you do</th>
              <th style={{ ...th, textAlign: "right" }}>Score change</th>
            </tr>
          </thead>
          <tbody>
            <ScoreRow action="Take a shift (awarded the OT)"    change="+1" colour="#c0392b" />
            <ScoreRow action="Say No"                           change="0"  colour="#7a8c8a" />
            <ScoreRow action="Don't respond"                    change="0"  colour="#7a8c8a" />
            <ScoreRow action="Say Yes but someone else gets it" change="0"  colour="#7a8c8a" last />
          </tbody>
        </table>
        <p style={{ ...p, marginBottom: 0, marginTop: 12, color: "#7a8c8a", fontSize: 11 }}>
          There are no penalties for saying No or not responding. Only taking a shift adds to your score.
        </p>
      </div>

      {/* ── Tiebreaker ────────────────────────────────────── */}
      <div className="section-title">What happens when scores are equal?</div>
      <div className="card">
        <p style={p}>If two people have the same score, the tiebreaker is applied in this order:</p>
        <ol style={{ margin: 0, paddingLeft: 20, color: "#475857", fontSize: 13, lineHeight: 1.9 }}>
          <li><strong style={teal}>Lowest score first</strong> — whoever has taken fewer shifts overall</li>
          <li><strong style={teal}>Least recent OT</strong> — if scores are equal, whoever did overtime longest ago goes next</li>
        </ol>
        <p style={{ ...p, marginBottom: 0, marginTop: 12, color: "#7a8c8a", fontSize: 11 }}>
          The result is always predictable — you can see exactly where you sit on the Board tab.
        </p>
      </div>

      {/* ── Response windows ──────────────────────────────── */}
      <div className="section-title">Response windows</div>
      <div className="card">
        <p style={p}>
          When a shift is posted, a response window opens. You have until the window
          closes to tap Yes or No — no need to rush. The window length depends on
          how soon the shift starts:
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e1e8e6" }}>
              <th style={th}>Time until shift</th>
              <th style={{ ...th, textAlign: "right" }}>Window</th>
            </tr>
          </thead>
          <tbody>
            <WindowRow label="72+ hours away"   window="24 hours" />
            <WindowRow label="48–72 hours away" window="12 hours" />
            <WindowRow label="Under 48 hours"   window="WhatsApp only" last />
          </tbody>
        </table>
        <p style={{ ...p, marginTop: 12, marginBottom: 0 }}>
          When the window closes, the co-ordinator taps <strong style={teal}>Award</strong> and
          the shift goes to whoever said Yes with the lowest score.
        </p>
      </div>

      {/* ── Identity / switching name ─────────────────────── */}
      <div className="section-title">Switching your name</div>
      <div className="card">
        <p style={{ ...p, marginBottom: 0 }}>
          Your name is shown in the top-right corner of the header. Tap it (the <strong>✕</strong>)
          to sign out and pick a different name. This is useful if someone else needs to
          use the same device.
        </p>
      </div>

    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────

const p   = { margin: "0 0 10px", color: "#475857", fontSize: 13, lineHeight: 1.7 };
const th  = { textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#7a8c8a", padding: "6px 0", fontWeight: 700 };
const teal = { color: "#042d2d" };

function Row({ label, text }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{ background: "#042d2d", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "3px 8px", borderRadius: 3, whiteSpace: "nowrap", marginTop: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#475857", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function ScoreRow({ action, change, colour, last }) {
  return (
    <tr style={{ borderBottom: last ? "none" : "1px solid #f0f3f2" }}>
      <td style={{ padding: "8px 0", fontSize: 13, color: "#475857" }}>{action}</td>
      <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 700, color: colour, textAlign: "right" }}>{change}</td>
    </tr>
  );
}

function WindowRow({ label, window, last }) {
  return (
    <tr style={{ borderBottom: last ? "none" : "1px solid #f0f3f2" }}>
      <td style={{ padding: "8px 0", fontSize: 13, color: "#475857" }}>{label}</td>
      <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 600, color: "#042d2d", textAlign: "right" }}>{window}</td>
    </tr>
  );
}
