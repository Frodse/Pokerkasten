import { useState, useEffect, useRef } from "react";
import Lobby from "./Lobby.jsx";
import { Confetti, BalanceView, SettleView } from "./Results.jsx";
import * as engine from "../supabase/functions/_shared/engine.js";
import { common as T, labels } from "./text/de.js";
import {
  Button, TwoTapButton, PauseButton, NoticeLine, HintLine, ExplainLine, Sheet, SeatChip,
  PotDisplay, PhaseTrack, ActionBar, RaisePanel, WinnerRow, RoundCard, ColorPicker, SeatFrame,
  VolumeToggle, MomentOverlay, PhaseBanner,
} from "./ui/components.jsx";
import {
  GameShell, TableHead, SeatTiles, SeatTile, tileState, ManageRow, RankingSlide, HandsSlide, LastAction, TableDock, HandEndTitle,
} from "./ui/slides.jsx";
import { SEAT_COLORS, firstFreeColor } from "../supabase/functions/_shared/seats.js";
import { Wordmark } from "./ui/brand.jsx";
import { Switch, Stepper, NumberField, RulesCard } from "./ui/rules.jsx";
import { IconTrash } from "./ui/icons.jsx";
import { useWakeLock, useAudioUnlock } from "./device.js";

const { PHASES } = engine;

export default function PokerKasten() {
  // home = Startseite mit Online-Tisch (Lobby.jsx), local = Menü für ein Handy
  const [screen, setScreen] = useState("home"); // home | local | setup | play | showdown | handEnd | over | settle
  const [saved, setSaved] = useState(null);       // gespeicherte Session (falls vorhanden)
  const [checked, setChecked] = useState(false);  // Storage-Check abgeschlossen
  const histRef = useRef([]);                     // Undo-Stack (Snapshots)
  const [histLen, setHistLen] = useState(0);
  const [names, setNames] = useState(["", ""]);
  const [noobs, setNoobs] = useState([false, false]);
  const [colors, setColors] = useState(SEAT_COLORS.slice(0, 2)); // Sitzfarbe je Setup-Zeile
  const [pickRow, setPickRow] = useState(null);                  // Setup-Zeile, deren Farbe gewählt wird
  const [rulesOpen, setRulesOpen] = useState(false);             // Regeln im Setup aufgeklappt
  const [startChips, setStartChips] = useState(1000);
  const [sb, setSb] = useState(10);
  const [beerEvery, setBeerEvery] = useState(3);
  const [blindUp, setBlindUp] = useState(8); // Blinds verdoppeln alle X Hände (0 = aus)
  const [buyInEuro, setBuyInEuro] = useState(10); // Preis der Start-Chips in €
  const [volume, setVolume] = useState("quiet");  // Kap. 9: quiet | loud
  const [moment, setMoment] = useState(null);     // gerade gezeigter Moment (nur „Laut“)
  const lastMoment = useRef(null);                // Schlüssel des zuletzt gezeigten Moments

  const [players, setPlayers] = useState([]);
  const [dealer, setDealer] = useState(0);
  const [phase, setPhase] = useState(0);
  const [cur, setCur] = useState(0);
  const [curBet, setCurBet] = useState(0);
  const [minRaise, setMinRaise] = useState(0);
  const [handNum, setHandNum] = useState(0);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [notice, setNotice] = useState("");
  const [runout, setRunout] = useState(false);
  const [pots, setPots] = useState([]);
  const [potIdx, setPotIdx] = useState(0);
  const [winnersSel, setWinnersSel] = useState([]);
  const [handResult, setHandResult] = useState("");
  const [lastAction, setLastAction] = useState(null); // nur Anzeige: „Lea erhöht auf 40“
  const [tab, setTab] = useState("table");          // Slide im Spiel (Kap. 13)
  const [openRow, setOpenRow] = useState(null);      // aufgeklappte Zeile im Slide „Spieler“
  const [addOpen, setAddOpen] = useState(false);     // Sheet „Spieler hinzufügen“
  const [announce, setAnnounce] = useState(null); // Handstart-Overlay {title, hint}
  const [banner, setBanner] = useState(null);     // Flop/Turn/River als Banner {title, hint, key}
  const [armAllIn, setArmAllIn] = useState(false);
  const [confirmPot, setConfirmPot] = useState(false);
  const [armEnd, setArmEnd] = useState(false); // "Abend beenden" braucht zwei Taps
  const lastTap = useRef(0);
  const [newName, setNewName] = useState("");
  const [newBuyIn, setNewBuyIn] = useState(1000);

  const bb = sb * 2;
  const settings = { sb, blindUp, startChips, buyInEuro, volume };
  const loud = volume === "loud";
  const blindsFor = (h) => engine.blindsFor(h, settings);
  const { s: sbNow, b: bbNow } = blindsFor(handNum);
  const { alive, active } = engine;
  const pot = engine.potTotal(players);

  // Bildschirm bleibt während des Spiels an; Ton fürs Online-Spiel freischalten
  useWakeLock(["play", "showdown", "handEnd"].includes(screen));
  useAudioUnlock();

  /* ── Session speichern / laden / Undo ── */
  const KEY = "pokerkasten:session";

  const snapshot = () => ({
    screen, players, dealer, phase, cur, curBet, minRaise, handNum,
    notice, runout, pots, potIdx, winnersSel, handResult, lastAction,
    names, noobs, colors, startChips, sb, beerEvery, blindUp, buyInEuro, volume,
  });

  const restore = (s) => {
    setNames(s.names); setNoobs(s.noobs ?? s.names.map(() => false)); setColors(s.colors ?? SEAT_COLORS.slice(0, s.names.length)); setStartChips(s.startChips); setSb(s.sb); setBeerEvery(s.beerEvery); setBlindUp(s.blindUp ?? 0); setBuyInEuro(s.buyInEuro ?? 10); setVolume(s.volume ?? "quiet");
    setPlayers(s.players); setDealer(s.dealer); setPhase(s.phase); setCur(s.cur);
    setCurBet(s.curBet); setMinRaise(s.minRaise); setHandNum(s.handNum);
    setNotice(s.notice); setRunout(s.runout); setPots(s.pots); setPotIdx(s.potIdx);
    setWinnersSel(s.winnersSel); setHandResult(s.handResult); setLastAction(s.lastAction ?? null);
    setRaiseOpen(false); setAnnounce(null); setMoment(null); setArmAllIn(false); setConfirmPot(false); setArmEnd(false); setScreen(s.screen);
  };

  const pushHist = () => {
    histRef.current = [...histRef.current.slice(-19), snapshot()];
    setHistLen(histRef.current.length);
  };

  const undo = () => {
    const h = histRef.current;
    if (!h.length) return;
    const s = h[h.length - 1];
    histRef.current = h.slice(0, -1);
    setHistLen(histRef.current.length);
    restore(s);
  };

  // Beim Start: gespeicherte Session suchen
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.snap && !["home", "local", "start", "setup"].includes(s.snap.screen)) setSaved(s);
      }
    } catch (e) { /* nichts gespeichert */ }
    setChecked(true);
  }, []);

  // Automatisch speichern, sobald gespielt wird
  useEffect(() => {
    if (["home", "local", "setup"].includes(screen)) return;
    const data = JSON.stringify({ snap: snapshot(), hist: histRef.current.slice(-8) });
    try { window.localStorage.setItem(KEY, data); } catch (e) { /* Storage voll oder deaktiviert */ }
  }, [players, screen, cur, phase, curBet, potIdx, winnersSel, handResult]);

  const resumeSaved = () => {
    if (!saved) return;
    histRef.current = saved.hist || [];
    setHistLen(histRef.current.length);
    restore(saved.snap);
  };

  /* ── Spielzüge: rechnet alles engine.js, hier nur Undo und Oberfläche ── */
  const game = () => ({
    screen, players, dealer, phase, cur, curBet, minRaise, handNum,
    notice, runout, pots, potIdx, winnersSel, handResult, lastAction, announce: null,
  });

  // Ergebnis des Rechenkerns in den Bildschirm-Zustand übernehmen
  function apply(next) {
    setScreen(next.screen); setPlayers(next.players); setDealer(next.dealer); setPhase(next.phase);
    setCur(next.cur); setCurBet(next.curBet); setMinRaise(next.minRaise); setHandNum(next.handNum);
    setNotice(next.notice); setRunout(next.runout); setPots(next.pots); setPotIdx(next.potIdx);
    setWinnersSel(next.winnersSel); setHandResult(next.handResult); setLastAction(next.lastAction ?? null);
    // Nur der Handstart blockiert den Bildschirm, Straßen kommen als Banner (4.13)
    if (next.announce) {
      if (next.phase === 0) setAnnounce(next.announce);
      else setBanner({ ...next.announce, key: `${next.handNum}:${next.phase}` });
    }
    if (next.moment && next.moment.key !== lastMoment.current) {
      lastMoment.current = next.moment.key;
      if (loud) setMoment(next.moment);
    }
    setConfirmPot(false);
    setArmEnd(false);
  }

  /* ── Setup ── */
  const startGame = () => {
    const g = game();
    const next = engine.startGame(g, names.map((name, i) => ({ name, noob: noobs[i], color: colors[i] })), settings, Math.random());
    if (next === g) return;
    histRef.current = []; setHistLen(0);
    setSaved(null);
    apply(next);
  };

  /* ── Actions ── */
  // 13.2: nach jeder Aktion zurück auf „Tisch“
  function applyAction(kind, amount) {
    pushHist();
    setArmAllIn(false);
    setRaiseOpen(false);
    setTab("table");
    apply(engine.applyAction(game(), kind, amount, settings));
  }

  function awardPot() {
    if (winnersSel.length === 0) return;
    pushHist();
    apply(engine.awardPot(game()));
  }

  function nextHand() {
    pushHist();
    apply(engine.nextHand(game(), settings));
  }

  function addPlayer() {
    const next = engine.addPlayer(game(), newName, newBuyIn);
    if (!next) return;
    pushHist();
    apply(next);
    setNewName("");
    setAddOpen(false);
  }

  function removePlayer(id) {
    pushHist();
    setRaiseOpen(false);
    apply(engine.removePlayer(game(), id, settings));
  }

  const movePlayer = (id, dir) => apply(engine.movePlayer(game(), id, dir));
  const toggleNoob = (id) => apply(engine.toggleNoob(game(), id));
  const togglePause = (id) => apply(engine.togglePause(game(), id));

  function endEvening() {
    if (!armEnd) { setArmEnd(true); return; }
    apply(engine.endEvening(game()));
  }

  function rebuy(id) {
    pushHist();
    apply(engine.rebuy(game(), id, settings));
  }

  /* ── Derived ── */
  const me = players[cur];
  const L = labels(me?.noob); // Beschriftungen nach Modus des Spielers am Zug
  const toCall = me ? curBet - me.bet : 0;
  const raiseAllowed = engine.canRaise(game());
  const allInAllowed = me ? raiseAllowed || me.chips + me.bet <= curBet : false; // Z1: All-In nur als Call
  const potBet = (f) => engine.potBet(game(), f, settings);
  const beerNow = handNum > 0 && beerEvery > 0 && handNum % beerEvery === 0;
  const beerPayer = alive(players).slice().sort((a, b) => b.chips - a.chips)[0];

  // Doppel-Tipp auf den Hintergrund von „Tisch“ = Check (nur wenn Check erlaubt ist)
  function feltTap(e) {
    if (screen !== "play" || raiseOpen || announce || addOpen) return;
    if (e.target.closest("button,input,.sheet,.overlay")) return;
    const now = Date.now();
    if (now - lastTap.current < 350) {
      lastTap.current = 0;
      if (toCall === 0 && me && !me.folded && !me.allIn) {
        applyAction("check");
        setNotice(T.doubleTapNotice(me.name));
      }
    } else {
      lastTap.current = now;
    }
  }

  // Showdown und Hand-Ende erscheinen auf „Tisch“ (13.2)
  useEffect(() => { if (screen === "showdown" || screen === "handEnd") setTab("table"); }, [screen]);
  useEffect(() => { setOpenRow(null); }, [screen === "showdown"]);

  const inGame = ["play", "showdown", "handEnd"].includes(screen);
  const visible = players.filter((p) => !p.gone);
  const phaseWord = screen === "showdown" ? T.phaseShowdown : null; // im Hand-Ende sagt es der Titel
  const head = (
    <TableHead handNum={handNum} phaseWord={phaseWord} sb={sbNow} bb={bbNow}
      riseIn={blindUp > 0 ? blindUp - ((handNum - 1) % blindUp) : 0} onUndo={undo} undoDisabled={histLen === 0} />
  );
  const tiles = (extraFor) => (
    <SeatTiles>
      {visible.map((p) => {
        const idx = players.indexOf(p);
        const { status, off, win } = tileState(p, screen);
        return (
          <SeatTile key={p.id} p={p} status={status} off={off} win={win} current={screen === "play" && idx === cur}
            dealer={idx === dealer} extra={extraFor?.(p)} />
        );
      })}
    </SeatTiles>
  );

  const tableSlide = (
    <>
      {screen === "play" && me && (
        <>
          {head}
          <PhaseTrack phases={PHASES} phase={phase} />
          <PotDisplay amount={pot} />
          {tiles()}
          {!raiseOpen && <LastAction players={players} lastAction={lastAction} />}
          {notice && !raiseOpen && <NoticeLine>{notice}</NoticeLine>}
          <TableDock>
            <div className={`turnHead ${raiseOpen ? "duringRaise" : ""}`}>
              <SeatChip color={me.color} size={40} />
              <div className="who">{T.phoneTo(me.name)}</div>
            </div>
            <div className={`toCall ${raiseOpen ? "duringRaise" : ""}`}>{toCall > 0 ? L.toCall(toCall) : T.noBet}</div>
            {me.noob && !raiseOpen && (
              <ExplainLine>{toCall > 0 ? L.explainBet(Math.min(toCall, me.chips)) : L.explainFree}</ExplainLine>
            )}
            {!raiseOpen ? (
              <>
                {!raiseAllowed && me.acted && toCall > 0 && <HintLine>{T.shortAllInHint}</HintLine>}
                {toCall === 0 && <HintLine>{T.doubleTapHint}</HintLine>}
                <ActionBar L={L} toCall={toCall} stack={me.chips} total={me.chips + me.bet}
                  raiseAllowed={raiseAllowed} allInAllowed={allInAllowed}
                  armed={armAllIn} onArm={() => setArmAllIn(true)} onAct={applyAction}
                  onRaise={() => { setRaiseTo(Math.min(curBet + minRaise, me.bet + me.chips)); setRaiseOpen(true); }} />
              </>
            ) : (
              <RaisePanel L={L} noob={me.noob} value={raiseTo} onChange={setRaiseTo}
                minTarget={curBet + minRaise} max={me.bet + me.chips} step={bbNow} potBet={potBet}
                onBack={() => setRaiseOpen(false)} onConfirm={(amt) => applyAction("raise", amt)} />
            )}
          </TableDock>
        </>
      )}

      {screen === "showdown" && (() => {
        const elig = pots[potIdx]?.elig ?? [];
        const rows = elig.map((id) => {
          const p = players.find((x) => x.id === id);
          const sel = winnersSel.includes(id);
          return (
            <WinnerRow key={id} name={p.name} color={p.color} selected={sel}
              onClick={() => { setConfirmPot(false); setWinnersSel(sel ? winnersSel.filter((x) => x !== id) : [...winnersSel, id]); }} />
          );
        });
        return (
          <>
            {head}
            {runout && <NoticeLine>{T.runout}</NoticeLine>}
            <PotDisplay amount={pots[potIdx]?.amt ?? 0} label={pots.length > 1 ? (potIdx === 0 ? T.mainPot : T.sidePot(potIdx)) : T.pot} />
            <HintLine>{T.compareCards}</HintLine>
            {elig.length >= 7 ? <div className="winnerGrid">{rows}</div> : rows}
            <TableDock>
              {!confirmPot ? (
                <Button primary onClick={() => setConfirmPot(true)} disabled={winnersSel.length === 0}>
                  {T.awardPot(winnersSel.length || 0)}
                </Button>
              ) : (
                <>
                  <NoticeLine>
                    {T.awardSure(winnersSel.map((id) => players.find((x) => x.id === id).name).join(" & "), winnersSel.length, Math.floor(pots[potIdx].amt / winnersSel.length))}
                  </NoticeLine>
                  <div className="row">
                    <Button onClick={() => setConfirmPot(false)}>{T.back}</Button>
                    <Button primary onClick={awardPot}>{T.confirm}</Button>
                  </div>
                </>
              )}
            </TableDock>
          </>
        );
      })()}

      {screen === "handEnd" && (
        <>
          {loud && <Confetti seed={handNum} />}
          {head}
          <HandEndTitle players={players} handNum={handNum} handResult={handResult} />
          {beerNow && beerPayer && (
            <RoundCard color={beerPayer.color} title={T.drinksRound}>{T.drinksLeader(beerPayer.name, beerPayer.chips)}</RoundCard>
          )}
          {/* Rebuy direkt auf der Kachel, damit er nicht schwerer erreichbar wird (13.4) */}
          {tiles((p) => p.out && <Button onClick={() => rebuy(p.id)}>{T.rebuy}</Button>)}
          {blindUp > 0 && blindsFor(handNum + 1).b > bbNow && (
            <NoticeLine>{(loud ? T.pricier : T.blindsRise)(blindsFor(handNum + 1).s, blindsFor(handNum + 1).b)}</NoticeLine>
          )}
          {engine.blockedReason(players) && (
            <NoticeLine>{engine.blockedReason(players) === "chips" ? T.needTwoChips : T.needTwoPaused}</NoticeLine>
          )}
          {/* weit weg von „Nächste Hand“, das unten am Daumen sitzt */}
          <TwoTapButton armed={armEnd} onArm={endEvening} onConfirm={endEvening} confirmLabel={T.endEveningConfirm}>
            {T.endEvening}
          </TwoTapButton>
          <TableDock>
            <Button primary onClick={nextHand} disabled={active(players).length < 2}>{T.nextHand}</Button>
          </TableDock>
        </>
      )}
    </>
  );

  // Slide „Spieler“ (13.5): ersetzt das Sheet „Spielerverwaltung“. Im
  // Showdown wird nichts verwaltet (wie bisher), nur angezeigt.
  const manage = screen !== "showdown";
  const playersSlide = (
    <>
      <div className="title">{T.manageTitle}</div>
      <HintLine left>{T.seatOrderHint}</HintLine>
      <div className={`card ${visible.length >= 9 ? "many" : ""}`}>
        {visible.map((p, vi) => (
          <ManageRow key={p.id} p={p} off={p.out || p.away} open={openRow === p.id}
            onToggle={() => setOpenRow(openRow === p.id ? null : p.id)}
            badges={[
              p.noob && T.badge.beginner, players.indexOf(p) === dealer && T.badge.dealer, p.out && T.badge.out,
              !p.out && p.away && (screen === "play" && !p.folded ? T.badge.pauseNext : T.badge.pause),
            ]}
            pause={manage && !p.out && <PauseButton away={p.away} onClick={() => togglePause(p.id)} />}
            buttons={manage && (
              <>
                <Button disabled={vi === 0} onClick={() => movePlayer(p.id, -1)}>{T.up}</Button>
                <Button disabled={vi === visible.length - 1} onClick={() => movePlayer(p.id, 1)}>{T.down}</Button>
                <Button className={p.noob ? "on" : ""} aria-pressed={p.noob} onClick={() => toggleNoob(p.id)}>{T.beginner}</Button>
                <Button onClick={() => { setOpenRow(null); removePlayer(p.id); }}>{T.remove}</Button>
              </>
            )} />
        ))}
      </div>
      {manage && (
        <>
          <HintLine left>{T.removeMidHandHint}</HintLine>
          <Button disabled={alive(players).length >= 9} onClick={() => { setNewBuyIn(startChips); setAddOpen(true); }}>{T.addPlayerTitle}</Button>
          <HintLine>{T.pauseFromNext}</HintLine>
        </>
      )}
      {/* Spiel bleibt gespeichert, „Alte Session fortsetzen“ holt es zurück */}
      <Button style={{ marginTop: 8 }} onClick={() => { setSaved({ snap: snapshot(), hist: histRef.current.slice(-8) }); setScreen("home"); }}>
        {T.toStartKeepGame}
      </Button>
    </>
  );

  /* ── Screens ── */
  return (
    <div className="app">
      {screen === "play" && <SeatFrame color={me?.color} />}
      {inGame && (
        <GameShell tab={tab} onTab={setTab} locked={raiseOpen} onTableClick={feltTap}
          slides={{
            players: playersSlide,
            table: tableSlide,
            ranking: <RankingSlide players={players} handNum={handNum} screen={screen} beerEvery={beerEvery} settings={settings} />,
            hands: <HandsSlide />,
          }} />
      )}
      <div className="wrap" hidden={inGame}>
        <Wordmark />

        {screen === "local" && (
          <>
            <div className="title">{T.localTitle}</div>
            <HintLine left>
              {checked
                ? saved
                  ? T.savedFound(saved.snap.handNum, saved.snap.players.filter((p) => !p.out).length)
                  : T.savedNone
                : T.savedSearching}
            </HintLine>
            <div className="stack" style={{ marginTop: 16 }}>
              <Button primary disabled={!saved} onClick={resumeSaved}>{T.resumeSession}</Button>
              <Button onClick={() => setScreen("setup")}>{T.newSession}</Button>
              <Button onClick={() => setScreen("home")}>{T.backToStart}</Button>
            </div>
          </>
        )}

        {screen === "home" && <Lobby onLocal={() => setScreen("local")} />}

        {screen === "setup" && (
          <>
            {/* 5.3: eine Zeile pro Spieler – Farbe · Name · Anfänger · Entfernen */}
            <div className="card">
              <div className="setupGrid setupHead">
                <h3 className="sec">{T.players}</h3>
                <span className="colHead">{T.beginner}</span>
              </div>
              {names.map((n, i) => {
                const who = n.trim() || T.playerPlaceholder(i + 1);
                return (
                  <div className="setupGrid setupRow" key={i}>
                    <button className="chipBtn" aria-label={T.pickColorFor(who)} onClick={() => setPickRow(i)}>
                      <SeatChip color={colors[i]} size={40} decorative />
                    </button>
                    <input type="text" placeholder={T.playerPlaceholder(i + 1)} value={n}
                      onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
                    <Switch checked={noobs[i]} label={T.beginnerFor(who)}
                      onChange={(on) => setNoobs(noobs.map((x, j) => (j === i ? on : x)))} />
                    {names.length > 2 ? (
                      <button className="iconBtn" aria-label={T.removeRow(who)} onClick={() => {
                        setNames(names.filter((_, j) => j !== i));
                        setNoobs(noobs.filter((_, j) => j !== i));
                        setColors(colors.filter((_, j) => j !== i));
                      }}><IconTrash /></button>
                    ) : <span />}
                  </div>
                );
              })}
              {names.length < 9 && (
                <Button style={{ marginTop: 8 }} onClick={() => { setNames([...names, ""]); setNoobs([...noobs, false]); setColors([...colors, firstFreeColor(colors)]); }}>{T.addPlayerRow}</Button>
              )}
              <HintLine left>{T.beginnerHint}</HintLine>
            </div>
            <RulesCard open={rulesOpen} onToggle={() => setRulesOpen(!rulesOpen)}
              lines={[
                `${T.sumChips(startChips)} · ${T.sumBlinds(sb)} · ${T.sumEuro(buyInEuro.toLocaleString("de-DE"))}`,
                `${T.sumDrinks(beerEvery)} · ${T.sumBlindsUp(blindUp)} · ${volume === "loud" ? T.loud : T.quiet}`,
              ]}>
              <div className="row">
                <NumberField label={T.startChips} value={startChips} onChange={(e) => setStartChips(Math.max(1, +e.target.value || 0))} />
                <NumberField label={T.smallBlind} hint={T.bigBlindIs(bb)} value={sb} onChange={(e) => setSb(Math.max(1, +e.target.value || 0))} />
              </div>
              <Stepper label={T.drinksLabel} value={beerEvery} onChange={setBeerEvery} text={T.everyHands} />
              <Stepper label={T.blindsUpLabel} value={blindUp} onChange={setBlindUp} text={T.everyHands} />
              <NumberField label={T.buyInEuroLabel} min="0" step="0.5" value={buyInEuro} onChange={(e) => setBuyInEuro(Math.max(0, +e.target.value || 0))} />
              <VolumeToggle value={volume} onChange={setVolume} />
              <HintLine left>{T.bigBlindHint(bb)}</HintLine>
            </RulesCard>
            <div className="stack">
              <Button primary onClick={startGame} disabled={names.filter((n) => n.trim()).length < 2}>{T.startRound}</Button>
              <Button onClick={() => setScreen("local")}>{T.back}</Button>
            </div>
          </>
        )}

        {screen === "over" && (
          <>
            <BalanceView players={players} settings={settings} seed={handNum + 99} />
            <div className="stack">
              <Button primary onClick={() => setScreen("settle")}>{T.settle}</Button>
              <Button onClick={() => setScreen("setup")}>{T.newGame}</Button>
            </div>
          </>
        )}

        {screen === "settle" && (
          <>
            <SettleView players={players} settings={settings} />
            <div className="stack">
              <Button onClick={() => setScreen("over")}>{T.backToBalance}</Button>
              <Button onClick={() => setScreen("setup")}>{T.newGame}</Button>
            </div>
          </>
        )}
      </div>

      {announce && (
        <div className="announce" onClick={() => setAnnounce(null)}>
          <h1>{announce.title}</h1>
          {/* Vor dem Flop gibt es nur die Handstart-Ansage: dort steht der Dealer (4.13) */}
          {announce.hint && <p>{phase === 0 && <SeatChip color={players[dealer]?.color} size={32} />}{announce.hint}</p>}
          <div className="tapHint">{T.tapToContinue}</div>
        </div>
      )}

      {addOpen && (
        <Sheet title={T.addPlayerTitle} onClose={() => setAddOpen(false)}>
          <div className="row" style={{ marginBottom: 8 }}>
            <div style={{ flex: 2 }}>
              <span className="lbl">{T.name}</span>
              <input type="text" value={newName} placeholder={T.newNamePlaceholder}
                onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <span className="lbl">{T.buyInChipsLabel}</span>
              <input type="number" value={newBuyIn}
                onChange={(e) => setNewBuyIn(Math.max(1, +e.target.value || 0))} />
            </div>
          </div>
          <Button primary disabled={!newName.trim() || alive(players).length >= 9} onClick={addPlayer}>
            {T.addPlayer}
          </Button>
        </Sheet>
      )}

      {inGame && <PhaseBanner banner={banner} />}
      {moment && <MomentOverlay moment={moment} players={players} onClose={() => setMoment(null)} />}

      {pickRow !== null && (
        <Sheet title={T.pickColorFor(names[pickRow]?.trim() || T.playerPlaceholder(pickRow + 1))} onClose={() => setPickRow(null)}>
          <ColorPicker value={colors[pickRow]} mine=""
            taken={Object.fromEntries(colors.map((c, j) => [c, names[j].trim() || T.playerPlaceholder(j + 1)]).filter((_, j) => j !== pickRow))}
            onPick={(c) => { setColors(colors.map((x, j) => (j === pickRow ? c : x))); setPickRow(null); }} />
        </Sheet>
      )}
    </div>
  );
}
