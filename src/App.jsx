import { useState, useEffect, useRef } from "react";
import Lobby from "./Lobby.jsx";
import { Confetti, BalanceView, SettleView } from "./Results.jsx";
import * as engine from "../supabase/functions/_shared/engine.js";
import { common as T, labels } from "./text/de.js";
import { IconPeople, IconUndo, IconCards } from "./ui/icons.jsx";
import {
  Button, TwoTapButton, PauseButton, PlayerRow, NoticeLine, HintLine, ExplainLine, Sheet, SeatChip,
  PotDisplay, PhaseTrack, ActionBar, RaisePanel, HandsSheet, WinnerRow, RoundCard, ColorPicker, SeatFrame,
  VolumeToggle, MomentOverlay,
} from "./ui/components.jsx";
import { SEAT_COLORS, firstFreeColor } from "../supabase/functions/_shared/seats.js";
import { Wordmark } from "./ui/brand.jsx";

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [announce, setAnnounce] = useState(null); // {title, hint}
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

  /* ── Session speichern / laden / Undo ── */
  const KEY = "pokerkasten:session";

  const snapshot = () => ({
    screen, players, dealer, phase, cur, curBet, minRaise, handNum,
    notice, runout, pots, potIdx, winnersSel, handResult,
    names, colors, startChips, sb, beerEvery, blindUp, buyInEuro, volume,
  });

  const restore = (s) => {
    setNames(s.names); setColors(s.colors ?? SEAT_COLORS.slice(0, s.names.length)); setStartChips(s.startChips); setSb(s.sb); setBeerEvery(s.beerEvery); setBlindUp(s.blindUp ?? 0); setBuyInEuro(s.buyInEuro ?? 10); setVolume(s.volume ?? "quiet");
    setPlayers(s.players); setDealer(s.dealer); setPhase(s.phase); setCur(s.cur);
    setCurBet(s.curBet); setMinRaise(s.minRaise); setHandNum(s.handNum);
    setNotice(s.notice); setRunout(s.runout); setPots(s.pots); setPotIdx(s.potIdx);
    setWinnersSel(s.winnersSel); setHandResult(s.handResult);
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
    notice, runout, pots, potIdx, winnersSel, handResult, announce: null,
  });

  // Ergebnis des Rechenkerns in den Bildschirm-Zustand übernehmen
  function apply(next) {
    setScreen(next.screen); setPlayers(next.players); setDealer(next.dealer); setPhase(next.phase);
    setCur(next.cur); setCurBet(next.curBet); setMinRaise(next.minRaise); setHandNum(next.handNum);
    setNotice(next.notice); setRunout(next.runout); setPots(next.pots); setPotIdx(next.potIdx);
    setWinnersSel(next.winnersSel); setHandResult(next.handResult);
    if (next.announce) setAnnounce(next.announce);
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
  function applyAction(kind, amount) {
    pushHist();
    setArmAllIn(false);
    setRaiseOpen(false);
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

  // Toolbar (4.7): Spieler (nicht im Showdown), Rückgängig, Hände
  const toolbar = (withPlayers) => (
    <div className="toolbar">
      {withPlayers && (
        <Button className="small" onClick={() => { setNewBuyIn(startChips); setMgmtOpen(true); }}><IconPeople />{T.playersButton}</Button>
      )}
      <Button className="small" disabled={histLen === 0} onClick={undo}><IconUndo />{T.undo}</Button>
      <Button className="small" onClick={() => setHelpOpen(true)}><IconCards />{T.hands}</Button>
    </div>
  );

  // Doppel-Tipp auf den Filz = Check (nur wenn Check erlaubt ist)
  function feltTap(e) {
    if (screen !== "play" || raiseOpen || announce || mgmtOpen || helpOpen) return;
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

  /* ── Screens ── */
  return (
    <div className="app" onClick={feltTap}>
      {screen === "play" && <SeatFrame color={me?.color} />}
      <div className="wrap">
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
            <div className="card">
              <h3 className="sec">{T.players}</h3>
              {names.map((n, i) => (
                <div className="setupRow" key={i}>
                  <div className="line">
                    <button className="chipBtn" aria-label={T.pickColorFor(n.trim() || T.playerPlaceholder(i + 1))} onClick={() => setPickRow(i)}>
                      <SeatChip color={colors[i]} size={40} decorative />
                    </button>
                    <input type="text" placeholder={T.playerPlaceholder(i + 1)} value={n}
                      onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
                  </div>
                  <div className="manageButtons">
                    <Button className={noobs[i] ? "on" : ""} aria-pressed={noobs[i]}
                      onClick={() => setNoobs(noobs.map((x, j) => (j === i ? !x : x)))}>{T.beginner}</Button>
                    {names.length > 2 && (
                      <Button onClick={() => {
                        setNames(names.filter((_, j) => j !== i));
                        setNoobs(noobs.filter((_, j) => j !== i));
                        setColors(colors.filter((_, j) => j !== i));
                      }}>{T.remove}</Button>
                    )}
                  </div>
                </div>
              ))}
              {names.length < 9 && (
                <Button onClick={() => { setNames([...names, ""]); setNoobs([...noobs, false]); setColors([...colors, firstFreeColor(colors)]); }}>{T.addPlayerRow}</Button>
              )}
              <HintLine left>{T.beginnerHint}</HintLine>
            </div>
            <div className="card">
              <h3 className="sec">{T.rules}</h3>
              <div className="row field">
                <div><span className="lbl">{T.startChips}</span>
                  <input type="number" value={startChips} onChange={(e) => setStartChips(Math.max(1, +e.target.value || 0))} /></div>
                <div><span className="lbl">{T.smallBlind}</span>
                  <input type="number" value={sb} onChange={(e) => setSb(Math.max(1, +e.target.value || 0))} /></div>
              </div>
              <div className="row field">
                <div><span className="lbl">{T.drinksEvery}</span>
                  <input type="number" value={beerEvery} onChange={(e) => setBeerEvery(Math.max(0, +e.target.value || 0))} /></div>
                <div><span className="lbl">{T.blindsUpEvery}</span>
                  <input type="number" value={blindUp} onChange={(e) => setBlindUp(Math.max(0, +e.target.value || 0))} /></div>
              </div>
              <div className="field"><span className="lbl">{T.buyInEuroLabel}</span>
                <input type="number" min="0" step="0.5" value={buyInEuro} onChange={(e) => setBuyInEuro(Math.max(0, +e.target.value || 0))} /></div>
              <VolumeToggle value={volume} onChange={setVolume} />
              <HintLine left>{T.bigBlindHint(bb)}</HintLine>
            </div>
            <Button primary onClick={startGame} disabled={names.filter((n) => n.trim()).length < 2}>{T.startRound}</Button>
          </>
        )}

        {screen === "play" && me && (
          <>
            <div className="headLine">
              {T.headLine(handNum, sbNow, bbNow, players[dealer].name)}
              {blindUp > 0 && <span className="nowrap">{T.blindsRiseIn(blindUp - ((handNum - 1) % blindUp))}</span>}
            </div>
            <PhaseTrack phases={PHASES} phase={phase} />
            {toolbar(true)}
            <PotDisplay amount={pot} />

            <div className="turnHead">
              <SeatChip color={me.color} size={56} />
              <div className="who">{T.phoneTo(me.name)}</div>
            </div>
            <div className="toCall">{toCall > 0 ? L.toCall(toCall) : T.noBet}</div>

            {notice && <NoticeLine>{notice}</NoticeLine>}
            {me.noob && !raiseOpen && (
              <ExplainLine>{toCall > 0 ? L.explainBet(Math.min(toCall, me.chips)) : L.explainFree}</ExplainLine>
            )}
            {!raiseOpen ? (
              <>
                <ActionBar L={L} toCall={toCall} stack={me.chips} total={me.chips + me.bet}
                  raiseAllowed={raiseAllowed} allInAllowed={allInAllowed}
                  armed={armAllIn} onArm={() => setArmAllIn(true)} onAct={applyAction}
                  onRaise={() => { setRaiseTo(Math.min(curBet + minRaise, me.bet + me.chips)); setRaiseOpen(true); }} />
                {!raiseAllowed && me.acted && toCall > 0 && <HintLine>{T.shortAllInHint}</HintLine>}
                {toCall === 0 && <HintLine>{T.doubleTapHint}</HintLine>}
              </>
            ) : (
              <RaisePanel L={L} noob={me.noob} value={raiseTo} onChange={setRaiseTo}
                minTarget={curBet + minRaise} max={me.bet + me.chips} step={bbNow} potBet={potBet}
                onBack={() => setRaiseOpen(false)} onConfirm={(amt) => applyAction("raise", amt)} />
            )}

            <div className="card" style={{ marginTop: 12 }}>
              {players.filter((p) => !p.out && !p.gone).map((p) => {
                const idx = players.indexOf(p);
                return (
                  <PlayerRow key={p.id} name={p.name} color={p.color} current={idx === cur} off={p.folded}
                    badges={[
                      p.noob && T.badge.beginner, idx === dealer && T.badge.dealer, p.allIn && T.badge.allIn,
                      p.away ? (p.folded ? T.badge.pause : T.badge.pauseNext) : p.folded && T.badge.fold,
                    ]}
                    bet={p.bet} stack={p.chips}
                    action={<PauseButton away={p.away} onClick={() => togglePause(p.id)} />} />
                );
              })}
              <HintLine>{T.pauseHint}</HintLine>
            </div>
          </>
        )}

        {screen === "showdown" && (
          <>
            {toolbar(false)}
            {runout && <NoticeLine>{T.runout}</NoticeLine>}
            <PotDisplay amount={pots[potIdx]?.amt ?? 0} label={pots.length > 1 ? (potIdx === 0 ? T.mainPot : T.sidePot(potIdx)) : T.pot} />
            <HintLine>{T.compareCards}</HintLine>
            {pots[potIdx]?.elig.map((id) => {
              const p = players.find((x) => x.id === id);
              const sel = winnersSel.includes(id);
              return (
                <WinnerRow key={id} name={p.name} color={p.color} selected={sel}
                  onClick={() => { setConfirmPot(false); setWinnersSel(sel ? winnersSel.filter((x) => x !== id) : [...winnersSel, id]); }} />
              );
            })}
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
          </>
        )}

        {screen === "handEnd" && (
          <>
            {loud && <Confetti seed={handNum} />}
            {toolbar(true)}
            <div className="title">{T.handOver(handNum)}</div>
            <div className="handResult">{handResult}</div>
            {beerNow && beerPayer && (
              <RoundCard color={beerPayer.color} title={T.drinksRound}>{T.drinksLeader(beerPayer.name, beerPayer.chips)}</RoundCard>
            )}
            <div className="card">
              {players.filter((p) => !p.gone).map((p) => (
                <PlayerRow key={p.id} name={p.name} color={p.color} off={p.out || p.away}
                  badges={[p.out && T.badge.out, !p.out && p.away && T.badge.pause]}
                  stack={p.chips}
                  action={p.out
                    ? <Button className="small" onClick={() => rebuy(p.id)}>{T.rebuy}</Button>
                    : <PauseButton away={p.away} onClick={() => togglePause(p.id)} />} />
              ))}
            </div>
            {blindUp > 0 && blindsFor(handNum + 1).b > bbNow && (
              <NoticeLine>{(loud ? T.pricier : T.blindsRise)(blindsFor(handNum + 1).s, blindsFor(handNum + 1).b)}</NoticeLine>
            )}
            {active(players).length < 2 && <NoticeLine>{T.needTwoActive}</NoticeLine>}
            <div className="stack">
              <Button primary onClick={nextHand} disabled={active(players).length < 2}>{T.nextHand}</Button>
              <TwoTapButton armed={armEnd} onArm={endEvening} onConfirm={endEvening} confirmLabel={T.endEveningConfirm}>
                {T.endEvening}
              </TwoTapButton>
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
          {announce.hint && <p>{announce.hint}</p>}
          <div className="tapHint">{T.tapToContinue}</div>
        </div>
      )}

      {mgmtOpen && (
        <Sheet title={T.manageTitle} onClose={() => setMgmtOpen(false)}>
          <HintLine left>{T.seatOrderHint}</HintLine>
          {players.filter((p) => !p.gone).map((p, vi, visible) => (
            <div key={p.id} className="manageRow">
              <PlayerRow name={p.name} color={p.color} off={p.out || p.away}
                badges={[
                  p.out && T.badge.out, !p.out && p.away && T.badge.pause,
                  screen === "play" && !p.out && !p.folded && T.badge.inHand,
                ]}
                stack={p.chips} />
              <div className="manageButtons">
                <Button disabled={vi === 0} onClick={() => movePlayer(p.id, -1)}>{T.up}</Button>
                <Button disabled={vi === visible.length - 1} onClick={() => movePlayer(p.id, 1)}>{T.down}</Button>
                <Button className={p.noob ? "on" : ""} aria-pressed={p.noob} onClick={() => toggleNoob(p.id)}>{T.beginner}</Button>
                <Button onClick={() => removePlayer(p.id)}>{T.remove}</Button>
              </div>
            </div>
          ))}
          <HintLine left>{T.removeMidHandHint}</HintLine>
          <h3 className="sec" style={{ marginTop: 12 }}>{T.addPlayerTitle}</h3>
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

      {helpOpen && <HandsSheet onClose={() => setHelpOpen(false)} />}
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
