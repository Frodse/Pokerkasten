import { useRef, useEffect } from "react";
import { Cap } from "./brand.jsx";
import { common as T, num } from "../text/de.js";
import { SEAT_COLORS } from "../../supabase/functions/_shared/seats.js";
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

export const seatLabel = (color) => T.seatChip(T.seatColor[color], T.suit[SUIT_OF[color]]);

export function SeatChip({ color, size = 24, off, current, decorative }) {
  const suit = SUIT_OF[color];
  if (!suit) return null;
  return (
    <svg className={`seatChip ${off ? "off" : ""} ${current ? "current" : ""}`} width={size} height={size} viewBox="0 0 48 48"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": seatLabel(color) })} style={{ "--seat": `var(--${color})` }}>
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
export function PlayerRow({ name, color, badges = [], bet = 0, stack, status, off, current, action, onChipClick, chipLabel }) {
  const chip = <SeatChip color={color} size={current ? 32 : 24} off={off} current={current} decorative={!!onChipClick} />;
  return (
    <div className={`playerRow ${off ? "off" : ""} ${current && !SUIT_OF[color] ? "currentText" : ""}`}>
      {onChipClick ? <button className="chipBtn" aria-label={chipLabel} onClick={onChipClick}>{chip}</button> : chip}
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

/* ColorPicker (5.2.2): neun Sitzfarben in 5 Spalten. `taken` ordnet
   vergebenen Farben den Namen zu, `mine` beschriftet die eigene Wahl. */
export function ColorPicker({ value, taken = {}, onPick, mine = T.badge.you }) {
  return (
    <div className="colorPicker">
      {SEAT_COLORS.map((c) => {
        const owner = c === value ? null : taken[c];
        return (
          <button key={c} type="button" className={`colorOpt ${c === value ? "sel" : ""}`} disabled={!!owner}
            aria-label={owner ? T.colorTakenBy(seatLabel(c), owner) : seatLabel(c)} aria-pressed={c === value}
            onClick={() => onPick(c)}>
            <SeatChip color={c} size={56} decorative />
            <span className="owner">{c === value ? mine : owner ?? ""}</span>
          </button>
        );
      })}
    </div>
  );
}

// Farbrahmen um den ganzen Bildschirm (4.13 SeatFrame), z. B. „du bist dran“
export function SeatFrame({ color }) {
  if (!SUIT_OF[color]) return null;
  return <div className="seatFrame" style={seatStyle(color)} aria-hidden="true" />;
}

/* Tisch-Code als vier Ziffernfelder (5.2.2). Der Code wird immer von vorn
   gefüllt; Einfügen und automatisches Ausfüllen verteilen alle Ziffern. */
export function CodeInput({ value, onChange }) {
  const boxes = useRef([]);
  // Erst nach dem Neuzeichnen springen, sonst sieht das Feld noch den alten Code
  const focus = (i) => setTimeout(() => boxes.current[Math.max(0, Math.min(3, i))]?.focus(), 0);
  const type = (i, raw) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    const next = (value.slice(0, i) + digits).slice(0, 4);
    onChange(next);
    focus(next.length);
  };
  const key = (i, e) => {
    if (e.key !== "Backspace") return;
    e.preventDefault();
    const cut = value[i] ? i : i - 1;
    if (cut < 0) return;
    onChange(value.slice(0, cut));
    focus(cut);
  };
  return (
    <div className="codeBoxes">
      {[0, 1, 2, 3].map((i) => (
        <input key={i} ref={(el) => (boxes.current[i] = el)} type="text" inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={T.codeDigit(i + 1)} value={value[i] ?? ""}
          onFocus={(e) => (i > value.length ? focus(value.length) : e.target.select())}
          onChange={(e) => type(i, e.target.value)}
          onKeyDown={(e) => key(i, e)} />
      ))}
    </div>
  );
}

// Lautstärke „Ruhig“ / „Laut“ (Kap. 9), im Setup bzw. in den Lobby-Regeln
export function VolumeToggle({ value, onChange }) {
  const loud = value === "loud";
  return (
    <div className="field">
      <span className="lbl">{T.volume}</span>
      <div className="toggleRow" style={{ marginBottom: 0 }}>
        <Button className={!loud ? "on" : ""} aria-pressed={!loud} onClick={() => onChange("quiet")}>{T.quiet}</Button>
        <Button className={loud ? "on" : ""} aria-pressed={loud} onClick={() => onChange("loud")}>{T.loud}</Button>
      </div>
      <HintLine left>{T.volumeHint}</HintLine>
    </div>
  );
}

/* Moment-Overlay (Kap. 9, nur „Laut“): Vollbild in der Sitzfarbe der Person.
   Ein Tipp schließt, sonst nach 2 s von selbst. */
const MOMENT_MS = 2000;

export function MomentOverlay({ moment, players, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, MOMENT_MS);
    return () => clearTimeout(timer);
  }, [moment.key]);
  const p = players.find((x) => x.id === moment.id);
  const text = T.moment[moment.kind];
  if (!p || !text) return null;
  return (
    <div className="moment" style={seatStyle(p.color)} onClick={onClose} role="status">
      <Cap mono className="cap" />
      <div className="big">{text.big}</div>
      <div className="who"><SeatChip color={p.color} size={56} decorative /><span>{p.name}</span></div>
      <div className="line">{text.line(p.name, moment.amount)}</div>
    </div>
  );
}
