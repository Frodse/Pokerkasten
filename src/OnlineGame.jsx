import { useState, useEffect, useRef } from "react";
import * as engine from "../supabase/functions/_shared/engine.js";
import { Confetti, BalanceView, SettleView } from "./Results.jsx";
import { BuyInField, buyInLabel, parseAmount } from "./buyIn.jsx";

/* Online-Tisch: Spielbildschirm. Jeder sieht denselben Tisch live, tippen
   darf jeder nur, was ihm zusteht – geprüft wird alles auf dem Server
   (Edge Function "game"). Damit die Admins den Ablauf nicht aufhalten,
   dürfen alle am Tisch Gewinner wählen und die nächste Hand starten.
   Es kann mehrere Admins geben (👑). */

const { PHASES } = engine;
const ANNOUNCE_MS = 3000; // Ansagen verschwinden von selbst
const TIMEOUT_RETRY_MS = 1500; // abgelaufene Uhr erneut melden, falls die Handy-Uhr vorgeht

export default function OnlineGame({ session, seats, meId, call, onExit, onHome, fromLobby }) {
  const game = session.state.game;
  const settings = session.state.settings;
  const clock = session.state.clock;
  const { players, dealer, phase, cur, curBet, minRaise, handNum, pots, potIdx, runout, notice, handResult, screen } = game;
  const isAdmin = !!seats.find((s) => s.id === meId)?.is_host;
  const adminNames = seats.filter((s) => s.is_host).map((s) => s.name).join(", ");
  const mine = players.find((p) => p.uid === meId);
  const seated = !!mine && !mine.gone;
  const turn = players[cur];
  const myTurn = screen === "play" && seated && turn?.uid === meId;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState(null);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [armAllIn, setArmAllIn] = useState(false);
  // Gewinner-Auswahl gehört fest zu einer Hand und einem Pot (kein Zurücksetzen nötig)
  const potKey = `${handNum}:${potIdx}`;
  const [selection, setSelection] = useState({ key: "", ids: [] });
  const winnersSel = selection.key === potKey ? selection.ids : [];
  const setWinnersSel = (ids) => setSelection({ key: potKey, ids });
  const [confirmPot, setConfirmPot] = useState(false);
  const [armEnd, setArmEnd] = useState(false);
  const [armLeave, setArmLeave] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settleView, setSettleView] = useState(false);
  const [rebuyText, setRebuyText] = useState(null); // eigener Rebuy-Betrag, null = Eingabe zu
  const [now, setNow] = useState(Date.now());

  // Jede Ansage (Hand #, Flop …) nur einmal zeigen: Sie bleibt im Spielstand
  // stehen, bis die nächste kommt, deshalb zählt Hand + Straße, nicht jeder
  // neue Stand (Uhr, Pause, Calls). Beim Wiedereinstieg nicht, direkt nach
  // dem Spielstart aus der Lobby schon („Hand #1“).
  const announceKey = game.announce ? `${handNum}:${phase}:${game.announce.title}` : null;
  const seenVersion = useRef(session.version);
  const seenAnnounce = useRef(fromLobby ? null : announceKey);
  useEffect(() => {
    if (session.version <= seenVersion.current) return;
    seenVersion.current = session.version;
    setArmAllIn(false); setConfirmPot(false); setArmEnd(false);
    if (!myTurn) setRaiseOpen(false);
  }, [session.version]);
  useEffect(() => {
    if (!announceKey || announceKey === seenAnnounce.current) return;
    seenAnnounce.current = announceKey;
    setAnnounce(game.announce);
  }, [announceKey]);
  useEffect(() => {
    if (!announce) return;
    const timer = setTimeout(() => setAnnounce(null), ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [announce]);
  useEffect(() => { setConfirmPot(false); }, [handNum, potIdx, screen]);

  // Uhr: sekündlich runterzählen; abgelaufen meldet jedes Handy am Tisch,
  // der Server prüft die Zeit selbst und zählt es nur einmal
  const clockRuns = !!clock && screen === "play" && turn?.uid === clock.uid;
  const secondsLeft = clockRuns ? Math.max(0, Math.ceil((clock.until - now) / 1000)) : 0;
  useEffect(() => {
    if (!clockRuns) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [clockRuns, clock?.until]);
  const lastTimeoutCall = useRef(0);
  useEffect(() => {
    if (!clockRuns || !seated || now < clock.until || now - lastTimeoutCall.current < TIMEOUT_RETRY_MS) return;
    lastTimeoutCall.current = now;
    call({ action: "timeout" }).catch(() => { /* schon erledigt oder Uhr geht vor */ });
  }, [now]);

  const send = async (body) => {
    setBusy(true); setError("");
    try { await call(body); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const act = (kind, amount) => { setArmAllIn(false); setRaiseOpen(false); send({ action: "act", kind, amount }); };
  const mayManage = (p) => p.uid === meId || isAdmin; // sich selbst, Admins alle

  const { s: sbNow, b: bbNow } = engine.blindsFor(handNum, settings);
  const pot = engine.potTotal(players);
  const toCall = turn ? curBet - turn.bet : 0;
  const raiseAllowed = myTurn && engine.canRaise(game);
  const allInAllowed = myTurn && (raiseAllowed || turn.chips + turn.bet <= curBet);
  const potBet = (f) => engine.potBet(game, f, settings);
  const beerNow = handNum > 0 && settings.beerEvery > 0 && handNum % settings.beerEvery === 0;
  const beerPayer = engine.alive(players).slice().sort((a, b) => b.chips - a.chips)[0];
  const errorBox = error && <div className="notice" style={{ borderColor: "#C8332B" }}>{error}</div>;

  const toolbar = (
    <div className="undoRow" style={{ gap: 8 }}>
      <button className="btn ghost sm" onClick={() => { setArmLeave(false); setSheetOpen(true); }}>👥 Spieler · Code {session.code}</button>
      {isAdmin && <button className="btn ghost sm" disabled={busy} onClick={() => send({ action: "undo" })}>↩︎ Rückgängig</button>}
    </div>
  );

  const pauseButton = (p) => mayManage(p) && seated && (
    <button className="pauseBtn" title="Aussetzen ab nächster Hand" disabled={busy}
      onClick={() => send({ action: "pause", targetId: p.uid })}>{p.away ? "▶" : "⏸"}</button>
  );

  return (
    <>
      {screen === "play" && turn && (
        <>
          {toolbar}
          <div className="card" style={{ textAlign: "center" }}>
            <div className="potChip"><div className="amt">{pot}</div><div className="cap">POT</div></div>
            <div className="phaseTrack">
              {PHASES.map((ph, i) => <span key={ph} className={i === phase ? "on" : ""}>{ph}</span>)}
            </div>
            <div className="small">
              Hand #{handNum} · Blinds {sbNow}/{bbNow} · Dealer: {players[dealer].name}
              {settings.blindUp > 0 && <> · steigen in {settings.blindUp - ((handNum - 1) % settings.blindUp)} Hand{settings.blindUp - ((handNum - 1) % settings.blindUp) !== 1 ? "en" : ""}</>}
            </div>
          </div>

          {notice && <div className="notice">{notice}</div>}
          {errorBox}

          <div className="turnBanner" style={myTurn ? { borderStyle: "solid", borderColor: "#E4B04A" } : {}}>
            <div className="todo">{myTurn ? "Du bist dran" : "Am Zug"}</div>
            <div className="who">{turn.name}</div>
            <div className="todo">{toCall > 0 ? `${toCall} zum Mitgehen` : "Kein Einsatz offen"}</div>
            {clockRuns && (
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 44, lineHeight: 1.1, color: secondsLeft <= 10 ? "#E8776F" : "#F3EBD8", marginTop: 6 }}>
                ⏱ {secondsLeft} s
              </div>
            )}
            {clockRuns && <div className="small" style={{ marginTop: 0 }}>Danach {toCall > 0 ? "Fold" : "Check"} – außer {myTurn ? "du tippst" : `${turn.name} tippt`} vorher.</div>}
          </div>
          {isAdmin && seated && (
            <button className="btn ghost" style={{ marginBottom: 12 }} disabled={busy}
              onClick={() => send({ action: "clock", ...(clockRuns ? { stop: true } : {}) })}>
              {clockRuns ? "Uhr stoppen" : `⏱ Uhr starten (30 s) für ${myTurn ? "dich" : turn.name}`}
            </button>
          )}

          {myTurn && turn.noob && !raiseOpen && (
            <div className="notice">
              {toCall > 0
                ? `🐣 Jemand hat gesetzt. Willst du dabei bleiben, musst du ${Math.min(toCall, turn.chips)} zahlen. Sonst: Karten weglegen (kostet nichts mehr) – oder selbst erhöhen.`
                : "🐣 Niemand hat gesetzt. Du kannst gratis schieben und die nächste Karte sehen – oder selbst Chips setzen."}
            </div>
          )}
          {myTurn && !raiseOpen && (
            <>
              <div className="row" style={{ marginBottom: 8 }}>
                <button className="btn red xl" disabled={busy} onClick={() => act("fold")}>
                  {turn.noob ? "🙅 Aufgeben" : "Fold"}
                </button>
                {toCall === 0 ? (
                  <button className="btn xl" disabled={busy} onClick={() => act("check")}>
                    {turn.noob ? "👊 Schieben (gratis)" : "Check"}
                  </button>
                ) : (
                  <button className="btn xl" disabled={busy} onClick={() => act("call")}>
                    {turn.noob
                      ? `✅ Mitgehen – zahle ${Math.min(toCall, turn.chips)}${toCall >= turn.chips ? " (alles!)" : ""}`
                      : `Call ${Math.min(toCall, turn.chips)}${toCall >= turn.chips ? " (All-In)" : ""}`}
                  </button>
                )}
              </div>
              <div className="row">
                <button className="btn gold xl" disabled={!raiseAllowed || busy}
                  onClick={() => { setRaiseTo(Math.min(curBet + minRaise, turn.bet + turn.chips)); setRaiseOpen(true); }}>
                  {turn.noob ? "📈 Mehr setzen" : "Raise"}
                </button>
                <button className={`btn xl ${armAllIn ? "red" : "ghost"}`} disabled={!allInAllowed || busy}
                  onClick={() => (armAllIn ? act("raise", turn.bet + turn.chips) : setArmAllIn(true))}>
                  {armAllIn
                    ? `🔥 Wirklich ALLES (${turn.chips + turn.bet})? Nochmal tippen!`
                    : turn.noob ? `Alles rein! (${turn.chips + turn.bet})` : `All-In ${turn.chips + turn.bet}`}
                </button>
              </div>
              {!raiseAllowed && turn.acted && toCall > 0 && <div className="small">Kurzes All-In vor dir: nur Call oder Fold.</div>}
            </>
          )}
          {myTurn && raiseOpen && (
            <div className="card">
              <span className="lbl">{turn.noob ? "🐣 Auf wie viel willst du insgesamt erhöhen?" : "Erhöhen auf (gesamt diese Runde)"}</span>
              {turn.noob && (
                <div className="small" style={{ textAlign: "left", marginBottom: 4 }}>
                  Die Zahl ist dein Gesamteinsatz in dieser Setzrunde – nicht was du zusätzlich drauflegst.
                </div>
              )}
              <div className="stepper">
                <button onClick={() => setRaiseTo(Math.max(curBet + minRaise, raiseTo - bbNow))}>−</button>
                <div className="val">{raiseTo}</div>
                <button onClick={() => setRaiseTo(Math.min(turn.bet + turn.chips, raiseTo + bbNow))}>+</button>
              </div>
              <div className="row" style={{ marginBottom: 8 }}>
                <button className="btn ghost sm" onClick={() => setRaiseTo(Math.min(curBet + minRaise, turn.bet + turn.chips))}>Min</button>
                <button className="btn ghost sm" onClick={() => setRaiseTo(potBet(0.5))}>½ Pot</button>
                <button className="btn ghost sm" onClick={() => setRaiseTo(potBet(2 / 3))}>⅔ Pot</button>
              </div>
              <div className="row" style={{ marginBottom: 8 }}>
                <button className="btn ghost sm" onClick={() => setRaiseTo(potBet(1))}>Pot</button>
                <button className="btn ghost sm" onClick={() => setRaiseTo(turn.bet + turn.chips)}>Max</button>
              </div>
              <div className="row">
                <button className="btn ghost" onClick={() => setRaiseOpen(false)}>Zurück</button>
                <button className="btn gold" disabled={busy} onClick={() => act("raise", raiseTo)}>
                  {turn.noob ? `Setzen: ${raiseTo}` : "Erhöhen"}
                </button>
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: 12 }}>
            {players.filter((p) => !p.out && !p.gone).map((p) => {
              const idx = players.indexOf(p);
              return (
                <div key={p.id} className={`pl ${idx === cur ? "turn" : ""} ${p.folded ? "folded" : ""}`}>
                  <div className="nm">{p.name}
                    {p.noob && <span title="Dumpfbacken-Modus">🐣</span>}
                    {idx === dealer && <span className="tag d">D</span>}
                    {p.uid === meId && <span className="tag mint">DU</span>}
                    {p.allIn && <span className="tag">ALL-IN</span>}
                    {p.away
                      ? <span className="tag mint">{p.folded ? "PAUSE" : "PAUSE AB NÄCHSTER HAND"}</span>
                      : p.folded && <span className="tag gray">FOLD</span>}
                  </div>
                  <div className="bet">{p.bet > 0 ? `▲ ${p.bet}` : ""}</div>
                  <div className="chips">{p.chips}</div>
                  {pauseButton(p)}
                </div>
              );
            })}
            {seated && <div className="small">⏸ = setzt ab der nächsten Hand aus (Klo, Bier holen)</div>}
          </div>
        </>
      )}

      {screen === "showdown" && (
        <>
          {toolbar}
          {runout && <div className="notice">Alle All-In / nur einer kann noch setzen → Dealer deckt die restlichen Karten auf.</div>}
          <div className="card" style={{ textAlign: "center" }}>
            <div className="potChip"><div className="amt">{pots[potIdx]?.amt}</div>
              <div className="cap">{pots.length > 1 ? (potIdx === 0 ? "MAIN POT" : `SIDE POT ${potIdx}`) : "POT"}</div></div>
            <div className="small">
              {seated ? "Karten vergleichen – wer gewinnt diesen Pot? (Split: mehrere antippen). Das kann jeder am Tisch eintragen." : "Am Tisch werden die Karten verglichen …"}
            </div>
          </div>
          {errorBox}
          {pots[potIdx]?.elig.map((id) => {
            const p = players.find((x) => x.id === id);
            const sel = winnersSel.includes(id);
            return (
              <button key={id} className={`winnerBtn ${sel ? "sel" : ""}`} disabled={!seated}
                onClick={() => { setConfirmPot(false); setWinnersSel(sel ? winnersSel.filter((x) => x !== id) : [...winnersSel, id]); }}>
                <span>{p.name}</span><span>{sel ? "🏆" : ""}</span>
              </button>
            );
          })}
          {seated && (!confirmPot ? (
            <button className="btn gold xl" onClick={() => setConfirmPot(true)} disabled={winnersSel.length === 0}>
              Pot vergeben ({winnersSel.length || 0} Gewinner)
            </button>
          ) : (
            <>
              <div className="notice">
                {winnersSel.map((id) => players.find((x) => x.id === id).name).join(" & ")} bekommt
                {winnersSel.length > 1 ? ` je ${Math.floor(pots[potIdx].amt / winnersSel.length)}` : ` ${pots[potIdx].amt}`} Chips – sicher?
              </div>
              <div className="row">
                <button className="btn ghost" onClick={() => setConfirmPot(false)}>Zurück</button>
                <button className="btn gold xl" disabled={busy}
                  onClick={() => send({ action: "award", winners: winnersSel, potIdx, handNum })}>✓ Karten auf den Tisch!</button>
              </div>
            </>
          ))}
        </>
      )}

      {screen === "handEnd" && (
        <>
          <Confetti seed={handNum} />
          {toolbar}
          {beerNow && beerPayer && (
            <div className="beer">
              <h2>🍺 Bierrunde!</h2>
              <div style={{ fontWeight: 800 }}>{beerPayer.name} führt mit {beerPayer.chips} Chips – und holt die Runde.</div>
            </div>
          )}
          <div className="card">
            <h3 className="sec">Hand #{handNum} beendet</h3>
            <div style={{ fontSize: 14, marginBottom: 10 }}>{handResult}</div>
            {players.filter((p) => !p.gone).map((p) => (
              <div key={p.id} className={`pl ${p.out ? "folded" : ""}`}>
                <div className="nm">{p.name}
                  {p.uid === meId && <span className="tag mint">DU</span>}
                  {p.out && <span className="tag gray">RAUS</span>}
                  {!p.out && p.away && <span className="tag mint">PAUSE</span>}
                </div>
                {p.out
                  ? mayManage(p) && seated && (
                    <button className="btn ghost sm" disabled={busy}
                      onClick={() => (p.uid === meId ? setRebuyText("") : send({ action: "rebuy", targetId: p.uid }))}>
                      {p.uid === meId ? "Rebuy …" : `Rebuy (${buyInLabel(settings, null)})`}
                    </button>
                  )
                  : pauseButton(p)}
                <div className="chips">{p.chips}</div>
              </div>
            ))}
          </div>
          {rebuyText !== null && mine?.out && (
            <div className="card">
              <BuyInField settings={settings} value={rebuyText} onChange={setRebuyText} label="Rebuy" />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn ghost" onClick={() => setRebuyText(null)}>Abbrechen</button>
                <button className="btn gold" disabled={busy || (parseAmount(rebuyText) !== null && !(parseAmount(rebuyText) > 0))}
                  onClick={() => { send({ action: "rebuy", amount: parseAmount(rebuyText) }); setRebuyText(null); }}>Einkaufen</button>
              </div>
            </div>
          )}
          {errorBox}
          {settings.blindUp > 0 && engine.blindsFor(handNum + 1, settings).b > bbNow && (
            <div className="notice">📈 Nächste Hand steigen die Blinds auf {engine.blindsFor(handNum + 1, settings).s}/{engine.blindsFor(handNum + 1, settings).b}.</div>
          )}
          {engine.active(players).length < 2 && (
            <div className="notice">Mindestens 2 Spieler müssen aktiv sein – Pause aufheben (▶).</div>
          )}
          {seated && (
            <button className="btn gold xl" style={{ marginBottom: 8 }} disabled={busy || engine.active(players).length < 2}
              onClick={() => send({ action: "nextHand", handNum })}>
              Nächste Hand – Dealer wandert
            </button>
          )}
          {isAdmin && (
            <button className={`btn ${armEnd ? "red" : "ghost"}`} disabled={busy}
              onClick={() => (armEnd ? send({ action: "endEvening" }) : setArmEnd(true))}>
              {armEnd ? "Wirklich Abend beenden? Nochmal tippen!" : "Abend beenden → Bilanz"}
            </button>
          )}
        </>
      )}

      {screen === "over" && (
        <>
          {settleView ? <SettleView players={players} settings={settings} /> : <BalanceView players={players} settings={settings} seed={handNum + 99} />}
          {settings.money !== false && (
            <button className={`btn ${settleView ? "ghost" : "gold xl"}`} style={{ marginBottom: 8 }} onClick={() => setSettleView(!settleView)}>
              {settleView ? "Zurück zur Bilanz" : "Abrechnen"}
            </button>
          )}
          <button className="btn ghost" onClick={onExit}>Fertig – zurück zum Start</button>
        </>
      )}

      {screen !== "over" && !seated && (
        <div className="notice">Du hast den Tisch verlassen und schaust nur noch zu. Dein Stack zählt in der Bilanz.</div>
      )}

      {mine && screen !== "over" && (
        <>
          <div style={{ height: 76 }} />
          <div className="myStack">
            <div>
              <div className="lbl" style={{ marginBottom: 0 }}>{mine.gone ? "Dein Endstand" : "Deine Chips"}</div>
              {mine.bet > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: "#E4B04A" }}>▲ {mine.bet} gesetzt</div>}
            </div>
            <div className="amt">{mine.chips}</div>
          </div>
        </>
      )}

      {announce && (
        <div className="announce" onClick={() => setAnnounce(null)}>
          <h1>{announce.title}</h1>
          {announce.hint && <p>{announce.hint}</p>}
        </div>
      )}

      {sheetOpen && (
        <div className="overlay" onClick={() => setSheetOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="sec">Spieler · Code {session.code}</h3>
            <div className="small" style={{ textAlign: "left", marginBottom: 8 }}>
              Wer später kommt, tippt den Code auf der Startseite unter „Beitreten“ ein und spielt ab der nächsten Hand mit.
              Admins: {adminNames || "–"}. {isAdmin
                ? "Als Admin kannst du Plätze tauschen (↑↓), Spieler entfernen (✕) und Admins ernennen oder abwählen (👑)."
                : "Admins können Plätze tauschen, Spieler entfernen und weitere Admins ernennen."}
            </div>
            {players.filter((p) => !p.gone).map((p, vi, visible) => (
              <div key={p.id} className={`pl ${p.out ? "folded" : ""}`}>
                <div className="nm">{p.name}
                  {p.uid === meId && <span className="tag mint">DU</span>}
                  {seats.find((s) => s.id === p.uid)?.is_host && <span className="tag d">ADMIN</span>}
                  {p.out && <span className="tag gray">RAUS</span>}
                  {!p.out && p.away && <span className="tag mint">PAUSE</span>}
                </div>
                <div className="chips">{p.chips}</div>
                {isAdmin && seated && (screen === "play" || screen === "handEnd") && (
                  <>
                    <button className="pauseBtn" disabled={vi === 0 || busy} style={vi === 0 ? { opacity: .3 } : {}}
                      title="Nach oben" onClick={() => send({ action: "move", targetId: p.uid, dir: -1 })}>↑</button>
                    <button className="pauseBtn" disabled={vi === visible.length - 1 || busy} style={vi === visible.length - 1 ? { opacity: .3 } : {}}
                      title="Nach unten" onClick={() => send({ action: "move", targetId: p.uid, dir: 1 })}>↓</button>
                  </>
                )}
                {isAdmin && seated && (
                  <button className="pauseBtn" title={seats.find((s) => s.id === p.uid)?.is_host ? "Admin-Rolle wegnehmen" : "Zum Admin machen"} disabled={busy}
                    style={seats.find((s) => s.id === p.uid)?.is_host ? { background: "#E4B04A", borderColor: "#E4B04A" } : {}}
                    onClick={() => send({ action: "toggleAdmin", targetId: p.uid })}>👑</button>
                )}
                {p.uid === meId && (
                  <button className="pauseBtn" style={p.noob ? { background: "#E4B04A", color: "#10241D", borderColor: "#E4B04A" } : {}}
                    title="Dumpfbacken-Modus umschalten" disabled={busy} onClick={() => send({ action: "toggleNoob" })}>🐣</button>
                )}
                {isAdmin && seated && p.uid !== meId && (screen === "play" || screen === "handEnd") && (
                  <button className="pauseBtn" title="Verlässt den Tisch (Stack zählt in der Bilanz)" disabled={busy}
                    onClick={() => send({ action: "leave", targetId: p.uid })}>✕</button>
                )}
              </div>
            ))}
            {errorBox}
            {seated && (screen === "play" || screen === "handEnd") && (
              <button className={`btn ${armLeave ? "red" : "ghost"}`} style={{ marginTop: 8 }} disabled={busy}
                onClick={() => (armLeave ? (setArmLeave(false), send({ action: "leave" })) : setArmLeave(true))}>
                {armLeave ? "Wirklich gehen? Dein Stack zählt in der Bilanz. Nochmal tippen!" : "Ich verlasse den Tisch"}
              </button>
            )}
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={onHome}>Zur Startseite (dein Platz bleibt)</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setSheetOpen(false)}>Schließen</button>
          </div>
        </div>
      )}
    </>
  );
}
