// Edge Function "lobby": Tisch erstellen, beitreten, zurückkommen, verlassen.
// Läuft auf dem Server mit vollen Rechten. Handys dürfen die Tabellen nur lesen.
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_PLAYERS = 9;
const MAX_NAME_LENGTH = 20;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

class UserError extends Error {}

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function cleanName(raw) {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) throw new UserError("Bitte einen Namen eingeben.");
  if (name.length > MAX_NAME_LENGTH) throw new UserError(`Name zu lang (höchstens ${MAX_NAME_LENGTH} Zeichen).`);
  return name;
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Nächsten freien Platz vergeben. Treten zwei gleichzeitig bei, wollen beide
// denselben Platz; die Datenbank lässt nur einen durch, der andere versucht es neu.
async function addPlayer(sessionId, name, isHost) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: seated, error } = await db.from("players").select("seat, name").eq("session_id", sessionId);
    if (error) throw error;
    if (seated.length >= MAX_PLAYERS) throw new UserError(`Der Tisch ist voll (${MAX_PLAYERS} Spieler).`);
    if (seated.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new UserError(`„${name}“ sitzt schon am Tisch. Bitte einen anderen Namen wählen.`);
    }
    const seat = seated.reduce((max, p) => Math.max(max, p.seat), -1) + 1;
    const { data: player, error: insertError } = await db
      .from("players").insert({ session_id: sessionId, name, seat, is_host: isHost }).select().single();
    if (insertError?.code === "23505") continue;
    if (insertError) throw insertError;

    const token = newToken();
    const { error: secretError } = await db.from("player_secrets").insert({ player_id: player.id, token_hash: await sha256(token) });
    if (secretError) throw secretError;
    return { player, token };
  }
  throw new Error("Kein freier Platz nach mehreren Versuchen");
}

async function checkToken(playerId, token) {
  if (typeof playerId !== "string" || typeof token !== "string") throw new UserError("Platz nicht gefunden.");
  const { data: secret } = await db.from("player_secrets").select("token_hash").eq("player_id", playerId).maybeSingle();
  if (!secret || secret.token_hash !== (await sha256(token))) throw new UserError("Platz nicht gefunden.");
  const { data: player, error } = await db.from("players").select().eq("id", playerId).single();
  if (error) throw error;
  return player;
}

async function create({ name }) {
  name = cleanName(name);
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const { data: session, error } = await db.from("sessions").insert({ code }).select().single();
    if (error?.code === "23505") continue; // Code gerade an einem anderen Tisch in Benutzung
    if (error) throw error;
    const { player, token } = await addPlayer(session.id, name, true);
    return { session, player, token };
  }
  throw new Error("Kein freier Code gefunden");
}

async function join({ code, name }) {
  name = cleanName(name);
  if (typeof code !== "string" || !/^[0-9]{4}$/.test(code)) throw new UserError("Der Code hat 4 Ziffern.");
  const { data: session } = await db.from("sessions").select().eq("code", code).neq("status", "over").maybeSingle();
  if (!session) throw new UserError(`Kein Tisch mit Code ${code} gefunden.`);
  if (session.status !== "lobby") throw new UserError("An diesem Tisch läuft schon ein Spiel.");
  const { player, token } = await addPlayer(session.id, name, false);
  return { session, player, token };
}

async function rejoin({ playerId, token }) {
  const player = await checkToken(playerId, token);
  const { data: session, error } = await db.from("sessions").select().eq("id", player.session_id).single();
  if (error) throw error;
  if (session.status === "over") throw new UserError("Dieser Tisch ist beendet.");
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

const handlers = { create, join, rejoin, leave };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const handler = handlers[body?.action];
    if (!handler) return reply({ error: "Unbekannte Aktion." }, 400);
    return reply(await handler(body));
  } catch (e) {
    if (e instanceof UserError) return reply({ error: e.message }, 400);
    console.error(e);
    return reply({ error: "Serverfehler. Bitte nochmal versuchen." }, 500);
  }
});
