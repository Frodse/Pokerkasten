# Pokerkasten

Digitaler Chip-Manager für private Pokerrunden. Verwaltet Chips, Blinds,
Pot und Side-Pots. Karten werden weiter physisch am Tisch gespielt.

Läuft am Handy im Browser, für 2 bis 9 Spieler.

## Status
Single-Device-Version funktional vollständig. Umbau auf Multiplayer
(jeder Spieler am eigenen Handy) läuft.

Aktueller Stand und nächste Schritte: `docs/status.md`

## Dokumentation
- `docs/spielregeln.md` — komplette Spiellogik der Single-Device-Version.
  Über Monate am echten Tisch getestet. Grundlage für den Nachbau.
- `docs/architektur.md` — Datenmodell und Entscheidungen für den Multiplayer
- `CLAUDE.md` — Arbeitsanweisung für Claude Code

## Stack
React + Vite, Supabase (Postgres + Realtime), Deployment über Vercel
