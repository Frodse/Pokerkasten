import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

/* Live-Stand eines Online-Tisches: Spielstand (sessions) und Spielerliste
   (players), für Lobby, Spiel und Tisch-Anzeige. Lesen geht ohne Token,
   schreiben nur über die Edge Functions.

   Ersatz für die Live-Verbindung: ohne sie alle 3 s nachfragen, mit ihr
   zur Sicherheit alle 15 s. Ist der Stand 8 s alt und nichts kommt an,
   meldet der Hook „offline“. */

export const SESSION_FIELDS = "id, code, status, state, version";
const PLAYER_FIELDS = "id, name, seat, is_host, buy_in, color";
const POLL_MS = 3000;
const SAFETY_EVERY = 5; // jede 5. Runde, also alle 15 s
const STALE_MS = 8000;

export function useSessionFeed(sessionId, { onSession, onPlayers }) {
  const [offline, setOffline] = useState(false);
  const handlers = useRef({ onSession, onPlayers });
  handlers.current = { onSession, onPlayers };

  useEffect(() => {
    if (!sessionId || !supabase) return;
    let active = true;
    let live = false;          // Live-Verbindung steht
    let lastOk = Date.now();   // letzter erfolgreich geladener Stand
    const refreshPlayers = async () => {
      const { data } = await supabase.from("players").select(PLAYER_FIELDS).eq("session_id", sessionId).order("seat");
      if (active && data) handlers.current.onPlayers(data.map((p) => ({ ...p, buy_in: p.buy_in === null ? null : Number(p.buy_in) })));
    };
    const refreshSession = async () => {
      const { data } = await supabase.from("sessions").select(SESSION_FIELDS).eq("id", sessionId).single();
      if (!active || !data) return;
      handlers.current.onSession(data);
      lastOk = Date.now();
      setOffline(false);
    };
    const refresh = () => { refreshPlayers(); refreshSession(); };
    refresh();
    let round = 0;
    const poll = setInterval(() => {
      round++;
      if (!live || round % SAFETY_EVERY === 0) refresh();
      setOffline(!navigator.onLine || (!live && Date.now() - lastOk > STALE_MS));
    }, POLL_MS);
    const channel = supabase
      .channel(`session-${sessionId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` }, refreshPlayers)
      // Löschungen lassen sich nicht nach Tisch filtern, daher alle mithören
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "players" }, refreshPlayers)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, refreshSession)
      // Live-Verbindung steht (auch nach Wiederverbinden): verpasste Änderungen nachladen
      .on("system", {}, (e) => { if (e.extension === "postgres_changes" && e.status === "ok") refresh(); })
      .subscribe((status) => { live = status === "SUBSCRIBED"; });
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const onOffline = () => setOffline(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", onOffline);
    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", onOffline);
    };
  }, [sessionId]);

  return offline;
}
