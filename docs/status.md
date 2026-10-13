# Pokerkasten — Status

Letzte Aktualisierung: 13.10.2026

## Wo wir stehen
- Single-Device-Version läuft als React-Artefakt, funktional vollständig
  (Setzrunden, Blind-Eskalation, Side-Pots, Undo, localStorage, Bierrunde,
  Dumpfbacken-Modus, Abschluss-Leaderboard)
- Vite-Projekt steht, GitHub-Repo verbunden (SSH), Vercel deployt
  automatisch bei jedem Push: https://pokerkasten.vercel.app
- PWA-Manifest + Icons (Filz-und-Gold-Look) live, auf iOS/Android zum
  Homescreen hinzufügbar, getestet
- Supabase-Projekt angelegt (Region: Europe), `@supabase/supabase-js`
  im Projekt installiert, Verbindung mit echtem Key getestet
  (`src/supabaseClient.js`). Noch keine Tabellen angelegt.

## Als nächstes
1. [x] spielregeln.md aus dem Artefakt-Chat erzeugen lassen — fertig,
       883 Zeilen dokumentiert, 22 Sonderbehandlungen, 10 offene Punkte
2. [x] Artefakt-Code in ein Vite-Projekt überführen
3. [x] GitHub-Repo anlegen, Code pushen
4. [x] Vercel mit dem Repo verbinden → erste öffentliche URL
5. [x] PWA-Manifest, damit die App auf den Homescreen passt
6. [ ] Supabase, Sessions, Multiplayer — läuft gerade:
   - [x] Projekt angelegt, Client im Code verbunden
   - [ ] Tabellen `sessions`, `players`, `actions` anlegen
         (Schema siehe architektur.md) — als Nächstes dran
   - [ ] Offene Fragen aus architektur.md klären (Reconnect, Host
         weg, Undo-Tiefe, Timeout, Realtime vs. Polling)
   - [ ] Spiellogik schrittweise auf den Server verlagern

## Offene Fragen
- Server des Vaters: Docker vorhanden? Node-Version? Subdomain frei?
  (relevant erst ab Schritt 6, Vercel reicht vorher)

## Entscheidungen
- 13.10.2026 — Backend wird Supabase, nicht Firebase.
  Grund: echte Postgres-DB passt zum geplanten Datenmodell.
- 13.10.2026 — Server ist autoritativ, Clients zeigen nur an.
- 13.10.2026 — Z1 bis Z5 entschieden, siehe architektur.md.
  Wichtigste Abweichung vom Artefakt: kurzes All-In-Raise öffnet die
  Setzrunde nicht mehr neu (Z1, Standard-Pokerregel).
- 13.10.2026 — SSH-Schlüssel (ohne Passphrase) statt Personal Access
  Token für GitHub-Push. Grund: Die Entwicklungsumgebung hat kein
  interaktives Terminal, Passwort-/Token-Prompts funktionieren nicht.
