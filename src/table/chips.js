/* Chipstapel für Tisch-Anzeige und Spieler-Handys (docs/design.md 14.4, 14.5).
   Nur Bild: Die Zahl daneben ist immer die Wahrheit, gerundet wird nur hier.

   1 Chip = 1 Big Blind der aktuellen Stufe. Chips haben die Sitzfarbe des
   Spielers, der sie gesetzt hat. */

export const PER_STACK = 20;   // höchstens 20 Chips pro Stapel, dann ein neuer daneben
export const MAX_VISIBLE = 60; // insgesamt ungefähr so viele, danach wächst nur die Zahl

// Chips für einen Betrag: gerundet auf Big Blinds, aber mindestens einer
export const chipCount = (amount, bb) => (amount > 0 ? Math.max(1, Math.round(amount / Math.max(1, bb))) : 0);

/* Teile [{ key, color, amount }] → [{ key, color, count }]. Werden es mehr
   als `max` Chips, schrumpft jeder Teil anteilig (jeder behält mindestens
   einen Chip). */
export function chipParts(parts, bb, max = MAX_VISIBLE) {
  const counted = parts.map((p) => ({ ...p, count: chipCount(p.amount, bb) })).filter((p) => p.count > 0);
  const total = counted.reduce((s, p) => s + p.count, 0);
  if (total <= max) return counted;
  return counted.map((p) => ({ ...p, count: Math.max(1, Math.floor((p.count * max) / total)) }));
}

// Einen Teil in Stapel zu je höchstens `perStack` Chips zerlegen
export function stacksOf(count, perStack = PER_STACK) {
  const out = [];
  for (let left = count; left > 0; left -= perStack) out.push(Math.min(perStack, left));
  return out;
}

/* Wer wie viel in welchem Pot hat (Main Pot, Side Pots), in derselben
   Aufteilung wie engine.computePots: Stufen nach Einsatz, gleiche
   Berechtigte zusammengelegt, Pots ohne Berechtigte gehen in den letzten
   Pot mit Berechtigten. Gibt [{ amt, elig, by: { [playerId]: Betrag } }]. */
export function potShares(players) {
  const levels = [...new Set(players.filter((q) => q.contrib > 0).map((q) => q.contrib))].sort((a, b) => a - b);
  let prev = 0;
  const out = [];
  for (const lv of levels) {
    const by = {};
    for (const q of players) {
      const part = Math.max(0, Math.min(q.contrib, lv) - prev);
      if (part > 0) by[q.id] = part;
    }
    const amt = Object.values(by).reduce((s, x) => s + x, 0);
    const elig = players.filter((q) => !q.out && !q.folded && q.contrib >= lv).map((q) => q.id);
    prev = lv;
    if (amt === 0) continue;
    const last = out[out.length - 1];
    if (last && last.elig.length === elig.length && last.elig.every((e, i) => e === elig[i])) {
      last.amt += amt;
      for (const [id, x] of Object.entries(by)) last.by[id] = (last.by[id] ?? 0) + x;
    } else out.push({ amt, elig, by });
  }
  const withElig = out.filter((pt) => pt.elig.length > 0);
  if (withElig.length && withElig.length < out.length) {
    const target = withElig[withElig.length - 1];
    for (const pt of out.filter((x) => x.elig.length === 0)) {
      target.amt += pt.amt;
      for (const [id, x] of Object.entries(pt.by)) target.by[id] = (target.by[id] ?? 0) + x;
    }
    return withElig;
  }
  return out;
}
