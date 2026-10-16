# Pokerkasten — Status

Letzte Aktualisierung: 16.10.2026

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
  (`src/supabaseClient.js`).
- Tabellen `sessions`, `players`, `actions`, `player_secrets` angelegt
  (`supabase/migrations/`). Handys dürfen nur lesen, Schreiben ist
  gesperrt und geprüft. Realtime für `sessions` und `players` an.
- Lobby für den Online-Tisch läuft lokal: Tisch erstellen (4-stelliger
  Code), beitreten, Spielerliste live, Wiedereinstieg nach Neuladen,
  Tisch verlassen (Host geht an den nächsten Platz). Server-Teil ist die
  Edge Function `lobby` (`supabase/functions/lobby/index.js`).
  Noch ohne Spielstart, das Einzel-Handy-Spiel ist unverändert.
- Vercel hat die Supabase-Zugangsdaten, Online-Tisch läuft live auf
  pokerkasten.vercel.app (vom Nutzer am Handy getestet).

## Als nächstes
1. [x] spielregeln.md aus dem Artefakt-Chat erzeugen lassen — fertig,
       883 Zeilen dokumentiert, 22 Sonderbehandlungen, 10 offene Punkte
2. [x] Artefakt-Code in ein Vite-Projekt überführen
3. [x] GitHub-Repo anlegen, Code pushen
4. [x] Vercel mit dem Repo verbinden → erste öffentliche URL
5. [x] PWA-Manifest, damit die App auf den Homescreen passt
6. [ ] Supabase, Sessions, Multiplayer — läuft gerade:
   - [x] Projekt angelegt, Client im Code verbunden
   - [x] Tabellen `sessions`, `players`, `actions` anlegen
         (Schema siehe architektur.md)
   - [x] Erste Edge Function + Lobby (Session erstellen, beitreten,
         Spielerliste live)
   - [x] Vercel: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`
         unter Settings → Environment Variables eingetragen
   - [ ] Spiellogik in reine Funktionen auslagern und mit Tests
         absichern, bevor sie auf den Server wandert
   - [ ] Offene Fragen aus architektur.md klären (Host weg,
         Undo-Tiefe, Timeout, Realtime vs. Polling)
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
- 16.10.2026 — Spiellogik läuft in Supabase Edge Functions (JavaScript),
  nicht als SQL-Funktionen. Grund: getestete Logik lässt sich fast 1:1
  übernehmen, geringstes Risiko beim Umbau.
- 16.10.2026 — Handys lesen nur (Row Level Security), jede Änderung
  läuft über eine Edge Function.
- 16.10.2026 — Reconnect über geheimes Token im localStorage, gespeichert
  als Hash in `player_secrets` (für Handys unsichtbar).
- 16.10.2026 — Supabase-Änderungen laufen per Access Token
  (`SUPABASE_ACCESS_TOKEN` in `.env`, nicht im Repo).
- 16.10.2026 — Tisch-Code muss nur unter laufenden Tischen eindeutig sein.
  Doppelte Namen am selben Tisch werden abgelehnt (Groß/klein egal).
- 16.10.2026 — Edge Functions werden mit
  `npx supabase@2.121.0 functions deploy <name> --use-api` hochgeladen
  (kein Docker nötig). Der Nutzer startet Server-Änderungen selbst.
