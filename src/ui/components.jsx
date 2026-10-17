import { common as T, num, HANDS } from "../text/de.js";
import { IconWarning, IconPause, IconPlay } from "./icons.jsx";

/* Grundbausteine nach docs/design.md (4.2a, 4.8, 4.10–4.12, 4.14).
   Einzel-Handy-Spiel und Online-Tisch benutzen dieselben. */

// Knopf (4.11): sekundär, mit `primary` Kreide. `loading` zeigt „Moment …“.
export function Button({ primary, loading, className = "", disabled, children, ...rest }) {
  return (
    <button className={`btn ${primary ? "primary" : ""} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? T.busy : children}
    </button>
  );
}

// Zweistufige Bestätigung (4.11): erster Tipp fragt nach, zweiter führt aus
export function TwoTapButton({ armed, onArm, onConfirm, confirmLabel, className = "", children, ...rest }) {
  return (
    <button className={`btn ${armed ? "armed" : ""} ${className}`} onClick={armed ? onConfirm : onArm} {...rest}>
      {armed ? confirmLabel : children}
    </button>
  );
}

// Quadratischer 48-px-Knopf für Pause/Fortsetzen
export function PauseButton({ away, ...rest }) {
  return (
    <button className="iconBtn" aria-label={away ? T.aria.resume : T.aria.pause} {...rest}>
      {away ? <IconPlay /> : <IconPause />}
    </button>
  );
}

export const NoticeLine = ({ children }) => <div className="noticeLine">{children}</div>;
export const HintLine = ({ left, children }) => <div className={`hintLine ${left ? "left" : ""}`}>{children}</div>;

// Fehlerbanner (4.12): Kreide statt Rot, weil Rot eine Sitzfarbe ist
export function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div className="errorBanner" role="alert">
      <IconWarning />
      <div>{children}</div>
    </div>
  );
}

// Sitzfarbe als CSS-Variable --seat; ohne Farbe greift der Ersatz im Stylesheet
export const seatStyle = (color) => (color ? { "--seat": `var(--${color})` } : undefined);

export const Badge = ({ children }) => <span className="badge">{children}</span>;

/* SeatChip (4.2a). `color` ist der Token-Name, z. B. "seat-red".
   Das Kartenzeichen hängt fest an der Farbe. */
const SUIT_OF = {
  "seat-red": "heart", "seat-blue": "spade", "seat-green": "club", "seat-yellow": "diamond", "seat-chalk": "star",
  "seat-purple": "diamond", "seat-orange": "spade", "seat-teal": "heart", "seat-pink": "club",
};
const SUIT_SHAPE = {
  heart: <path d="M12 21s-9-6-9-12.2C3 5.6 5.4 3.5 8.1 3.5c1.7 0 3.1.9 3.9 2.3.8-1.4 2.2-2.3 3.9-2.3 2.7 0 5.1 2.1 5.1 5.3C21 15 12 21 12 21z" />,
  spade: <path d="M12 2C9 6 3 9 3 14c0 3 2.5 5 5 5 1.6 0 2.8-.8 3.3-2-.3 2-1 3.6-2.3 5h6c-1.3-1.4-2-3-2.3-5 .5 1.2 1.7 2 3.3 2 2.5 0 5-2 5-5 0-5-6-8-9-12z" />,
  diamond: <path d="M12 2l8 10-8 10-8-10z" />,
  club: (
    <>
      <circle cx="12" cy="7" r="4.6" /><circle cx="7" cy="13.2" r="4.6" /><circle cx="17" cy="13.2" r="4.6" />
      <circle cx="12" cy="12" r="3" /><path d="M11 12h2l1.6 10h-5.2z" />
    </>
  ),
  star: <path d="M12 2l2.6 6.6 6.9.6-5.3 4.5 1.7 6.9L12 16.8l-5.9 3.8 1.7-6.9-5.3-4.5 6.9-.6z" />,
};

export function SeatChip({ color, size = 24, off, current }) {
  const suit = SUIT_OF[color];
  if (!suit) return null;
  return (
    <svg className={`seatChip ${off ? "off" : ""} ${current ? "current" : ""}`} width={size} height={size} viewBox="0 0 48 48"
      role="img" aria-label={T.seatChip(T.seatColor[color], T.suit[suit])} style={{ "--seat": `var(--${color})` }}>
      <circle cx="24" cy="24" r="23" fill="var(--seat)" />
      {size >= 24 && (
        <circle cx="24" cy="24" r="19" fill="none" strokeWidth="4" strokeDasharray="6 3.95"
          stroke={color === "seat-chalk" ? "rgba(23,19,15,.45)" : "var(--c-chalk)"} />
      )}
      <g transform="translate(14 14) scale(0.8333)" fill="var(--c-night)">{SUIT_SHAPE[suit]}</g>
    </svg>
  );
}

/* PlayerRow (4.8): SeatChip · Name · Badges · Einsatz · Stack · Knopf.
   `status` ersetzt den Stack durch ein Wort (z. B. „Einverstanden“). */
export function PlayerRow({ name, color, badges = [], bet = 0, stack, status, off, current, action }) {
  return (
    <div className={`playerRow ${off ? "off" : ""} ${current && !SUIT_OF[color] ? "currentText" : ""}`}>
      <SeatChip color={color} size={current ? 32 : 24} off={off} current={current} />
      <div className="name">
        <span className="who">{name}</span>
        {badges.filter(Boolean).map((b) => <Badge key={b}>{b}</Badge>)}
      </div>
      {bet > 0 && <div className="bet">{T.bets(bet)}</div>}
      {status !== undefined
        ? <div className="status">{status}</div>
        : stack !== undefined && <div className="stackNum">{num(stack)}</div>}
      {action}
    </div>
  );
}

// Sheet von unten (4.14): großer Schließen-Knopf, Tipp außerhalb schließt
export function Sheet({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="sec">{title}</h3>}
        {children}
        <Button className="sheetClose" onClick={onClose}>{T.close}</Button>
      </div>
    </div>
  );
}

// Kurzer Hinweis in einer Karte, nur im Anfängermodus (4.9)
export const ExplainLine = ({ children }) => <div className="explainLine">{children}</div>;

// Pot groß in der Mitte (5.4)
export function PotDisplay({ amount, label = T.pot }) {
  return (
    <div className="potDisplay">
      <span className="lbl">{label}</span>
      <div className="amt">{num(amount)}</div>
    </div>
  );
}

// Phasen Pre-Flop · Flop · Turn · River (4.4)
export function PhaseTrack({ phases, phase }) {
  return (
    <div className="phaseTrack">
      {phases.map((ph, i) => <span key={ph} className={i === phase ? "on" : ""}>{ph}</span>)}
    </div>
  );
}

/* ActionBar (4.5): vier gleich große Knöpfe an festen Plätzen, keiner
   hervorgehoben. `L` sind die Beschriftungen (Standard oder Anfänger). */
export function ActionBar({ L, toCall, stack, total, raiseAllowed, allInAllowed, armed, onArm, onAct, onRaise, disabled }) {
  return (
    <div className="actionBar">
      <Button className="action" disabled={disabled} onClick={() => onAct("fold")}>{L.fold}</Button>
      {toCall === 0
        ? <Button className="action" disabled={disabled} onClick={() => onAct("check")}>{L.check}</Button>
        : <Button className="action" disabled={disabled} onClick={() => onAct("call")}>{L.call(Math.min(toCall, stack), toCall >= stack)}</Button>}
      <Button className="action" disabled={disabled || !raiseAllowed} onClick={onRaise}>{L.raise}</Button>
      <TwoTapButton className="action" disabled={disabled || !allInAllowed} armed={armed}
        onArm={onArm} onConfirm={() => onAct("raise", total)} confirmLabel={L.allInConfirm(total)}>
        {L.allIn(total)}
      </TwoTapButton>
    </div>
  );
}

/* RaisePanel (4.6): ersetzt die ActionBar an derselben Stelle.
   ± um `step` (Big Blind), nie unter `minTarget`, nie über `max` (U0).
   `potBet(f)` rechnet der Rechenkern (Z8). */
export function RaisePanel({ L, noob, value, onChange, minTarget, max, step, potBet, onBack, onConfirm, disabled }) {
  return (
    <div className="raisePanel">
      <span className="lbl">{L.raiseLabel}</span>
      {noob && <HintLine left>{L.raiseExplain}</HintLine>}
      <div className="target">
        <button className="iconBtn" aria-label={T.aria.less} onClick={() => onChange(Math.max(minTarget, value - step))}>−</button>
        <div className="val">{num(value)}</div>
        <button className="iconBtn" aria-label={T.aria.more} onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
      <div className="quickRow">
        <Button onClick={() => onChange(Math.min(minTarget, max))}>{T.quick.min}</Button>
        <Button onClick={() => onChange(potBet(0.5))}>{T.quick.half}</Button>
        <Button onClick={() => onChange(potBet(2 / 3))}>{T.quick.twoThirds}</Button>
        <Button onClick={() => onChange(potBet(1))}>{T.quick.pot}</Button>
        <Button onClick={() => onChange(max)}>{T.quick.max}</Button>
      </div>
      <div className="row">
        <Button onClick={onBack}>{T.back}</Button>
        <Button primary disabled={disabled} onClick={() => onConfirm(value)}>{L.raiseConfirm(value)}</Button>
      </div>
    </div>
  );
}

// Hand-Rangfolge als Sheet (4.15)
const MiniCard = ({ c }) => (
  <div className={`mini ${c[2] === "r" ? "r" : ""} ${c[3] === "dim" ? "dim" : ""}`}>
    <span>{c[0]}</span><span>{c[1]}</span>
  </div>
);

export function HandsSheet({ onClose }) {
  return (
    <Sheet title={T.handsTitle} onClose={onClose}>
      <HintLine left>{T.handsHint}</HintLine>
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
    </Sheet>
  );
}

// WinnerRow (4.8): ganze Breite, ausgewählt in der Sitzfarbe mit „Gewinner“
export function WinnerRow({ name, color, selected, onClick, disabled }) {
  return (
    <button className={`winnerRow ${selected ? "sel" : ""}`} style={seatStyle(color)} aria-pressed={selected}
      onClick={onClick} disabled={disabled}>
      <SeatChip color={color} size={32} />
      <span className="name">{name}</span>
      {selected && <span className="mark">{T.winner}</span>}
    </button>
  );
}

// RoundCard (5.8): Kreide-Karte, z. B. für die Getränkerunde
export function RoundCard({ color, title, children }) {
  return (
    <div className="roundCard">
      <SeatChip color={color} size={40} />
      <div>
        <div className="h">{title}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}
