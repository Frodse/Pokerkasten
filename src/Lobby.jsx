import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import OnlineGame from "./OnlineGame.jsx";
import { BuyInField, buyInLabel, parseAmount } from "./buyIn.jsx";

/* Startseite und Online-Tisch. Erste Seite: direkt beitreten (auch in ein
   laufendes Spiel), Online-Tisch erstellen oder lokal an einem Handy spielen.
   In der Lobby wählt jeder seinen Buy-in, ein Admin stellt die Regeln ein
   und startet. Schreiben läuft nur über die Edge Functions "lobby" und
   "game". Sobald das Spiel läuft, zeigt die Lobby den Spielbildschirm. */

const SESSION_FIELDS = "id, code, status, state, version";
// Wie DEFAULT_SETTINGS in supabase/functions/_shared/settings.js
const DEFAULT_SETTINGS = { money: true, buyInEuro: 10, startChips: 1000, sb: 10, beerEvery: 3, blindUp: 8 };
const SYNC_MS = 700; // Eingaben erst nach kurzer Tipp-Pause an den Server

const SEAT_KEY = "pokerkasten-online-seat"; // { playerId, token } für den Wiedereinstieg

export function loadSeat() {
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
async function callServer(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (!error) return data;
  const err = new Error("Keine Verbindung zum Server. Bitte nochmal versuchen.");
  try {
    const answer = await error.context.json();
    if (answer?.error) { err.message = answer.error; err.rejected = error.context.status === 400; }
  } catch (e) { /* keine lesbare Antwort */ }
  throw err;
}
const callLobby = (body) => callServer("lobby", body);

export default function Lobby({ onLocal }) {
  const [view, setView] = useState(() => (loadSeat() ? "loading" : "home")); // loading | home | create | table
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [joinBuyIn, setJoinBuyIn] = useState("");
  const [found, setFound] = useState(null);     // Tisch zum eingegebenen Code: { status, settings } | "none"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [table, setTable] = useState(null);     // { session, player }
  const [players, setPlayers] = useState([]);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [draft, setDraft] = useState(null);     // Regeln, die ein Admin gerade bearbeitet
  const [myBuyIn, setMyBuyIn] = useState(null); // eigener Buy-in als Text, null = noch nicht angefasst
  const sawLobby = useRef(false); // Spielstart live miterlebt (für die erste Ansage)

  // Nur neuere Stände übernehmen (Antworten können sich überholen)
  const takeSession = (fresh) =>
    setTable((t) => (t && fresh && t.session.id === fresh.id && fresh.version >= (t.session.version ?? 0) ? { ...t, session: { ...t.session, ...fresh } } : t));

  // Beim Öffnen: gespeicherten Platz wieder einnehmen
  const rejoin = async () => {
    const seat = loadSeat();
    if (!seat) { setView("home"); return; }
    setView("loading"); setError("");
    try {
      const res = await callLobby({ action: "rejoin", ...seat });
      setTable({ session: res.session, player: res.player });
      setView("table");
    } catch (e) {
      if (e.rejected) { storeSeat(null); setView("home"); }
      setError(e.message);
    }
  };
  useEffect(() => { if (supabase) rejoin(); }, []);

  // Code eingegeben: nachsehen, ob dort schon gespielt wird (dann Buy-in abfragen)
  useEffect(() => {
    setFound(null);
    if (!supabase || code.length !== 4) return;
    let active = true;
    supabase.from("sessions").select("status, settings:state->settings").eq("code", code).neq("status", "over").maybeSingle()
      .then(({ data }) => { if (active) setFound(data ? { status: data.status, settings: data.settings ?? DEFAULT_SETTINGS } : "none"); });
    return () => { active = false; };
  }, [code]);

  // Spielerliste und Spielstand laden und bei jeder Änderung neu laden
  const sessionId = table?.session.id;
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const refreshPlayers = async () => {
      const { data } = await supabase.from("players").select("id, name, seat, is_host, buy_in").eq("session_id", sessionId).order("seat");
      if (active && data) setPlayers(data.map((p) => ({ ...p, buy_in: p.buy_in === null ? null : Number(p.buy_in) })));
    };
    const refreshSession = async () => {
      const { data } = await supabase.from("sessions").select(SESSION_FIELDS).eq("id", sessionId).single();
      if (active && data) takeSession(data);
    };
    const refresh = () => { refreshPlayers(); refreshSession(); };
    refresh();
    const channel = supabase
      .channel(`lobby-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` }, refreshPlayers)
      // Löschungen lassen sich nicht nach Tisch filtern, daher alle mithören
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "players" }, refreshPlayers)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, refreshSession)
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
  }, [sessionId]);

  const serverSettings = table?.session.state?.settings ?? DEFAULT_SETTINGS;
  const me = table?.player.id;
  const amAdmin = !!players.find((p) => p.id === me)?.is_host;
  const inLobby = view === "table" && table?.session.status === "lobby";

  // Wechselt der Tisch zwischen € und Chips, setzt der Server alle Buy-ins zurück
  useEffect(() => { setMyBuyIn(null); }, [serverSettings.money]);

  // Admin: Regeln nach kurzer Tipp-Pause speichern, damit alle sie live sehen
  useEffect(() => {
    if (!inLobby || !amAdmin || !draft) return;
    const timer = setTimeout(() => {
      callLobby({ action: "settings", settings: draft, ...loadSeat() })
        .then((res) => res?.state && takeSession({ id: sessionId, state: res.state, version: res.version }))
        .catch((e) => setError(e.message));
    }, SYNC_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  // Eigenen Buy-in nach kurzer Tipp-Pause speichern
  useEffect(() => {
    if (!inLobby || myBuyIn === null) return;
    const amount = parseAmount(myBuyIn);
    if (amount !== null && !(amount > 0)) return;
    const timer = setTimeout(() => {
      setError("");
      callLobby({ action: "setBuyIn", buyIn: amount, ...loadSeat() }).catch((e) => setError(e.message));
    }, SYNC_MS);
    return () => clearTimeout(timer);
  }, [myBuyIn]);

  // Spielzug an den Server; die Antwort enthält schon den neuen Stand
  const callGame = async (body) => {
    const res = await callServer("game", { ...body, ...loadSeat() });
    if (res?.state?.game) {
      takeSession({ id: sessionId, state: res.state, version: res.version, status: res.state.game.screen === "over" ? "over" : "playing" });
    }
    return res;
  };

  const startGame = async () => {
    setBusy(true); setError("");
    try { await callGame({ action: "start", settings: draft ?? serverSettings }); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const backHome = () => { setError(""); setLeaveArmed(false); setTable(null); setPlayers([]); setDraft(null); setMyBuyIn(null); setView("home"); };
  // Spiel vorbei: Platz wird nicht mehr gebraucht
  const exitFinished = () => { storeSeat(null); backHome(); };

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
      backHome();
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
        <button className="btn gold xl" onClick={onLocal}>Lokal spielen (ein Handy)</button>
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
        <button className="btn ghost" onClick={() => goTo("home")}>Zur Startseite</button>
      </>
    );
  }

  if (view === "table" && table && table.session.status !== "lobby" && table.session.state?.game) {
    return <OnlineGame session={table.session} seats={players} meId={me} call={callGame} onExit={exitFinished} onHome={backHome} fromLobby={sawLobby.current} />;
  }
  if (view === "table" && table) sawLobby.current = true;

  if (view === "table" && table) {
    const shown = amAdmin ? draft ?? serverSettings : serverSettings;
    const edit = (patch) => setDraft({ ...shown, ...patch });
    const num = (key, min) => (e) => edit({ [key]: Math.max(min, Math.floor(+e.target.value || 0)) });
    const myRow = players.find((p) => p.id === me);
    const myText = myBuyIn ?? (myRow?.buy_in === null || myRow?.buy_in === undefined ? "" : String(myRow.buy_in).replace(".", ","));
    return (
      <>
        <div className="card" style={{ textAlign: "center", padding: 20 }}>
          <span className="lbl">Tisch-Code</span>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 72, lineHeight: 1, letterSpacing: ".12em", color: "#E4B04A" }}>
            {table.session.code}
          </div>
          <div className="small">Sag den Code den anderen – sie tippen ihn auf der Startseite unter „Beitreten“ ein.</div>
        </div>
        <div className="card">
          <h3 className="sec">Am Tisch · {players.length} von 9</h3>
          {players.map((p) => (
            <div key={p.id} className={`pl ${p.id === me ? "turn" : ""}`}>
              <div className="nm">
                {p.name}
                {p.is_host && <span className="tag d">ADMIN</span>}
                {p.id === me && <span className="tag mint">DU</span>}
              </div>
              <div style={{ fontSize: 13, color: "#9DBFAE", fontWeight: 800 }}>{buyInLabel(shown, p.buy_in)}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <BuyInField settings={shown} value={myText} onChange={setMyBuyIn} />
        </div>
        {amAdmin ? (
          <div className="card">
            <h3 className="sec">Regeln</h3>
            <div className="row" style={{ marginBottom: 10 }}>
              <button className={`btn ${shown.money ? "gold" : "ghost"}`} onClick={() => edit({ money: true })}>💶 Mit Geld</button>
              <button className={`btn ${!shown.money ? "gold" : "ghost"}`} onClick={() => edit({ money: false })}>Ohne Geld</button>
            </div>
            {shown.money ? (
              <div className="row" style={{ marginBottom: 10, alignItems: "flex-end" }}>
                <div><span className="lbl">Kurs: €</span>
                  <input type="number" min="0" step="0.5" value={shown.buyInEuro}
                    onChange={(e) => edit({ buyInEuro: Math.max(0, +e.target.value || 0) })} /></div>
                <div><span className="lbl">= Chips</span>
                  <input type="number" value={shown.startChips} onChange={num("startChips", 1)} /></div>
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}><span className="lbl">Vorschlag Start-Chips</span>
                <input type="number" value={shown.startChips} onChange={num("startChips", 1)} /></div>
            )}
            <div className="row" style={{ marginBottom: 10 }}>
              <div><span className="lbl">Small Blind</span>
                <input type="number" value={shown.sb} onChange={num("sb", 1)} /></div>
              <div><span className="lbl">🍺 Bierrunde alle … Hände (0 = aus)</span>
                <input type="number" value={shown.beerEvery} onChange={num("beerEvery", 0)} /></div>
            </div>
            <div style={{ marginBottom: 10 }}><span className="lbl">📈 Blinds ×2 alle … Hände (0 = aus)</span>
              <input type="number" value={shown.blindUp} onChange={num("blindUp", 0)} /></div>
            <div className="small">
              Big Blind = {shown.sb * 2}. {shown.money ? "Jeder tippt seinen Buy-in in € ein, der Kurs rechnet ihn in Chips um." : "Jeder tippt seine Start-Chips ein, am Ende gibt es keine Abrechnung in €."}
            </div>
          </div>
        ) : (
          <div className="notice">
            {shown.money ? `Kurs: ${shown.buyInEuro.toLocaleString("de-DE")} € = ${shown.startChips} Chips` : "Ohne Geld – nur Chips"} · Blinds {shown.sb}/{shown.sb * 2}
            <br />Warte, bis ein Admin das Spiel startet …
          </div>
        )}
        {errorBox}
        {amAdmin && (
          <button className="btn gold xl" style={{ marginBottom: 8 }} disabled={busy || players.length < 2} onClick={startGame}>
            {players.length < 2 ? "Warte auf Mitspieler …" : busy ? "Moment …" : `Spiel starten (${players.length} Spieler)`}
          </button>
        )}
        <button className="btn ghost" style={{ marginBottom: 8 }} onClick={backHome}>Zur Startseite (dein Platz bleibt)</button>
        <button className={`btn ${leaveArmed ? "red" : "ghost"}`} disabled={busy} onClick={leave}>
          {leaveArmed ? "Wirklich verlassen? Nochmal tippen!" : "Tisch verlassen"}
        </button>
      </>
    );
  }

  if (view === "create") {
    const canSubmit = name.trim() && !busy;
    const submit = (e) => { e.preventDefault(); if (canSubmit) enter({ action: "create", name }); };
    return (
      <form onSubmit={submit}>
        <div className="card">
          <h3 className="sec">Online-Tisch erstellen</h3>
          <span className="lbl">Dein Name</span>
          <input type="text" maxLength={20} autoComplete="off" placeholder="Name"
            value={name} onChange={(e) => setName(e.target.value)} />
          <div className="small">Jeder spielt am eigenen Handy. Du bekommst einen Code, den du den anderen sagst.</div>
        </div>
        {errorBox}
        <button type="submit" className="btn gold xl" style={{ marginBottom: 8 }} disabled={!canSubmit}>
          {busy ? "Moment …" : "Tisch erstellen"}
        </button>
        <button type="button" className="btn ghost" onClick={() => goTo("home")}>Zurück</button>
      </form>
    );
  }

  // Startseite
  const running = found && found !== "none" && found.status === "playing";
  const amount = parseAmount(joinBuyIn);
  const canJoin = name.trim() && code.length === 4 && !busy && (!running || amount === null || amount > 0);
  const submitJoin = (e) => {
    e.preventDefault();
    if (canJoin) enter({ action: "join", code, name, ...(running ? { buyIn: amount } : {}) });
  };
  const seat = loadSeat();
  return (
    <>
      {seat && (
        <button className="btn gold xl" style={{ marginBottom: 12 }} onClick={rejoin}>Zurück an deinen Tisch</button>
      )}
      <form onSubmit={submitJoin}>
        <div className="card">
          <h3 className="sec">Beitreten</h3>
          <div className="row" style={{ marginBottom: 12 }}>
            <div><span className="lbl">Tisch-Code</span>
              <input type="text" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="1234"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} /></div>
            <div style={{ flex: 1.4 }}><span className="lbl">Dein Name</span>
              <input type="text" maxLength={20} autoComplete="off" placeholder="Name"
                value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          {found === "none" && <div className="small">Kein laufender Tisch mit diesem Code.</div>}
          {running && (
            <>
              <div className="notice" style={{ marginTop: 4 }}>Hier läuft schon ein Spiel – du spielst ab der nächsten Hand mit.</div>
              <BuyInField settings={found.settings} value={joinBuyIn} onChange={setJoinBuyIn} />
            </>
          )}
        </div>
        {errorBox}
        <button type="submit" className="btn gold xl" style={{ marginBottom: 8 }} disabled={!canJoin}>
          {busy ? "Moment …" : "Beitreten"}
        </button>
      </form>
      <button className="btn ghost" style={{ marginBottom: 8 }} onClick={() => goTo("create")}>Online-Tisch erstellen</button>
      <button className="btn ghost" onClick={onLocal}>Lokal spielen (ein Handy für alle)</button>
    </>
  );
}
