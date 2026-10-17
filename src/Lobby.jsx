import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import OnlineGame from "./OnlineGame.jsx";
import { BuyInField, buyInLabel, parseAmount } from "./buyIn.jsx";
import { common as T } from "./text/de.js";
import {
  Button, TwoTapButton, PlayerRow, ErrorBanner, NoticeLine, HintLine, Sheet, ColorPicker, CodeInput,
} from "./ui/components.jsx";
import { SEAT_COLORS, firstFreeColor } from "../supabase/functions/_shared/seats.js";

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
  const [found, setFound] = useState(null);     // Tisch zum eingegebenen Code: { status, settings, taken } | "none"
  const [color, setColor] = useState(SEAT_COLORS[0]); // gewünschte Sitzfarbe beim Erstellen/Beitreten
  const [colorOpen, setColorOpen] = useState(false);  // Farbauswahl in der Lobby
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
    (async () => {
      const { data } = await supabase.from("sessions").select("id, status, settings:state->settings").eq("code", code).neq("status", "over").maybeSingle();
      if (!active) return;
      if (!data) { setFound("none"); return; }
      // Vergebene Farben anzeigen und die erste freie vorschlagen
      const { data: seated } = await supabase.from("players").select("name, color").eq("session_id", data.id);
      if (!active) return;
      const taken = Object.fromEntries((seated ?? []).filter((p) => p.color).map((p) => [p.color, p.name]));
      setFound({ status: data.status, settings: data.settings ?? DEFAULT_SETTINGS, taken });
      setColor((c) => (taken[c] ? firstFreeColor(Object.keys(taken)) : c));
    })();
    return () => { active = false; };
  }, [code]);

  // Spielerliste und Spielstand laden und bei jeder Änderung neu laden
  const sessionId = table?.session.id;
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const refreshPlayers = async () => {
      const { data } = await supabase.from("players").select("id, name, seat, is_host, buy_in, color").eq("session_id", sessionId).order("seat");
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

  const pickColor = async (c) => {
    setColorOpen(false); setError("");
    try { await callLobby({ action: "setColor", color: c, ...loadSeat() }); } catch (e) { setError(e.message); }
  };

  const goTo = (v) => { setError(""); setView(v); };
  const errorBox = <ErrorBanner>{error}</ErrorBanner>;

  if (!supabase) {
    return (
      <>
        <NoticeLine>{T.notConfigured}</NoticeLine>
        <Button primary onClick={onLocal}>{T.playLocal}</Button>
      </>
    );
  }

  if (view === "loading") {
    return (
      <>
        <div className="title">{error ? T.connectFailed : T.connecting}</div>
        {errorBox}
        <div className="stack">
          {error && <Button primary onClick={rejoin}>{T.retry}</Button>}
          <Button onClick={() => goTo("home")}>{T.toStart}</Button>
        </div>
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
        <div className="card" style={{ textAlign: "center" }}>
          <span className="lbl">{T.tableCode}</span>
          <div className="bigCode">{table.session.code}</div>
          <HintLine>{T.codeHint}</HintLine>
        </div>
        <div className="card">
          <h3 className="sec">{T.atTable(players.length)}</h3>
          {players.map((p) => (
            <PlayerRow key={p.id} name={p.name} color={p.color} badges={[p.is_host && T.badge.admin, p.id === me && T.badge.you]}
              status={buyInLabel(shown, p.buy_in)}
              {...(p.id === me ? { onChipClick: () => setColorOpen(true), chipLabel: T.changeColor } : {})} />
          ))}
          {myRow?.color && <HintLine left>{T.colorHint}</HintLine>}
        </div>
        <div className="card">
          <BuyInField settings={shown} value={myText} onChange={setMyBuyIn} />
        </div>
        {amAdmin ? (
          <div className="card">
            <h3 className="sec">{T.rules}</h3>
            <div className="toggleRow">
              <Button className={shown.money ? "on" : ""} aria-pressed={shown.money} onClick={() => edit({ money: true })}>{T.withMoney}</Button>
              <Button className={!shown.money ? "on" : ""} aria-pressed={!shown.money} onClick={() => edit({ money: false })}>{T.withoutMoney}</Button>
            </div>
            {shown.money ? (
              <div className="row field" style={{ alignItems: "flex-end" }}>
                <div><span className="lbl">{T.rateEuro}</span>
                  <input type="number" min="0" step="0.5" value={shown.buyInEuro}
                    onChange={(e) => edit({ buyInEuro: Math.max(0, +e.target.value || 0) })} /></div>
                <div><span className="lbl">{T.rateChips}</span>
                  <input type="number" value={shown.startChips} onChange={num("startChips", 1)} /></div>
              </div>
            ) : (
              <div className="field"><span className="lbl">{T.suggestChips}</span>
                <input type="number" value={shown.startChips} onChange={num("startChips", 1)} /></div>
            )}
            <div className="row field">
              <div><span className="lbl">{T.smallBlind}</span>
                <input type="number" value={shown.sb} onChange={num("sb", 1)} /></div>
              <div><span className="lbl">{T.drinksEvery}</span>
                <input type="number" value={shown.beerEvery} onChange={num("beerEvery", 0)} /></div>
            </div>
            <div className="field"><span className="lbl">{T.blindsUpEvery}</span>
              <input type="number" value={shown.blindUp} onChange={num("blindUp", 0)} /></div>
            <HintLine left>{T.bigBlindHint(shown.sb * 2)} {shown.money ? T.moneyHint : T.noMoneyHint}</HintLine>
          </div>
        ) : (
          <NoticeLine>
            {shown.money ? T.lobbyRate(shown.buyInEuro.toLocaleString("de-DE"), shown.startChips) : T.lobbyNoMoney} · {T.lobbyBlinds(shown.sb)}
            <br />{T.waitForAdmin}
          </NoticeLine>
        )}
        {errorBox}
        <div className="stack">
          {amAdmin && (
            <Button primary disabled={players.length < 2} loading={busy} onClick={startGame}>
              {players.length < 2 ? T.waitForPlayers : T.startGame(players.length)}
            </Button>
          )}
          <Button onClick={backHome}>{T.toStartKeepSeat}</Button>
          <TwoTapButton disabled={busy} armed={leaveArmed} onArm={leave} onConfirm={leave} confirmLabel={T.leaveTableConfirm}>
            {T.leaveTable}
          </TwoTapButton>
        </div>
        {colorOpen && (
          <Sheet title={T.yourColor} onClose={() => setColorOpen(false)}>
            <ColorPicker value={myRow?.color}
              taken={Object.fromEntries(players.filter((p) => p.id !== me && p.color).map((p) => [p.color, p.name]))}
              onPick={pickColor} />
          </Sheet>
        )}
      </>
    );
  }

  if (view === "create") {
    const canSubmit = name.trim() && !busy;
    const submit = (e) => { e.preventDefault(); if (canSubmit) enter({ action: "create", name, color }); };
    return (
      <form onSubmit={submit}>
        <div className="title">{T.createTitle}</div>
        <HintLine left>{T.createHint}</HintLine>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="field">
            <span className="lbl">{T.yourName}</span>
            <input type="text" maxLength={20} autoComplete="off" placeholder={T.namePlaceholder}
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <span className="lbl">{T.yourColor}</span>
          <ColorPicker value={color} onPick={setColor} />
        </div>
        {errorBox}
        <div className="stack">
          <Button type="submit" primary disabled={!name.trim()} loading={busy}>{T.createButton}</Button>
          <Button type="button" onClick={() => goTo("home")}>{T.back}</Button>
        </div>
      </form>
    );
  }

  // Startseite
  const running = found && found !== "none" && found.status === "playing";
  const amount = parseAmount(joinBuyIn);
  const canJoin = name.trim() && code.length === 4 && (!running || amount === null || amount > 0);
  const submitJoin = (e) => {
    e.preventDefault();
    if (canJoin && !busy) enter({ action: "join", code, name, color, ...(running ? { buyIn: amount } : {}) });
  };
  const seat = loadSeat();
  return (
    <>
      {seat && <Button primary style={{ marginBottom: 12 }} onClick={rejoin}>{T.backToTable}</Button>}
      <form onSubmit={submitJoin}>
        <div className="card">
          <h3 className="sec">{T.join}</h3>
          <div className="field">
            <span className="lbl">{T.tableCode}</span>
            <CodeInput value={code} onChange={setCode} />
            {found === "none" && <HintLine left>{T.noTableWithCode}</HintLine>}
          </div>
          <div className="field">
            <span className="lbl">{T.yourName}</span>
            <input type="text" maxLength={20} autoComplete="off" placeholder={T.namePlaceholder}
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {found && found !== "none" && (
            <div className="field">
              <span className="lbl">{T.yourColor}</span>
              <ColorPicker value={color} taken={found.taken} onPick={setColor} />
            </div>
          )}
          {running && (
            <>
              <NoticeLine>{T.joinRunning}</NoticeLine>
              <BuyInField settings={found.settings} value={joinBuyIn} onChange={setJoinBuyIn} />
            </>
          )}
        </div>
        {errorBox}
        <Button type="submit" primary style={{ marginBottom: 8 }} disabled={!canJoin} loading={busy}>{T.join}</Button>
      </form>
      <div className="stack">
        <Button onClick={() => goTo("create")}>{T.createOnline}</Button>
        <Button onClick={onLocal}>{T.playLocal}</Button>
      </div>
    </>
  );
}
