// ============================================================
// App.jsx — Root component
//
// Three jobs:
//   1. Auth gate — shows a name-picker until the user identifies
//      themselves. Identity is stored in localStorage so they
//      don't have to pick every time.
//   2. Data layer — fetches team, active offer, and history from
//      Supabase on mount. Subscribes to realtime changes so every
//      device sees updates instantly without refreshing.
//   3. Actions — all database writes (post, respond, award, cancel,
//      add/rename/remove member) live here and are passed down as
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

// localStorage key for remembering which team member this device belongs to
const CURRENT_USER_KEY = "ot-current-user";

// ─── Notification helpers ─────────────────────────────────────────────────
// These use the standard Web Notifications API (not push — the app must be
// open for these to fire). Works well enough for a tab that's always open
// on a shared device. True push (background notifications) would need a
// push service and VAPID keys — see the README for guidance on that.

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
// Determines how long the response window should be based on how soon
// the shift starts. This is the canonical version — used before inserting
// into the DB so the computed value is stored alongside the offer.

function getWindowHours(shiftTime) {
  const hoursUntil = (new Date(shiftTime) - Date.now()) / 3_600_000;
  if (hoursUntil >= 72) return 24;  // 3+ days away → 24 hour window
  if (hoursUntil >= 48) return 12;  // 2–3 days away → 12 hour window
  return null;                       // under 48h — blocked in the form, handled on WhatsApp
}

// ─── Auth screen ─────────────────────────────────────────────────────────
// Simple name picker — no password. The team member taps their name
// and we remember it in localStorage. Good enough for an internal tool.
// To add a PIN or proper auth later, this is the place to do it.

function AuthScreen({ team, onSelect }) {
  return (
    <div className="auth-screen">
      <div className="auth-title">OVERTIME TRACKER</div>
      <div className="auth-subtitle">Who are you? Tap your name to continue.</div>
      <div className="auth-grid">
        {team.map(m => (
          <button key={m.id} className="auth-name-btn" onClick={() => onSelect(m)}>
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("board");

  // All data comes from Supabase — no localStorage for app state anymore
  const [team,        setTeam]        = useState([]);
  const [activeOffer, setActiveOffer] = useState(null); // the one open offer, or null
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);

  // The team member using this device. Persisted in localStorage so they
  // don't have to pick their name every visit.
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)); }
    catch { return null; }
  });

  // ── Data fetching ───────────────────────────────────────────────────────
  // Each fetch is a separate function so realtime handlers can call them
  // individually (e.g. only re-fetch active offer when responses change).

  const fetchTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("score",   { ascending: true })
      .order("last_ot", { ascending: true, nullsFirst: true }); // tiebreaker: least recent OT first
    if (error) { console.error("fetchTeam:", error); return; }
    setTeam(data);
  }, []);

  const fetchActiveOffer = useCallback(async () => {
    // Fetch the open offer together with all its responses in one query.
    // maybeSingle() returns null instead of erroring when there's no open offer.
    const { data, error } = await supabase
      .from("ot_offers")
      .select("*, ot_responses(*)")
      .eq("status", "open")
      .maybeSingle();
    if (error) { console.error("fetchActiveOffer:", error); return; }
    setActiveOffer(data); // null when no offer is open
  }, []);

  const fetchHistory = useCallback(async () => {
    // Fetch closed/cancelled offers with winner name + response breakdown
    const { data, error } = await supabase
      .from("ot_offers")
      .select("*, winner:team_members!winner_id(name), ot_responses(*)")
      .in("status", ["closed", "cancelled"])
      .order("closed_at", { ascending: false })
      .limit(50); // last 50 offers is plenty
    if (error) { console.error("fetchHistory:", error); return; }
    setHistory(data);
  }, []);

  // ── Mount: initial load + realtime subscription ─────────────────────────

  useEffect(() => {
    Promise.all([fetchTeam(), fetchActiveOffer(), fetchHistory()])
      .finally(() => setLoading(false));

    requestNotificationPermission();

    // Subscribe to all three tables. Any change on any device triggers a
    // targeted refetch. We refetch rather than merge incremental changes
    // to keep the logic simple — fine for a 15-person team.
    const channel = supabase
      .channel("overtime-changes")

      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" },
        () => fetchTeam()
      )

      .on("postgres_changes", { event: "*", schema: "public", table: "ot_offers" },
        (payload) => {
          fetchActiveOffer();
          fetchHistory();
          // Show a browser notification when a new offer is posted
          if (payload.eventType === "INSERT" && payload.new?.status === "open") {
            showNotification("⚡ New Overtime Available", payload.new.description);
          }
        }
      )

      .on("postgres_changes", { event: "*", schema: "public", table: "ot_responses" },
        () => fetchActiveOffer() // someone responded — refresh the active offer
      )

      .subscribe();

    return () => supabase.removeChannel(channel); // clean up on unmount
  }, [fetchTeam, fetchActiveOffer, fetchHistory]);

  // ── Keep currentUser in sync with team changes ──────────────────────────
  // If someone's name is changed or their account is deleted on another device,
  // update (or clear) the locally stored identity.

  useEffect(() => {
    if (!currentUser || team.length === 0) return;
    const stillExists = team.find(m => m.id === currentUser.id);
    if (!stillExists) {
      // Member was removed — log out this device
      setCurrentUser(null);
      localStorage.removeItem(CURRENT_USER_KEY);
    } else if (stillExists.name !== currentUser.name) {
      // Name was updated elsewhere — refresh local cache
      const updated = { ...currentUser, name: stillExists.name };
      setCurrentUser(updated);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
    }
  }, [team, currentUser]);

  // ── Actions ─────────────────────────────────────────────────────────────
  // All DB writes live here and are passed as props to tab components.
  // Realtime subscriptions above will automatically refresh state after each write.

  // Post a new OT offer (called from PostOT tab)
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

  // Record or update a yes/no response (called from Board tab).
  // Uses UPSERT so a person can change their answer before the window closes.
  async function respond(memberId, answer) {
    if (!activeOffer) return;
    const { error } = await supabase
      .from("ot_responses")
      .upsert(
        { offer_id: activeOffer.id, member_id: memberId, answer, responded_at: new Date().toISOString() },
        { onConflict: "offer_id,member_id" }
      );
    if (error) console.error("respond:", error);
    // Realtime will trigger fetchActiveOffer() — no manual state update needed
  }

  // Award the shift and close the offer. Uses an RPC (Postgres function)
  // so the score increment and offer close happen atomically.
  async function closeOT(winnerId) {
    if (!activeOffer) return;
    const { error } = await supabase.rpc("close_ot_offer", {
      p_offer_id:  activeOffer.id,
      p_winner_id: winnerId,
    });
    if (error) console.error("closeOT:", error);
  }

  // Cancel the active offer without awarding anyone
  async function cancelOT() {
    if (!activeOffer) return;
    const { error } = await supabase
      .from("ot_offers")
      .update({ status: "cancelled", closed_at: new Date().toISOString() })
      .eq("id", activeOffer.id);
    if (error) console.error("cancelOT:", error);
  }

  // Reset all scores to zero (end of quarter)
  async function resetScores() {
    const { error } = await supabase.rpc("reset_all_scores");
    if (error) console.error("resetScores:", error);
  }

  // Add a new team member
  async function addMember(name) {
    const { error } = await supabase.from("team_members").insert({ name });
    if (error) console.error("addMember:", error);
  }

  // Rename a team member
  async function renameMember(id, name) {
    const { error } = await supabase.from("team_members").update({ name }).eq("id", id);
    if (error) console.error("renameMember:", error);
    // If this device's user was renamed, update local cache immediately
    if (!error && currentUser?.id === id) {
      const updated = { ...currentUser, name };
      setCurrentUser(updated);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
    }
  }

  // Remove a team member (their responses cascade-delete via the FK)
  async function removeMember(id) {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) console.error("removeMember:", error);
    // If this device's user was deleted, log them out
    if (!error && currentUser?.id === id) {
      setCurrentUser(null);
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  // Grant or revoke admin for a team member.
  // Only admins can call this — the UI enforces it by only showing the
  // toggle to admins, but the DB doesn't restrict it (internal tool).
  async function toggleAdmin(id, isAdmin) {
    const { error } = await supabase
      .from("team_members")
      .update({ is_admin: isAdmin })
      .eq("id", id);
    if (error) console.error("toggleAdmin:", error);
    // If this device's user's admin status changed, update local cache
    if (!error && currentUser?.id === id) {
      const updated = { ...currentUser, is_admin: isAdmin };
      setCurrentUser(updated);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
    }
  }

  // ── Auth handlers ────────────────────────────────────────────────────────

  function selectUser(member) {
    setCurrentUser(member);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(member));
  }

  function signOut() {
    setCurrentUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="loading-screen">Loading…</div>;
  }

  // Name picker — shown until the user identifies themselves
  if (!currentUser) {
    return <AuthScreen team={team} onSelect={selectUser} />;
  }

  return (
    <div className="app-wrapper">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="header">
        <div className="header-title">OVERTIME TRACKER</div>
        <div className="header-row">
          <div className="header-subtitle">Fair rotation system</div>
          {/* Shows the current user's name — tap to switch identity */}
          <button className="signout-btn" onClick={signOut}>
            {currentUser.name} ✕
          </button>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────── */}
      {/* Post OT is only shown to admins — everyone else sees Board, History, Setup, About */}
      <div className="tab-bar">
        {[
          ["board",   "Board"],
          // Only admins see the Post OT tab — conditionally included in the array
          ...(currentUser.is_admin ? [["post", "Post OT"]] : []),
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

        {tab === "post" && (
          <PostOT
            activeOffer={activeOffer}
            onPost={postOT}
          />
        )}

        {tab === "history" && (
          <History history={history} />
        )}

        {tab === "setup" && (
          <Setup
            team={team}
            currentUser={currentUser}
            onAdd={addMember}
            onRename={renameMember}
            onRemove={removeMember}
            onResetScores={resetScores}
            onToggleAdmin={toggleAdmin}
          />
        )}

        {tab === "about" && (
          <About />
        )}

      </div>
    </div>
  );
}
