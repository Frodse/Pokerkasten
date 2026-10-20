import { useEffect, useState } from "react";

/* Handy-Funktionen, die nicht jedes Gerät kann. Alles hier ist freiwillig:
   Fehlt eine Funktion, läuft die App ohne sie weiter. */

/* Bildschirm wach halten (Screen Wake Lock), solange `on` gilt.
   Das Handy gibt die Sperre selbst frei, sobald die App im Hintergrund
   ist; beim Zurückkommen wird sie neu angefordert. */
export function useWakeLock(on) {
  useEffect(() => {
    if (!on || !navigator.wakeLock) return;
    let lock = null;
    let stopped = false;
    const request = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) next.release().catch(() => {});
        else lock = next;
      } catch (e) { /* abgelehnt, z. B. Stromsparmodus */ }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, [on]);
}

/* Kurzer Ton „du bist dran“ (Web Audio, ohne Tondatei). Browser spielen
   Töne erst nach dem ersten Tippen auf die Seite ab, deshalb wird der
   Ton beim ersten Tippen vorbereitet. Ein stummgeschaltetes iPhone bleibt
   still. */
let audio = null;

function audioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  return audio;
}

export function useAudioUnlock() {
  useEffect(() => {
    const unlock = () => {
      const ctx = audioContext();
      if (!ctx) return;
      ctx.resume?.().catch(() => {});
      // stiller Mini-Ton: schaltet die Wiedergabe auf iOS frei
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
}

export function playTurnSound() {
  try {
    const ctx = audioContext();
    if (!ctx || ctx.state !== "running") return;
    // zwei kurze, aufsteigende Töne, zusammen gut 0,3 s
    [[660, 0], [880, 0.14]].forEach(([freq, at]) => {
      const t = ctx.currentTime + at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch (e) { /* kein Ton möglich */ }
}

/* Auf den Homescreen (PWA). Android/Chrome melden mit „beforeinstallprompt“,
   dass die App installierbar ist; die Meldung kommt früh, deshalb wird sie
   schon beim Laden gemerkt. iPhone/iPad können das nicht, dort gibt es nur
   eine Anleitung. Läuft die App schon vom Homescreen, gibt es nichts.
   mode: "installed" | "prompt" | "ios" | "none" */
let installEvent = null;
const installListeners = new Set();
const notifyInstall = () => installListeners.forEach((fn) => fn());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; notifyInstall(); });
  window.addEventListener("appinstalled", () => { installEvent = null; notifyInstall(); });
}

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
// iPadOS meldet sich als Mac, hat aber einen Touchscreen
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const installMode = (installed) =>
  installed || isStandalone() ? "installed" : installEvent ? "prompt" : isIOS() ? "ios" : "none";

export function useInstall() {
  const [installed, setInstalled] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => {
    const on = () => redraw((n) => n + 1);
    const done = () => setInstalled(true);
    installListeners.add(on);
    window.addEventListener("appinstalled", done);
    return () => { installListeners.delete(on); window.removeEventListener("appinstalled", done); };
  }, []);
  const install = async () => {
    const e = installEvent;
    if (!e) return;
    installEvent = null; // die Meldung gilt nur einmal
    e.prompt();
    try { if ((await e.userChoice).outcome === "accepted") setInstalled(true); } catch (err) { /* abgebrochen */ }
    redraw((n) => n + 1);
  };
  return { mode: installMode(installed), install };
}
