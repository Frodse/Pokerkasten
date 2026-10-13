# Pokerkasten — Status

Letzte Aktualisierung: 13.10.2026

## Wo wir stehen
- Single-Device-Version läuft als React-Artefakt, funktional vollständig
  (Setzrunden, Blind-Eskalation, Side-Pots, Undo, localStorage, Bierrunde,
  Dumpfbacken-Modus, Abschluss-Leaderboard)
- Noch kein Repo, kein Deployment, kein Backend

## Als nächstes
1. [x] spielregeln.md aus dem Artefakt-Chat erzeugen lassen — fertig,
       883 Zeilen dokumentiert, 22 Sonderbehandlungen, 10 offene Punkte
2. [ ] Artefakt-Code in ein Vite-Projekt überführen
3. [ ] GitHub-Repo anlegen, Code pushen
4. [ ] Vercel mit dem Repo verbinden → erste öffentliche URL
5. [ ] PWA-Manifest, damit die App auf den Homescreen passt
6. [ ] Erst danach: Supabase, Sessions, Multiplayer

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
