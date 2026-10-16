// Edge Function "game": alle Spielzüge am Online-Tisch.
// Der Server ist die einzige Wahrheit: Er prüft, wer was darf, rechnet mit
// demselben Rechenkern wie die App und speichert den Stand in sessions.state.
//
// sessions.state = { settings, game }   game = Spielzustand des Rechenkerns,
//                                       jeder Spieler dort trägt uid = players.id
// sessions.history = Undo-Verlauf (höchstens 20 Spielstände)
// sessions.version = steigt bei jeder Änderung (Schutz gegen gleichzeitiges Tippen)
import { db, UserError, checkToken, serve } from "../_shared/server.js";
import * as engine from "../_shared/engine.js";

const UNDO_DEPTH = 20; // UN5

const EMPTY_GAME = {
  screen: "start", players: [], dealer: 0, phase: 0, cur: 0, curBet: 0, minRaise: 0, handNum: 0,
  notice: "", runout: false, pots: [], potIdx: 0, winnersSel: [], handResult: "", announce: null,
};

function intSetting(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) throw new UserError(`${label}: ganze Zahl von ${min} bis ${max}.`);
  return value;
}

// S4/S5, Z9: im Online-Spiel nur ganze Chips und sinnvolle Grenzen
function cleanSettings(raw = {}) {
  const buyInEuro = raw.buyInEuro;
  if (typeof buyInEuro !== "number" || !(buyInEuro >= 0 && buyInEuro <= 10000)) throw new UserError("Buy-in in €: 0 bis 10.000.");
  const settings = {
    startChips: intSetting(raw.startChips, 1, 1000000, "Start-Chips"),
    sb: intSetting(raw.sb, 1, 100000, "Small Blind"),
    beerEvery: intSetting(raw.beerEvery, 0, 1000, "Bierrunde"),
    blindUp: intSetting(raw.blindUp, 0, 1000, "Blind-Steigerung"),
    buyInEuro: Math.round(buyInEuro * 100) / 100,
  };
  if (settings.startChips < settings.sb * 2) throw new UserError("Start-Chips müssen mindestens eine Big Blind sein.");
  return settings;
}

// Wer fragt: Token prüfen, gibt die Zeile aus players zurück
const whoAsks = ({ playerId, token }) => checkToken(playerId, token);

// Liest den Tisch, wendet die Änderung an und schreibt nur, wenn sich
// zwischendurch nichts geändert hat. Sonst nochmal mit dem neuen Stand.
async function mutate(sessionId, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: session, error } = await db.from("sessions").select("id, status, state, version, history").eq("id", sessionId).single();
    if (error) throw error;
    const next = await change(session);
    const game = next.state.game;
    const { data: written, error: writeError } = await db.from("sessions").update({
      state: next.state,
      history: next.history ?? session.history,
      version: session.version + 1,
      status: game.screen === "over" ? "over" : next.status ?? session.status,
      current_player_id: game.screen === "play" ? game.players[game.cur]?.uid ?? null : null,
    }).eq("id", sessionId).eq("version", session.version).select("id");
    if (writeError) throw writeError;
    if (written.length) {
      if (next.after) await next.after(game);
      return { version: session.version + 1, state: next.state };
    }
  }
  throw new Error("Zu viele gleichzeitige Änderungen");
}

function requireGame(session) {
  if (session.status === "lobby" || !session.state?.game) throw new UserError("Das Spiel hat noch nicht begonnen.");
  return session.state.game;
}
function requireHost(player) {
  if (!player.is_host) throw new UserError("Das darf nur der Host.");
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
// Ziel einer Verwaltungsaktion: man selbst oder (nur Host) ein anderer
function targetOf(game, player, targetId) {
  const uid = targetId ?? player.id;
  if (uid !== player.id) requireHost(player);
  const idx = seatOf(game, uid);
  if (game.players[idx].gone) throw new UserError("Dieser Spieler hat den Tisch schon verlassen.");
  return game.players[idx];
}

// UN1/UN2: Spielstand vor der Änderung ablegen
const pushHistory = (session, game) => [...session.history, { ...game, announce: null }].slice(-UNDO_DEPTH);
const withGame = (session, game, extra = {}) => ({ state: { ...session.state, game }, ...extra });

/* ── Aktionen ── */

async function start(body) {
  const player = await whoAsks(body);
  requireHost(player);
  const settings = cleanSettings(body.settings);
  const { data: seated, error } = await db.from("players").select("id, name").eq("session_id", player.session_id).order("seat");
  if (error) throw error;
  if (seated.length < 2) throw new UserError("Mindestens 2 Spieler müssen am Tisch sitzen.");
  return mutate(player.session_id, (session) => {
    if (session.status !== "lobby") throw new UserError("Das Spiel läuft schon.");
    const game = engine.startGame(EMPTY_GAME, seated.map((p) => ({ name: p.name })), settings, Math.random());
    game.players = game.players.map((p, i) => ({ ...p, uid: seated[i].id }));
    return { state: { settings, game }, history: [], status: "playing" };
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

// SD1/SD2: Host wählt die Gewinner des angezeigten Pots
async function award(body) {
  const player = await whoAsks(body);
  requireHost(player);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["showdown"], "Gerade ist kein Showdown.");
    const winners = body.winners;
    const elig = game.pots[game.potIdx]?.elig ?? [];
    if (!Array.isArray(winners) || winners.length === 0 || new Set(winners).size !== winners.length || !winners.every((id) => elig.includes(id))) {
      throw new UserError("Bitte nur Gewinner auswählen, die für diesen Pot spielen.");
    }
    const next = engine.awardPot({ ...game, winnersSel: winners });
    return withGame(session, next, { history: pushHistory(session, game) });
  });
}

async function nextHand(body) {
  const player = await whoAsks(body);
  requireHost(player);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["handEnd"], "Die Hand ist noch nicht vorbei.");
    if (engine.active(game.players).length < 2) throw new UserError("Mindestens 2 Spieler müssen aktiv sein.");
    const next = engine.nextHand(game, session.state.settings);
    return withGame(session, next, { history: pushHistory(session, game) });
  });
}

async function endEvening(body) {
  const player = await whoAsks(body);
  requireHost(player);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["handEnd"], "Den Abend kann man nur nach einer Hand beenden.");
    return withGame(session, engine.endEvening(game));
  });
}

// UN4, UN8: nur Host, nicht im Endbildschirm
async function undo(body) {
  const player = await whoAsks(body);
  requireHost(player);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["play", "showdown", "handEnd"], "Hier gibt es kein Rückgängig.");
    if (!session.history.length) throw new UserError("Nichts zum Rückgängigmachen.");
    const previous = session.history[session.history.length - 1];
    return withGame(session, previous, { history: session.history.slice(0, -1) });
  });
}

// V1: sich selbst pausieren, der Host auch andere. Nicht undo-fähig (UN3).
async function pause(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireSeated(game, player);
    requireScreen(game, ["play", "handEnd"], "Pause geht nur während der Hand oder am Hand-Ende.");
    const target = targetOf(game, player, body.targetId);
    return withGame(session, engine.togglePause(game, target.id));
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

// RB1: im Hand-Ende, für Ausgeschiedene
async function rebuy(body) {
  const player = await whoAsks(body);
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireSeated(game, player);
    requireScreen(game, ["handEnd"], "Rebuy geht nur am Hand-Ende.");
    const target = targetOf(game, player, body.targetId);
    if (!target.out) throw new UserError(`${target.name} ist nicht ausgeschieden.`);
    const next = engine.rebuy(game, target.id, session.state.settings);
    return withGame(session, next, { history: pushHistory(session, game) });
  });
}

// X1–X3: Tisch verlassen (selbst) oder Spieler entfernen (Host).
// Geht der Host, übernimmt der nächste Spieler, der noch am Tisch sitzt.
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
        const { data: leaving } = await db.from("players").select("is_host").eq("id", target.uid).single();
        if (!leaving?.is_host) return;
        const heir = written.players.find((p) => !p.gone && p.uid);
        if (!heir) return;
        await db.from("players").update({ is_host: false }).eq("id", target.uid);
        await db.from("players").update({ is_host: true }).eq("id", heir.uid);
      },
    });
  });
}

// O1/O2: Reihenfolge ändern, nur Host, nicht undo-fähig (UN3)
async function move(body) {
  const player = await whoAsks(body);
  requireHost(player);
  if (body.dir !== 1 && body.dir !== -1) throw new UserError("Richtung ist 1 oder -1.");
  return mutate(player.session_id, (session) => {
    const game = requireGame(session);
    requireScreen(game, ["play", "handEnd"], "Umsortieren geht nur während der Hand oder am Hand-Ende.");
    const target = targetOf(game, player, body.targetId);
    return withGame(session, engine.movePlayer(game, target.id, body.dir));
  });
}

serve({ start, act, award, nextHand, endEvening, undo, pause, toggleNoob, rebuy, leave, move });
