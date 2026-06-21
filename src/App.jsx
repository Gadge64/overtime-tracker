// ============================================================
// App.jsx — Root component
//
// Three jobs:
//   1. Auth gate — team members pick their name from the roster.
//      Supervisors (admins) have a separate login section.
//      Identity is stored in localStorage so they don't re-pick
//      every visit. currentUser always has a `role` field:
//        'member' — a team member eligible for OT
//        'admin'  — a supervisor, not eligible for OT
//
//   2. Data layer — fetches team_members, admins, active offer,
//      and history from Supabase on mount. Realtime subscriptions
//      keep every device in sync automatically.
//
//   3. Actions — all database writes live here and are passed as
//      props to the tab components.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import Board   from "./Board";
import PostOT  from "./PostOT";
import History from "./History";
import Setup   from "./Setup";
import About   from "./About";
import "./styles.css";

// localStorage key for persisting the current user's identity between visits
const CURRENT_USER_KEY = "ot-current-user";

// ─── Notification helpers ─────────────────────────────────────────────────
// Browser notifications fire when a new OT offer is posted while the tab is open.
// (True push notifications when the app is closed require extra infrastructure.)

async function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function showNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon.svg" });
  }
}

// ─── Window hours helper ──────────────────────────────────────────────────
// How long the response window should be based on how soon the shift starts.
// Shifts under 48h are not posted here — handled on WhatsApp instead.

function getWindowHours(shiftTime) {
  const hoursUntil = (new Date(shiftTime) - Date.now()) / 3_600_000;
  if (hoursUntil >= 72) return 24;  // 3+ days away → 24 hour window
  if (hoursUntil >= 48) return 12;  // 2–3 days away → 12 hour window
  return null;                       // under 48h — blocked in the form
}

// ─── Auth screen ─────────────────────────────────────────────────────────
// Two sections:
//   Top: team member grid (picking here sets role='member')
//   Bottom: supervisor section (picking here sets role='admin')
// Admins are completely separate from team members — no score, no OT eligibility.

function AuthScreen({ team, admins, onSelectMember, onSelectAdmin }) {
  return (
    <div className="auth-screen">
      <div className="auth-title">OVERTIME TRACKER</div>
      <div className="auth-subtitle">Who are you? Tap your name to continue.</div>

      {/* Team member grid */}
      <div className="auth-grid">
        {team.map(m => (
          <button key={m.id} className="auth-name-btn" onClick={() => onSelectMember(m)}>
            {m.name}
          </button>
        ))}
      </div>

      {/* Supervisor section — only shown if there are admins in the DB */}
      {admins.length > 0 && (
        <div style={{ width: "100%", maxWidth: 320, marginTop: 24 }}>
          <div style={{
            textAlign: "center", marginBottom: 12,
            fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
            color: "#7a8c8a", fontWeight: 700,
          }}>
            Supervisor
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {admins.map(a => (
              <button
                key={a.id}
                className="auth-name-btn"
                style={{ flex: 1 }}
                onClick={() => onSelectAdmin(a)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("board");

  // Data from Supabase
  const [team,        setTeam]        = useState([]);
  const [admins,      setAdmins]      = useState([]); // supervisor accounts (separate from team)
  const [activeOffer, setActiveOffer] = useState(null);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Current user — has { id, name, role } where role is 'member' or 'admin'
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)); }
    catch { return null; }
  });

  // ── Data fetching ───────────────────────────────────────────────────────

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

  const fetchActiveOffer = useCallback(async () => {
    const { data, error } = await supabase
      .from("ot_offers")
      .select("*, ot_responses(*)")
      .eq("status", "open")
      .maybeSingle();
    if (error) { console.error("fetchActiveOffer:", error); return; }
    setActiveOffer(data);
  }, []);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("ot_offers")
      .select("*, winner:team_members!winner_id(name), ot_responses(*)")
      .in("status", ["closed", "cancelled"])
      .order("closed_at", { ascending: false })
      .limit(50);
    if (error) { console.error("fetchHistory:", error); return; }
    setHistory(data);
  }, []);

  // ── Mount: initial load + realtime subscriptions ────────────────────────

  useEffect(() => {
    Promise.all([fetchTeam(), fetchAdmins(), fetchActiveOffer(), fetchHistory()])
      .finally(() => setLoading(false));

    requestNotificationPermission();

    const channel = supabase
      .channel("overtime-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" },
        () => fetchTeam()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "admins" },
        () => fetchAdmins()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "ot_offers" },
        (payload) => {
          fetchActiveOffer();
          fetchHistory();
          if (payload.eventType === "INSERT" && payload.new?.status === "open") {
            showNotification("⚡ New Overtime Available", payload.new.description);
          }
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "ot_responses" },
        () => fetchActiveOffer()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchTeam, fetchAdmins, fetchActiveOffer, fetchHistory]);

  // ── Keep currentUser in sync with DB changes ────────────────────────────
  // If someone's name changes or account is deleted on another device,
  // update or clear the locally stored identity.

  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role === "admin") {
      // Check against the admins table
      if (admins.length === 0) return;
      const stillExists = admins.find(a => a.id === currentUser.id);
      if (!stillExists) {
        setCurrentUser(null);
        localStorage.removeItem(CURRENT_USER_KEY);
      } else if (stillExists.name !== currentUser.name) {
        const updated = { ...currentUser, name: stillExists.name };
        setCurrentUser(updated);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
      }
    } else {
      // Check against the team_members table
      if (team.length === 0) return;
      const stillExists = team.find(m => m.id === currentUser.id);
      if (!stillExists) {
        setCurrentUser(null);
        localStorage.removeItem(CURRENT_USER_KEY);
      } else if (stillExists.name !== currentUser.name) {
        const updated = { ...currentUser, name: stillExists.name };
        setCurrentUser(updated);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
      }
    }
  }, [team, admins, currentUser]);

  // ── Actions: OT offers ──────────────────────────────────────────────────

  async function postOT({ desc, shiftTime, immediate }) {
    const payload = immediate
      ? { description: desc, immediate: true, status: "open" }
      : (() => {
          const wh = getWindowHours(shiftTime);
          return {
            description:  desc,
            immediate:    false,
            shift_time:   new Date(shiftTime).toISOString(),
            window_hours: wh,
            closes_at:    new Date(Date.now() + wh * 3_600_000).toISOString(),
            status:       "open",
          };
        })();
    const { error } = await supabase.from("ot_offers").insert(payload);
    if (error) { console.error("postOT:", error); return; }
    setTab("board");
  }

  // UPSERT so team members can update their response before the window closes
  async function respond(memberId, answer) {
    if (!activeOffer) return;
    const { error } = await supabase
      .from("ot_responses")
      .upsert(
        { offer_id: activeOffer.id, member_id: memberId, answer, responded_at: new Date().toISOString() },
        { onConflict: "offer_id,member_id" }
      );
    if (error) console.error("respond:", error);
  }

  // Award the shift — atomic RPC increments winner's score and closes the offer
  async function closeOT(winnerId) {
    if (!activeOffer) return;
    const { error } = await supabase.rpc("close_ot_offer", {
      p_offer_id:  activeOffer.id,
      p_winner_id: winnerId,
    });
    if (error) console.error("closeOT:", error);
  }

  async function cancelOT() {
    if (!activeOffer) return;
    const { error } = await supabase
      .from("ot_offers")
      .update({ status: "cancelled", closed_at: new Date().toISOString() })
      .eq("id", activeOffer.id);
    if (error) console.error("cancelOT:", error);
  }

  // ── Actions: team members ───────────────────────────────────────────────

  async function addMember(name) {
    const { error } = await supabase.from("team_members").insert({ name });
    if (error) console.error("addMember:", error);
  }

  async function renameMember(id, name) {
    const { error } = await supabase.from("team_members").update({ name }).eq("id", id);
    if (error) console.error("renameMember:", error);
    if (!error && currentUser?.role === "member" && currentUser.id === id) {
      const updated = { ...currentUser, name };
      setCurrentUser(updated);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
    }
  }

  async function removeMember(id) {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) console.error("removeMember:", error);
    if (!error && currentUser?.role === "member" && currentUser.id === id) {
      setCurrentUser(null);
      localStorage.removeItem(CURRENT_USER_KEY);
    }
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
      const updated = { ...currentUser, name };
      setCurrentUser(updated);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
    }
  }

  async function removeAdmin(id) {
    const { error } = await supabase.from("admins").delete().eq("id", id);
    if (error) console.error("removeAdmin:", error);
    if (!error && currentUser?.role === "admin" && currentUser.id === id) {
      setCurrentUser(null);
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  // ── Auth handlers ────────────────────────────────────────────────────────

  // Team member login — tagged with role:'member'
  function selectMember(member) {
    const user = { ...member, role: "member" };
    setCurrentUser(user);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  // Supervisor login — tagged with role:'admin'
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

  if (loading) {
    return <div className="loading-screen">Loading…</div>;
  }

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

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="header">
        <div className="header-title">OVERTIME TRACKER</div>
        <div className="header-row">
          <div className="header-subtitle">
            {isAdmin ? "Supervisor view" : "Fair rotation system"}
          </div>
          {/* Tap name to sign out and switch identity */}
          <button className="signout-btn" onClick={signOut}>
            {currentUser.name} ✕
          </button>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────── */}
      {/* Post OT is only visible to admins */}
      <div className="tab-bar">
        {[
          ["board",   "Board"],
          ...(isAdmin ? [["post", "Post OT"]] : []),
          ["history", "History"],
          ["setup",   "Setup"],
          ["about",   "About"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab-btn ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <div className="tab-content">

        {tab === "board" && (
          <Board
            team={team}
            activeOffer={activeOffer}
            currentUser={currentUser}
            onRespond={respond}
            onCloseOT={closeOT}
            onCancelOT={cancelOT}
          />
        )}

        {tab === "post" && isAdmin && (
          <PostOT activeOffer={activeOffer} onPost={postOT} />
        )}

        {tab === "history" && (
          <History history={history} />
        )}

        {tab === "setup" && (
          <Setup
            team={team}
            admins={admins}
            currentUser={currentUser}
            onAdd={addMember}
            onRename={renameMember}
            onRemove={removeMember}
            onResetScores={resetScores}
            onAddAdmin={addAdmin}
            onRenameAdmin={renameAdmin}
            onRemoveAdmin={removeAdmin}
          />
        )}

        {tab === "about" && (
          <About />
        )}

      </div>
    </div>
  );
}
