import { common as T } from "../text/de.js";
import { Button } from "./components.jsx";

/* Setup und Lobby-Regeln (docs/design.md 5.3, 5.2.3): Schalter, −/+ mit
   Klartext und eine eingeklappte Regel-Karte. Die meisten ändern nichts,
   deshalb steht zuerst nur die Zusammenfassung da. */

// Kippschalter: aus = Linie, an = Kreide mit Knopf rechts. Tap-Fläche 48 px.
export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" className={`switch ${checked ? "on" : ""}`} role="switch" aria-checked={checked}
      aria-label={label} onClick={() => onChange(!checked)}>
      <span className="track"><span className="knob" /></span>
    </button>
  );
}

// −/+ mit Klartext, z. B. „Getränkerunde: alle 3 Hände“ bzw. „aus“
export function Stepper({ label, value, min = 0, max = 99, onChange, text }) {
  return (
    <div className="stepper">
      <div className="stepText">
        <span className="fieldLbl">{label}</span>
        <span className="stepVal">{text(value)}</span>
      </div>
      <button type="button" className="iconBtn" aria-label={T.aria.lessOf(label)} disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <button type="button" className="iconBtn" aria-label={T.aria.moreOf(label)} disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

// Zahlenfeld mit Label in normaler Schreibweise
export function NumberField({ label, hint, ...input }) {
  return (
    <label className="numField">
      <span className="fieldLbl">{label}</span>
      <input type="number" {...input} />
      {hint && <span className="fieldHint">{hint}</span>}
    </label>
  );
}

/* Regel-Karte: eingeklappt zwei Zeilen Zusammenfassung und „Ändern“.
   Ohne `onToggle` (Nicht-Admins) nur die Zusammenfassung. */
export function RulesCard({ open, onToggle, lines, children }) {
  return (
    <div className="card rulesCard">
      <div className="rulesTop">
        <div className="rulesSum">
          <h3 className="sec">{T.rules}</h3>
          {lines.map((l) => <div key={l} className="sumLine">{l}</div>)}
        </div>
        {onToggle && (
          <Button className="small" aria-expanded={open} onClick={onToggle}>{open ? T.rulesDone : T.rulesChange}</Button>
        )}
      </div>
      {open && <div className="rulesBody">{children}</div>}
    </div>
  );
}
