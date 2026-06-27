// ============================================================
// App.jsx — Root component
//
// Three jobs:
//   1. Auth gate — team members tap their name and enter a 4-digit PIN.
//      Co-ordinators have a separate password-protected login.
//
//   2. Data layer — fetches team_members, admins, active offers, and history
//      from Supabase. Realtime subscriptions keep every device in sync.
//      Multiple OT offers can be live simultaneously.
//
//   3. Actions — all DB writes live here and are passed as props to tabs.
//
// Auto-close logic:
//   - Every 30s the client calls auto_close_expired_offers() — a DB function
//     that closes any offer whose response window has passed, awarding to the
//     top-priority yes-responder (or cancelling if none).
//   - After each member responds, check_and_close_if_complete() checks if
//     everyone has answered and closes/awards immediately if so.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import Board   from "./Board";
import PostOT  from "./PostOT";
import History from "./History";
import Setup   from "./Setup";
import About   from "./About";
import Roster  from "./Roster";
import "./styles.css";

const CURRENT_USER_KEY = "ot-current-user";


// ─── Password hashing ────────────────────────────────────────────────────
// SHA-256 via Web Crypto API. Only the hash is stored; never plain text.
// Member PINs are stored as plain text (convenience feature, not security gate).

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Auth screen ─────────────────────────────────────────────────────────
// Team member grid → PIN prompt → logged in
// Co-ordinator button → password prompt → logged in as admin

function AuthScreen({ team, admins, onSelectMember, onSelectAdmin }) {
  const [pendingAdmin,  setPendingAdmin]  = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [checking,      setChecking]      = useState(false);

  const [pendingMember, setPendingMember] = useState(null);
  const [pinInput,      setPinInput]      = useState("");
  const [pinError,      setPinError]      = useState(false);

  async function handleAdminLogin(e) {
    e.preventDefault();
    if (!pendingAdmin || !passwordInput) return;
    setChecking(true);
    setPasswordError(false);
    const hash = await hashPassword(passwordInput);
    if (hash === pendingAdmin.password_hash) {
      onSelectAdmin(pendingAdmin);
    } else {
      setPasswordError(true);
      setPasswordInput("");
    }
    setChecking(false);
  }

  function handleMemberPinSubmit(e) {
    e.preventDefault();
    if (!pendingMember || pinInput.length !== 4) return;
    if (pinInput === pendingMember.pin) {
      onSelectMember(pendingMember);
    } else {
      setPinError(true);
      setPinInput("");
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-title">OVERTIME TRACKER</div>
      <div className="auth-subtitle">Who are you? Tap your name to continue.</div>

      <div className="auth-grid">
        {[...team].sort((a, b) => a.name.localeCompare(b.name)).map(m => (
          <button
            key={m.id}
            className="auth-name-btn"
            onClick={() => { setPendingMember(m); setPinInput(""); setPinError(false); }}
          >
            {m.name}
          </button>
        ))}
      </div>

      {admins.length > 0 && (
        <div style={{ width: "100%", maxWidth: 320, marginTop: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 12, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#7a8c8a", fontWeight: 700 }}>
            Co-ordinator
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {admins.map(a => (
              <button key={a.id} className="auth-name-btn" style={{ flex: 1 }}
                onClick={() => { setPendingAdmin(a); setPasswordInput(""); setPasswordError(false); }}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin password modal */}
      {pendingAdmin && (
        <div className="password-overlay" onClick={() => { setPendingAdmin(null); setPasswordInput(""); setPasswordError(false); }}>
          <div className="password-box" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 18, fontWeight: 700, color: "#042d2d", marginBottom: 4 }}>Co-ordinator Login</div>
            <div style={{ fontSize: 12, color: "#7a8c8a", marginBottom: 20 }}>Enter the admin password to continue.</div>
            <form onSubmit={handleAdminLogin}>
              <input className="input" type="password" placeholder="Password" value={passwordInput}
                onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
                autoFocus style={{ marginBottom: 8 }} />
              {passwordError && <div style={{ fontSize: 11, color: "#c0392b", marginBottom: 8, fontWeight: 600 }}>Incorrect password. Try again.</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button className="btn primary" type="submit" disabled={!passwordInput || checking} style={{ flex: 1 }}>
                  {checking ? "Checking…" : "Login"}
                </button>
                <button className="btn" type="button" onClick={() => { setPendingAdmin(null); setPasswordInput(""); setPasswordError(false); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member PIN modal */}
      {pendingMember && (
        <div className="password-overlay" onClick={() => { setPendingMember(null); setPinInput(""); setPinError(false); }}>
          <div className="password-box" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 18, fontWeight: 700, color: "#042d2d", marginBottom: 4 }}>
              Welcome, {pendingMember.name}
            </div>
            <div style={{ fontSize: 12, color: "#7a8c8a", marginBottom: 20 }}>Enter your 4-digit PIN to continue.</div>
            <form onSubmit={handleMemberPinSubmit}>
              <input className="input" type="password" inputMode="numeric" maxLength={4}
                placeholder="• • • •" value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(false); }}
                autoFocus style={{ marginBottom: 8, letterSpacing: 10, textAlign: "center", fontSize: 20 }} />
              {pinError && <div style={{ fontSize: 11, color: "#c0392b", marginBottom: 8, fontWeight: 600 }}>Incorrect PIN. Try again.</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button className="btn primary" type="submit" disabled={pinInput.length !== 4} style={{ flex: 1 }}>Continue</button>
                <button className="btn" type="button" onClick={() => { setPendingMember(null); setPinInput(""); setPinError(false); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("board");

  const [team,         setTeam]         = useState([]);
  const [admins,       setAdmins]       = useState([]);
  const [activeOffers, setActiveOffers] = useState([]);
  const [history,      setHistory]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  // toast: { message, type } | null — shown for 4s when a shift is auto-awarded
  const [toast, setToast] = useState(null);
  // teamRef lets the realtime callback look up winner names without a stale closure
  const teamRef = useRef([]);

  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)); }
    catch { return null; }
  });

  // ── Data fetching ───────────────────────────────────────────────────────

  // Keep teamRef in sync so realtime callbacks can look up names without stale closures
  useEffect(() => { teamRef.current = team; }, [team]);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("score",   { ascending: true })
      .order("last_ot", { ascending: true, nullsFirst: true });
    if (error) { console.error("fetchTeam:", error); return; }
    setTeam(data);
  }, []);

  const fetchAdmins = useCallback(async () => {
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) { console.error("fetchAdmins:", error); return; }
    setAdmins(data);
  }, []);

  // Fetches all open offers AND recently closed/cancelled (last 30 min).
  // Uses flat select("*") with no embedded joins (joins can silently return null
  // if FK constraint names don't match). Responses are fetched separately and
  // merged in JS so the Board can show who has responded to each offer.
  const fetchActiveOffers = useCallback(async () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60_000).toISOString();

    const [openRes, recentRes] = await Promise.all([
      supabase.from("ot_offers").select("*").eq("status", "open").order("shift_time", { ascending: true }),
      supabase.from("ot_offers").select("*").in("status", ["closed", "cancelled"]).gte("closed_at", thirtyMinsAgo).order("closed_at", { ascending: false }).limit(10),
    ]);

    if (openRes.error)   console.error("fetchActiveOffers (open):",   openRes.error);
    if (recentRes.error) console.error("fetchActiveOffers (recent):", recentRes.error);

    const allOffers = [...(openRes.data || []), ...(recentRes.data || [])];

    if (allOffers.length === 0) { setActiveOffers([]); return; }

    // Fetch responses for these offers in one flat query — no FK joins needed
    const offerIds = allOffers.map(o => o.id);
    const { data: responses, error: respErr } = await supabase
      .from("ot_responses")
      .select("*")
      .in("offer_id", offerIds);

    if (respErr) console.error("fetchActiveOffers (responses):", respErr);

    // Group responses by offer_id and attach to each offer
    const byOffer = {};
    for (const r of (responses || [])) {
      if (!byOffer[r.offer_id]) byOffer[r.offer_id] = [];
      byOffer[r.offer_id].push(r);
    }

    setActiveOffers(allOffers.map(o => ({ ...o, ot_responses: byOffer[o.id] || [] })));
  }, []);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("ot_offers")
      .select("*")
      .in("status", ["closed", "cancelled"])
      .order("closed_at", { ascending: false })
      .limit(50);
    if (error) { console.error("fetchHistory:", error); return; }

    if (!data || data.length === 0) { setHistory([]); return; }

    // Fetch responses separately — same flat-query pattern as fetchActiveOffers
    const offerIds = data.map(o => o.id);
    const { data: responses, error: respErr } = await supabase
      .from("ot_responses")
      .select("*")
      .in("offer_id", offerIds);
    if (respErr) console.error("fetchHistory (responses):", respErr);

    const byOffer = {};
    for (const r of (responses || [])) {
      if (!byOffer[r.offer_id]) byOffer[r.offer_id] = [];
      byOffer[r.offer_id].push(r);
    }

    setHistory(data.map(o => ({ ...o, ot_responses: byOffer[o.id] || [] })));
  }, []);

  // ── Mount: load data + realtime subscriptions + auto-close timer ────────

  const autoCloseExpired = useCallback(async () => {
    // Calls the DB function that closes any offer whose window has expired
    const { error } = await supabase.rpc("auto_close_expired_offers");
    if (error) console.error("auto_close_expired_offers:", error);
  }, []);

  useEffect(() => {
    Promise.all([fetchTeam(), fetchAdmins(), fetchActiveOffers(), fetchHistory()])
      .then(() => autoCloseExpired())  // check on mount in case window lapsed while app was closed
      .finally(() => setLoading(false));

    // Realtime: refresh data whenever DB tables change
    const channel = supabase
      .channel("overtime-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => fetchTeam())
      .on("postgres_changes", { event: "*", schema: "public", table: "admins" }, () => fetchAdmins())
      .on("postgres_changes", { event: "*", schema: "public", table: "ot_offers" }, (payload) => {
        fetchActiveOffers();
        fetchHistory();
        // Show a toast when the system auto-awards a shift
        if (payload.eventType === "UPDATE" && payload.new?.status === "closed" && payload.new?.winner_id) {
          const winner = teamRef.current.find(m => m.id === payload.new.winner_id);
          if (winner) setToast({ message: `Shift awarded to ${winner.name}`, type: "success" });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ot_responses" }, () => fetchActiveOffers())
      .subscribe();

    // Poll every 30s to auto-close any expired offers (handles the case where
    // no one is actively using the app when the window closes)
    const timer = setInterval(autoCloseExpired, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [fetchTeam, fetchAdmins, fetchActiveOffers, fetchHistory, autoCloseExpired]);

  // ── Keep currentUser in sync with DB changes ────────────────────────────

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === "admin") {
      if (admins.length === 0) return;
      const found = admins.find(a => a.id === currentUser.id);
      if (!found) { setCurrentUser(null); localStorage.removeItem(CURRENT_USER_KEY); }
      else if (found.name !== currentUser.name) {
        const u = { ...currentUser, name: found.name };
        setCurrentUser(u); localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
      }
    } else {
      if (team.length === 0) return;
      const found = team.find(m => m.id === currentUser.id);
      if (!found) { setCurrentUser(null); localStorage.removeItem(CURRENT_USER_KEY); }
      else if (found.name !== currentUser.name) {
        const u = { ...currentUser, name: found.name };
        setCurrentUser(u); localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
      }
    }
  }, [team, admins, currentUser]);

  // ── Actions: OT offers ──────────────────────────────────────────────────

  // Posts a new offer. windowHours comes from PostOT (already calculated there,
  // including the short-notice coordinator-chosen window for sub-48h shifts).
  // rosterDate is the YYYY-MM-DD string the coordinator picked; used to look up
  // the roster and auto-decline anyone who is not ot_available on that date.
  async function postOT({ desc, shiftType, shiftStart, shiftEnd, shiftHours, windowHours, rosterDate }) {
    const start = new Date(shiftStart);
    const payload = {
      description:  desc,
      shift_type:   shiftType,
      shift_time:   start.toISOString(),
      shift_end:    shiftEnd ? new Date(shiftEnd).toISOString() : null,
      shift_hours:  shiftHours,
      window_hours: windowHours ?? null,
      closes_at:    windowHours ? new Date(Date.now() + windowHours * 3_600_000).toISOString() : null,
      status:       "open",
      immediate:    false,
    };

    // Need the new offer's ID so we can create auto-decline responses immediately
    const { data: newOffer, error } = await supabase
      .from("ot_offers")
      .insert(payload)
      .select("id")
      .single();
    if (error) { console.error("postOT:", error); return; }

    // Look up roster for adjacent dates and auto-decline ineligible members.
    //
    // Look-AHEAD rules (apply to all offer types):
    //   X+1 has N or NW  → unavailable on X (shift starts that evening)
    //   X+2 has N or NW  → eligible for N/NW OT only (needs daytime rest)
    //
    // Look-BACK rules (apply only when the offer itself is N or NW, because
    // night shifts start the evening BEFORE the roster calendar date):
    //   NW offer (starts 20:00 on X-1): blocked if X-1 duty is E (ends 22:15),
    //     EW (ends 20:15), or E* (ends 20:15) — all overlap the 20:00 start
    //   N offer  (starts 22:00 on X-1): blocked if X-1 duty is E (ends 22:15)
    //     only — EW/E* end at 20:15 leaving 1h45m clear, so no conflict
    if (rosterDate) {
      // Add n calendar days to a YYYY-MM-DD string (UTC-safe, handles month/year rollovers)
      function addDays(isoDate, n) {
        const [y, mo, d] = isoDate.split("-").map(Number);
        return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
      }

      const nightDuties  = new Set(["N", "NW"]);
      const offerIsNight = nightDuties.has(shiftType);

      const dateXm1 = addDays(rosterDate, -1);
      const dateX   = rosterDate;
      const dateX1  = addDays(rosterDate, 1);

      // Fetch X-1 only for night offers (it's the physical start evening)
      const datesToFetch = offerIsNight
        ? [dateXm1, dateX, dateX1]
        : [dateX, dateX1];

      const { data: rosterRows } = await supabase
        .from("roster_availability")
        .select("date, engineer, ot_available, base_duty")
        .in("date", datesToFetch);

      if (rosterRows && rosterRows.length > 0) {
        // Group rows by date for fast per-engineer lookups
        const byDate = {};
        for (const r of rosterRows) {
          if (!byDate[r.date]) byDate[r.date] = {};
          byDate[r.date][r.engineer] = r;
        }
        const rXm1 = byDate[dateXm1] || {};
        const rX   = byDate[dateX]   || {};
        const rX1  = byDate[dateX1]  || {};

        // Returns a human-readable reason string for why a member is ineligible,
        // or null if they are eligible. Checked in priority order so the most
        // immediate reason is shown (e.g. "on shift today" beats "night in 2 days").
        function declineReason(m) {
          if (m.active === false) return null;

          // Anyone with no roster entry for the offer date is not in the current
          // roster cycle and is not eligible — regardless of other checks.
          const dayX = rX[m.name];
          if (!dayX) return "Not in the current roster";

          // Day X: explicitly unavailable per roster flag
          if (!dayX.ot_available) {
            const s = dayX.status, d = dayX.base_duty;
            if (s === "AL_SHIFT" || s === "AL_REST") return "On annual leave";
            if (s === "COVER_ACTIVE")                return "On cover duty";
            if (s === "OT_RECORD")                   return "Already working an OT shift";
            return `On ${d} shift`;
          }

          // Day X+1: night shift starts the same evening as the OT offer date
          const dayX1 = rX1[m.name];
          if (dayX1 && nightDuties.has(dayX1.base_duty))
            return `${dayX1.base_duty} shift starts tomorrow evening`;

          // Day X-1 (N/NW offers only): E/EW/E* the previous evening overlaps by 15 min
          if (offerIsNight) {
            const xm1Duty = rXm1[m.name]?.base_duty;
            if (xm1Duty && ["E", "EW", "E*"].includes(xm1Duty)) {
              const endsAt = xm1Duty === "E" ? "22:15" : "20:15";
              return `${xm1Duty} shift runs until ${endsAt} — overlaps with night start`;
            }
          }

          return null;
        }

        const toDecline = team
          .filter(m => m.active !== false)
          .map(m => ({ m, reason: declineReason(m) }))
          .filter(({ reason }) => reason !== null);

        if (toDecline.length > 0) {
          const autoDeclines = toDecline.map(({ m, reason }) => ({
            offer_id:       newOffer.id,
            member_id:      m.id,
            answer:         "no",
            responded_at:   new Date().toISOString(),
            auto_declined:  true,
            decline_reason: reason,
          }));
          const { error: declineErr } = await supabase.from("ot_responses").insert(autoDeclines);
          if (declineErr) console.error("postOT (auto-decline):", declineErr);
          else {
            // Check if the offer can already be closed (e.g. all members are unavailable)
            await supabase.rpc("check_and_close_if_complete", { p_offer_id: newOffer.id });
          }
        }
      }
    }

    setTab("board");
  }

  // Upsert a response. After saving, call check_and_close_if_complete so the
  // offer is awarded the moment the last team member responds.
  async function respond(offerId, memberId, answer) {
    const { error } = await supabase
      .from("ot_responses")
      .upsert(
        { offer_id: offerId, member_id: memberId, answer, responded_at: new Date().toISOString() },
        { onConflict: "offer_id,member_id" }
      );
    if (error) { console.error("respond:", error); return; }

    // Check whether all active members have now responded
    const { error: checkErr } = await supabase.rpc("check_and_close_if_complete", { p_offer_id: offerId });
    if (checkErr) console.error("check_and_close_if_complete:", checkErr);
  }

  // Manual award by co-ordinator (before everyone has responded)
  async function closeOT(offerId, winnerId) {
    const { error } = await supabase.rpc("close_ot_offer", { p_offer_id: offerId, p_winner_id: winnerId });
    if (error) console.error("closeOT:", error);
  }

  async function cancelOT(offerId) {
    const { error } = await supabase
      .from("ot_offers")
      .update({ status: "cancelled", closed_at: new Date().toISOString() })
      .eq("id", offerId);
    if (error) console.error("cancelOT:", error);
  }

  // ── Actions: team members ───────────────────────────────────────────────

  async function addMember(name, pin) {
    const { error } = await supabase.from("team_members").insert({ name, pin });
    if (error) { console.error("addMember:", error); return false; }
    return true;
  }

  async function renameMember(id, name) {
    const { error } = await supabase.from("team_members").update({ name }).eq("id", id);
    if (error) console.error("renameMember:", error);
    if (!error && currentUser?.role === "member" && currentUser.id === id) {
      const u = { ...currentUser, name };
      setCurrentUser(u); localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
    }
  }

  async function removeMember(id) {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) console.error("removeMember:", error);
    if (!error && currentUser?.role === "member" && currentUser.id === id) {
      setCurrentUser(null); localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  async function toggleMemberActive(id, active) {
    const { error } = await supabase.from("team_members").update({ active }).eq("id", id);
    if (error) console.error("toggleMemberActive:", error);
  }

  async function resetScores() {
    const { error } = await supabase.rpc("reset_all_scores");
    if (error) console.error("resetScores:", error);
  }

  // ── Actions: admins ─────────────────────────────────────────────────────

  async function addAdmin(name) {
    const { error } = await supabase.from("admins").insert({ name });
    if (error) console.error("addAdmin:", error);
  }

  async function renameAdmin(id, name) {
    const { error } = await supabase.from("admins").update({ name }).eq("id", id);
    if (error) console.error("renameAdmin:", error);
    if (!error && currentUser?.role === "admin" && currentUser.id === id) {
      const u = { ...currentUser, name };
      setCurrentUser(u); localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
    }
  }

  async function removeAdmin(id) {
    const { error } = await supabase.from("admins").delete().eq("id", id);
    if (error) console.error("removeAdmin:", error);
    if (!error && currentUser?.role === "admin" && currentUser.id === id) {
      setCurrentUser(null); localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  async function changeAdminPassword(id, newPasswordHash) {
    const { error } = await supabase.from("admins").update({ password_hash: newPasswordHash }).eq("id", id);
    if (error) { console.error("changeAdminPassword:", error); return false; }
    return true;
  }

  // ── Auth handlers ────────────────────────────────────────────────────────

  function selectMember(member) {
    const user = { ...member, role: "member" };
    setCurrentUser(user);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  function selectAdmin(admin) {
    const user = { ...admin, role: "admin" };
    setCurrentUser(user);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  function signOut() {
    setCurrentUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <div className="loading-screen">Loading…</div>;

  if (!currentUser) {
    return (
      <AuthScreen
        team={team}
        admins={admins}
        onSelectMember={selectMember}
        onSelectAdmin={selectAdmin}
      />
    );
  }

  const isAdmin = currentUser.role === "admin";

  return (
    <div className="app-wrapper">

      {/* Toast — slides in from the bottom when a shift is auto-awarded */}
      {toast && (
        <div onClick={() => setToast(null)} style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#042d2d", color: "#fff", padding: "12px 20px", borderRadius: 8,
          fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          ✓ {toast.message}
        </div>
      )}

      <div className="header">
        <div className="header-title">OVERTIME TRACKER</div>
        <div className="header-row">
          <div className="header-subtitle">{isAdmin ? "Co-ordinator view" : "Fair rotation system"}</div>
          <button className="signout-btn" onClick={signOut}>{currentUser.name} ✕</button>
        </div>
      </div>

      <div className="tab-bar">
        {[
          ["board",   "Board"],
          ...(isAdmin ? [["post", "Post OT"]] : []),
          ...(!isAdmin ? [["roster", "Roster"]] : []),
          ["history", "History"],
          ["setup",   "Setup"],
          ["about",   "About"],
        ].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="tab-content">

        {tab === "board" && (
          <Board
            team={team}
            history={history}
            activeOffers={activeOffers}
            currentUser={currentUser}
            onRespond={respond}
            onCloseOT={closeOT}
            onCancelOT={cancelOT}
          />
        )}

        {tab === "post" && isAdmin && (
          <PostOT onPost={postOT} team={team} />
        )}

        {tab === "roster" && !isAdmin && (
          <Roster currentUser={currentUser} team={team} />
        )}

        {tab === "history" && (
          <History history={history} team={team} currentUser={currentUser} />
        )}

        {tab === "setup" && (
          <Setup
            team={team}
            admins={admins}
            currentUser={currentUser}
            onAdd={addMember}
            onRename={renameMember}
            onRemove={removeMember}
            onToggleMemberActive={toggleMemberActive}
            onResetScores={resetScores}
            onAddAdmin={addAdmin}
            onRenameAdmin={renameAdmin}
            onRemoveAdmin={removeAdmin}
            onChangeAdminPassword={changeAdminPassword}
          />
        )}

        {tab === "about" && <About isMember={!isAdmin} />}

      </div>
    </div>
  );
}
