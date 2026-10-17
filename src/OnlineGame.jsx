import { useState, useEffect, useRef } from "react";
import * as engine from "../supabase/functions/_shared/engine.js";
import { Confetti, BalanceView, SettleView } from "./Results.jsx";
import { BuyInField, buyInLabel, parseAmount } from "./buyIn.jsx";
import { common as T, labels } from "./text/de.js";
import { IconPeople, IconUndo, IconClock, IconCards } from "./ui/icons.jsx";
import {
  Button, TwoTapButton, PauseButton, PlayerRow, NoticeLine, HintLine, ExplainLine, ErrorBanner, Sheet,
  ActionBar, RaisePanel, HandsSheet, SeatChip, PotDisplay, WinnerRow, RoundCard,
} from "./ui/components.jsx";

/* Online-Tisch: Spielbildschirm. Jeder sieht denselben Tisch live, tippen
   darf jeder nur, was ihm zusteht – geprüft wird alles auf dem Server
   (Edge Function "game"). Damit die Admins den Ablauf nicht aufhalten,
   schlägt im Showdown irgendwer die Gewinner vor und alle mit Karten
   bestätigen; die nächste Hand startet, wenn alle „Bereit“ getippt haben.
   Es kann mehrere Admins geben, sie können beides abkürzen. */

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

  const [pending, setPending] = useState(null); // Aktion, auf deren Antwort wir warten
  const busy = pending !== null;
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
  const [armEnd, setArmEnd] = useState(false);
  const [armLeave, setArmLeave] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [handsOpen, setHandsOpen] = useState(false);
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
    setArmAllIn(false); setArmEnd(false);
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
    setPending(body.action); setError("");
    try { await call(body); } catch (e) { setError(e.message); }
    setPending(null);
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
  const errorBox = <ErrorBanner>{error}</ErrorBanner>;
  const L = labels(turn?.noob); // Beschriftungen nach Modus des Spielers am Zug

  // Abstimmungen: Gewinner bestätigen (Showdown) und „Bereit“ (Hand-Ende)
  const vote = session.state.vote && session.state.vote.handNum === handNum ? session.state.vote : null;
  const noteState = session.state.note;
  const note = noteState && noteState.handNum === handNum && noteState.potIdx === potIdx ? noteState.text : null;
  const readyYes = vote?.kind === "ready" ? vote.yes : [];
  const iActive = !!mine && !mine.out && !mine.away && !mine.gone;
  const iReady = readyYes.includes(meId);
  const notReady = engine.active(players).filter((p) => !readyYes.includes(p.uid));

  const toolbar = (
    <div className="toolbar">
      <Button className="small" onClick={() => { setArmLeave(false); setSheetOpen(true); }}><IconPeople />{T.playersButton}</Button>
      {isAdmin && <Button className="small" disabled={busy} onClick={() => send({ action: "undo" })}><IconUndo />{T.undo}</Button>}
      <Button className="small" onClick={() => setHandsOpen(true)}><IconCards />{T.hands}</Button>
    </div>
  );

  const pauseButton = (p) => mayManage(p) && seated && (
    <PauseButton away={p.away} disabled={busy} onClick={() => send({ action: "pause", targetId: p.uid })} />
  );
  const isAdminSeat = (p) => !!seats.find((s) => s.id === p.uid)?.is_host;

  return (
    <>
      {screen === "play" && turn && (
        <>
          {toolbar}
          <div className="card" style={{ textAlign: "center" }}>
            <div className="potChip"><div className="amt">{pot}</div><div className="cap">{T.pot}</div></div>
            <div className="phaseTrack">
              {PHASES.map((ph, i) => <span key={ph} className={i === phase ? "on" : ""}>{ph}</span>)}
            </div>
            <div className="small">
              {T.headLine(handNum, sbNow, bbNow, players[dealer].name)}
              {settings.blindUp > 0 && T.blindsRiseIn(settings.blindUp - ((handNum - 1) % settings.blindUp))}
            </div>
          </div>

          {notice && <NoticeLine>{notice}</NoticeLine>}
          {errorBox}

          {myTurn ? (
            <>
              <div className="turnHead">
                <SeatChip color={turn.color} size={56} />
                <div className="who">{T.yourTurn}</div>
              </div>
              <div className="toCall">{toCall > 0 ? L.toCall(toCall) : T.noBet}</div>
              {clockRuns && <div className="clock">{T.clockSeconds(secondsLeft)}</div>}
              {clockRuns && <HintLine left>{T.clockThen(toCall > 0, myTurn, turn.name)}</HintLine>}
            </>
          ) : (
            // Ohne Sitzfarbe (kommt mit Design-Schritt 8) eine neutrale Karte
            <div className={`turnBanner ${turn.color ? "" : "neutral"}`} style={turn.color ? { "--seat": `var(--${turn.color})` } : undefined}>
              <SeatChip color={turn.color} size={56} />
              <div className="who">{T.isTurn(turn.name)}</div>
              <div className="sub">{toCall > 0 ? L.toCall(toCall) : T.noBet}</div>
              {clockRuns && <div className="clock">{T.clockSeconds(secondsLeft)}</div>}
              {clockRuns && <div className="sub">{T.clockThen(toCall > 0, myTurn, turn.name)}</div>}
            </div>
          )}
          {isAdmin && seated && (
            <button className="btn ghost" style={{ marginBottom: 12 }} disabled={busy}
              onClick={() => send({ action: "clock", ...(clockRuns ? { stop: true } : {}) })}>
              {!clockRuns && <IconClock />}{clockRuns ? T.clockStop : T.clockStart(myTurn ? T.clockYou : turn.name)}
            </button>
          )}

          {myTurn && turn.noob && !raiseOpen && (
            <ExplainLine>{toCall > 0 ? L.explainBet(Math.min(toCall, turn.chips)) : L.explainFree}</ExplainLine>
          )}
          {myTurn && !raiseOpen && (
            <>
              <ActionBar L={L} toCall={toCall} stack={turn.chips} total={turn.chips + turn.bet}
                raiseAllowed={raiseAllowed} allInAllowed={allInAllowed} disabled={busy}
                armed={armAllIn} onArm={() => setArmAllIn(true)} onAct={act}
                onRaise={() => { setRaiseTo(Math.min(curBet + minRaise, turn.bet + turn.chips)); setRaiseOpen(true); }} />
              {!raiseAllowed && turn.acted && toCall > 0 && <HintLine>{T.shortAllInHint}</HintLine>}
            </>
          )}
          {myTurn && raiseOpen && (
            <RaisePanel L={L} noob={turn.noob} value={raiseTo} onChange={setRaiseTo}
              minTarget={curBet + minRaise} max={turn.bet + turn.chips} step={bbNow} potBet={potBet}
              onBack={() => setRaiseOpen(false)} onConfirm={(amt) => act("raise", amt)} disabled={busy} />
          )}

          <div className="card" style={{ marginTop: 12 }}>
            {players.filter((p) => !p.out && !p.gone).map((p) => {
              const idx = players.indexOf(p);
              return (
                <PlayerRow key={p.id} name={p.name} color={p.color} current={idx === cur} off={p.folded}
                  badges={[
                    p.noob && T.badge.beginner, idx === dealer && T.badge.dealer, p.uid === meId && T.badge.you,
                    p.allIn && T.badge.allIn, p.away ? (p.folded ? T.badge.pause : T.badge.pauseNext) : p.folded && T.badge.fold,
                  ]}
                  bet={p.bet} stack={p.chips} action={pauseButton(p)} />
              );
            })}
            {seated && <HintLine>{T.pauseHint}</HintLine>}
          </div>
        </>
      )}

      {screen === "showdown" && (() => {
        const amt = pots[potIdx]?.amt ?? 0;
        const nameOf = (id) => players.find((x) => x.id === id).name;
        const share = (ids) => Math.floor(amt / ids.length);
        const voters = (pots[potIdx]?.elig ?? []).map((id) => players.find((x) => x.id === id)).filter((p) => !p.gone);
        const proposal = vote?.kind === "award" ? vote : null;
        const missing = proposal ? voters.filter((p) => !proposal.yes.includes(p.uid)) : [];
        const iVote = voters.some((p) => p.uid === meId);
        const iAgreed = proposal?.yes.includes(meId);
        const byName = proposal && (players.find((x) => x.uid === proposal.by)?.name ?? T.someone);
        const answer = (agree) => send({ action: "vote", voteId: proposal.id, agree });
        return (
          <>
            {toolbar}
            {runout && <NoticeLine>{T.runout}</NoticeLine>}
            <PotDisplay amount={amt} label={pots.length > 1 ? (potIdx === 0 ? T.mainPot : T.sidePot(potIdx)) : T.pot} />
            {!proposal && <HintLine>{seated ? T.compareCardsOnline : T.comparingAtTable}</HintLine>}
            {errorBox}
            {!proposal ? (
              <>
                {note && <NoticeLine>{note}</NoticeLine>}
                {voters.map((p) => {
                  const sel = winnersSel.includes(p.id);
                  return (
                    <WinnerRow key={p.id} name={p.name} color={p.color} selected={sel} disabled={!seated}
                      onClick={() => setWinnersSel(sel ? winnersSel.filter((x) => x !== p.id) : [...winnersSel, p.id])} />
                  );
                })}
                {seated && (
                  <Button primary disabled={busy || winnersSel.length === 0} loading={pending === "propose"}
                    onClick={() => send({ action: "propose", winners: winnersSel, potIdx, handNum })}>
                    {winnersSel.length ? T.propose(winnersSel.map(nameOf).join(" & "), winnersSel.length) : T.pickWinner}
                  </Button>
                )}
              </>
            ) : (
              <>
                <RoundCard color={proposal.winners.length === 1 ? players.find((x) => x.id === proposal.winners[0])?.color : undefined}
                  title={proposal.winners.map(nameOf).join(" & ")}>
                  {T.proposalGets(proposal.winners.length, share(proposal.winners), byName)}
                </RoundCard>
                <div className="card">
                  {voters.map((p) => (
                    <PlayerRow key={p.id} name={p.name} color={p.color} badges={[p.uid === meId && T.badge.you]}
                      off={!proposal.yes.includes(p.uid)} status={proposal.yes.includes(p.uid) ? T.agrees : T.waits} />
                  ))}
                  <HintLine>{T.awardWhenAll}</HintLine>
                </div>
                {iVote && !iAgreed && (
                  <div className="row" style={{ marginBottom: 8 }}>
                    <Button disabled={busy} onClick={() => answer(false)}>{T.disagree}</Button>
                    <Button primary disabled={busy} loading={pending === "vote"} onClick={() => answer(true)}>{T.agree}</Button>
                  </div>
                )}
                {(iAgreed || proposal.by === meId) && (
                  <Button style={{ marginBottom: 8 }} disabled={busy} onClick={() => answer(false)}>
                    {proposal.by === meId ? T.withdraw : T.rejectAfter}
                  </Button>
                )}
                {isAdmin && missing.length > 0 && (
                  <Button disabled={busy} loading={pending === "award"}
                    onClick={() => send({ action: "award", winners: proposal.winners, potIdx, handNum })}>
                    {T.forceAward(missing.map((p) => p.name).join(", "))}
                  </Button>
                )}
              </>
            )}
          </>
        );
      })()}

      {screen === "handEnd" && (
        <>
          <Confetti seed={handNum} />
          {toolbar}
          <div className="title">{T.handOver(handNum)}</div>
          <div className="handResult">{handResult}</div>
          {beerNow && beerPayer && (
            <RoundCard color={beerPayer.color} title={T.drinksRound}>{T.drinksLeader(beerPayer.name, beerPayer.chips)}</RoundCard>
          )}
          <div className="card">
            {players.filter((p) => !p.gone).map((p) => (
              <PlayerRow key={p.id} name={p.name} color={p.color} off={p.out || p.away}
                badges={[
                  p.uid === meId && T.badge.you, p.out && T.badge.out, !p.out && p.away && T.badge.pause,
                  readyYes.includes(p.uid) && T.badge.ready,
                ]}
                stack={p.chips}
                action={p.out
                  ? mayManage(p) && seated && (
                    <Button className="small" disabled={busy}
                      onClick={() => (p.uid === meId ? setRebuyText("") : send({ action: "rebuy", targetId: p.uid }))}>
                      {p.uid === meId ? T.rebuyOpen : T.rebuyDefault(buyInLabel(settings, null))}
                    </Button>
                  )
                  : pauseButton(p)} />
            ))}
          </div>
          {rebuyText !== null && mine?.out && (
            <div className="card">
              <BuyInField settings={settings} value={rebuyText} onChange={setRebuyText} label={T.rebuyLabel} />
              <div className="row" style={{ marginTop: 10 }}>
                <Button onClick={() => setRebuyText(null)}>{T.cancel}</Button>
                <Button primary disabled={busy || (parseAmount(rebuyText) !== null && !(parseAmount(rebuyText) > 0))}
                  onClick={() => { send({ action: "rebuy", amount: parseAmount(rebuyText) }); setRebuyText(null); }}>{T.buyNow}</Button>
              </div>
            </div>
          )}
          {errorBox}
          {settings.blindUp > 0 && engine.blindsFor(handNum + 1, settings).b > bbNow && (
            <NoticeLine>{T.blindsRise(engine.blindsFor(handNum + 1, settings).s, engine.blindsFor(handNum + 1, settings).b)}</NoticeLine>
          )}
          {engine.active(players).length < 2 && <NoticeLine>{T.needTwoActive}</NoticeLine>}
          {seated && iActive && (
            <Button primary={!iReady} style={{ marginBottom: 8 }} disabled={busy} loading={pending === "ready"}
              onClick={() => send({ action: "ready", handNum })}>
              {iReady ? T.readyDone : T.ready}
            </Button>
          )}
          {seated && !iActive && <NoticeLine>{T.sittingOut}</NoticeLine>}
          {notReady.length > 0 && engine.active(players).length >= 2 && (
            <HintLine>{T.waitingFor(notReady.map((p) => p.name).join(", "))}</HintLine>
          )}
          {isAdmin && notReady.length > 0 && engine.active(players).length >= 2 && (
            <Button style={{ marginBottom: 8 }} disabled={busy} loading={pending === "nextHand"}
              onClick={() => send({ action: "nextHand", handNum })}>
              {T.forceStart}
            </Button>
          )}
          {isAdmin && (
            <TwoTapButton disabled={busy} armed={armEnd} onArm={() => setArmEnd(true)}
              onConfirm={() => send({ action: "endEvening" })} confirmLabel={T.endEveningConfirm}>
              {T.endEvening}
            </TwoTapButton>
          )}
        </>
      )}

      {screen === "over" && (
        <>
          {settleView ? <SettleView players={players} settings={settings} /> : <BalanceView players={players} settings={settings} seed={handNum + 99} />}
          <div className="stack">
            {settings.money !== false && (
              <Button primary={!settleView} onClick={() => setSettleView(!settleView)}>
                {settleView ? T.backToBalance : T.settle}
              </Button>
            )}
            <Button onClick={onExit}>{T.doneToStart}</Button>
          </div>
        </>
      )}

      {screen !== "over" && !seated && (
        <NoticeLine>{T.spectator}</NoticeLine>
      )}

      {mine && screen !== "over" && (
        <>
          <div style={{ height: 76 }} />
          <div className="myStack">
            <div>
              <div className="lbl" style={{ marginBottom: 0 }}>{mine.gone ? T.yourFinal : T.yourChips}</div>
              {mine.bet > 0 && <div className="hintLine left" style={{ margin: 0 }}>{T.yourBet(mine.bet)}</div>}
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

      {handsOpen && <HandsSheet onClose={() => setHandsOpen(false)} />}

      {sheetOpen && (
        <Sheet title={T.onlineManageTitle(session.code)} onClose={() => setSheetOpen(false)}>
          <HintLine left>{T.lateJoinHint} {T.adminsAre(adminNames)} {isAdmin ? T.adminCan : T.adminsCan}</HintLine>
          {players.filter((p) => !p.gone).map((p, vi, visible) => {
            const canMove = isAdmin && seated && (screen === "play" || screen === "handEnd");
            return (
              <div key={p.id} className="manageRow">
                <PlayerRow name={p.name} color={p.color} off={p.out || p.away}
                  badges={[
                    p.uid === meId && T.badge.you, isAdminSeat(p) && T.badge.admin,
                    p.out && T.badge.out, !p.out && p.away && T.badge.pause,
                  ]}
                  stack={p.chips} />
                {(isAdmin && seated) || p.uid === meId ? (
                  <div className="manageButtons">
                    {canMove && (
                      <>
                        <Button disabled={vi === 0 || busy} onClick={() => send({ action: "move", targetId: p.uid, dir: -1 })}>{T.up}</Button>
                        <Button disabled={vi === visible.length - 1 || busy} onClick={() => send({ action: "move", targetId: p.uid, dir: 1 })}>{T.down}</Button>
                      </>
                    )}
                    {isAdmin && seated && (
                      <Button className={isAdminSeat(p) ? "on" : ""} aria-pressed={isAdminSeat(p)}
                        aria-label={isAdminSeat(p) ? T.toggleAdminOff : T.toggleAdminOn} disabled={busy}
                        onClick={() => send({ action: "toggleAdmin", targetId: p.uid })}>{T.admin}</Button>
                    )}
                    {p.uid === meId && (
                      <Button className={p.noob ? "on" : ""} aria-pressed={p.noob} disabled={busy}
                        onClick={() => send({ action: "toggleNoob" })}>{T.beginner}</Button>
                    )}
                    {canMove && p.uid !== meId && (
                      <Button disabled={busy} onClick={() => send({ action: "leave", targetId: p.uid })}>{T.remove}</Button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          {errorBox}
          {seated && (screen === "play" || screen === "handEnd") && (
            <TwoTapButton style={{ marginTop: 8 }} disabled={busy} armed={armLeave} onArm={() => setArmLeave(true)}
              onConfirm={() => { setArmLeave(false); send({ action: "leave" }); }} confirmLabel={T.leaveMeConfirm}>
              {T.leaveMe}
            </TwoTapButton>
          )}
          <Button style={{ marginTop: 8 }} onClick={onHome}>{T.toStartKeepSeat}</Button>
        </Sheet>
      )}
    </>
  );
}
