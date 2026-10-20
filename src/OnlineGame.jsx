import { useState, useEffect, useRef } from "react";
import * as engine from "../supabase/functions/_shared/engine.js";
import { Confetti, BalanceView, SettleView } from "./Results.jsx";
import { BuyInField, buyInLabel, parseAmount } from "./buyIn.jsx";
import { common as T, labels, num } from "./text/de.js";
import { IconClock } from "./ui/icons.jsx";
import { playTurnSound } from "./device.js";
import {
  Button, TwoTapButton, PauseButton, NoticeLine, HintLine, ExplainLine, ErrorBanner,
  ActionBar, RaisePanel, SeatChip, PotDisplay, WinnerRow, RoundCard, PhaseTrack, SeatFrame, seatStyle,
  MomentOverlay, PhaseBanner, InviteCard, Sheet,
} from "./ui/components.jsx";
import {
  GameShell, TableHead, SeatTiles, SeatTile, tileState, ManageRow, RankingSlide, HandsSlide, LastAction, TableDock, HandEndTitle,
} from "./ui/slides.jsx";
import { ChipPile } from "./table/ChipStack.jsx";

/* Online-Tisch: Spielbildschirm. Jeder sieht denselben Tisch live, tippen
   darf jeder nur, was ihm zusteht – geprüft wird alles auf dem Server
   (Edge Function "game"). Damit die Admins den Ablauf nicht aufhalten,
   schlägt im Showdown irgendwer die Gewinner vor und alle mit Karten
   bestätigen; die nächste Hand startet, wenn alle „Bereit“ getippt haben.
   Es kann mehrere Admins geben, sie können beides abkürzen.
   Aufgeteilt auf Slides mit Tab-Leiste (docs/design.md Kap. 13). */

const { PHASES } = engine;
const ANNOUNCE_MS = 3000; // Ansagen verschwinden von selbst
const THINKING_MS = 30000; // „Lea überlegt noch.“ (nur „Laut“)
const TIMEOUT_RETRY_MS = 1500; // abgelaufene Uhr erneut melden, falls die Handy-Uhr vorgeht
// 14.5: Chips als Stapel zeigen, pro Gerät, Standard aus
const CHIPS_KEY = "pokerkasten-chips";
const loadChips = () => { try { return window.localStorage.getItem(CHIPS_KEY) === "1"; } catch (e) { return false; } };
const storeChips = (on) => { try { window.localStorage.setItem(CHIPS_KEY, on ? "1" : "0"); } catch (e) { /* nur für diese Sitzung */ } };

export default function OnlineGame({ session, seats, meId, call, onExit, onHome, fromLobby, offline }) {
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
  const [announce, setAnnounce] = useState(null); // Handstart-Overlay
  const [banner, setBanner] = useState(null);     // Flop/Turn/River als Banner (4.13)
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
  const [tab, setTab] = useState("table");     // Slide (Kap. 13)
  const [openRow, setOpenRow] = useState(null); // aufgeklappte Zeile im Slide „Spieler“
  const [settleView, setSettleView] = useState(false);
  const [rebuyText, setRebuyText] = useState(null); // eigener Rebuy-Betrag, null = Eingabe zu
  const [now, setNow] = useState(Date.now());
  const [chipsOn, setChipsOn] = useState(loadChips);
  const [inviteOpen, setInviteOpen] = useState(false); // Sheet „Einladen“ für Nachzügler

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
    if (phase === 0) setAnnounce(game.announce);
    else setBanner({ ...game.announce, key: announceKey });
  }, [announceKey]);
  useEffect(() => {
    if (!announce) return;
    const timer = setTimeout(() => setAnnounce(null), ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [announce]);

  // Momente (Kap. 9, nur „Laut“): jeder nur einmal, wie die Ansagen
  const loud = settings.volume === "loud";
  const [moment, setMoment] = useState(null);
  const momentKey = game.moment?.key ?? null;
  const seenMoment = useRef(fromLobby ? null : momentKey);
  useEffect(() => {
    if (!momentKey || momentKey === seenMoment.current) return;
    seenMoment.current = momentKey;
    if (loud) setMoment(game.moment);
  }, [momentKey]);

  // „Lea überlegt noch.“ nach 30 s am Zug (nur „Laut“)
  const turnKey = screen === "play" ? `${handNum}:${phase}:${cur}:${curBet}` : null;
  const [thinking, setThinking] = useState(false);
  useEffect(() => {
    setThinking(false);
    if (!loud || !turnKey) return;
    const timer = setTimeout(() => setThinking(true), THINKING_MS);
    return () => clearTimeout(timer);
  }, [turnKey]);

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
  // Wer nach dem aktuellen Zug voraussichtlich dran ist (nur als Hinweis)
  const nextIdx = screen === "play" && turn ? engine.firstActable(players, (cur + 1) % players.length, curBet) : -1;
  const nextIsMe = !myTurn && seated && nextIdx !== cur && players[nextIdx]?.uid === meId;

  // 5.4 B, 13.2: dran → sofort auf „Tisch“, kurz vibrieren und Ton (falls das Handy es kann)
  useEffect(() => {
    if (!myTurn) return;
    setTab("table");
    try { navigator.vibrate?.(80); } catch (e) { /* nicht unterstützt */ }
    playTurnSound();
  }, [myTurn]);
  // Showdown und Hand-Ende erscheinen auf „Tisch“ (13.2)
  useEffect(() => { if (screen === "showdown" || screen === "handEnd") setTab("table"); }, [screen]);

  // Abstimmungen: Gewinner bestätigen (Showdown) und „Bereit“ (Hand-Ende)
  const vote = session.state.vote && session.state.vote.handNum === handNum ? session.state.vote : null;
  const noteState = session.state.note;
  const note = noteState && noteState.handNum === handNum && noteState.potIdx === potIdx ? noteState.text : null;
  const readyYes = vote?.kind === "ready" ? vote.yes : [];
  const iActive = !!mine && !mine.out && !mine.away && !mine.gone;
  const iReady = readyYes.includes(meId);
  const notReady = engine.active(players).filter((p) => !readyYes.includes(p.uid));
  const blocked = screen === "handEnd" ? engine.blockedReason(players) : null; // Z6/Z7

  const visible = players.filter((p) => !p.gone);
  const isAdminSeat = (p) => !!seats.find((s) => s.id === p.uid)?.is_host;
  const pauseButton = (p) => mayManage(p) && seated && !p.out && (screen === "play" || screen === "handEnd") && (
    <PauseButton away={p.away} disabled={busy} onClick={() => send({ action: "pause", targetId: p.uid })} />
  );

  if (screen === "over") {
    return (
      <>
        {offline && <ErrorBanner>{T.offline}</ErrorBanner>}
        {settleView ? <SettleView players={players} settings={settings} /> : <BalanceView players={players} settings={settings} seed={handNum + 99} />}
        <div className="stack">
          {settings.money !== false && (
            <Button primary={!settleView} onClick={() => setSettleView(!settleView)}>
              {settleView ? T.backToBalance : T.settle}
            </Button>
          )}
          <Button onClick={onExit}>{T.doneToStart}</Button>
        </div>
        {moment && <MomentOverlay moment={moment} players={players} onClose={() => setMoment(null)} />}
      </>
    );
  }

  const phaseWord = screen === "showdown" ? T.phaseShowdown : null; // im Hand-Ende sagt es der Titel
  const head = (
    <TableHead handNum={handNum} phaseWord={phaseWord} sb={sbNow} bb={bbNow}
      riseIn={settings.blindUp > 0 ? settings.blindUp - ((handNum - 1) % settings.blindUp) : 0}
      onUndo={isAdmin ? () => send({ action: "undo" }) : undefined} undoDisabled={busy} />
  );
  // Kacheln aller Spieler am Tisch; `statusFor` ersetzt den Status (z. B. „bereit“)
  const tiles = ({ statusFor, extraFor } = {}) => (
    <SeatTiles>
      {visible.map((p) => {
        const idx = players.indexOf(p);
        const base = tileState(p, screen);
        return (
          <SeatTile key={p.id} p={p} status={statusFor?.(p) ?? base.status} off={base.off} win={base.win}
            current={screen === "play" && idx === cur} dealer={idx === dealer} me={p.uid === meId} extra={extraFor?.(p)} />
        );
      })}
    </SeatTiles>
  );

  const tableSlide = (
    <>
      {screen === "play" && turn && (
        <>
          {/* 5.4 C, 13.4: jemand anderes ist dran – Block in seiner Farbe ganz oben */}
          {!myTurn && (
            <div className={`turnBanner ${turn.color ? "" : "neutral"}`} style={seatStyle(turn.color)}>
              <SeatChip color={turn.color} size={40} />
              <div className="who">{T.isTurn(turn.name)}</div>
              <div className="sub">{toCall > 0 ? L.toCall(toCall) : T.noBet}</div>
              {nextIsMe && <div className="sub">{T.nextUp}</div>}
              {thinking && <div className="sub">{T.thinking(turn.name)}</div>}
              {clockRuns && <div className="clock">{T.clockSeconds(secondsLeft)}</div>}
              {clockRuns && <div className="sub">{T.clockThen(toCall > 0, myTurn, turn.name)}</div>}
            </div>
          )}
          {head}
          <PhaseTrack phases={PHASES} phase={phase} />
          {mine && (!myTurn || chipsOn) ? (
            <div className="potRow">
              {/* 14.5: kleine Stapel neben den Beschriftungen, damit nichts verrutscht */}
              <PotDisplay amount={pot} label={<>{T.pot}{chipsOn && (
                <ChipPile className="miniPile" bb={bbNow} perStack={10} max={30}
                  parts={players.map((p) => ({ key: p.id, color: p.color, amount: p.contrib }))} />
              )}</>} />
              <div className="mine">
                <span className="lbl">
                  {chipsOn && <ChipPile className="miniPile mineChips" bb={bbNow} perStack={10} max={10} parts={[{ key: mine.id, color: mine.color, amount: mine.chips }]} />}
                  {mine.gone ? T.yourFinal : T.yourStack}
                </span>
                <div className="amt">{num(mine.chips)}</div>
              </div>
            </div>
          ) : (
            <PotDisplay amount={pot} />
          )}
          {tiles()}
          {!raiseOpen && <LastAction players={players} lastAction={game.lastAction} />}
          {notice && !raiseOpen && <NoticeLine>{notice}</NoticeLine>}
          {errorBox}

          <TableDock>
            {myTurn && (
              <>
                <div className={`turnHead ${raiseOpen ? "duringRaise" : ""}`}>
                  <SeatChip color={turn.color} size={40} />
                  <div className="who">{T.yourTurn}</div>
                </div>
                <div className={`toCall ${raiseOpen ? "duringRaise" : ""}`}>{toCall > 0 ? L.toCall(toCall) : T.noBet}</div>
                {clockRuns && <div className="clock">{T.clockSeconds(secondsLeft)}</div>}
                {clockRuns && <HintLine left>{T.clockThen(toCall > 0, myTurn, turn.name)}</HintLine>}
              </>
            )}
            {seated && !myTurn && <HintLine>{T.lieDownSlides}</HintLine>}
            {isAdmin && seated && !raiseOpen && (
              <Button style={{ marginBottom: 10 }} disabled={busy}
                onClick={() => send({ action: "clock", ...(clockRuns ? { stop: true } : {}) })}>
                {!clockRuns && <IconClock />}{clockRuns ? T.clockStop : T.clockStart(myTurn ? T.clockYou : turn.name)}
              </Button>
            )}
            {myTurn && turn.noob && !raiseOpen && (
              <ExplainLine>{toCall > 0 ? L.explainBet(Math.min(toCall, turn.chips)) : L.explainFree}</ExplainLine>
            )}
            {myTurn && !raiseOpen && (
              <>
                {!raiseAllowed && turn.acted && toCall > 0 && <HintLine>{T.shortAllInHint}</HintLine>}
                <ActionBar L={L} toCall={toCall} stack={turn.chips} total={turn.chips + turn.bet}
                  raiseAllowed={raiseAllowed} allInAllowed={allInAllowed} disabled={busy}
                  armed={armAllIn} onArm={() => setArmAllIn(true)} onAct={act}
                  onRaise={() => { setRaiseTo(Math.min(curBet + minRaise, turn.bet + turn.chips)); setRaiseOpen(true); }} />
              </>
            )}
            {myTurn && raiseOpen && (
              <RaisePanel L={L} noob={turn.noob} value={raiseTo} onChange={setRaiseTo}
                minTarget={curBet + minRaise} max={turn.bet + turn.chips} step={bbNow} potBet={potBet}
                onBack={() => setRaiseOpen(false)} onConfirm={(amt) => act("raise", amt)} disabled={busy} />
            )}
          </TableDock>
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
        const rows = voters.map((p) => {
          const sel = winnersSel.includes(p.id);
          return (
            <WinnerRow key={p.id} name={p.name} color={p.color} selected={sel} disabled={!seated}
              onClick={() => setWinnersSel(sel ? winnersSel.filter((x) => x !== p.id) : [...winnersSel, p.id])} />
          );
        });
        return (
          <>
            {head}
            {runout && <NoticeLine>{T.runout}</NoticeLine>}
            <PotDisplay amount={amt} label={pots.length > 1 ? (potIdx === 0 ? T.mainPot : T.sidePot(potIdx)) : T.pot} />
            {!proposal && <HintLine>{seated ? T.compareCardsOnline : T.comparingAtTable}</HintLine>}
            {errorBox}
            {!proposal ? (
              <>
                {note && <NoticeLine>{note}</NoticeLine>}
                {voters.length >= 7 ? <div className="winnerGrid">{rows}</div> : rows}
                {seated && (
                  <TableDock>
                    <Button primary disabled={busy || winnersSel.length === 0} loading={pending === "propose"}
                      onClick={() => send({ action: "propose", winners: winnersSel, potIdx, handNum })}>
                      {winnersSel.length ? T.propose(winnersSel.map(nameOf).join(" & "), winnersSel.length) : T.pickWinner}
                    </Button>
                  </TableDock>
                )}
              </>
            ) : (
              <>
                <RoundCard color={proposal.winners.length === 1 ? players.find((x) => x.id === proposal.winners[0])?.color : undefined}
                  title={proposal.winners.map(nameOf).join(" & ")}>
                  {T.proposalGets(proposal.winners.length, share(proposal.winners), byName)}
                </RoundCard>
                <SeatTiles>
                  {voters.map((p) => {
                    const yes = proposal.yes.includes(p.uid);
                    return <SeatTile key={p.id} p={p} me={p.uid === meId} off={!yes} status={yes ? T.tile.agrees : T.tile.waits} />;
                  })}
                </SeatTiles>
                <HintLine>{T.awardWhenAll}</HintLine>
                {(iAgreed || proposal.by === meId) && (
                  <Button style={{ marginBottom: 8 }} disabled={busy} onClick={() => answer(false)}>
                    {proposal.by === meId ? T.withdraw : T.rejectAfter}
                  </Button>
                )}
                {isAdmin && missing.length > 0 && (
                  <Button style={{ marginBottom: 8 }} disabled={busy} loading={pending === "award"}
                    onClick={() => send({ action: "award", winners: proposal.winners, potIdx, handNum })}>
                    {T.forceAward(missing.map((p) => p.name).join(", "))}
                  </Button>
                )}
                {iVote && !iAgreed && (
                  <TableDock>
                    <div className="row">
                      <Button disabled={busy} onClick={() => answer(false)}>{T.disagree}</Button>
                      <Button primary disabled={busy} loading={pending === "vote"} onClick={() => answer(true)}>{T.agree}</Button>
                    </div>
                  </TableDock>
                )}
              </>
            )}
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
          {/* Rebuy direkt auf der Kachel (13.4), Rechte wie bisher */}
          {tiles({
            statusFor: (p) => (!p.out && !p.away && readyYes.includes(p.uid) ? T.tile.ready : undefined),
            extraFor: (p) => p.out && mayManage(p) && seated && (
              <Button disabled={busy}
                onClick={() => (p.uid === meId ? setRebuyText("") : send({ action: "rebuy", targetId: p.uid }))}>
                {p.uid === meId ? T.rebuyOpen : T.rebuyDefault(buyInLabel(settings, null))}
              </Button>
            ),
          })}
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
            <NoticeLine>{(loud ? T.pricier : T.blindsRise)(engine.blindsFor(handNum + 1, settings).s, engine.blindsFor(handNum + 1, settings).b)}</NoticeLine>
          )}
          {blocked && <NoticeLine>{blocked === "chips" ? T.needTwoChipsOnline : T.needTwoPaused}</NoticeLine>}
          {seated && !iActive && <NoticeLine>{T.sittingOut}</NoticeLine>}
          {/* weit weg von „Bereit“, das unten am Daumen sitzt */}
          {isAdmin && (
            <TwoTapButton disabled={busy} armed={armEnd} onArm={() => setArmEnd(true)}
              onConfirm={() => send({ action: "endEvening" })} confirmLabel={T.endEveningConfirm}>
              {T.endEvening}
            </TwoTapButton>
          )}
          <TableDock>
            {notReady.length > 0 && !blocked && (
              <HintLine>{T.waitingFor(notReady.map((p) => p.name).join(", "))}</HintLine>
            )}
            {isAdmin && notReady.length > 0 && !blocked && (
              <Button style={{ marginBottom: 8 }} disabled={busy} loading={pending === "nextHand"}
                onClick={() => send({ action: "nextHand", handNum })}>
                {T.forceStart}
              </Button>
            )}
            {seated && iActive && !blocked && (
              <Button primary={!iReady} disabled={busy} loading={pending === "ready"}
                onClick={() => send({ action: "ready", handNum })}>
                {iReady ? T.readyDone : T.ready}
              </Button>
            )}
          </TableDock>
        </>
      )}

      {!seated && <NoticeLine>{T.spectator}</NoticeLine>}
    </>
  );

  // Slide „Spieler“ (13.5): ersetzt das Sheet „Spielerverwaltung“
  const canMove = isAdmin && seated && (screen === "play" || screen === "handEnd");
  const playersSlide = (
    <>
      <div className="title">{T.onlineManageTitle(session.code)}</div>
      <HintLine left>{T.lateJoinHint} {T.adminsAre(adminNames)} {isAdmin ? T.adminCan : T.adminsCan}</HintLine>
      <Button style={{ marginBottom: 10 }} onClick={() => setInviteOpen(true)}>{T.invite}</Button>
      <div className={`card ${visible.length >= 9 ? "many" : ""}`}>
        {visible.map((p, vi) => {
          const manageable = (isAdmin && seated) || p.uid === meId;
          return (
            <ManageRow key={p.id} p={p} off={p.out || p.away} open={openRow === p.id}
              onToggle={() => setOpenRow(openRow === p.id ? null : p.id)}
              badges={[
                p.uid === meId && T.badge.you, isAdminSeat(p) && T.badge.admin, p.noob && T.badge.beginner,
                p.out && T.badge.out, !p.out && p.away && (screen === "play" && !p.folded ? T.badge.pauseNext : T.badge.pause),
              ]}
              pause={pauseButton(p)}
              buttons={manageable && (
                <>
                  {canMove && (
                    <>
                      <Button disabled={vi === 0 || busy} onClick={() => send({ action: "move", targetId: p.uid, dir: -1 })}>{T.up}</Button>
                      <Button disabled={vi === visible.length - 1 || busy} onClick={() => send({ action: "move", targetId: p.uid, dir: 1 })}>{T.down}</Button>
                    </>
                  )}
                  {p.uid === meId && (
                    <Button className={p.noob ? "on" : ""} aria-pressed={p.noob} disabled={busy}
                      onClick={() => send({ action: "toggleNoob" })}>{T.beginner}</Button>
                  )}
                  {isAdmin && seated && (
                    <Button className={isAdminSeat(p) ? "on" : ""} aria-pressed={isAdminSeat(p)}
                      aria-label={isAdminSeat(p) ? T.toggleAdminOff : T.toggleAdminOn} disabled={busy}
                      onClick={() => send({ action: "toggleAdmin", targetId: p.uid })}>{T.admin}</Button>
                  )}
                  {canMove && p.uid !== meId && (
                    <Button disabled={busy} onClick={() => { setOpenRow(null); send({ action: "leave", targetId: p.uid }); }}>{T.remove}</Button>
                  )}
                </>
              )} />
          );
        })}
      </div>
      {errorBox}
      {seated && (screen === "play" || screen === "handEnd") && (
        <TwoTapButton style={{ marginBottom: 8 }} disabled={busy} armed={armLeave} onArm={() => setArmLeave(true)}
          onConfirm={() => { setArmLeave(false); send({ action: "leave" }); }} confirmLabel={T.leaveMeConfirm}>
          {T.leaveMe}
        </TwoTapButton>
      )}
      <Button onClick={onHome}>{T.toStartKeepSeat}</Button>
      {seated && <HintLine>{T.pauseFromNext}</HintLine>}
      <Button className={`chipsToggle ${chipsOn ? "on" : ""}`} aria-pressed={chipsOn}
        onClick={() => { storeChips(!chipsOn); setChipsOn(!chipsOn); }}>{T.chipsToggle}</Button>
      <HintLine>{T.chipsToggleHint}</HintLine>
    </>
  );

  return (
    <>
      {/* 5.4 B: ich bin dran – Rahmen in meiner Farbe */}
      {myTurn && <SeatFrame color={turn.color} />}
      <GameShell tab={tab} onTab={(t) => { setArmLeave(false); setTab(t); }} locked={raiseOpen}
        banner={offline && <ErrorBanner>{T.offline}</ErrorBanner>}
        slides={{
          players: playersSlide,
          table: tableSlide,
          ranking: <RankingSlide players={players} handNum={handNum} screen={screen} beerEvery={settings.beerEvery} settings={settings} />,
          hands: <HandsSlide />,
        }} />

      {announce && (
        <div className="announce" onClick={() => setAnnounce(null)}>
          <h1>{announce.title}</h1>
          {/* Vor dem Flop gibt es nur die Handstart-Ansage: dort steht der Dealer (4.13) */}
          {announce.hint && <p>{phase === 0 && <SeatChip color={players[dealer]?.color} size={32} />}{announce.hint}</p>}
        </div>
      )}
      <PhaseBanner banner={banner} />
      {inviteOpen && (
        <Sheet title={T.inviteTitle(session.code)} onClose={() => setInviteOpen(false)}>
          <InviteCard code={session.code} />
        </Sheet>
      )}
      {moment && <MomentOverlay moment={moment} players={players} onClose={() => setMoment(null)} />}
    </>
  );
}
