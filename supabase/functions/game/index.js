// Edge Function "game": alle Spielzüge am Online-Tisch.
// Der Server ist die einzige Wahrheit: Er prüft, wer was darf, rechnet mit
// demselben Rechenkern wie die App und speichert den Stand in sessions.state.
//
// sessions.state = { settings, game, clock }
//   game  = Spielzustand des Rechenkerns, jeder Spieler trägt uid = players.id
//   clock = Uhr, die ein Admin für den Spieler am Zug gestartet hat (oder null)
// players.is_host = Admin. Es kann mehrere Admins geben, mindestens einer bleibt.
// sessions.history = Undo-Verlauf (höchstens 20 Spielstände)
// sessions.version = steigt bei jeder Änderung (Schutz gegen gleichzeitiges Tippen)
import { db, UserError, checkToken, serve, mutate } from "../_shared/server.js";
import { cleanSettings, chipsFor, cleanBuyIn } from "../_shared/settings.js";
import * as engine from "../_shared/engine.js";

const UNDO_DEPTH = 20; // UN5
const CLOCK_MS = 30000;  // Uhr für Spieler, die nicht reagieren

const EMPTY_GAME = {
  screen: "start", players: [], dealer: 0, phase: 0, cur: 0, curBet: 0, minRaise: 0, handNum: 0,
  notice: "", runout: false, pots: [], potIdx: 0, winnersSel: [], handResult: "", announce: null,
};

// Wer fragt: Token prüfen, gibt die Zeile aus players zurück
const whoAsks = ({ playerId, token }) => checkToken(playerId, token);

function requireGame(session) {
  if (session.status === "lobby" || !session.state?.game) throw new UserError("Das Spiel hat noch nicht begonnen.");
  return session.state.game;
}
function requireAdmin(player) {
  if (!player.is_host) throw new UserError("Das darf nur ein Admin.");
}
function seatOf(game, uid) {
  const idx = game.players.findIndex((p) => p.uid === uid);
  if (idx === -1) throw new UserError("Dieser Spieler sitzt nicht am Tisch.");
  return idx;
}
function requireSeated(game, player) {
  const idx = seatOf(game, player.id);
  if (game.players[idx].gone) throw new UserError("Du hast den Tisch verlassen.");
  return idx;
}
function requireScreen(game, screens, message) {
  if (!screens.includes(game.screen)) throw new UserError(message);
}
// Ziel einer Verwaltungsaktion: man selbst oder (nur Admin) ein anderer
function targetOf(game, player, targetId) {
  const uid = targetId ?? player.id;
  if (uid !== player.id) requireAdmin(player);
  const idx = seatOf(game, uid);
  if (game.players[idx].gone) throw new UserError("Dieser Spieler hat den Tisch schon verlassen.");
  return game.players[idx];
}

// UN1/UN2: Spielstand vor der Änderung ablegen
const pushHistory = (session, game) => [...session.history, { ...game, announce: null }].slice(-UNDO_DEPTH);
// Die Uhr gilt nur, solange derselbe Spieler in derselben Hand am Zug ist
function clockFor(state, game) {
  const c = state.clock;
  return c && game.screen === "play" && game.handNum === c.handNum && game.players[game.cur]?.uid === c.uid ? c : null;
}
const withGame = (session, game, extra = {}) => ({ state: { ...session.state, game, clock: clockFor(session.state, game) }, ...extra });

/* ── Aktionen ── */

// Start mit den Regeln des Admins; jeder spielt mit dem Buy-in, den er in
// der Lobby eingetippt hat (sonst mit dem Vorschlag)
async function start(body) {
  const player = await whoAsks(body);
  requireAdmin(player);
  const settings = cleanSettings(body.settings);
  const { data: seated, error } = await db.from("players").select("id, name, buy_in").eq("session_id", player.session_id).order("seat");
  if (error) throw error;
  if (seated.length < 2) throw new UserError("Mindestens 2 Spieler müssen am Tisch sitzen.");
  const rows = seated.map((p) => ({ name: p.name, chips: chipsFor(settings, p.buy_in === null ? null : Number(p.buy_in)) }));
  return mutate(player.session_id, (session) => {
    if (session.status !== "lobby") throw new UserError("Das Spiel läuft schon.");
    const game = engine.startGame(EMPTY_GAME, rows, settings, Math.random());
    game.players = game.players.map((p, i) => ({ ...p, uid: seated[i].id }));
    return {
      state: { settings, game, clock: null }, history: [], status: "playing",
      // Zum Start 2 Admins: wer den Tisch erstellt hat und der nächste Spieler
      after: async () => {
        const { data: admins } = await db.from("players").select("id").eq("session_id", player.session_id).eq("is_host", true);
        const second = seated.find((p) => !admins?.some((a) => a.id === p.id));
        if ((admins?.length ?? 0) < 2 && second) await db.from("players").update({ is_host: true }).eq("id", second.id);
      },
    };
  });
}

async function act(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    if (game.players[game.cur]?.uid !== player.id || game.screen !== "play") throw new UserError("Du bist nicht am Zug.");
    const problem = engine.validateAction(game, body.kind, body.amount);
    if (problem) throw new UserError(problem);
    const next = engine.applyAction(game, body.kind, body.amount, session.state.settings);
    return withGame(session, next, { history: pushHistory(session, game) });
  });
}

// Tippen zwei gleichzeitig denselben Knopf, zählt nur der erste
function requireSameStep(game, body, potToo) {
  if (body.handNum !== game.handNum || (potToo && body.potIdx !== game.potIdx)) throw new UserError("Das hat schon jemand anders gemacht.");
}

// SD1/SD2: jeder am Tisch kann die Gewinner des angezeigten Pots wählen
// (der Host soll den Spielfluss nicht aufhalten). Danach gehen Pots, um die
// nur noch einer spielt (nicht gecallte Chips), ohne Tippen an ihn.
async function award(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireSeated(game, player);
    requireScreen(game, ["showdown"], "Gerade ist kein Showdown.");
    requireSameStep(game, body, true);
    const winners = body.winners;
    const elig = game.pots[game.potIdx]?.elig ?? [];
    if (!Array.isArray(winners) || winners.length === 0 || new Set(winners).size !== winners.length || !winners.every((id) => elig.includes(id))) {
      throw new UserError("Bitte nur Gewinner auswählen, die für diesen Pot spielen.");
    }
    let next = engine.awardPot({ ...game, winnersSel: winners });
    if (next.screen === "showdown" && next.pots.slice(next.potIdx).every((pt) => pt.elig.length === 1)) {
      while (next.screen === "showdown") next = engine.awardPot({ ...next, winnersSel: next.pots[next.potIdx].elig });
      // SD7: das Ergebnis nennt die Gewinner des letzten umkämpften Pots
      const names = winners.map((id) => game.players.find((p) => p.id === id).name).join(" & ");
      next = { ...next, handResult: `Pot verteilt – letzter Pot an ${names}.` };
    }
    return withGame(session, next, { history: pushHistory(session, game) });
  });
}

async function nextHand(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireSeated(game, player);
    requireScreen(game, ["handEnd"], "Die Hand ist noch nicht vorbei.");
    requireSameStep(game, body, false);
    if (engine.active(game.players).length < 2) throw new UserError("Mindestens 2 Spieler müssen aktiv sein.");
    const next = engine.nextHand(game, session.state.settings);
    return withGame(session, next, { history: pushHistory(session, game) });
  });
}

async function endEvening(body) {
  const player = await whoAsks(body);
  requireAdmin(player);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["handEnd"], "Den Abend kann man nur nach einer Hand beenden.");
    return withGame(session, engine.endEvening(game));
  });
}

// UN4, UN8: nur Admins, nicht im Endbildschirm. Kommt jemand mitten im Spiel
// dazu, beginnt der Verlauf neu (sonst würde Undo seinen Platz löschen).
async function undo(body) {
  const player = await whoAsks(body);
  requireAdmin(player);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["play", "showdown", "handEnd"], "Hier gibt es kein Rückgängig.");
    if (!session.history.length) throw new UserError("Nichts zum Rückgängigmachen.");
    const previous = session.history[session.history.length - 1];
    return withGame(session, previous, { history: session.history.slice(0, -1) });
  });
}

// Nächster Spieler nach uid in Sitzreihenfolge, bevorzugt einer, der gerade mitspielt
function heirOf(game, uid) {
  const ps = game.players, start = ps.findIndex((p) => p.uid === uid);
  const order = ps.map((_, i) => ps[(start + 1 + i) % ps.length]).filter((p) => p.uid !== uid && !p.gone);
  return order.find((p) => !p.away && !p.out) ?? order[0] ?? null;
}
// Sorgt dafür, dass mindestens ein Admin aktiv mitspielt. Sonst wird der
// nächste aktive Spieler nach uid zusätzlich Admin.
async function ensureActiveAdmin(game, sessionId, uid) {
  const { data: admins } = await db.from("players").select("id").eq("session_id", sessionId).eq("is_host", true);
  const activeAdmin = game.players.some((p) => !p.gone && !p.away && admins?.some((a) => a.id === p.uid));
  if (activeAdmin) return;
  const heir = heirOf(game, uid);
  if (heir) await db.from("players").update({ is_host: true }).eq("id", heir.uid);
}

// V1: sich selbst pausieren, ein Admin auch andere. Nicht undo-fähig (UN3).
// Pausiert der letzte aktive Admin, wird der nächste aktive Spieler Admin.
async function pause(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireSeated(game, player);
    requireScreen(game, ["play", "handEnd"], "Pause geht nur während der Hand oder am Hand-Ende.");
    const target = targetOf(game, player, body.targetId);
    const next = engine.togglePause(game, target.id);
    return withGame(session, next, { after: (written) => ensureActiveAdmin(written, player.session_id, target.uid) });
  });
}

// Admin ernennt einen Spieler zum Admin oder nimmt die Rolle wieder weg.
// Der letzte Admin kann nicht entfernt werden.
async function toggleAdmin(body) {
  const player = await whoAsks(body);
  requireAdmin(player);
  const { data: session, error } = await db.from("sessions").select("status, state").eq("id", player.session_id).single();
  if (error) throw error;
  const game = requireGame(session);
  const uid = body.targetId;
  const idx = seatOf(game, uid);
  if (game.players[idx].gone) throw new UserError("Dieser Spieler hat den Tisch schon verlassen.");
  const { data: target } = await db.from("players").select("id, is_host").eq("id", uid).single();
  if (target.is_host) {
    const { data: admins } = await db.from("players").select("id").eq("session_id", player.session_id).eq("is_host", true);
    const others = admins.filter((a) => a.id !== uid && game.players.some((p) => p.uid === a.id && !p.gone));
    if (!others.length) throw new UserError("Mindestens ein Admin muss bleiben.");
  }
  await db.from("players").update({ is_host: !target.is_host }).eq("id", uid);
  return { admin: !target.is_host };
}

// Admin startet (oder stoppt) die Uhr für den Spieler am Zug
async function clock(body) {
  const player = await whoAsks(body);
  requireAdmin(player);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["play"], "Gerade ist niemand am Zug.");
    const turn = game.players[game.cur];
    const running = clockFor(session.state, game);
    const next = body.stop ? null : running ?? { uid: turn.uid, handNum: game.handNum, until: Date.now() + CLOCK_MS };
    return { state: { ...session.state, clock: next } };
  });
}

// Uhr abgelaufen: Check, wenn das gratis geht, sonst Fold. Jedes Handy am
// Tisch meldet das; der Server prüft die Zeit selbst, es zählt nur einmal.
async function timeout(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireSeated(game, player);
    const running = clockFor(session.state, game);
    if (!running) throw new UserError("Es läuft keine Uhr.");
    if (Date.now() < running.until) throw new UserError("Die Uhr läuft noch.");
    const turn = game.players[game.cur];
    const kind = game.curBet - turn.bet === 0 ? "check" : "fold";
    const next = engine.applyAction(game, kind, undefined, session.state.settings);
    const notice = `⏱ Zeit abgelaufen – ${turn.name} ${kind === "check" ? "checkt" : "foldet"}.`;
    return withGame(session, { ...next, notice: next.notice || notice }, { history: pushHistory(session, game) });
  });
}

async function toggleNoob(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    const idx = requireSeated(game, player);
    return withGame(session, engine.toggleNoob(game, game.players[idx].id));
  });
}

// RB1: im Hand-Ende, für Ausgeschiedene. Den Betrag wählt man selbst
// (in der Einheit des Tisches), ohne Angabe gilt der Vorschlag.
async function rebuy(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireSeated(game, player);
    requireScreen(game, ["handEnd"], "Rebuy geht nur am Hand-Ende.");
    const target = targetOf(game, player, body.targetId);
    if (!target.out) throw new UserError(`${target.name} ist nicht ausgeschieden.`);
    const settings = session.state.settings;
    const next = engine.rebuy(game, target.id, settings, chipsFor(settings, cleanBuyIn(settings, body.amount ?? null)));
    return withGame(session, next, { history: pushHistory(session, game) });
  });
}

// X1–X3: Tisch verlassen (selbst) oder Spieler entfernen (Admin).
// Wer geht, ist kein Admin mehr. Bleibt kein aktiver Admin, rückt der nächste
// aktive Spieler nach.
async function leave(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireSeated(game, player);
    requireScreen(game, ["play", "handEnd"], "Verlassen geht nur während der Hand oder am Hand-Ende.");
    const target = targetOf(game, player, body.targetId);
    const next = engine.removePlayer(game, target.id, session.state.settings);
    return withGame(session, next, {
      history: pushHistory(session, game),
      after: async (written) => {
        await db.from("players").update({ is_host: false }).eq("id", target.uid);
        await ensureActiveAdmin(written, player.session_id, target.uid);
      },
    });
  });
}

// O1/O2: Reihenfolge ändern, nur Admins, nicht undo-fähig (UN3)
async function move(body) {
  const player = await whoAsks(body);
  requireAdmin(player);
  if (body.dir !== 1 && body.dir !== -1) throw new UserError("Richtung ist 1 oder -1.");
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["play", "handEnd"], "Umsortieren geht nur während der Hand oder am Hand-Ende.");
    const target = targetOf(game, player, body.targetId);
    return withGame(session, engine.movePlayer(game, target.id, body.dir));
  });
}

serve({ start, act, award, nextHand, endEvening, undo, pause, toggleAdmin, clock, timeout, toggleNoob, rebuy, leave, move });
