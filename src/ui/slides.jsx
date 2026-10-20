import { useRef, useEffect, useLayoutEffect, useState } from "react";
import * as engine from "../../supabase/functions/_shared/engine.js";
import { common as T, num, HANDS } from "../text/de.js";
import { IconPeople, IconTable, IconRanking, IconCards, IconUndo } from "./icons.jsx";
import { SeatChip, Badge, HintLine, seatStyle } from "./components.jsx";

/* Spielbildschirm als Slides mit Tab-Leiste (docs/design.md Kap. 13).
   Einzel-Handy-Spiel und Online-Tisch benutzen dieselben Bausteine.
   Reihenfolge links → rechts: Spieler, Tisch, Rangliste, Hände. */

export const TABS = ["players", "table", "ranking", "hands"];
const TAB_ICONS = { players: IconPeople, table: IconTable, ranking: IconRanking, hands: IconCards };

// Bewegung nach 13.8
const SLIDE_MS = 250;
const SLIDE_EASE = "cubic-bezier(0.25, 1, 0.5, 1)";
const START_PX = 10;      // ab hier entscheidet sich: wischen oder scrollen
const FLICK_PX_MS = 0.5;  // schneller Wisch wechselt auch unter einem Drittel
const EDGE_RESIST = 0.3;  // Widerstand am ersten und letzten Slide

export function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/* Ganzer Spielbildschirm: Slides nebeneinander, darunter die Tab-Leiste.
   `slides` = { players, table, ranking, hands }. `locked` schaltet Wischen
   ab (offenes RaisePanel). Wischen beginnt nie auf Knöpfen, Eingaben oder
   im RaisePanel. */
export function GameShell({ tab, onTab, locked, slides, onTableClick, banner }) {
  const idx = TABS.indexOf(tab);
  const viewport = useRef(null);
  const track = useRef(null);
  const drag = useRef(null);
  const swallowClick = useRef(false);
  const placed = useRef(false);
  const reduced = useReducedMotion();

  const width = () => viewport.current?.clientWidth ?? 0;
  const place = (x, animate) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${SLIDE_MS}ms ${SLIDE_EASE}` : "none";
    el.style.transform = `translate3d(${x}px, 0, 0)`;
  };
  const currentX = () => {
    const m = getComputedStyle(track.current).transform;
    return m && m !== "none" ? new DOMMatrixReadOnly(m).m41 : -idx * width();
  };

  // Tab gewechselt (Tipp, Wisch oder „du bist dran“): hingleiten, beim ersten Mal springen
  useLayoutEffect(() => {
    if (reduced) { if (track.current) track.current.style.transform = ""; return; }
    place(-idx * width(), placed.current);
    placed.current = true;
  }, [idx, reduced]);
  useEffect(() => {
    const onResize = () => { if (!reduced) place(-TABS.indexOf(tab) * width(), false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tab, reduced]);

  const onPointerDown = (e) => {
    swallowClick.current = false;
    if (locked || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (e.target.closest("button, input, textarea, select, a, .raisePanel, .noSwipe")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), on: false, dx: 0, base: 0 };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(dy) > START_PX && Math.abs(dy) >= Math.abs(dx)) { drag.current = null; return; } // scrollt
      if (Math.abs(dx) <= START_PX) return;
      d.on = true;
      d.base = reduced ? 0 : currentX(); // unterbrechbar: dort weiter, wo der Slide gerade ist
      viewport.current.setPointerCapture?.(e.pointerId);
    }
    d.dx = dx;
    if (reduced) return; // ohne Bewegung: erst beim Loslassen wechseln
    const atEdge = (idx === 0 && dx > 0) || (idx === TABS.length - 1 && dx < 0);
    place(d.base + (atEdge ? dx * EDGE_RESIST : dx), false);
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.on || d.id !== e.pointerId) return;
    swallowClick.current = true;
    const fast = Math.abs(d.dx) / Math.max(1, performance.now() - d.t) > FLICK_PX_MS && Math.abs(d.dx) > 24;
    const far = Math.abs(d.dx) > width() / 3;
    let next = idx;
    if (far || fast) next = Math.max(0, Math.min(TABS.length - 1, idx + (d.dx < 0 ? 1 : -1)));
    if (next !== idx) onTab(TABS[next]);
    else if (!reduced) place(-idx * width(), true);
  };
  const onPointerCancel = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.on && !reduced) place(-idx * width(), true);
  };
  // Nach dem Wischen keinen Tipp auslösen (z. B. Doppel-Tipp = Check)
  const onClickCapture = (e) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className="gameShell">
      {banner && <div className="shellBanner">{banner}</div>}
      <div ref={viewport} className={`slideViewport ${reduced ? "reduced" : ""}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}>
        <div ref={track} className="slideTrack">
          {TABS.map((t, i) => (
            <section key={t} className={`slide ${i === idx ? "active" : ""}`} aria-label={T.tabs[t]}
              aria-hidden={i === idx ? undefined : true} inert={i === idx ? undefined : ""}
              onClick={t === "table" ? onTableClick : undefined}>
              <div className={`slideInner ${t === "table" ? "tableInner" : ""}`}>{slides[t]}</div>
            </section>
          ))}
        </div>
      </div>
      <TabBar tab={tab} onTab={onTab} />
    </div>
  );
}

export function TabBar({ tab, onTab }) {
  return (
    <nav className="tabBar" aria-label={T.tabsLabel}>
      {TABS.map((t) => {
        const Icon = TAB_ICONS[t];
        return (
          <button key={t} className={t === tab ? "on" : ""} aria-current={t === tab ? "page" : undefined} onClick={() => onTab(t)}>
            <Icon />
            <span>{T.tabs[t]}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* Kopfzeile von „Tisch“ (13.4): Hand, Blinds als Pille, „steigen in n“,
   Rückgängig rechts. Die Phase zeigt der PhaseTrack; nur Showdown und
   Hand-Ende stehen als Wort da (`phaseWord`). */
export function TableHead({ handNum, phaseWord, sb, bb, riseIn, onUndo, undoDisabled }) {
  const pair = T.blindsPair(sb, bb);
  return (
    <div className="tableHead">
      <div className="headLine">
        <span>{T.handLabel(handNum)}{phaseWord && ` · ${phaseWord}`}</span>
        <span className="blindsPill" aria-label={T.blindsPillLabel(pair)}>{pair}</span>
        {riseIn > 0 && <span className="nowrap">{T.riseIn(riseIn)}</span>}
      </div>
      {onUndo && (
        <button className="iconBtn undoBtn" aria-label={T.undo} disabled={undoDisabled} onClick={onUndo}><IconUndo /></button>
      )}
    </div>
  );
}

/* Status rechts auf der Kachel (13.4): raus, Pause, All-In, fold, dann die
   eigene Aktion dieser Setzrunde (check, call 40, erhöht 40). Ohne Aktion,
   aber mit Einsatz (Blinds): „setzt 10“. Im Hand-Ende „+120“ für Gewinner.
   `off` = gefoldet, raus oder pausiert (dunkle Fläche), `win` = hat gewonnen. */
export function tileState(p, screen) {
  if (screen === "handEnd" && p.won > 0) return { status: T.tile.won(p.won), off: false, win: true };
  if (p.out) return { status: T.tile.out, off: true };
  if (screen === "handEnd") return p.away ? { status: T.tile.pause, off: true } : { status: "", off: false };
  if (p.away && p.folded) return { status: T.tile.pause, off: true };
  if (p.allIn) return { status: T.tile.allIn(p.contrib), off: false };
  if (p.folded) return { status: T.tile.fold, off: true };
  if (p.last?.kind === "raise") return { status: T.tile.raise(p.bet), off: false };
  if (p.last?.kind === "call") return { status: T.tile.call(p.bet), off: false };
  if (p.last?.kind === "check") return { status: T.tile.check, off: false };
  if (p.bet > 0) return { status: T.tile.bets(p.bet), off: false };
  return { status: "", off: false };
}

// Zeile „Lea erhöht auf 40“ unter den Kacheln; leer zu Beginn einer Hand
export function LastAction({ players, lastAction }) {
  const p = lastAction && players.find((x) => x.id === lastAction.id);
  if (!p) return null;
  const { kind, to, allIn } = lastAction;
  const text = allIn && kind !== "fold" ? T.lastAct.allIn(p.name, to) : T.lastAct[kind]?.(p.name, to);
  if (!text) return null;
  return (
    <div className="lastAction" role="status">
      <SeatChip color={p.color} size={18} decorative />
      <span>{text}</span>
    </div>
  );
}

/* Unterer Teil von „Tisch“: sitzt direkt über der Tab-Leiste. Die Knöpfe
   sind immer das Letzte darin; Hinweise wachsen nach oben, die Knöpfe
   bleiben an ihrem Platz. */
export const TableDock = ({ children }) => <div className="tableDock">{children}</div>;

/* Titel im Hand-Ende aus `won`: „Lea gewinnt 120“, „Lea & Jonas teilen 240“
   oder bei Side Pots „Lea & Jonas gewinnen“. Bei Fold-Sieg ein Zusatz.
   Ältere Spielstände ohne `won`: null (dann gilt der alte Text). */
export function handEndTitle(players) {
  const winners = players.filter((p) => p.won > 0);
  if (!winners.length) return null;
  const names = winners.map((p) => p.name).join(" & ");
  const amounts = winners.map((p) => p.won);
  const total = amounts.reduce((s, a) => s + a, 0);
  const foldWin = players.filter((p) => !p.folded && !p.gone).length === 1;
  let title;
  if (winners.length === 1) title = T.winsHand(names, total);
  else if (Math.max(...amounts) - Math.min(...amounts) < winners.length) title = T.splitHand(names, total); // Restchips (Z2)
  else title = T.winHands(names);
  return { title, sub: foldWin ? T.foldWin : "" };
}

export function HandEndTitle({ players, handNum, handResult }) {
  const t = handEndTitle(players);
  if (!t) {
    return (
      <>
        <div className="title">{T.handOver(handNum)}</div>
        <div className="handResult">{handResult}</div>
      </>
    );
  }
  return (
    <>
      <div className="title handWin">{t.title}</div>
      {t.sub && <div className="handResult">{t.sub}</div>}
    </>
  );
}

/* SeatTile (13.4): SeatChip, Name, Stack, rechts Einsatz oder Status.
   Am Zug: Rand in der Sitzfarbe. `extra` z. B. ein Rebuy-Knopf. */
export function SeatTile({ p, status, off, current, win, dealer, me, extra }) {
  return (
    <div className={`seatTile ${off ? "off" : ""} ${current || win ? "current" : ""} ${win ? "win" : ""}`} style={seatStyle(p.color)}>
      <div className="top">
        <SeatChip color={p.color} size={18} off={off} />
        <span className="nm">{p.name}</span>
        {me && <span className="you">{T.tile.you}</span>}
        {dealer && <span className="dealerMark" role="img" aria-label={T.tile.dealerLabel}>{T.tile.dealer}</span>}
      </div>
      <div className="bottom">
        <span className="stk">{num(p.chips)}</span>
        {status && <span className="st">{status}</span>}
      </div>
      {extra}
    </div>
  );
}

export const SeatTiles = ({ children }) => <div className="seatTiles">{children}</div>;

/* Zeile im Slide „Spieler“ (13.5). Tipp auf die Zeile klappt die Knöpfe
   darunter auf, es ist immer höchstens eine Zeile offen. */
export function ManageRow({ p, badges = [], off, open, onToggle, pause, buttons }) {
  const canOpen = !!buttons;
  return (
    <div className={`manageRow2 ${open ? "open" : ""}`}>
      <div className={`playerRow ${off ? "off" : ""}`}>
        {canOpen ? (
          <button className="rowToggle" aria-expanded={open} aria-label={T.rowMore(p.name)} onClick={onToggle}>
            <RowBody p={p} badges={badges} off={off} />
          </button>
        ) : (
          <div className="rowToggle"><RowBody p={p} badges={badges} off={off} /></div>
        )}
        {pause}
      </div>
      {open && canOpen && <div className="rowButtons">{buttons}</div>}
    </div>
  );
}
const RowBody = ({ p, badges, off }) => (
  <>
    <SeatChip color={p.color} size={24} off={off} decorative />
    <span className="name">
      <span className="who">{p.name}</span>
      {badges.filter(Boolean).map((b) => <Badge key={b}>{b}</Badge>)}
    </span>
    <span className="stackNum">{num(p.chips)}</span>
  </>
);

/* Slide „Rangliste“ (13.6): nach Chips, Pausierte zählen mit, Verlassene
   am Ende. Unten Getränkerunde und Blind-Stufe, nur wenn eingestellt. */
export function RankingSlide({ players, handNum, screen, beerEvery, settings }) {
  const seated = players.filter((p) => !p.gone).slice().sort((a, b) => b.chips - a.chips);
  const left = players.filter((p) => p.gone);
  const [first, ...rest] = seated;
  const leader = engine.alive(players).slice().sort((a, b) => b.chips - a.chips)[0];
  const handEnd = screen === "handEnd";
  const nextBeer = beerEvery > 0 ? (handEnd ? Math.floor(handNum / beerEvery) + 1 : Math.ceil(handNum / beerEvery)) * beerEvery : 0;
  const bbNow = engine.blindsFor(handNum, settings);
  let k = 0;
  if (settings.blindUp > 0) {
    k = 1;
    while (engine.blindsFor(handNum + k, settings).b <= bbNow.b) k++;
  }
  const next = k ? engine.blindsFor(handNum + k, settings) : null;
  return (
    <>
      <div className="title">{T.rankingTitle}</div>
      <div className="rankHint"><HintLine left>{T.rankingHint}</HintLine></div>
      {first && (
        <div className="rankFirst" style={seatStyle(first.color)}>
          <span className="place">1.</span>
          <span className="nm">{first.name}</span>
          <span className="amt">{num(first.chips)}</span>
        </div>
      )}
      <div className="rankList">
        {rest.map((p, i) => (
          <div key={p.id} className={`rankRow ${p.out ? "off" : ""}`}>
            <span className="place">{i + 2}.</span>
            <SeatChip color={p.color} size={24} off={p.out} />
            <span className="nm">{p.name}{p.out && <Badge>{T.badge.out}</Badge>}{p.away && !p.out && <Badge>{T.badge.pause}</Badge>}</span>
            <span className="amt">{num(p.chips)}</span>
          </div>
        ))}
        {left.map((p) => (
          <div key={p.id} className="rankRow off">
            <span className="place" />
            <SeatChip color={p.color} size={24} off />
            <span className="nm">{p.name}<Badge>{T.badge.left}</Badge></span>
            <span className="amt">{num(p.chips)}</span>
          </div>
        ))}
      </div>
      {nextBeer > 0 && leader && <div className="infoCard">{T.drinksNext(nextBeer, leader.name)}</div>}
      {next && (
        <div className="infoCard">{T.blindsCard(k, handEnd, T.blindsPair(bbNow.s, bbNow.b), T.blindsPair(next.s, next.b))}</div>
      )}
    </>
  );
}

/* Slide „Hände“ (13.7): Hand-Rangfolge, alle zehn ohne Scrollen.
   ︎ hinter dem Kartenzeichen, damit iOS kein Emoji daraus macht. */
const MiniCard = ({ c }) => (
  <div className={`mini ${c[2] === "r" ? "r" : ""} ${c[3] === "dim" ? "dim" : ""}`}>
    <span>{c[0]}</span><span>{c[1]}{"︎"}</span>
  </div>
);

export function HandsSlide() {
  return (
    <>
      <div className="title">{T.handsTitle}</div>
      <HintLine left>{T.handsHint}</HintLine>
      <div className="handsList">
        {HANDS.map((h, i) => (
          <div className="hand" key={h.n}>
            <div className="rank">{i + 1}</div>
            <div className="info">
              <div className="hn">{h.n}</div>
              <div className="hd">{h.d}</div>
            </div>
            <div className="cards">{h.c.map((c, j) => <MiniCard c={c} key={j} />)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
