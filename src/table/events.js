import { alive, potTotal } from "../../supabase/functions/_shared/engine.js";

/* Spielereignisse für die Tisch-Anzeige (docs/design.md 14.6). Reine
   Funktion: vergleicht zwei Spielstände und sagt, was dazwischen passiert
   ist. Später hängen daran Animationen (Figuren, Streaks, Musik); jetzt
   nutzt die Anzeige sie nur, um zu wissen, dass sich etwas getan hat.

   Ereignisse:
     { kind: "allIn",    id, amount }  – Spieler hat seinen ganzen Stack gesetzt
     { kind: "bigPot",   amount }      – Pot erreicht mindestens die Hälfte aller Chips
     { kind: "out",      id }          – Spieler ist ausgeschieden
     { kind: "newLeader", id }         – ein anderer führt jetzt nach Chips */

export const BIG_POT_SHARE = 0.5;

// Chip-Leader: meiste Chips unter allen, die noch dabei sind (bei Gleichstand
// keiner). Was jemand in dieser Hand schon gesetzt hat, zählt noch zu ihm,
// damit der Vergleich mit dem Stand vor der Vergabe stimmt.
function leaderOf(players) {
  const ps = alive(players);
  if (!ps.length) return null;
  const own = (p) => p.chips + p.contrib;
  const top = Math.max(...ps.map(own));
  const at = ps.filter((p) => own(p) === top);
  return at.length === 1 ? at[0].id : null;
}

const allChips = (players) => players.filter((p) => !p.gone).reduce((s, p) => s + p.chips + p.contrib, 0);

export function deriveEvents(prev, next) {
  if (!prev || !next || !prev.players || !next.players) return [];
  const events = [];
  const before = (id) => prev.players.find((p) => p.id === id);
  const sameHand = prev.handNum === next.handNum;

  for (const p of next.players) {
    const was = before(p.id);
    if (!was) continue;
    if (p.allIn && !(sameHand && was.allIn)) events.push({ kind: "allIn", id: p.id, amount: p.contrib });
    if (p.out && !was.out) events.push({ kind: "out", id: p.id });
  }

  const total = allChips(next.players);
  const potNow = potTotal(next.players);
  const potThen = sameHand ? potTotal(prev.players) : 0;
  if (total > 0 && potNow >= total * BIG_POT_SHARE && potThen < total * BIG_POT_SHARE) {
    events.push({ kind: "bigPot", amount: potNow });
  }

  // Chip-Leader nur zwischen Händen vergleichen, mitten in der Hand liegen Chips im Pot
  if (next.screen === "handEnd" || next.screen === "over") {
    const was = leaderOf(prev.players), now = leaderOf(next.players);
    if (now !== null && now !== was) events.push({ kind: "newLeader", id: now });
  }
  return events;
}
