// Gemeinsame Bausteine der Edge Functions: Datenbank mit vollen Rechten,
// Antworten, Fehler für die Nutzer und Prüfung des Spieler-Tokens.
import { createClient } from "npm:@supabase/supabase-js@2";

export const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

// Fehler, deren Text der Spieler sehen soll (Antwort 400)
export class UserError extends Error {}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Gibt die Zeile aus players zurück, wenn Token und Spieler zusammenpassen
export async function checkToken(playerId, token) {
  if (typeof playerId !== "string" || typeof token !== "string") throw new UserError("Platz nicht gefunden.");
  const { data: secret } = await db.from("player_secrets").select("token_hash").eq("player_id", playerId).maybeSingle();
  if (!secret || secret.token_hash !== (await sha256(token))) throw new UserError("Platz nicht gefunden.");
  const { data: player, error } = await db.from("players").select().eq("id", playerId).single();
  if (error) throw error;
  return player;
}

// Startet die Function: body.action wählt den Handler
export function serve(handlers) {
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
}

// Liest den Tisch, wendet die Änderung an und schreibt nur, wenn sich
// zwischendurch nichts geändert hat. Sonst nochmal mit dem neuen Stand.
// change(session) gibt { state, history?, status?, after? } zurück.
export async function mutate(sessionId, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: session, error } = await db.from("sessions").select("id, status, state, version, history").eq("id", sessionId).single();
    if (error) throw error;
    const next = await change(session);
    const game = next.state.game;
    const { data: written, error: writeError } = await db.from("sessions").update({
      state: next.state,
      history: next.history ?? session.history,
      version: session.version + 1,
      status: game?.screen === "over" ? "over" : next.status ?? session.status,
      current_player_id: game?.screen === "play" ? game.players[game.cur]?.uid ?? null : null,
    }).eq("id", sessionId).eq("version", session.version).select("id");
    if (writeError) throw writeError;
    if (written.length) {
      if (next.after) await next.after(game);
      return { version: session.version + 1, state: next.state };
    }
  }
  throw new Error("Zu viele gleichzeitige Änderungen");
}
