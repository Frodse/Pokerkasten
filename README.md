# Pokerkasten

Digitaler Chip-Manager für private Pokerrunden. Verwaltet Chips, Blinds,
Pot und Side-Pots. Karten werden weiter physisch am Tisch gespielt.

Läuft am Handy im Browser, für 2 bis 9 Spieler.

## Status
Live auf https://pokerkasten.vercel.app. Zwei Arten zu spielen:
lokal (ein Handy für alle) und online (jeder am eigenen Handy, Einladung
per Link, QR-Code, WhatsApp oder 4-stelligem Code). Dazu optional eine Tisch-Anzeige (Handy/iPad in der
Mitte, nur lesend). Design nach `docs/design.md` umgesetzt, Spielbildschirm
als Slides mit Tab-Leiste. Startet nach dem ersten Öffnen auch ohne Internet,
lässt sich auf den Homescreen legen.

Aktueller Stand und nächste Schritte: `docs/status.md`

## Dokumentation
- `docs/spielregeln.md` — komplette Spiellogik der Single-Device-Version.
  Über Monate am echten Tisch getestet. Grundlage für den Nachbau.
- `docs/architektur.md` — Datenmodell und Entscheidungen für den Multiplayer
- `docs/design.md` — verbindliche Gestaltung der Oberfläche
- `CLAUDE.md` — Arbeitsanweisung für Claude Code

## Stack
React + Vite, Supabase (Postgres + Realtime + Edge Functions),
Deployment über Vercel

## Entwickeln
- `npm run dev` – Vorschau auf http://localhost:5173
- `npm test` – Tests für den Rechenkern und die Tisch-Anzeige
- `npm run build` – Produktions-Build

## Aufbau
- `src/` – Oberfläche: `App.jsx` (lokal), `Lobby.jsx` + `OnlineGame.jsx`
  (online), `Results.jsx` (Bilanz), `ui/` (Bausteine, Slides, Regel-Karte,
  Icons, Wortmarke), `table/` (Tisch-Anzeige, Chipstapel, Spielereignisse),
  `sessionFeed.js` (Live-Stand mit Polling-Ersatz), `device.js` (Bildschirm
  wach halten, Ton, Homescreen-Hinweis), `sw.js` (Offline-Start), `text/de.js` (alle Texte),
  `styles/` (Tokens und Stylesheet)
- `supabase/functions/` – Edge Functions `lobby` und `game`, gemeinsamer
  Rechenkern in `_shared/engine.js`
- `supabase/migrations/` – Datenbank-Schema
- `public/` – Icons (`icon.svg` ist die Vorlage) und Manifest
