import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import OnlineGame from "./OnlineGame.jsx";
import { BuyInField, buyInLabel, parseAmount } from "./buyIn.jsx";
import { common as T } from "./text/de.js";
import { TwoTapButton, PlayerRow, ErrorBanner } from "./ui/components.jsx";

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
  const err = new Error(T.noConnection);
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
  const errorBox = <ErrorBanner>{error}</ErrorBanner>;

  if (!supabase) {
    return (
      <>
        <div className="notice">{T.notConfigured}</div>
        <button className="btn gold xl" onClick={onLocal}>{T.playLocal}</button>
      </>
    );
  }

  if (view === "loading") {
    return (
      <>
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontWeight: 800 }}>{error ? T.connectFailed : T.connecting}</div>
        </div>
        {errorBox}
        {error && <button className="btn gold" style={{ marginBottom: 8 }} onClick={rejoin}>{T.retry}</button>}
        <button className="btn ghost" onClick={() => goTo("home")}>{T.toStart}</button>
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
          <span className="lbl">{T.tableCode}</span>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 72, lineHeight: 1, letterSpacing: ".12em", color: "#E4B04A" }}>
            {table.session.code}
          </div>
          <div className="small">{T.codeHint}</div>
        </div>
        <div className="card">
          <h3 className="sec">{T.atTable(players.length)}</h3>
          {players.map((p) => (
            <PlayerRow key={p.id} name={p.name} badges={[p.is_host && T.badge.admin, p.id === me && T.badge.you]}
              status={buyInLabel(shown, p.buy_in)} />
          ))}
        </div>
        <div className="card">
          <BuyInField settings={shown} value={myText} onChange={setMyBuyIn} />
        </div>
        {amAdmin ? (
          <div className="card">
            <h3 className="sec">{T.rules}</h3>
            <div className="row" style={{ marginBottom: 10 }}>
              <button className={`btn ${shown.money ? "gold" : "ghost"}`} onClick={() => edit({ money: true })}>{T.withMoney}</button>
              <button className={`btn ${!shown.money ? "gold" : "ghost"}`} onClick={() => edit({ money: false })}>{T.withoutMoney}</button>
            </div>
            {shown.money ? (
              <div className="row" style={{ marginBottom: 10, alignItems: "flex-end" }}>
                <div><span className="lbl">{T.rateEuro}</span>
                  <input type="number" min="0" step="0.5" value={shown.buyInEuro}
                    onChange={(e) => edit({ buyInEuro: Math.max(0, +e.target.value || 0) })} /></div>
                <div><span className="lbl">{T.rateChips}</span>
                  <input type="number" value={shown.startChips} onChange={num("startChips", 1)} /></div>
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}><span className="lbl">{T.suggestChips}</span>
                <input type="number" value={shown.startChips} onChange={num("startChips", 1)} /></div>
            )}
            <div className="row" style={{ marginBottom: 10 }}>
              <div><span className="lbl">{T.smallBlind}</span>
                <input type="number" value={shown.sb} onChange={num("sb", 1)} /></div>
              <div><span className="lbl">{T.drinksEvery}</span>
                <input type="number" value={shown.beerEvery} onChange={num("beerEvery", 0)} /></div>
            </div>
            <div style={{ marginBottom: 10 }}><span className="lbl">{T.blindsUpEvery}</span>
              <input type="number" value={shown.blindUp} onChange={num("blindUp", 0)} /></div>
            <div className="small">
              {T.bigBlindHint(shown.sb * 2)} {shown.money ? T.moneyHint : T.noMoneyHint}
            </div>
          </div>
        ) : (
          <div className="notice">
            {shown.money ? T.lobbyRate(shown.buyInEuro.toLocaleString("de-DE"), shown.startChips) : T.lobbyNoMoney} · {T.lobbyBlinds(shown.sb)}
            <br />{T.waitForAdmin}
          </div>
        )}
        {errorBox}
        {amAdmin && (
          <button className="btn gold xl" style={{ marginBottom: 8 }} disabled={busy || players.length < 2} onClick={startGame}>
            {players.length < 2 ? T.waitForPlayers : busy ? T.busy : T.startGame(players.length)}
          </button>
        )}
        <button className="btn ghost" style={{ marginBottom: 8 }} onClick={backHome}>{T.toStartKeepSeat}</button>
        <TwoTapButton disabled={busy} armed={leaveArmed} onArm={leave} onConfirm={leave} confirmLabel={T.leaveTableConfirm}>
          {T.leaveTable}
        </TwoTapButton>
      </>
    );
  }

  if (view === "create") {
    const canSubmit = name.trim() && !busy;
    const submit = (e) => { e.preventDefault(); if (canSubmit) enter({ action: "create", name }); };
    return (
      <form onSubmit={submit}>
        <div className="card">
          <h3 className="sec">{T.createTitle}</h3>
          <span className="lbl">{T.yourName}</span>
          <input type="text" maxLength={20} autoComplete="off" placeholder={T.namePlaceholder}
            value={name} onChange={(e) => setName(e.target.value)} />
          <div className="small">{T.createHint}</div>
        </div>
        {errorBox}
        <button type="submit" className="btn gold xl" style={{ marginBottom: 8 }} disabled={!canSubmit}>
          {busy ? T.busy : T.createButton}
        </button>
        <button type="button" className="btn ghost" onClick={() => goTo("home")}>{T.back}</button>
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
        <button className="btn gold xl" style={{ marginBottom: 12 }} onClick={rejoin}>{T.backToTable}</button>
      )}
      <form onSubmit={submitJoin}>
        <div className="card">
          <h3 className="sec">{T.join}</h3>
          <div className="row" style={{ marginBottom: 12 }}>
            <div><span className="lbl">{T.tableCode}</span>
              <input type="text" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="1234"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} /></div>
            <div style={{ flex: 1.4 }}><span className="lbl">{T.yourName}</span>
              <input type="text" maxLength={20} autoComplete="off" placeholder={T.namePlaceholder}
                value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          {found === "none" && <div className="small">{T.noTableWithCode}</div>}
          {running && (
            <>
              <div className="notice" style={{ marginTop: 4 }}>{T.joinRunning}</div>
              <BuyInField settings={found.settings} value={joinBuyIn} onChange={setJoinBuyIn} />
            </>
          )}
        </div>
        {errorBox}
        <button type="submit" className="btn gold xl" style={{ marginBottom: 8 }} disabled={!canJoin}>
          {busy ? T.busy : T.join}
        </button>
      </form>
      <button className="btn ghost" style={{ marginBottom: 8 }} onClick={() => goTo("create")}>{T.createOnline}</button>
      <button className="btn ghost" onClick={onLocal}>{T.playLocal}</button>
    </>
  );
}
