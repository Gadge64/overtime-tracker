// ============================================================
// About.jsx — Full guide to the overtime tracker
//
// Covers: how to log in, all tabs, shift presets, the OT offer
// flow, scoring, response windows, co-ordinator tools, and FAQs.
// Written so a new engineer can pick it up with no handover.
// ============================================================

export default function About({ isMember = false }) {
  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── What is this? ──────────────────────────────────── */}
      <div className="section-title">What is this?</div>
      <div className="card">
        <p style={p}>
          This app manages planned overtime offers for the ANI SMC shift team.
          When a shift becomes available, the co-ordinator posts it here.
          Everyone gets a fair chance to respond — no racing to reply first.
          The person who has done the fewest OT hours gets priority.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          <strong style={teal}>Short-notice cover</strong> (shifts starting under 48 hours away)
          can also be posted here with a short response window picked by the co-ordinator.
        </p>
      </div>

      {/* ── Logging in ─────────────────────────────────────── */}
      <div className="section-title">Logging in</div>
      <div className="card">
        <Step n="1" text="Tap your initials on the login screen." />
        <Step n="2" text="Enter your 4-digit PIN when prompted." />
        <Step n="3" text="You're in. Your name appears in the top-right corner." />
        <p style={{ ...p, marginTop: 12, marginBottom: 4 }}>
          <strong style={teal}>Forgot your PIN?</strong> Contact the co-ordinator — they can look it up or reset your account.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          <strong style={teal}>Co-ordinators</strong> log in via the separate button at the bottom of the login screen, using their admin password.
        </p>
      </div>

      {/* ── The tabs ───────────────────────────────────────── */}
      <div className="section-title">The tabs</div>
      <div className="card">
        <Row label="Board"    text="The main screen. Shows all live OT offers, each with a respond button, and the priority board showing everyone's accumulated hours." />
        <Row label="Post OT"  text="Co-ordinators only. Post a new overtime opportunity by picking a date, selecting a shift preset, and submitting. Includes a roster check showing who will be auto-declined before you post." />
        {isMember && <Row label="Roster"  text="View your shift schedule week by week, compare your schedule with a colleague, and send Swap or UDR requests directly through the app." />}
        <Row label="History"  text="A log of every past OT offer — who was awarded it, how long the shift was, and how many people opted in or declined." />
        <Row label="Setup"    text="Manage the team roster: add members (with auto-generated PINs), rename, suspend, or remove. Co-ordinator accounts and passwords are managed here too." />
        <Row label="About"    text="This page." last />
      </div>

      {/* ── Shift presets ──────────────────────────────────── */}
      <div className="section-title">Shift presets</div>
      <div className="card">
        <p style={p}>
          When posting an OT offer, the co-ordinator picks a date and then selects
          a preset. Only presets valid for that day of the week are shown.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e1e8e6" }}>
              <th style={th}>Code</th>
              <th style={th}>Start</th>
              <th style={th}>End</th>
              <th style={th}>Duration</th>
              <th style={{ ...th, textAlign: "right" }}>Valid days</th>
            </tr>
          </thead>
          <tbody>
            <PresetRow code="E"    start="13:30" end="22:15"         dur="8h 45m"  days="Mon – Thu" />
            <PresetRow code="D1"   start="08:00" end="16:30"         dur="8h 30m"  days="Mon – Fri" />
            <PresetRow code="N"    start="22:00 ‡" end="08:15 †"     dur="10h 15m" days="Tue – Fri" />
            <PresetRow code="EW"   start="08:00" end="20:15"         dur="12h 15m" days="Sat – Sun" />
            <PresetRow code="NW"   start="20:00 ‡" end="08:15 †"     dur="12h 15m" days="Sat – Mon" />
            <PresetRow code="SBY"  start="08:00" end="13:30"         dur="5h 30m"  days="Mon – Fri" />
            <PresetRow code="E*"   start="13:30" end="20:15"         dur="6h 45m"  days="Fri only" />
            <PresetRow code="CONT" start="13:30" end="22:15"         dur="8h 45m"  days="Any day" last />
          </tbody>
        </table>
        <p style={{ ...p, marginTop: 10, marginBottom: 4, color: "#7a8c8a", fontSize: 11 }}>
          † Overnight — shift ends at 08:15 on the morning of the calendar date shown.
          The app handles this automatically when calculating hours and close times.
          Manual entry is also available if none of the presets fit.
        </p>
        <p style={{ ...p, marginBottom: 12, color: "#7a8c8a", fontSize: 11 }}>
          ‡ N and NW shifts <em>start</em> the evening before the calendar date — see note below.
        </p>
        <div style={{ padding: "10px 14px", background: "#eef3f8", borderRadius: 4, border: "1px solid #2471a333", fontSize: 12, color: "#1a2e2e", lineHeight: 1.7 }}>
          <strong>Important — N and NW calendar convention:</strong> These shifts are entered on the
          roster for the day they <em>end</em>, not the day they start. An <strong>N</strong> listed
          on Wednesday physically begins at <strong>22:00 Tuesday evening</strong> and ends 08:15
          Wednesday. An <strong>NW</strong> listed on Saturday begins at <strong>20:00 Friday
          evening</strong> and ends 08:15 Saturday. The system accounts for this in all eligibility
          checks — if you're rostered for an N or NW, the previous evening is protected automatically.
        </div>
      </div>

      {/* ── Roster eligibility ─────────────────────────────── */}
      <div className="section-title">Roster eligibility — how auto-decline works</div>
      <div className="card">
        <p style={p}>
          When the co-ordinator posts an OT offer, the system automatically cross-references
          the ANI SMC roster and declines anyone who cannot reasonably take the shift.
          If you're auto-declined, you'll see a grey <strong>Auto-declined</strong> badge
          on the Board with the reason shown underneath — no action is needed from you.
        </p>
        <p style={p}>
          Three checks are applied around the offer date (called <strong style={teal}>X</strong>),
          plus a membership check.
        </p>

        {/* Check 0 — roster membership */}
        <EligRow
          title="Roster membership"
          colour="#7a8c8a"
          text="Only engineers who appear in the current roster cycle are eligible. Anyone without a roster entry for the offer date is auto-declined regardless of other checks."
          examples={[
            { outcome: "❌", text: "No roster entry for date X → auto-declined (Not in the current roster)" },
            { outcome: "✅", text: "Has a roster entry → proceeds to the checks below" },
          ]}
        />

        {/* Check 1 */}
        <EligRow
          title="Day X — the offer itself"
          colour="#1f8a5f"
          text="Your roster entry for the offer date is checked. If you're already committed to a shift, on annual leave, on cover duty, or already working an OT shift, you're auto-declined."
          examples={[
            { outcome: "❌", text: "On annual leave → auto-declined" },
            { outcome: "❌", text: "On any shift (E, D1, N, NW, SBY, EW, Cover…) → auto-declined with that shift code as the reason" },
            { outcome: "✅", text: "On a rest day (R) → eligible to respond" },
          ]}
        />

        {/* Check 2 */}
        <EligRow
          title="Day X+1 — the day after"
          colour="#2471a3"
          text="If you have an N or NW shift on the following calendar day, you're auto-declined. N starts at 22:00 and NW at 20:00 on the same evening as the OT offer date — so your free time runs out that afternoon."
          examples={[
            { outcome: "❌", text: "N or NW on X+1 → auto-declined (shift starts tomorrow evening)" },
            { outcome: "✅", text: "Any other shift on X+1, or N/NW on X+2 — fine, enough rest either way" },
          ]}
        />

        {/* Check 3 */}
        <EligRow
          title="Day X−1 look-back — night offers only"
          colour="#1a2e6e"
          last
          text="For N and NW offers only, the previous evening is also checked. N/NW shifts begin at 22:00/20:00 on the evening before their calendar date. If you worked E (ends 22:15), EW (ends 20:15), or E* (ends 20:15) the night before, the two shifts overlap by 15 minutes — by design in the roster."
          examples={[
            { outcome: "❌", text: "E on X−1 → blocked for N or NW OT (E ends 22:15, N starts 22:00 — 15 min overlap)" },
            { outcome: "❌", text: "EW or E* on X−1 → blocked for N or NW OT (ends 20:15, NW starts 20:00 — 15 min overlap)" },
            { outcome: "✅", text: "N or NW on X−1 → fine (that shift started evening of X−2 and ended 08:15, leaving a full day's rest)" },
          ]}
        />

        <div style={{ marginTop: 14, padding: "10px 14px", background: "#f5f7f6", borderRadius: 4, border: "1px solid #e1e8e6", fontSize: 12, color: "#475857", lineHeight: 1.7 }}>
          <strong style={teal}>Roster preview (co-ordinators):</strong> On the Post OT tab, tap the
          "Roster check" line after selecting a date and shift type to see who will be
          available and who will be auto-declined — before you post the offer.
        </div>
      </div>

      {/* ── Swap / UDR checker — members only, not shown to co-ordinators ── */}
      {isMember && (
        <>
          <div className="section-title">Swap / UDR checker</div>
          <div className="card">
            <p style={p}>
              The <strong style={teal}>Roster tab</strong> lets you see your shift schedule week by week
              and compare it with a colleague's. This is the starting point for arranging a <strong>Swap</strong> or a <strong>UDR</strong>.
            </p>

            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #e1e8e6" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Straight Swap</div>
              <p style={{ ...p, marginBottom: 0 }}>
                Two engineers agree to cover each other's shifts on different dates. There is no requirement
                that the shifts are the same type — for example, an SBY can be swapped with an N.
                When you send a Swap request, no return date needs to be specified upfront.
                If the partner accepts, they bank the return shift and call it in whenever suits them.
              </p>
            </div>

            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #e1e8e6" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>UDR — Urgent Domestic Request</div>
              <p style={{ ...p, marginBottom: 0 }}>
                Essentially a day of annual leave where cover is arranged directly between two engineers,
                without going through official leave management. One engineer covers the other's shift
                with no reciprocal required. The person taking the day off sends the request; their
                colleague accepts or declines.
              </p>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>How to use it</div>
            <Step n="1" text="Go to the Roster tab and navigate to the relevant week with the ◀ ▶ arrows." />
            <Step n="2" text="Open the 'Swap / UDR checker' section and pick a colleague from the dropdown." />
            <Step n="3" text="Your schedules appear side by side. 'Request →' appears on any day where they're free and you have a shift they could cover. 'You free' appears where the opposite is true." />
            <Step n="4" text="Tap 'Request →' on the shift you'd like covered. Choose Swap (return banked, no date needed) or UDR (one-way, no return at all). Add an optional note and send." />
            <Step n="5" text="Your colleague sees the pending request on their Roster tab and taps Accept or Decline." last />

            <div style={{ marginTop: 10, fontSize: 12, color: "#7a8c8a", lineHeight: 1.6 }}>
              <strong style={teal}>Note:</strong> The checker uses the roster's rest-day (R) flag to determine
              availability. Night shift overlap rules still apply in practice — check those yourself before
              finalising a night shift swap.
            </div>
          </div>
        </>
      )}

      {/* ── The OT offer flow ──────────────────────────────── */}
      <div className="section-title">How an OT offer works — step by step</div>
      <div className="card">
        <Step n="1" text="Co-ordinator posts an offer: picks a date, selects a shift preset (or enters times manually), edits the description if needed, and taps Post." />
        <Step n="2" text="The offer appears on the Board for everyone. A response window opens automatically." />
        <Step n="3" text="Each engineer taps Opt in or Decline. You can change your response at any time before the window closes." />
        <Step n="4" text="Once the window closes — or the moment the last person responds — the system automatically awards the shift to whoever opted in with the lowest accumulated hours." />
        <Step n="5" text="A result banner appears on the Board and a brief notification pops up. The awarded shift moves to History." last />
      </div>

      {/* ── Responding ─────────────────────────────────────── */}
      <div className="section-title">Responding to an offer</div>
      <div className="card">
        <p style={p}>
          On the Board, each live offer shows your current response status and two buttons:
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, background: "#eef9f3", border: "1px solid #1f8a5f33", borderRadius: 4, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1f8a5f", marginBottom: 4 }}>Opt in</div>
            <div style={{ fontSize: 12, color: "#475857" }}>
              You want the shift. You'll be awarded it if you have the lowest hours among all who opted in.
            </div>
          </div>
          <div style={{ flex: 1, background: "#fdf0ee", border: "1px solid #c0392b33", borderRadius: 4, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#c0392b", marginBottom: 4 }}>Decline</div>
            <div style={{ fontSize: 12, color: "#475857" }}>
              You're not available. No penalty — declining never affects your hours total or priority.
            </div>
          </div>
        </div>
        <p style={{ ...p, marginBottom: 0 }}>
          Changed your mind? Tap <strong style={teal}>Change</strong> next to your current response and pick again.
          You can update as many times as you like before the window closes.
        </p>
      </div>

      {/* ── Response windows ───────────────────────────────── */}
      <div className="section-title">Response windows</div>
      <div className="card">
        <p style={p}>
          The response window is how long you have to reply before the system closes the offer.
          It's set automatically based on how far away the shift is:
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e1e8e6" }}>
              <th style={th}>Shift starts…</th>
              <th style={{ ...th, textAlign: "right" }}>Response window</th>
            </tr>
          </thead>
          <tbody>
            <WindowRow label="72+ hours away"   window="24 hours" />
            <WindowRow label="48–72 hours away" window="12 hours" />
            <WindowRow label="Under 48 hours"   window="Co-ordinator picks: 30 min / 1h / 2h / 4h" last />
          </tbody>
        </table>
        <p style={{ ...p, marginBottom: 0 }}>
          The offer closes automatically when the window expires <strong style={teal}>or</strong> when
          every active team member has responded — whichever comes first.
          The co-ordinator can also award manually at any time using the Award button.
        </p>
      </div>

      {/* ── Scoring ────────────────────────────────────────── */}
      <div className="section-title">How scoring works</div>
      <div className="card">
        <p style={p}>
          Everyone starts on <strong style={teal}>0 hours</strong>. The person with the
          fewest accumulated hours gets first pick. Longer shifts add more hours —
          so doing a 12-hour weekend shift counts for more than a 5-hour standby extension.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e1e8e6" }}>
              <th style={th}>Action</th>
              <th style={{ ...th, textAlign: "right" }}>Hours added to your total</th>
            </tr>
          </thead>
          <tbody>
            <ScoreRow action="Awarded and work the shift"         change="+ exact shift duration" colour="#c0392b" />
            <ScoreRow action="Opt in but someone else gets it"    change="0"                      colour="#7a8c8a" />
            <ScoreRow action="Decline"                            change="0"                      colour="#7a8c8a" />
            <ScoreRow action="Don't respond before window closes" change="0"                      colour="#7a8c8a" last />
          </tbody>
        </table>
        <p style={{ ...p, marginTop: 10, marginBottom: 0, color: "#7a8c8a", fontSize: 11 }}>
          Only working a shift increases your total. There are no penalties for declining or not responding.
        </p>
      </div>

      {/* ── Priority & tiebreaker ───────────────────────────── */}
      <div className="section-title">Priority order & tiebreakers</div>
      <div className="card">
        <p style={p}>When the offer closes, the system awards to the highest-priority opt-in using this order:</p>
        <ol style={{ margin: "0 0 10px", paddingLeft: 20, color: "#475857", fontSize: 13, lineHeight: 2 }}>
          <li><strong style={teal}>Lowest accumulated hours</strong> — whoever has done the least OT goes first</li>
          <li><strong style={teal}>Longest since last OT</strong> — if hours are equal, whoever did OT longest ago wins</li>
        </ol>
        <p style={{ ...p, marginBottom: 0, color: "#7a8c8a", fontSize: 11 }}>
          Your current position is always visible on the Board tab — no surprises.
        </p>
      </div>

      {/* ── Multiple live offers ────────────────────────────── */}
      <div className="section-title">Multiple offers at once</div>
      <div className="card">
        <p style={{ ...p, marginBottom: 0 }}>
          More than one OT offer can be live at the same time — for example if two shifts need covering
          on the same day, or across different days. Each offer has its own response buttons and its own
          window. Opting in to one does not affect any other. Scroll down the Board to see all active offers.
        </p>
      </div>

      {/* ── Co-ordinator guide ─────────────────────────────── */}
      <div className="section-title">Co-ordinator guide</div>
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Posting an offer</div>
        <ol style={{ margin: "0 0 14px", paddingLeft: 20, color: "#475857", fontSize: 13, lineHeight: 1.9 }}>
          <li>Go to <strong>Post OT</strong> tab</li>
          <li>Pick the shift date</li>
          <li>Select a preset (only valid presets for that day of the week appear) or choose Manual and enter start/end times</li>
          <li>Edit the description if needed — it auto-fills from the preset</li>
          <li>For shifts under 48h away, pick a short response window (30 min / 1h / 2h / 4h)</li>
          <li>Tap <strong>Post overtime offer</strong></li>
        </ol>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Awarding manually</div>
        <p style={p}>
          On the Board, the co-ordinator sees an <strong>Award</strong> button next to the top-priority
          opt-in. Tap it to close the offer early and award the shift without waiting for the window.
        </p>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Cancelling an offer</div>
        <p style={{ ...p, marginBottom: 14 }}>
          Tap <strong>Cancel this offer</strong> at the bottom of any offer card. This closes the offer with
          no winner. It appears in History marked as Cancelled.
        </p>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Adding a new team member</div>
        <ol style={{ margin: "0 0 14px", paddingLeft: 20, color: "#475857", fontSize: 13, lineHeight: 1.9 }}>
          <li>Go to <strong>Setup</strong> tab</li>
          <li>Enter the new member's name (use initials, e.g. <em>AB</em>)</li>
          <li>Tap <strong>Add member</strong> — a PIN is generated automatically</li>
          <li>Note the PIN and give it to the new member — it's only shown once</li>
        </ol>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Suspending / reinstating someone</div>
        <p style={{ ...p, marginBottom: 14 }}>
          In Setup, tap <strong>Suspend</strong> next to a member's name. They disappear from the OT roster
          and won't see or receive offers. Their score and history are preserved. Tap <strong>Reinstate</strong>
          when they return.
        </p>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#042d2d", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Changing your password</div>
        <p style={{ ...p, marginBottom: 0 }}>
          In Setup, scroll to the Co-ordinator Accounts section and tap <strong>Change password</strong>
          next to your name.
        </p>
      </div>

      {/* ── PIN ────────────────────────────────────────────── */}
      <div className="section-title">Your PIN</div>
      <div className="card">
        <p style={{ ...p, marginBottom: 0 }}>
          Each team member has a 4-digit PIN set by the co-ordinator when their account is created.
          It prevents someone accidentally selecting the wrong name on a shared device. It is
          not a security gate — contact your co-ordinator if you've forgotten it.
        </p>
      </div>

      {/* ── Suspended from roster ──────────────────────────── */}
      <div className="section-title">Suspended from OT</div>
      <div className="card">
        <p style={{ ...p, marginBottom: 0 }}>
          If you're suspended (e.g. on extended leave), you won't appear on the priority board
          and won't be able to respond to offers. Your score and history are kept intact.
          Ask the co-ordinator to reinstate you when you're back.
        </p>
      </div>

      {/* ── Signing out ────────────────────────────────────── */}
      <div className="section-title">Signing out</div>
      <div className="card">
        <p style={{ ...p, marginBottom: 0 }}>
          Tap your name <strong>✕</strong> in the top-right corner to sign out and return to the
          login screen. Useful if someone else needs to use the same device.
        </p>
      </div>

    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────

const p    = { margin: "0 0 10px", color: "#475857", fontSize: 13, lineHeight: 1.7 };
const th   = { textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#7a8c8a", padding: "6px 0", fontWeight: 700 };
const teal = { color: "#042d2d" };

function Row({ label, text, last }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: last ? 0 : 12, alignItems: "flex-start" }}>
      <div style={{ background: "#042d2d", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "3px 8px", borderRadius: 3, whiteSpace: "nowrap", marginTop: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#475857", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function Step({ n, text, last }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: last ? 0 : 10, alignItems: "flex-start" }}>
      <div style={{ background: "#042d2d", color: "#fff", fontSize: 11, fontWeight: 800, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
        {n}
      </div>
      <div style={{ fontSize: 13, color: "#475857", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function PresetRow({ code, start, end, dur, days, last }) {
  return (
    <tr style={{ borderBottom: last ? "none" : "1px solid #f0f3f2" }}>
      <td style={{ padding: "7px 0" }}>
        <span className="badge badge-gold" style={{ fontSize: 10 }}>{code}</span>
      </td>
      <td style={{ padding: "7px 6px", fontSize: 12, color: "#1a2e2e", fontWeight: 600 }}>{start}</td>
      <td style={{ padding: "7px 6px", fontSize: 12, color: "#1a2e2e", fontWeight: 600 }}>{end}</td>
      <td style={{ padding: "7px 6px", fontSize: 12, color: "#7a8c8a" }}>{dur}</td>
      <td style={{ padding: "7px 0", fontSize: 11, color: "#7a8c8a", textAlign: "right" }}>{days}</td>
    </tr>
  );
}

function ScoreRow({ action, change, colour, last }) {
  return (
    <tr style={{ borderBottom: last ? "none" : "1px solid #f0f3f2" }}>
      <td style={{ padding: "8px 0", fontSize: 13, color: "#475857" }}>{action}</td>
      <td style={{ padding: "8px 0", fontSize: 12, fontWeight: 700, color: colour, textAlign: "right", whiteSpace: "nowrap" }}>{change}</td>
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

// Eligibility check card with coloured left border, title, description, and examples
function EligRow({ title, colour, text, examples, last }) {
  return (
    <div style={{
      borderLeft: `3px solid ${colour}`, paddingLeft: 12, marginBottom: last ? 0 : 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: colour, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {title}
      </div>
      <p style={{ ...p, marginBottom: 8 }}>{text}</p>
      {examples.map((e, i) => (
        <div key={i} style={{ fontSize: 12, color: "#475857", marginBottom: 4, display: "flex", gap: 8 }}>
          <span style={{ minWidth: 18 }}>{e.outcome}</span>
          <span>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
