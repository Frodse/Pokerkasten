import { useState, useEffect, useRef, useLayoutEffect } from "react";
import * as engine from "../../supabase/functions/_shared/engine.js";
import { useSessionFeed } from "../sessionFeed.js";
import { useWakeLock } from "../device.js";
import { common as T, num } from "../text/de.js";
import { BalanceView } from "../Results.jsx";
import { SeatChip, PhaseTrack, NoticeLine, RoundCard, ErrorBanner, TwoTapButton, MomentOverlay, seatStyle } from "../ui/components.jsx";
import { useReducedMotion } from "../ui/slides.jsx";
import { ChipPile } from "./ChipStack.jsx";
import { potShares } from "./chips.js";
import { deriveEvents } from "./events.js";

/* Tisch-Anzeige (docs/design.md Kap. 14): ein zusätzliches Gerät in der
   Mitte des Tisches. Es ist kein Spieler, belegt keinen Platz und kann
   nichts auslösen – es liest nur den Spielstand, wie jeder mit dem Code. */

const { PHASES } = engine;
const ANNOUNCE_MS = 3000; // wie auf den Handys
const FLIGHT_MS = 400;    // Stapel gleiten zum Gewinner (14.4)

// Platz auf dem Oval, im Uhrzeigersinn ab unten Mitte (in % der Tischfläche)
function seatPos(i, n, rx = 41, ry = 38) {
  const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a) };
}

export default function TableDisplay({ sessionId, onDisconnect }) {
  const [session, setSession] = useState(null);
  const [seats, setSeats] = useState([]);
  const [armOff, setArmOff] = useState(false);
  const take = (fresh) => setSession((s) => (!s || fresh.version >= (s.version ?? 0) ? { ...s, ...fresh } : s));
  const offline = useSessionFeed(sessionId, { onSession: take, onPlayers: setSeats });
  useWakeLock(true);

  const game = session?.state?.game ?? null;
  const settings = session?.state?.settings ?? { sb: 10, blindUp: 0, beerEvery: 0, volume: "quiet", startChips: 1000, buyInEuro: 10 };
  const loud = settings.volume === "loud";

  // Ansagen und Momente wie auf den Handys, aber nichts Altes beim Verbinden
  const [announce, setAnnounce] = useState(null);
  const [moment, setMoment] = useState(null);
  const seenAnnounce = useRef(undefined);
  const seenMoment = useRef(undefined);
  const announceKey = game?.announce ? `${game.handNum}:${game.phase}:${game.announce.title}` : null;
  const momentKey = game?.moment?.key ?? null;
  useEffect(() => {
    if (!game) return;
    if (seenAnnounce.current === undefined) { seenAnnounce.current = announceKey; return; }
    if (!announceKey || announceKey === seenAnnounce.current) return;
    seenAnnounce.current = announceKey;
    setAnnounce(game.announce);
  }, [announceKey, !!game]);
  useEffect(() => {
    if (!announce) return;
    const timer = setTimeout(() => setAnnounce(null), ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [announce]);
  useEffect(() => {
    if (!game) return;
    if (seenMoment.current === undefined) { seenMoment.current = momentKey; return; }
    if (!momentKey || momentKey === seenMoment.current) return;
    seenMoment.current = momentKey;
    if (loud) setMoment(game.moment);
  }, [momentKey, !!game]);

  // Spielereignisse (14.6): jetzt nur abgeleitet, später hängen hier Animationen dran
  const prevGame = useRef(null);
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!game) return;
    if (prevGame.current && prevGame.current !== game) setEvents(deriveEvents(prevGame.current, game));
  }, [game]);

  const offBanner = offline && <ErrorBanner>{T.offline}</ErrorBanner>;
  const disconnect = (
    <TwoTapButton className="small tdOff" armed={armOff} onArm={() => setArmOff(true)} onConfirm={onDisconnect}
      confirmLabel={T.displayDisconnectConfirm} onBlur={() => setArmOff(false)}>
      {T.displayDisconnect}
    </TwoTapButton>
  );

  if (!session) {
    return (
      <div className="tdisp tdCenter">
        {offBanner}
        <div className="title">{T.connecting}</div>
        {disconnect}
      </div>
    );
  }

  // Lobby: Code riesig, Spieler erscheinen live
  if (session.status === "lobby" || !game) {
    return (
      <div className="tdisp tdCenter">
        {offBanner}
        <div className="tdCode">{session.code}</div>
        <div className="tdJoin">{T.displayJoin(session.code)}</div>
        <div className="tdLobby">
          {seats.length === 0 && <div className="hintLine">{T.waitForPlayers}</div>}
          {seats.map((p) => (
            <div key={p.id} className="tdLobbyP"><SeatChip color={p.color} size={40} /><span>{p.name}</span></div>
          ))}
        </div>
        {disconnect}
      </div>
    );
  }

  if (game.screen === "over") {
    return (
      <div className="tdisp tdOver">
        {offBanner}
        <div className="tdOverInner"><BalanceView players={game.players} settings={settings} seed={game.handNum + 99} /></div>
        {disconnect}
        {moment && <MomentOverlay moment={moment} players={game.players} onClose={() => setMoment(null)} />}
      </div>
    );
  }

  return (
    <div className="tdisp">
      {offBanner}
      <TableView game={game} settings={settings} events={events} />
      {disconnect}
      {announce && (
        <div className="announce" onClick={() => setAnnounce(null)}>
          <h1>{announce.title}</h1>
          {announce.hint && <p>{game.phase === 0 && <SeatChip color={game.players[game.dealer]?.color} size={32} />}{announce.hint}</p>}
        </div>
      )}
      {moment && <MomentOverlay moment={moment} players={game.players} onClose={() => setMoment(null)} />}
    </div>
  );
}

/* Spiel, Showdown, Hand-Ende auf dem ovalen Tisch (14.2, 14.3) */
function TableView({ game, settings, events }) {
  const { players, dealer, phase, cur, handNum, screen, pots, potIdx, notice, handResult } = game;
  const visible = players.filter((p) => !p.gone);
  const { s: sbNow, b: bbNow } = engine.blindsFor(handNum, settings);
  const reduced = useReducedMotion();
  const area = useRef(null);
  const posOf = (p) => seatPos(visible.indexOf(p), visible.length);

  // Pot in der Mitte: im Spiel die Einsätze früherer Setzrunden je Spieler
  // (die laufende Runde liegt vor den Spielern), im Showdown je Pot
  const groups = screen === "showdown"
    ? potShares(players).slice(potIdx).map((pt, i) => ({
        label: pots.length > 1 ? (potIdx + i === 0 ? T.mainPot : T.sidePot(potIdx + i)) : T.pot,
        amt: pots[potIdx + i]?.amt ?? pt.amt,
        parts: Object.entries(pt.by).map(([id, amount]) => ({ key: id, color: players.find((p) => p.id === +id)?.color, amount })),
      }))
    : [{
        label: T.pot,
        amt: engine.potTotal(players),
        parts: players.map((p) => ({ key: p.id, color: p.color, amount: p.contrib - p.bet })),
      }];
  // Die große Zahl ist dieselbe wie auf den Handys: im Showdown der Pot, um den es gerade geht
  const potNumber = groups[0]?.amt ?? 0;
  const potLabel = groups[0]?.label ?? T.pot;

  // Vergabe: Chips gleiten zu dem, der gewonnen hat (400 ms, nicht bei „Weniger Bewegung“)
  const [flights, setFlights] = useState([]);
  const before = useRef(game);
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = game;
    if (reduced || !prev || prev === game || prev.handNum !== game.handNum) return;
    const gainers = game.players.filter((p) => {
      const was = prev.players.find((x) => x.id === p.id);
      return was && p.chips > was.chips;
    });
    if (!gainers.length) return;
    const box = area.current?.getBoundingClientRect();
    if (!box) return;
    // Was aus der Mitte verschwindet: im Showdown der vergebene Pot, sonst alles aus dieser Hand
    const vanished = prev.screen === "showdown"
      ? Object.entries(potShares(prev.players)[prev.potIdx]?.by ?? {}).map(([id, amount]) => ({ id: +id, amount }))
      : prev.players.map((p) => ({ id: p.id, amount: p.contrib }));
    const shown = game.players.filter((p) => !p.gone);
    const stamp = Date.now();
    setFlights(gainers.map((g, k) => {
      const at = seatPos(shown.indexOf(g), shown.length);
      return {
        id: `${stamp}-${k}`,
        // bei Split bekommt jeder seinen Anteil zu sehen
        parts: vanished.map((v) => ({ key: v.id, color: prev.players.find((p) => p.id === v.id)?.color, amount: v.amount / gainers.length })),
        dx: ((at.x - 50) / 100) * box.width, dy: ((at.y - 50) / 100) * box.height,
      };
    }));
    const timer = setTimeout(() => setFlights([]), FLIGHT_MS + 80);
    return () => clearTimeout(timer);
  }, [game]);

  const beerNow = handNum > 0 && settings.beerEvery > 0 && handNum % settings.beerEvery === 0;
  const beerPayer = engine.alive(players).slice().sort((a, b) => b.chips - a.chips)[0];
  const phaseName = screen === "showdown" ? T.phaseShowdown : screen === "handEnd" ? T.phaseHandEnd : PHASES[phase];
  const next = engine.blindsFor(handNum + 1, settings);

  return (
    <>
      <div className="tdHead">
        <div className="tdHeadLine">
          {T.tableHead(handNum, phaseName, sbNow, bbNow)}
          {settings.blindUp > 0 && <span className="nowrap">{T.blindsRiseIn(settings.blindUp - ((handNum - 1) % settings.blindUp))}</span>}
        </div>
        <PhaseTrack phases={PHASES} phase={screen === "play" ? phase : -1} />
      </div>

      <div className="tdTable" ref={area}>
        <div className="tdOval" />

        {visible.map((p) => {
          const idx = players.indexOf(p);
          const at = posOf(p);
          const turn = screen === "play" && idx === cur;
          const off = p.out || (screen !== "handEnd" && p.folded) || (screen === "handEnd" && p.away);
          return (
            <div key={p.id} className={`tdSeat ${turn ? "turn" : ""} ${off && !turn ? "off" : ""}`}
              style={{ left: `${at.x}%`, top: `${at.y}%`, ...seatStyle(p.color) }}>
              <div className="tdSeatTop">
                <span className="tdChipRing"><SeatChip color={p.color} size={40} off={off && !turn} /></span>
                {idx === dealer && <span className="dealerMark" role="img" aria-label={T.tile.dealerLabel}>{T.tile.dealer}</span>}
              </div>
              <div className="tdName">{p.name}</div>
              <div className="tdStack">{num(p.chips)}</div>
              {turn && <div className="tdTurn">{T.isTurnShort}</div>}
              {!turn && p.out && <div className="tdTurn">{T.tile.out}</div>}
            </div>
          );
        })}

        {/* Einsätze dieser Setzrunde vor jedem Spieler (14.3) */}
        {screen === "play" && visible.filter((p) => p.bet > 0).map((p) => {
          const at = seatPos(visible.indexOf(p), visible.length, 24, 21);
          return (
            <div key={`bet-${p.id}`} className="tdBet" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
              <ChipPile parts={[{ key: p.id, color: p.color, amount: p.bet }]} bb={bbNow} max={20} />
              <span className="tdBetNum">{num(p.bet)}</span>
            </div>
          );
        })}

        <div className="tdMiddle">
          {screen === "showdown" && <div className="tdShow">{T.showCards}</div>}
          {screen === "handEnd" ? (
            <div className="tdEnd">
              <div className="tdEndTitle">{T.handOver(handNum)}</div>
              <div className="tdResult">{handResult}</div>
              {beerNow && beerPayer && (
                <RoundCard color={beerPayer.color} title={T.drinksRound}>{T.drinksLeader(beerPayer.name, beerPayer.chips)}</RoundCard>
              )}
              {settings.blindUp > 0 && next.b > bbNow && <div className="tdRise">{T.blindsRise(next.s, next.b)}</div>}
            </div>
          ) : (
            <>
              <div className="tdPots">
                {groups.map((g, i) => (
                  <div key={i} className="tdPotGroup">
                    <ChipPile parts={g.parts} bb={bbNow} />
                    {groups.length > 1 && <div className="tdPotLabel">{g.label} · {num(g.amt)}</div>}
                  </div>
                ))}
              </div>
              <div className="tdPotNum">{num(potNumber)}</div>
              <div className="lbl">{potLabel}</div>
            </>
          )}
        </div>

        {flights.map((f) => <Flight key={f.id} f={f} bb={bbNow} />)}

        {/* Fester Platz für spätere Ereignis-Animationen (14.6) */}
        <div className="tdEvents" aria-hidden="true" data-events={events.map((e) => e.kind).join(" ")} />
      </div>

      <div className="tdFoot">{screen === "play" && notice && <NoticeLine>{notice}</NoticeLine>}</div>
    </>
  );
}

// Ein Stapel auf dem Weg zum Gewinner: startet in der Mitte, gleitet zum Platz
function Flight({ f, bb }) {
  const el = useRef(null);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    node.getBoundingClientRect(); // Startpunkt festhalten, dann losgleiten
    node.style.transform = `translate(calc(-50% + ${f.dx}px), calc(-50% + ${f.dy}px)) scale(.6)`;
    node.style.opacity = "0.2";
  }, []);
  return (
    <div ref={el} className="tdFlight">
      <ChipPile parts={f.parts} bb={bb} />
    </div>
  );
}
