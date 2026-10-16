/* ── Pokerkasten Rechenkern ──────────────────────
   Die komplette Spiellogik ohne Oberfläche. Wird von der App und später
   von den Edge Functions benutzt, damit es die Regeln nur einmal gibt.
   Regeln und Sonderbehandlungen: docs/spielregeln.md (Kürzel in Kommentaren).
   Z1–Z5 sind seit 16.10.2026 nach docs/architektur.md umgesetzt.

   Jede Aktion bekommt den Spielzustand und gibt einen neuen zurück,
   der alte wird nicht verändert.

   Spielzustand:
     screen, players, dealer, phase, cur, curBet, minRaise, handNum,
     notice, runout, pots, potIdx, winnersSel, handResult,
     announce (Vollbild-Ansage {title, hint} oder null)
   Einstellungen (settings): { sb, blindUp, startChips }
──────────────────────────────────────────────── */

export const PHASES = ["Pre-Flop", "Flop", "Turn", "River"];
export const DEAL_HINT = [null, "Dealer: 3 Karten aufdecken", "Dealer: 4. Karte aufdecken", "Dealer: 5. Karte aufdecken"];

export const fresh = (p) => ({ ...p, folded: false, allIn: false, bet: 0, contrib: 0, acted: false });
export const alive = (ps) => ps.filter((p) => !p.out && !p.gone);
export const active = (ps) => ps.filter((p) => !p.out && !p.away && !p.gone);
export const potTotal = (ps) => ps.reduce((s, p) => s + p.contrib, 0);

// B1: Blinds aus der Handnummer
export function blindsFor(h, { sb, blindUp }) {
  const lvl = blindUp > 0 ? Math.floor(Math.max(0, h - 1) / blindUp) : 0;
  const s = sb * 2 ** lvl;
  return { s, b: s * 2 };
}

// 0.3 Suchlauf 1: nächster aktiver Spieler nach Platz X, -1 wenn es keinen gibt (Z5)
export function nextAliveIdx(ps, from) {
  for (let k = 1; k <= ps.length; k++) {
    const i = (from + k) % ps.length;
    if (!ps[i].out && !ps[i].away && !ps[i].gone) return i;
  }
  return -1;
}

// 0.3 Suchlauf 2: nächster Spieler am Zug ab Platz X (inklusive X)
export function firstActable(ps, from, cBet) {
  for (let k = 0; k < ps.length; k++) {
    const i = (from + k) % ps.length;
    const p = ps[i];
    if (!p.out && !p.gone && !p.folded && !p.allIn && (!p.acted || p.bet < cBet)) return i;
  }
  return -1;
}

// Z1: Wer schon gehandelt hat und nur durch ein kurzes All-In wieder
// dran ist, darf nur callen oder folden.
export function canRaise(state) {
  const p = state.players[state.cur];
  if (!p) return false;
  return p.chips + p.bet > state.curBet && !(p.acted && p.bet < state.curBet);
}

/* ── Setup ── */
// S3, S6, S7: rand (0 bis <1) kommt von außen, damit der Kern berechenbar bleibt
export function startGame(state, rows, settings, rand) {
  const ps = rows
    .map((r) => ({ n: r.name.trim(), noob: !!r.noob }))
    .filter((x) => x.n)
    .map((x, i) => ({ id: i, name: x.n, noob: x.noob, chips: settings.startChips, out: false, away: false, gone: false, ...fresh({}) }));
  if (ps.length < 2) return state;
  return beginHand({ ...state, players: ps, handNum: 0 }, ps, Math.floor(rand * ps.length), 1, settings);
}

/* ── Handstart (H1–H11) ── */
export function beginHand(state, psIn, dealerIdx, hNum, settings) {
  let ps = psIn.map((p) =>
    p.out || p.away || p.gone
      ? { ...p, folded: true, bet: 0, contrib: 0, allIn: false, acted: true }
      : fresh(p)
  );
  if (ps.filter((p) => !p.out && !p.gone).length < 2) return { ...state, players: ps, screen: "over", announce: null }; // H3
  const liveIdx = ps.map((p, i) => (!p.out && !p.away && !p.gone ? i : -1)).filter((i) => i >= 0);
  if (liveIdx.length < 2) return state; // Z5: ohne 2 aktive keine Hand (V3)
  if (ps[dealerIdx].out || ps[dealerIdx].away || ps[dealerIdx].gone) dealerIdx = nextAliveIdx(ps, dealerIdx); // H4 🔧

  const { s: sbH, b: bbH } = blindsFor(hNum, settings);
  const headsUp = liveIdx.length === 2; // HU1 🔧
  const sbIdx = headsUp ? dealerIdx : nextAliveIdx(ps, dealerIdx); // HU2 🔧
  const bbIdx = nextAliveIdx(ps, sbIdx);

  const post = (i, amt) => { // H7 🔧
    const pay = Math.min(amt, ps[i].chips);
    ps[i] = { ...ps[i], chips: ps[i].chips - pay, bet: pay, contrib: pay, allIn: ps[i].chips - pay === 0 };
  };
  post(sbIdx, sbH);
  post(bbIdx, bbH);

  const first = headsUp ? dealerIdx : nextAliveIdx(ps, bbIdx); // T1, HU3 🔧
  const next = {
    ...state,
    players: ps,
    dealer: dealerIdx,
    phase: 0,
    curBet: bbH, // H8 🔧 volle BB
    minRaise: bbH,
    handNum: hNum,
    runout: false,
    notice: `Blinds gesetzt · SB ${ps[sbIdx].name} (${sbH}) · BB ${ps[bbIdx].name} (${bbH})`,
    announce: { title: `Hand #${hNum}`, hint: `${ps[dealerIdx].name} mischt und gibt jedem 2 Karten · Blinds ${sbH}/${bbH}` },
    screen: "play",
    cur: firstActable(ps, first, bbH),
  };
  // Z3: alle durch die Blinds all-in → direkt Showdown mit Runout
  if (next.cur === -1) return startShowdown({ ...next, runout: true }, ps);
  return next;
}

/* ── Aktionen (3.1) ── */
export function applyAction(state, kind, amount, settings) {
  const ps = state.players.map((p) => ({ ...p }));
  let cBet = state.curBet, mRaise = state.minRaise;
  const cur = state.cur;
  const p = ps[cur];

  if (kind === "fold") { p.folded = true; p.acted = true; }
  if (kind === "check") { p.acted = true; }
  if (kind === "call") {
    const pay = Math.min(cBet - p.bet, p.chips);
    p.chips -= pay; p.bet += pay; p.contrib += pay; p.acted = true;
    if (p.chips === 0) p.allIn = true;
  }
  if (kind === "raise") {
    const to = Math.min(amount, p.bet + p.chips); // AK1 🔧
    const pay = to - p.bet;
    p.chips -= pay; p.bet = to; p.contrib += pay; p.acted = true;
    if (p.chips === 0) p.allIn = true;
    // AK3; AK4 🔧: Ziel ≤ offener Einsatz wirkt wie Call
    // Z1: nur ein voller Raise öffnet die Runde für alle neu. Ein kurzes All-In hebt
    // den offenen Einsatz, wer schon gehandelt hat, muss nachziehen (canRaise).
    if (to > cBet) {
      const fullRaise = to - cBet >= mRaise;
      mRaise = Math.max(mRaise, to - cBet);
      cBet = to;
      if (fullRaise) ps.forEach((q, i) => { if (i !== cur && !q.folded && !q.allIn && !q.out) q.acted = false; });
    }
  }

  return finish({ ...state, notice: "", announce: null }, ps, cBet, mRaise, (cur + 1) % ps.length, settings);
}

// 2.3: gemeinsamer Abschluss nach Aktion oder Spieler-Entfernung
function finish(state, ps, cBet, mRaise, searchFrom, settings) {
  const inHand = ps.filter((q) => !q.out && !q.gone && !q.folded);
  if (inHand.length === 1) return finishFoldWin(state, ps, inHand[0]); // E1 🔧

  const next = firstActable(ps, searchFrom, cBet);
  if (next !== -1) return { ...state, players: ps, curBet: cBet, minRaise: mRaise, cur: next }; // E2

  const canAct = inHand.filter((q) => !q.allIn);
  if (state.phase === 3 || canAct.length <= 1) { // E3 🔧
    const runout = state.phase < 3 && canAct.length <= 1 ? true : state.runout;
    return startShowdown({ ...state, runout }, ps);
  }
  // E4 🔧
  ps = ps.map((q) => ({ ...q, bet: 0, acted: q.out || q.gone || q.folded || q.allIn }));
  const nPhase = state.phase + 1;
  return {
    ...state,
    players: ps,
    curBet: 0,
    minRaise: blindsFor(state.handNum, settings).b,
    phase: nPhase,
    notice: "",
    announce: { title: PHASES[nPhase], hint: DEAL_HINT[nPhase] },
    // T5; Z5: wer mitten in der Hand pausiert, spielt die Hand normal zu Ende
    cur: firstActable(ps, (state.dealer + 1) % ps.length, 0),
  };
}

function finishFoldWin(state, ps, winner) {
  const total = potTotal(ps);
  ps = ps.map((q) => (q.id === winner.id ? { ...q, chips: q.chips + total } : q));
  return endHand(state, ps, `${winner.name} gewinnt ${total} – alle anderen haben gefoldet.`);
}

/* ── Showdown & Side Pots (Kap. 5, 6) ── */
export function computePots(ps) {
  const levels = [...new Set(ps.filter((q) => q.contrib > 0).map((q) => q.contrib))].sort((a, b) => a - b);
  let prev = 0; const out = [];
  for (const lv of levels) {
    const amt = ps.reduce((s, q) => s + Math.max(0, Math.min(q.contrib, lv) - prev), 0);
    const elig = ps.filter((q) => !q.out && !q.folded && q.contrib >= lv).map((q) => q.id);
    prev = lv;
    if (amt === 0) continue;
    const last = out[out.length - 1];
    if (last && last.elig.length === elig.length && last.elig.every((e, i) => e === elig[i])) last.amt += amt; // P4 🔧
    else out.push({ amt, elig });
  }
  // Z4: Pot ohne Berechtigte (Spieler mit höchstem Einsatz entfernt) geht in
  // den letzten Pot mit Berechtigten. Keine Rückerstattung.
  const withElig = out.filter((pt) => pt.elig.length > 0);
  if (withElig.length && withElig.length < out.length) {
    withElig[withElig.length - 1].amt += out.filter((pt) => pt.elig.length === 0).reduce((s, pt) => s + pt.amt, 0);
    return withElig;
  }
  return out;
}

function startShowdown(state, ps) {
  return { ...state, players: ps, pots: computePots(ps), potIdx: 0, winnersSel: [], screen: "showdown" };
}

// SD3, Z2: Restchips einzeln an die Gewinner, beginnend links vom Dealer
export function awardPot(state) {
  const { winnersSel, pots, potIdx } = state;
  if (winnersSel.length === 0) return state;
  const ps = state.players.map((p) => ({ ...p }));
  const potObj = pots[potIdx];
  const share = Math.floor(potObj.amt / winnersSel.length);
  let rem = potObj.amt - share * winnersSel.length;
  const n = ps.length;
  const fromDealer = (id) => (ps.findIndex((x) => x.id === id) - state.dealer - 1 + n) % n;
  [...winnersSel].sort((a, b) => fromDealer(a) - fromDealer(b)).forEach((id) => {
    const q = ps.find((x) => x.id === id);
    q.chips += share + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  });
  if (potIdx + 1 < pots.length) return { ...state, players: ps, potIdx: potIdx + 1, winnersSel: [] }; // SD4
  const wNames = winnersSel.map((id) => ps.find((x) => x.id === id).name).join(" & ");
  return endHand(state, ps, `Pot verteilt – letzter Pot an ${wNames}.`);
}

// SD6 🔧
function endHand(state, ps, resultText) {
  ps = ps.map((q) => ({ ...q, contrib: 0, bet: 0, out: q.out || q.chips === 0 }));
  return { ...state, players: ps, handResult: resultText, screen: alive(ps).length < 2 ? "over" : "handEnd" };
}

export function nextHand(state, settings) {
  const dealerIdx = nextAliveIdx(state.players, state.dealer);
  if (dealerIdx === -1) return state; // Z5: niemand aktiv
  return beginHand(state, state.players, dealerIdx, state.handNum + 1, settings);
}

/* ── Spielerverwaltung (Kap. 8) ── */
// AD1, AD2 🔧: gibt null zurück, wenn Hinzufügen nicht erlaubt ist
export function addPlayer(state, rawName, buyInRaw) {
  const name = rawName.trim();
  if (!name || alive(state.players).length >= 9) return null;
  const buyIn = Math.max(1, buyInRaw);
  const p = {
    id: Math.max(...state.players.map((q) => q.id)) + 1,
    name, noob: false, chips: buyIn, out: false, away: false, gone: false,
    folded: true, acted: true, bet: 0, contrib: 0, allIn: false,
  };
  return { ...state, players: [...state.players, p], notice: `${name} spielt ab der nächsten Hand mit (${buyIn} Chips).` };
}

// X1–X4, X3 🔧
export function removePlayer(state, id, settings) {
  const ps = state.players.map((p) => (p.id === id ? { ...p, gone: true, folded: true, acted: true } : { ...p }));
  if (state.screen === "play") return finish({ ...state, announce: null }, ps, state.curBet, state.minRaise, state.cur, settings);
  return { ...state, players: ps };
}

// O1, O2 🔧
export function movePlayer(state, id, dir) {
  const arr = [...state.players];
  const i = arr.findIndex((p) => p.id === id);
  let j = i + dir;
  while (j >= 0 && j < arr.length && arr[j].gone) j += dir;
  if (j < 0 || j >= arr.length) return state;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  const dealerId = state.players[state.dealer]?.id;
  const curId = state.players[state.cur]?.id;
  return {
    ...state,
    players: arr,
    dealer: Math.max(0, arr.findIndex((p) => p.id === dealerId)),
    cur: state.screen === "play" ? Math.max(0, arr.findIndex((p) => p.id === curId)) : state.cur,
  };
}

export function toggleNoob(state, id) {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, noob: !p.noob } : p)) };
}

// V1, V2
export function togglePause(state, id) {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, away: !p.away } : p)) };
}

// RB1
export function rebuy(state, id, settings) {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, out: false, chips: settings.startChips } : p)) };
}

/* ── Abgeleitete Werte ── */
// U0, Z8: Pot-Schnellwahl als Gesamtziel, gerundet auf den Small Blind
export function potBet(state, f, settings) {
  const me = state.players[state.cur];
  if (!me) return 0;
  const sbNow = blindsFor(state.handNum, settings).s;
  const maxTo = me.bet + me.chips;
  const minTo = Math.min(state.curBet + state.minRaise, maxTo);
  const raw = Math.round((potTotal(state.players) * f) / sbNow) * sbNow;
  return Math.min(maxTo, Math.max(minTo, raw));
}
