import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/* Online-Tisch: Lobby. Tisch erstellen oder per Code beitreten,
   Spielerliste live. Schreiben läuft nur über die Edge Function "lobby". */

const SEAT_KEY = "pokerkasten-online-seat"; // { playerId, token } für den Wiedereinstieg

function loadSeat() {
  try { return JSON.parse(window.localStorage.getItem(SEAT_KEY)); } catch (e) { return null; }
}
function storeSeat(seat) {
  try {
    if (seat) window.localStorage.setItem(SEAT_KEY, JSON.stringify(seat));
    else window.localStorage.removeItem(SEAT_KEY);
  } catch (e) { /* Storage deaktiviert – Wiedereinstieg geht dann nicht */ }
}

// Fehler vom Server (z. B. "Tisch ist voll") tragen rejected = true,
// Verbindungsprobleme nicht.
async function callLobby(body) {
  const { data, error } = await supabase.functions.invoke("lobby", { body });
  if (!error) return data;
  const err = new Error("Keine Verbindung zum Server. Bitte nochmal versuchen.");
  try {
    const answer = await error.context.json();
    if (answer?.error) { err.message = answer.error; err.rejected = error.context.status === 400; }
  } catch (e) { /* keine lesbare Antwort */ }
  throw err;
}

export default function Lobby({ onBack }) {
  const [view, setView] = useState(() => (loadSeat() ? "loading" : "choose")); // loading | choose | create | join | table
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [table, setTable] = useState(null);     // { session, player }
  const [players, setPlayers] = useState([]);
  const [leaveArmed, setLeaveArmed] = useState(false);

  // Beim Öffnen: gespeicherten Platz wieder einnehmen
  const rejoin = async () => {
    const seat = loadSeat();
    if (!seat) { setView("choose"); return; }
    setView("loading"); setError("");
    try {
      const res = await callLobby({ action: "rejoin", ...seat });
      setTable({ session: res.session, player: res.player });
      setView("table");
    } catch (e) {
      if (e.rejected) { storeSeat(null); setView("choose"); }
      setError(e.message);
    }
  };
  useEffect(() => { if (supabase) rejoin(); }, []);

  // Spielerliste laden und bei jeder Änderung neu laden
  useEffect(() => {
    if (!table) return;
    const sessionId = table.session.id;
    let active = true;
    const refresh = async () => {
      const { data } = await supabase.from("players").select("id, name, seat, is_host").eq("session_id", sessionId).order("seat");
      if (active && data) setPlayers(data);
    };
    refresh();
    const channel = supabase
      .channel(`lobby-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` }, refresh)
      // Löschungen lassen sich nicht nach Tisch filtern, daher alle mithören
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "players" }, refresh)
      // Live-Verbindung steht (auch nach Wiederverbinden): verpasste Änderungen nachladen
      .on("system", {}, (e) => { if (e.extension === "postgres_changes" && e.status === "ok") refresh(); })
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [table]);

  const enter = async (body) => {
    setBusy(true); setError("");
    try {
      const res = await callLobby(body);
      storeSeat({ playerId: res.player.id, token: res.token });
      setTable({ session: res.session, player: res.player });
      setView("table");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const leave = async () => {
    if (!leaveArmed) { setLeaveArmed(true); return; }
    setBusy(true); setError("");
    try {
      await callLobby({ action: "leave", ...loadSeat() });
      storeSeat(null);
      setTable(null); setPlayers([]); setView("choose");
    } catch (e) {
      setError(e.message);
    }
    setLeaveArmed(false);
    setBusy(false);
  };

  const goTo = (v) => { setError(""); setView(v); };
  const errorBox = error && <div className="notice" style={{ borderColor: "#C8332B" }}>{error}</div>;

  if (!supabase) {
    return (
      <>
        <div className="notice">Der Online-Tisch ist auf diesem Gerät noch nicht eingerichtet.</div>
        <button className="btn ghost" onClick={onBack}>Zurück</button>
      </>
    );
  }

  if (view === "loading") {
    return (
      <>
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontWeight: 800 }}>{error ? "Verbindung fehlgeschlagen" : "Verbinde mit deinem Tisch …"}</div>
        </div>
        {errorBox}
        {error && <button className="btn gold" style={{ marginBottom: 8 }} onClick={rejoin}>Nochmal versuchen</button>}
        <button className="btn ghost" onClick={onBack}>Zurück</button>
      </>
    );
  }

  if (view === "table" && table) {
    const me = table.player.id;
    return (
      <>
        <div className="card" style={{ textAlign: "center", padding: 20 }}>
          <span className="lbl">Tisch-Code</span>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 72, lineHeight: 1, letterSpacing: ".12em", color: "#E4B04A" }}>
            {table.session.code}
          </div>
          <div className="small">Sag den Code den anderen – sie tippen ihn unter „Beitreten“ ein.</div>
        </div>
        <div className="card">
          <h3 className="sec">Am Tisch · {players.length} von 9</h3>
          {players.map((p) => (
            <div key={p.id} className={`pl ${p.id === me ? "turn" : ""}`}>
              <div className="nm">
                {p.name}
                {p.is_host && <span className="tag d">HOST</span>}
                {p.id === me && <span className="tag mint">DU</span>}
              </div>
            </div>
          ))}
        </div>
        {errorBox}
        <button className="btn ghost" style={{ marginBottom: 8 }} onClick={onBack}>Zurück zum Start (dein Platz bleibt)</button>
        <button className={`btn ${leaveArmed ? "red" : "ghost"}`} disabled={busy} onClick={leave}>
          {leaveArmed ? "Wirklich verlassen? Nochmal tippen!" : "Tisch verlassen"}
        </button>
      </>
    );
  }

  if (view === "create" || view === "join") {
    const isJoin = view === "join";
    const canSubmit = name.trim() && (!isJoin || code.length === 4) && !busy;
    const submit = (e) => {
      e.preventDefault();
      if (!canSubmit) return;
      enter(isJoin ? { action: "join", code, name } : { action: "create", name });
    };
    return (
      <form onSubmit={submit}>
        <div className="card">
          <h3 className="sec">{isJoin ? "Tisch beitreten" : "Neuen Tisch erstellen"}</h3>
          {isJoin && (
            <div style={{ marginBottom: 12 }}>
              <span className="lbl">Tisch-Code</span>
              <input type="text" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="1234"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          )}
          <span className="lbl">Dein Name</span>
          <input type="text" maxLength={20} autoComplete="off" placeholder="Name"
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {errorBox}
        <button type="submit" className="btn gold xl" style={{ marginBottom: 8 }} disabled={!canSubmit}>
          {busy ? "Moment …" : isJoin ? "Beitreten" : "Tisch erstellen"}
        </button>
        <button type="button" className="btn ghost" onClick={() => goTo("choose")}>Zurück</button>
      </form>
    );
  }

  return (
    <>
      <div className="card" style={{ textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Online-Tisch</div>
        <div className="small">Jeder am eigenen Handy. Einer erstellt den Tisch, die anderen treten mit dem Code bei.</div>
      </div>
      {errorBox}
      <button className="btn gold xl" style={{ marginBottom: 8 }} onClick={() => goTo("create")}>Tisch erstellen</button>
      <button className="btn ghost" style={{ marginBottom: 8 }} onClick={() => goTo("join")}>Beitreten</button>
      <button className="btn ghost" onClick={onBack}>Zurück</button>
    </>
  );
}
