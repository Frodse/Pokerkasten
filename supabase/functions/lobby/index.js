// Edge Function "lobby": Tisch erstellen, beitreten (auch in ein laufendes
// Spiel), zurückkommen, verlassen, Regeln und eigenen Buy-in festlegen.
// Läuft auf dem Server mit vollen Rechten. Handys dürfen die Tabellen nur lesen.
import { db, UserError, newToken, sha256, checkToken, serve, mutate } from "../_shared/server.js";
import { DEFAULT_SETTINGS, cleanSettings, chipsFor, cleanBuyIn } from "../_shared/settings.js";
import * as engine from "../_shared/engine.js";
import { isSeatColor, firstFreeColor } from "../_shared/seats.js";

const MAX_PLAYERS = 9;
const MAX_NAME_LENGTH = 20;

function cleanName(raw) {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) throw new UserError("Bitte einen Namen eingeben.");
  if (name.length > MAX_NAME_LENGTH) throw new UserError(`Name zu lang (höchstens ${MAX_NAME_LENGTH} Zeichen).`);
  return name;
}

const COLOR_TAKEN = "Die Farbe hat schon jemand. Bitte eine andere wählen.";

// Gewünschte Sitzfarbe prüfen (null = keine Wahl, dann die nächste freie)
function cleanColor(raw) {
  if (raw === undefined || raw === null) return null;
  if (!isSeatColor(raw)) throw new UserError("Unbekannte Farbe.");
  return raw;
}

// Nächsten freien Platz vergeben. Treten zwei gleichzeitig bei, wollen beide
// denselben Platz (oder dieselbe Farbe); die Datenbank lässt nur einen durch,
// der andere versucht es neu.
// Im laufenden Spiel zählt der Rechenkern die freien Plätze (Gegangene sitzen nicht mehr).
async function addPlayer(sessionId, name, isHost, { buyIn = null, countSeats = true, color = null } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: seated, error } = await db.from("players").select("seat, name, color").eq("session_id", sessionId);
    if (error) throw error;
    if (countSeats && seated.length >= MAX_PLAYERS) throw new UserError(`Der Tisch ist voll (${MAX_PLAYERS} Spieler).`);
    if (seated.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new UserError(`„${name}“ sitzt schon am Tisch. Bitte einen anderen Namen wählen.`);
    }
    const taken = seated.map((p) => p.color).filter(Boolean);
    if (color && taken.includes(color)) throw new UserError(COLOR_TAKEN);
    const seat = seated.reduce((max, p) => Math.max(max, p.seat), -1) + 1;
    const { data: player, error: insertError } = await db
      .from("players").insert({ session_id: sessionId, name, seat, is_host: isHost, buy_in: buyIn, color: color ?? firstFreeColor(taken) })
      .select().single();
    if (insertError?.code === "23505") continue;
    if (insertError) throw insertError;

    const token = newToken();
    const { error: secretError } = await db.from("player_secrets").insert({ player_id: player.id, token_hash: await sha256(token) });
    if (secretError) throw secretError;
    return { player, token };
  }
  throw new Error("Kein freier Platz nach mehreren Versuchen");
}

async function create({ name, color }) {
  name = cleanName(name);
  color = cleanColor(color);
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const { data: session, error } = await db.from("sessions").insert({ code }).select().single();
    if (error?.code === "23505") continue; // Code gerade an einem anderen Tisch in Benutzung
    if (error) throw error;
    const { player, token } = await addPlayer(session.id, name, true, { color });
    return { session, player, token };
  }
  throw new Error("Kein freier Code gefunden");
}

async function join({ code, name, buyIn, color }) {
  name = cleanName(name);
  color = cleanColor(color);
  if (typeof code !== "string" || !/^[0-9]{4}$/.test(code)) throw new UserError("Der Code hat 4 Ziffern.");
  const { data: session } = await db.from("sessions").select().eq("code", code).neq("status", "over").maybeSingle();
  if (!session) throw new UserError(`Kein Tisch mit Code ${code} gefunden.`);
  if (session.status === "lobby") {
    const { player, token } = await addPlayer(session.id, name, false, { color });
    return { session, player, token };
  }

  // AD1, AD2: Spiel läuft – sofort hinsetzen, mitspielen ab der nächsten Hand
  const settings = session.state.settings;
  const amount = cleanBuyIn(settings, buyIn ?? null);
  const chips = chipsFor(settings, amount);
  const { player, token } = await addPlayer(session.id, name, false, { buyIn: amount, countSeats: false, color });
  try {
    const res = await mutate(session.id, (current) => {
      if (current.status !== "playing") throw new UserError("Das Spiel ist schon vorbei.");
      const next = engine.addPlayer(current.state.game, name, chips, player.color);
      if (!next) throw new UserError(`Der Tisch ist voll (${MAX_PLAYERS} Spieler).`);
      next.players[next.players.length - 1].uid = player.id;
      // Undo darf nicht hinter den Neuzugang zurück, sonst verschwände sein Platz
      return { state: { ...current.state, game: next }, history: [] };
    });
    return { session: { ...session, state: res.state, version: res.version }, player, token };
  } catch (e) {
    await db.from("players").delete().eq("id", player.id);
    throw e;
  }
}

// Regeln des Admins, live für alle in der Lobby sichtbar. Wechselt der Tisch
// zwischen „mit Geld“ und „ohne Geld“, passen getippte Buy-ins nicht mehr
// zur Einheit und werden auf den Vorschlag zurückgesetzt.
async function settings({ playerId, token, settings: raw }) {
  const player = await checkToken(playerId, token);
  if (!player.is_host) throw new UserError("Das darf nur ein Admin.");
  const clean = cleanSettings(raw);
  let unitChanged = false;
  const res = await mutate(player.session_id, (session) => {
    if (session.status !== "lobby") throw new UserError("Das Spiel läuft schon.");
    unitChanged = (session.state?.settings?.money ?? DEFAULT_SETTINGS.money) !== clean.money;
    return { state: { ...session.state, settings: clean } };
  });
  if (unitChanged) await db.from("players").update({ buy_in: null }).eq("session_id", player.session_id);
  return res;
}

// Eigener Buy-in in der Lobby (in € oder Chips, je nach Tisch); null = Vorschlag
async function setBuyIn({ playerId, token, buyIn }) {
  const player = await checkToken(playerId, token);
  const { data: session, error } = await db.from("sessions").select("status, state").eq("id", player.session_id).single();
  if (error) throw error;
  if (session.status !== "lobby") throw new UserError("Das Spiel läuft schon.");
  const amount = cleanBuyIn(session.state?.settings ?? DEFAULT_SETTINGS, buyIn ?? null);
  await db.from("players").update({ buy_in: amount }).eq("id", player.id);
  return { buyIn: amount };
}

// Eigene Sitzfarbe in der Lobby wechseln
async function setColor({ playerId, token, color }) {
  const player = await checkToken(playerId, token);
  color = cleanColor(color);
  if (!color) throw new UserError("Bitte eine Farbe wählen.");
  const { data: session, error } = await db.from("sessions").select("status").eq("id", player.session_id).single();
  if (error) throw error;
  if (session.status !== "lobby") throw new UserError("Das Spiel läuft schon.");
  const { error: updateError } = await db.from("players").update({ color }).eq("id", player.id);
  if (updateError?.code === "23505") throw new UserError(COLOR_TAKEN);
  if (updateError) throw updateError;
  return { color };
}

async function rejoin({ playerId, token }) {
  const player = await checkToken(playerId, token);
  const { data: session, error } = await db.from("sessions").select().eq("id", player.session_id).single();
  if (error) throw error;
  // Beendete Tische bleiben erreichbar, solange es eine Bilanz anzuzeigen gibt
  if (session.status === "over" && !session.state?.game) throw new UserError("Dieser Tisch ist beendet.");
  await db.from("players").update({ last_seen: new Date().toISOString() }).eq("id", player.id);
  return { session, player };
}

// Verlassen geht nur in der Lobby. Geht der Host, wird der Spieler mit dem
// niedrigsten Platz Host. Geht der Letzte, ist der Tisch beendet.
async function leave({ playerId, token }) {
  const player = await checkToken(playerId, token);
  const { data: session, error } = await db.from("sessions").select("status").eq("id", player.session_id).single();
  if (error) throw error;
  if (session.status !== "lobby") throw new UserError("Während eines Spiels kann man den Tisch nicht verlassen.");

  const { error: deleteError } = await db.from("players").delete().eq("id", player.id);
  if (deleteError) throw deleteError;
  const { data: rest, error: restError } = await db.from("players").select("id").eq("session_id", player.session_id).order("seat").limit(1);
  if (restError) throw restError;
  if (!rest.length) {
    await db.from("sessions").update({ status: "over" }).eq("id", player.session_id);
  } else if (player.is_host) {
    await db.from("players").update({ is_host: true }).eq("id", rest[0].id);
  }
  return { left: true };
}

serve({ create, join, rejoin, leave, settings, setBuyIn, setColor });
