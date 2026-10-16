// Tests für den Rechenkern. Kürzel (H7, AK4, …) verweisen auf docs/spielregeln.md.
// Sie halten das am Tisch erprobte Verhalten fest. Z1–Z5 gelten seit 16.10.2026 wie in docs/architektur.md entschieden.
import { describe, it, expect } from "vitest";
import {
  fresh, blindsFor, beginHand, startGame, applyAction, computePots, awardPot, nextHand,
  addPlayer, removePlayer, movePlayer, togglePause, rebuy, potBet, canRaise, nextAliveIdx,
} from "../supabase/functions/_shared/engine.js";

const S = { sb: 10, blindUp: 8, startChips: 1000 };
const EMPTY = {
  screen: "start", players: [], dealer: 0, phase: 0, cur: 0, curBet: 0, minRaise: 0, handNum: 0,
  notice: "", runout: false, pots: [], potIdx: 0, winnersSel: [], handResult: "", announce: null,
};
const NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

// Tisch mit gegebenen Stacks, erste Hand, Dealer auf Platz `dealer`
function table(stacks, { dealer = 0, away = [], settings = S } = {}) {
  const ps = stacks.map((chips, i) => ({
    id: i, name: NAMES[i], noob: false, chips, out: false, away: away.includes(i), gone: false, ...fresh({}),
  }));
  return beginHand({ ...EMPTY, players: ps }, ps, dealer, 1, settings);
}
const act = (st, kind, amount) => applyAction(st, kind, amount, S);
const who = (st) => st.players[st.cur]?.name;
const chips = (st) => st.players.map((p) => p.chips);

describe("Setup (S2, S3, S7)", () => {
  it("ignoriert leere Namen, vergibt ids in Reihenfolge, würfelt den Dealer", () => {
    const rows = [{ name: " Anna " }, { name: "  " }, { name: "Ben", noob: true }, { name: "Cem" }];
    const st = startGame(EMPTY, rows, S, 0.99);
    expect(st.players.map((p) => [p.id, p.name, p.noob])).toEqual([[0, "Anna", false], [1, "Ben", true], [2, "Cem", false]]);
    expect(st.dealer).toBe(2);
    expect(st.handNum).toBe(1);
  });
  it("startet nicht mit weniger als 2 Namen", () => {
    expect(startGame(EMPTY, [{ name: "Anna" }, { name: "" }], S, 0)).toBe(EMPTY);
  });
});

describe("Blind-Eskalation (B1, B2)", () => {
  it("verdoppelt alle 8 Hände", () => {
    expect([1, 8, 9, 16, 17, 25].map((h) => blindsFor(h, S))).toEqual([
      { s: 10, b: 20 }, { s: 10, b: 20 }, { s: 20, b: 40 }, { s: 20, b: 40 }, { s: 40, b: 80 }, { s: 80, b: 160 },
    ]);
  });
  it("bleibt bei 0 = aus konstant", () => {
    expect(blindsFor(100, { sb: 10, blindUp: 0 })).toEqual({ s: 10, b: 20 });
  });
});

describe("Handstart (H, T1)", () => {
  it("3 Spieler: SB nach Dealer, BB danach, UTG beginnt", () => {
    const st = table([1000, 1000, 1000]);
    expect(st.players.map((p) => p.bet)).toEqual([0, 10, 20]);
    expect(st.curBet).toBe(20);
    expect(st.minRaise).toBe(20);
    expect(who(st)).toBe("A");
    expect(st.notice).toBe("Blinds gesetzt · SB B (10) · BB C (20)");
    expect(st.announce.title).toBe("Hand #1");
  });
  it("🔧1/2 H7/H8: zu kurzer BB ist all-in, offener Einsatz bleibt die volle BB", () => {
    const st = table([1000, 1000, 15]);
    expect(st.players[2]).toMatchObject({ bet: 15, chips: 0, allIn: true });
    expect(st.curBet).toBe(20);
  });
  it("🔧5 H4: inaktiver Dealer wird weitergeschoben", () => {
    const st = table([1000, 1000, 1000, 1000], { dealer: 1, away: [1] });
    expect(st.dealer).toBe(2);
  });
  it("Pausierte sitzen die Hand gefoldet aus (V2)", () => {
    const st = table([1000, 1000, 1000, 1000], { away: [3] });
    expect(st.players[3]).toMatchObject({ folded: true, acted: true, bet: 0 });
  });
});

describe("Heads-up (HU)", () => {
  it("🔧3 HU2/HU3: Dealer ist SB und beginnt, postflop beginnt der andere", () => {
    let st = table([1000, 1000]);
    expect(st.players.map((p) => p.bet)).toEqual([10, 20]);
    expect(who(st)).toBe("A");
    st = act(st, "call");
    expect(who(st)).toBe("B"); // T4: BB-Option
    st = act(st, "check");
    expect(st.phase).toBe(1);
    expect(who(st)).toBe("B");
  });
  it("🔧4 HU1: zählt nur aktive Spieler", () => {
    const st = table([1000, 1000, 1000], { away: [2] });
    expect(st.players.map((p) => p.bet)).toEqual([10, 20, 0]);
    expect(who(st)).toBe("A");
  });
  it("Z3: beide all-in durch Blinds → direkt Showdown mit Runout", () => {
    const st = table([10, 20]);
    expect(st.screen).toBe("showdown");
    expect(st.runout).toBe(true);
    expect(st.pots).toEqual([{ amt: 20, elig: [0, 1] }, { amt: 10, elig: [1] }]);
    expect(st.announce.title).toBe("Hand #1");
  });
  it("Z3: nur einer all-in durch Blinds → der andere ist normal dran", () => {
    const st = table([10, 1000]);
    expect(st.screen).toBe("play");
    expect(who(st)).toBe("B");
  });
});

describe("Aktionen und Mindest-Raise (AK, M)", () => {
  it("🔧6 AK1: Raise wird auf den Stack gekappt", () => {
    const st = act(table([1000, 1000, 1000]), "raise", 5000);
    expect(st.players[0]).toMatchObject({ bet: 1000, chips: 0, allIn: true });
  });
  it("M4: Mindest-Zuwachs ist der größte Zuwachs der Runde", () => {
    let st = act(table([1000, 1000, 1000]), "raise", 100);
    expect([st.curBet, st.minRaise]).toEqual([100, 80]);
    st = act(st, "raise", 180);
    expect([st.curBet, st.minRaise]).toEqual([180, 80]);
    expect(st.curBet + st.minRaise).toBe(260);
  });
  it("🔧7 AK4: All-In unter dem Call-Betrag wirkt wie Call", () => {
    let st = act(table([1000, 50, 1000]), "raise", 100);
    st = act(st, "raise", 50); // B hat nur noch 40 + 10 gesetzt
    expect(st.players[1]).toMatchObject({ bet: 50, allIn: true });
    expect([st.curBet, st.minRaise]).toEqual([100, 80]);
    expect(st.players[0].acted).toBe(true);
    expect(who(st)).toBe("C");
  });
  it("Z1: kurzes All-In-Raise öffnet die Runde nicht neu, wer gehandelt hat, darf nur callen", () => {
    let st = act(table([1000, 1000, 130]), "raise", 100);
    st = act(st, "call");
    st = act(st, "raise", 130); // C: Zuwachs 30 < 80
    expect([st.curBet, st.minRaise]).toEqual([130, 80]);
    expect(st.players[0].acted).toBe(true);
    expect(who(st)).toBe("A"); // muss die 30 nachziehen
    expect(canRaise(st)).toBe(false);
    st = act(st, "call");
    expect(who(st)).toBe("B");
    expect(canRaise(st)).toBe(false);
    st = act(st, "call");
    expect(st.phase).toBe(1);
  });
  it("Z1: wer noch nicht gehandelt hat, darf nach kurzem All-In voll erhöhen", () => {
    let st = act(table([1000, 1000, 1000, 1000, 130]), "raise", 100); // D (UTG) erhöht um 80
    st = act(st, "raise", 130); // E: kurzes All-In, Zuwachs 30
    expect(who(st)).toBe("A");
    expect(canRaise(st)).toBe(true);
    expect(st.curBet + st.minRaise).toBe(210);
    st = act(st, "raise", 210); // voller Raise öffnet wieder für alle
    st = act(act(st, "fold"), "fold"); // B, C
    expect(who(st)).toBe("D");
    expect(canRaise(st)).toBe(true);
  });
  it("Z1: ein volles All-In-Raise öffnet die Runde neu", () => {
    let st = act(table([1000, 1000, 180]), "raise", 100);
    st = act(st, "call");
    st = act(st, "raise", 180); // C: Zuwachs 80 = Mindest-Zuwachs
    expect(st.players[0].acted).toBe(false);
    expect(canRaise(st)).toBe(true);
  });
  it("canRaise: nicht möglich, wenn der Stack den offenen Einsatz nicht übersteigt (M7)", () => {
    const st = act(table([1000, 1000, 1000]), "raise", 1000);
    expect(canRaise(st)).toBe(false);
  });
  it("T4: BB bekommt seine Option, wenn alle nur callen", () => {
    let st = act(act(table([1000, 1000, 1000]), "call"), "call");
    expect(who(st)).toBe("C");
    expect(st.phase).toBe(0);
  });
});

describe("Ende einer Setzrunde (E)", () => {
  it("🔧8 E1: Fold-Win, Gewinner bekommt alles inklusive nicht gecalltem Überschuss", () => {
    let st = act(table([1000, 1000, 1000]), "raise", 500);
    st = act(act(st, "fold"), "fold");
    expect(st.screen).toBe("handEnd");
    expect(chips(st)).toEqual([1030, 990, 980]);
    expect(st.handResult).toBe("A gewinnt 530 – alle anderen haben gefoldet.");
  });
  it("🔧9 E3: Runout, wenn nur einer handlungsfähig ist", () => {
    let st = act(table([300, 1000, 1000]), "raise", 300);
    st = act(act(st, "fold"), "call");
    expect(st.screen).toBe("showdown");
    expect(st.runout).toBe(true);
    expect(st.pots).toEqual([{ amt: 610, elig: [0, 2] }]);
  });
  it("🔧10 E4: Phasenwechsel setzt Einsätze zurück, nur Handlungsfähige werden gefragt", () => {
    let st = act(table([1000, 1000, 1000]), "fold");
    st = act(act(st, "call"), "check");
    expect(st.phase).toBe(1);
    expect([st.curBet, st.minRaise]).toEqual([0, 20]);
    expect(st.players.map((p) => [p.bet, p.acted])).toEqual([[0, true], [0, false], [0, false]]);
    expect(who(st)).toBe("B");
    expect(st.announce).toEqual({ title: "Flop", hint: "Dealer: 3 Karten aufdecken" });
  });
  it("River abgeschlossen → Showdown ohne Runout", () => {
    let st = act(act(table([1000, 1000]), "call"), "check");
    for (let street = 1; street <= 3; street++) st = act(act(st, "check"), "check");
    expect(st.screen).toBe("showdown");
    expect(st.runout).toBe(false);
    expect(st.pots).toEqual([{ amt: 40, elig: [0, 1] }]);
  });
});

describe("Side Pots (Kap. 5)", () => {
  const P = (id, contrib, extra = {}) => ({ id, contrib, folded: false, out: false, gone: false, ...extra });
  it("5.2 Beispiel: 340 / 400 / 200, 🔧11 P4 zusammengelegt, 🔧12 P6 Überschuss", () => {
    expect(computePots([P(0, 100), P(1, 300), P(2, 500), P(3, 40, { folded: true })])).toEqual([
      { amt: 340, elig: [0, 1, 2] }, { amt: 400, elig: [1, 2] }, { amt: 200, elig: [2] },
    ]);
  });
  it("A 500, B 200", () => {
    expect(computePots([P(0, 500), P(1, 200)])).toEqual([{ amt: 400, elig: [0, 1] }, { amt: 300, elig: [0] }]);
  });
  it("Gefoldete Ebenen landen in einem Pot", () => {
    expect(computePots([P(0, 200), P(1, 200), P(2, 60, { folded: true }), P(3, 120, { folded: true })]))
      .toEqual([{ amt: 580, elig: [0, 1] }]);
  });
  it("Z4: Pot ohne Berechtigte geht in den letzten Pot mit Berechtigten", () => {
    expect(computePots([P(0, 100, { gone: true, folded: true }), P(1, 50), P(2, 50)]))
      .toEqual([{ amt: 200, elig: [1, 2] }]);
    expect(computePots([P(0, 300, { gone: true, folded: true }), P(1, 100), P(2, 200)]))
      .toEqual([{ amt: 300, elig: [1, 2] }, { amt: 300, elig: [2] }]);
  });
  it("Z4: Showdown lässt sich nach Entfernen des höchsten Einsatzes abschließen", () => {
    let st = act(table([1000, 1000, 50, 50]), "raise", 50); // D (UTG) all-in 50
    st = act(st, "raise", 200); // A erhöht auf 200
    st = act(st, "fold"); // B
    expect(who(st)).toBe("C");
    st = removePlayer(st, 0, S); // A wird entfernt, seine 200 bleiben im Pot
    st = act(st, "call"); // C all-in
    expect(st.screen).toBe("showdown");
    expect(st.pots).toEqual([{ amt: 310, elig: [2, 3] }]);
    st = awardPot({ ...st, winnersSel: [2] });
    expect(st.screen).toBe("handEnd");
    expect(chips(st)).toEqual([800, 990, 310, 0]);
  });
});

describe("Pot-Vergabe (SD)", () => {
  const showdown = (pots, winnersSel, stacks = [0, 0, 0]) => ({
    ...EMPTY, screen: "showdown", pots, potIdx: 0, winnersSel,
    players: stacks.map((c, i) => ({ id: i, name: NAMES[i], chips: c, out: false, gone: false, ...fresh({}) })),
  });
  it("SD3, Z2: Restchips an den ersten Gewinner links vom Dealer, egal wie angetippt", () => {
    // Dealer = A (Platz 0): links davon B, dann C, dann A
    expect(chips(awardPot(showdown([{ amt: 340, elig: [0, 1, 2] }], [2, 0, 1], [1, 1, 1])))).toEqual([114, 115, 114]);
    expect(chips(awardPot(showdown([{ amt: 5, elig: [0, 1] }], [1, 0], [1, 1, 1])))).toEqual([3, 4, 1]);
    expect(chips(awardPot(showdown([{ amt: 5, elig: [0, 2] }], [0, 2], [1, 1, 1])))).toEqual([3, 1, 4]);
    // Dealer = C (Platz 2): links davon A
    expect(chips(awardPot({ ...showdown([{ amt: 5, elig: [0, 1] }], [1, 0], [1, 1, 1]), dealer: 2 }))).toEqual([4, 3, 1]);
  });
  it("SD4: nach jedem Pot außer dem letzten geht es zum nächsten Pot", () => {
    const st = awardPot(showdown([{ amt: 100, elig: [0, 1] }, { amt: 50, elig: [1] }], [0], [1, 1, 1]));
    expect([st.screen, st.potIdx, st.winnersSel]).toEqual(["showdown", 1, []]);
    const end = awardPot({ ...st, winnersSel: [1] });
    expect(end.screen).toBe("handEnd");
    expect(chips(end)).toEqual([101, 51, 1]);
    expect(end.handResult).toBe("Pot verteilt – letzter Pot an B.");
  });
  it("ohne Gewinnerauswahl passiert nichts", () => {
    const st = showdown([{ amt: 100, elig: [0, 1] }], []);
    expect(awardPot(st)).toBe(st);
  });
  it("🔧14 SD6: Stack 0 → out, unter 2 alive → Spielende", () => {
    let st = act(table([1000, 20]), "call"); // B ist durch den BB all-in
    expect(st.runout).toBe(true);
    st = awardPot({ ...st, winnersSel: [0] });
    expect(st.players[1].out).toBe(true);
    expect(st.screen).toBe("over");
  });
});

describe("Nächste Hand (H1, H4, HU4)", () => {
  it("Button wandert, Handnummer steigt, Blinds steigen ab Hand 9", () => {
    let st = act(act(table([1000, 1000, 1000]), "fold"), "fold");
    st = nextHand(st, S);
    expect([st.handNum, st.dealer]).toEqual([2, 1]);
    st = nextHand({ ...st, handNum: 8 }, S);
    expect(st.curBet).toBe(40);
  });
  it("Pause wirkt ab der nächsten Hand", () => {
    let st = act(act(table([1000, 1000, 1000]), "fold"), "fold");
    st = nextHand(togglePause(st, 0), S);
    expect(st.players[0]).toMatchObject({ folded: true, bet: 0 });
  });
});

describe("Pause mitten in der Hand (Z5)", () => {
  it("wer mitten in der Hand pausiert, beginnt postflop trotzdem an seinem Platz", () => {
    let st = act(act(table([1000, 1000, 1000]), "call"), "call"); // C hat BB-Option
    st = togglePause(st, 1); // B (SB) pausiert mitten in der Hand
    st = act(st, "check");
    expect(st.phase).toBe(1);
    expect(who(st)).toBe("B");
  });
  it("Suchlauf bricht ab, wenn niemand aktiv ist", () => {
    const ps = [{ away: true }, { out: true }, { gone: true }];
    expect(nextAliveIdx(ps, 0)).toBe(-1);
  });
  it("alle pausiert → keine neue Hand, kein Hänger", () => {
    let st = act(act(table([1000, 1000]), "fold"), "check");
    st = togglePause(togglePause(st, 0), 1);
    expect(nextHand(st, S)).toBe(st);
  });
});

describe("Spielerverwaltung (Kap. 8)", () => {
  it("🔧15 AD2: neuer Spieler hinten, folded/acted, nächste id", () => {
    const st = addPlayer(table([1000, 1000, 1000]), "  Dora ", 500);
    expect(st.players[3]).toMatchObject({ id: 3, name: "Dora", chips: 500, folded: true, acted: true });
    expect(st.notice).toBe("Dora spielt ab der nächsten Hand mit (500 Chips).");
  });
  it("AD1: kein Hinzufügen ohne Namen oder bei 9 Spielern", () => {
    expect(addPlayer(table([1000, 1000]), "  ", 500)).toBe(null);
    expect(addPlayer(table(Array(9).fill(1000)), "Jo", 500)).toBe(null);
  });
  it("🔧16 X3: Entfernen eines anderen lässt den Zug beim aktuellen Spieler", () => {
    const st = removePlayer(table([1000, 1000, 1000, 1000], { dealer: 3 }), 1, S); // BB geht, C ist am Zug
    expect(st.players[1]).toMatchObject({ gone: true, folded: true, contrib: 20 }); // X6
    expect(who(st)).toBe("C");
  });
  it("🔧16 X3: Entfernen des Spielers am Zug gibt den Zug weiter", () => {
    expect(who(removePlayer(table([1000, 1000, 1000]), 0, S))).toBe("B");
  });
  it("🔧16 X3: Entfernen bis auf einen ist ein Fold-Win", () => {
    const st = removePlayer(act(table([1000, 1000, 1000]), "fold"), 2, S);
    expect(st.screen).toBe("handEnd");
    expect(chips(st)).toEqual([1000, 1020, 980]);
  });
  it("X4: Entfernen im Hand-Ende setzt nur das Flag", () => {
    const end = act(act(table([1000, 1000, 1000]), "fold"), "fold");
    const st = removePlayer(end, 0, S);
    expect(st.screen).toBe("handEnd");
    expect(st.players[0].gone).toBe(true);
  });
  it("🔧17 O2: Umsortieren behält Dealer und aktuellen Spieler", () => {
    const st0 = table([1000, 1000, 1000]);
    const st = movePlayer(st0, 0, 1);
    expect(st.players.map((p) => p.name)).toEqual(["B", "A", "C"]);
    expect(st.players[st.dealer].name).toBe("A");
    expect(who(st)).toBe("A");
  });
  it("RB1: Rebuy setzt Start-Chips", () => {
    const st = rebuy({ ...EMPTY, players: [{ id: 0, chips: 0, out: true }] }, 0, S);
    expect(st.players[0]).toMatchObject({ chips: 1000, out: false });
  });
});

describe("Pot-Schnellwahl (U0, Z8)", () => {
  it("Anteil vom Pot vor dem eigenen Call, mindestens Mindest-Ziel", () => {
    const st = act(act(table([1000, 1000, 1000]), "raise", 100), "call"); // Pot 220, C am Zug
    expect(potBet(st, 1, S)).toBe(220);
    expect(potBet(st, 0.5, S)).toBe(180);
    expect(potBet(st, 99, S)).toBe(1000);
  });
});
