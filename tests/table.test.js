// Tests für die Tisch-Anzeige (docs/design.md Kap. 14): Chipstapel und Spielereignisse.
// Nur Bild und Ereignisse, keine Spielregeln.
import { describe, it, expect } from "vitest";
import { fresh, beginHand, applyAction, awardPot, computePots, removePlayer } from "../supabase/functions/_shared/engine.js";
import { chipCount, chipParts, stacksOf, potShares } from "../src/table/chips.js";
import { deriveEvents } from "../src/table/events.js";

const S = { sb: 10, blindUp: 8, startChips: 1000, buyInEuro: 10 };
const EMPTY = {
  screen: "start", players: [], dealer: 0, phase: 0, cur: 0, curBet: 0, minRaise: 0, handNum: 0,
  notice: "", runout: false, pots: [], potIdx: 0, winnersSel: [], handResult: "", announce: null,
};
function table(stacks) {
  const ps = stacks.map((chips, i) => ({ id: i, name: "ABCDEFGHI"[i], chips, buyIn: chips, out: false, away: false, gone: false, ...fresh({}) }));
  return beginHand({ ...EMPTY, players: ps }, ps, 0, 1, S);
}
const act = (st, kind, amount) => applyAction(st, kind, amount, S);

describe("Chipstapel (14.4)", () => {
  it("1 Chip = 1 Big Blind, gerundet, mindestens einer", () => {
    expect(chipCount(0, 20)).toBe(0);
    expect(chipCount(10, 20)).toBe(1);
    expect(chipCount(30, 20)).toBe(2);
    expect(chipCount(400, 20)).toBe(20);
  });
  it("höchstens 20 pro Stapel, dann daneben", () => {
    expect(stacksOf(45)).toEqual([20, 20, 5]);
    expect(stacksOf(10, 10)).toEqual([10]);
  });
  it("über 60 Chips schrumpft jeder Teil anteilig, keiner verschwindet", () => {
    const parts = chipParts([{ key: 0, amount: 2000 }, { key: 1, amount: 2000 }, { key: 2, amount: 20 }], 20);
    expect(parts.reduce((s, p) => s + p.count, 0)).toBeLessThanOrEqual(60);
    expect(parts.find((p) => p.key === 2).count).toBe(1);
  });
  it("Pot-Aufteilung stimmt mit dem Rechenkern überein, auch mit Side Pots und Entfernten", () => {
    let st = table([1000, 300, 100]);
    st = act(st, "raise", 100); // A
    st = act(st, "raise", 300); // B all-in
    st = act(st, "call");       // C all-in mit 100
    st = act(st, "call");       // A
    const engine = computePots(st.players);
    const shares = potShares(st.players);
    expect(shares.map((p) => [p.amt, p.elig])).toEqual(engine.map((p) => [p.amt, p.elig]));
    for (const p of shares) expect(Object.values(p.by).reduce((s, x) => s + x, 0)).toBe(p.amt);
    // Z4: Spieler mit dem höchsten Einsatz entfernt
    let z = act(act(table([1000, 50, 50]), "raise", 100), "call");
    z = removePlayer(z, 0, S);
    const ps = { ...z, players: z.players.map((p) => ({ ...p })) };
    expect(potShares(ps.players).map((p) => [p.amt, p.elig])).toEqual(computePots(ps.players).map((p) => [p.amt, p.elig]));
  });
});

describe("Spielereignisse (14.6)", () => {
  it("All-In einmal pro Hand", () => {
    const a = table([1000, 500, 1000]);
    const b = act(a, "call");
    expect(deriveEvents(a, b)).toEqual([]);
    const c = act(b, "raise", 500);
    expect(deriveEvents(b, c)).toContainEqual({ kind: "allIn", id: 1, amount: 500 });
    const d = act(c, "call");
    expect(deriveEvents(c, d).filter((e) => e.kind === "allIn" && e.id === 1)).toEqual([]);
  });
  it("großer Pot ab der Hälfte aller Chips, nur beim Überschreiten", () => {
    const a = table([1000, 1000, 1000]);
    const b = act(a, "raise", 600); // Pot 630 von 3000
    expect(deriveEvents(a, b).map((e) => e.kind)).toEqual([]);
    const c = act(b, "call");       // Pot 1220
    expect(deriveEvents(b, c).map((e) => e.kind)).toEqual([]);
    const d = act(c, "call");       // Pot 1800 ≥ 1500
    expect(deriveEvents(c, d)).toContainEqual({ kind: "bigPot", amount: 1800 });
    const e = act(d, "check");
    expect(deriveEvents(d, e).filter((x) => x.kind === "bigPot")).toEqual([]);
  });
  it("Ausscheiden und neuer Chip-Leader am Hand-Ende", () => {
    let st = table([800, 300, 1000]); // C führt
    st = act(st, "raise", 300); // A
    st = act(st, "call");       // B all-in
    st = act(st, "fold");       // C
    expect(st.screen).toBe("showdown");
    const end = awardPot({ ...st, winnersSel: [0] });
    const ev = deriveEvents(st, end);
    expect(ev).toContainEqual({ kind: "out", id: 1 });
    expect(ev).toContainEqual({ kind: "newLeader", id: 0 });
  });
  it("ohne Vorstand keine Ereignisse", () => {
    expect(deriveEvents(null, table([1000, 1000]))).toEqual([]);
  });
});
