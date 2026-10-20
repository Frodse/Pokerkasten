import { useRef, useEffect } from "react";
import { chipParts, stacksOf, PER_STACK, MAX_VISIBLE } from "./chips.js";

/* Chips von der Seite als flacher Zylinder (docs/design.md 14.4): Kreis in
   der Sitzfarbe mit gestricheltem Kreide-Rand, ohne Kartenzeichen. Neue
   Chips fallen kurz auf den Stapel (220 ms), beim ersten Zeichnen nicht. */

function Chip({ color, drop }) {
  const seat = color ? `var(--${color})` : "var(--c-chalk)";
  const edge = color === "seat-chalk" || !color ? "rgba(23,19,15,.45)" : "var(--c-chalk)";
  return (
    <svg className={`chip ${drop ? "drop" : ""}`} viewBox="0 0 40 16" aria-hidden="true">
      <path d="M0 5v6a20 5 0 0 0 40 0V5z" fill={seat} />
      <path d="M0 5v6a20 5 0 0 0 40 0V5z" fill="rgba(23,19,15,.3)" />
      <ellipse cx="20" cy="5" rx="19.25" ry="4.25" fill={seat} stroke={edge} strokeWidth="1.5" strokeDasharray="4 2.6" />
    </svg>
  );
}

// Ein Stapel aus `count` Chips einer Farbe
export function ChipStack({ color, count }) {
  const seen = useRef(null); // Anzahl beim letzten Zeichnen, null = erstes Mal
  const before = seen.current ?? count;
  useEffect(() => { seen.current = count; });
  return (
    <span className="chipStack">
      {Array.from({ length: count }, (_, i) => <Chip key={i} color={color} drop={i >= before} />)}
    </span>
  );
}

/* Mehrere Teile [{ key, color, amount }] nebeneinander, je Teil so viele
   Stapel wie nötig. `bb` = Wert eines Chips. */
export function ChipPile({ parts, bb, perStack = PER_STACK, max = MAX_VISIBLE, className = "" }) {
  const counted = chipParts(parts, bb, max);
  if (!counted.length) return null;
  return (
    <span className={`chipPile ${className}`} aria-hidden="true">
      {counted.flatMap((p) => stacksOf(p.count, perStack).map((n, col) => (
        <ChipStack key={`${p.key}-${col}`} color={p.color} count={n} />
      )))}
    </span>
  );
}
