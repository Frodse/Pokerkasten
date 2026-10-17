import { common as T } from "../text/de.js";

/* Narrenkappe (docs/design.md Kap. 8): Wortmarke oben auf jeder Seite und
   klein im Moment-Overlay. Gleiche Form wie das App-Icon (public/icon.svg). */
const TIPS = {
  left: "M44 108 C30 88 18 68 20 46 C40 58 58 80 72 106 Z",
  right: "M116 108 C130 88 142 68 140 46 C120 58 102 80 88 106 Z",
  mid: "M62 106 C62 78 70 50 80 24 C90 50 98 78 98 106 Z",
};

// mono: Zipfel und Band in Nacht, Glöckchen Kreide (für farbige Flächen)
export function Cap({ mono, className }) {
  const fill = (color) => (mono ? "var(--c-night)" : color);
  return (
    <svg className={className} viewBox="8 8 144 120" aria-hidden="true">
      <path d={TIPS.left} fill={fill("var(--seat-red)")} />
      <path d={TIPS.right} fill={fill("var(--seat-blue)")} />
      <path d={TIPS.mid} fill={fill("var(--seat-yellow)")} />
      <circle cx="20" cy="42" r="10" fill="var(--c-chalk)" />
      <circle cx="140" cy="42" r="10" fill="var(--c-chalk)" />
      <circle cx="80" cy="20" r="10" fill="var(--c-chalk)" />
      <rect x="36" y="102" width="88" height="24" rx="12" fill={mono ? "var(--c-night)" : "var(--c-chalk)"} />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="wordmark">
      <Cap />
      <span>{T.appName}</span>
    </div>
  );
}
