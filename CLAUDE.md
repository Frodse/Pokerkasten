# Pokerkasten — Arbeitsanweisung

## Kontext
Digitaler Chip-Manager für private Pokerrunden. Ersetzt Chips,
Blinds und Pot-Verwaltung. Karten werden weiter physisch gespielt.
Läuft am Handy, im Browser, zu fünft bis neunt am Tisch.

## Stack
- React + Vite, Deployment über Vercel
- Supabase: Postgres + Realtime
- Kein TypeScript, solange es nicht nötig wird

## Wer hier arbeitet
Ich habe kein Entwicklungswissen, aber Grundverständnis von
Frontend/Backend und User Stories. Erkläre Entscheidungen kurz
in normalem Deutsch, bevor du sie umsetzt — nicht danach.

## Arbeitsweise
- Kleine Schritte, nach jedem Schritt muss die App laufen
- Keine Features, die ich nicht angefragt habe
- Wenn eine Anforderung Unsinn ist oder nicht funktioniert: sag es
- Keine Platzhalter oder TODO-Stubs im Code, den du als fertig meldest

## Design
Verbindlich ist docs/design.md. Änderungen am Design nur nach Rückfrage.
Alles wird am Handy bedient, oft mit einer Hand und leicht betrunken.
Große Tap-Flächen, keine Dialoge mit kleinen Schließen-Kreuzen.

## Testen und Hochladen
- `npm test` muss grün sein, `npm run build` muss durchlaufen.
- Server-Änderungen (Edge Functions, Datenbank) startet der Nutzer selbst;
  Befehle und Reihenfolge stehen in docs/architektur.md unter „Hochladen“.

## Sprache
App-Oberfläche auf Deutsch, Code und Variablennamen auf Englisch.

## Nicht anfassen
Die Spiellogik aus docs/spielregeln.md ist über Monate am echten Tisch
getestet. Änderungen daran nur auf ausdrückliche Ansage.
