# Pokerkasten — Status

Letzte Aktualisierung: 17.10.2026

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
- Online-Tisch läuft live auf pokerkasten.vercel.app. Startseite:
  direkt beitreten (Code + Name), Online-Tisch erstellen oder lokal an
  einem Handy spielen.
  - Lobby: jeder tippt seinen Buy-in selbst ein (in € oder, ohne Geld,
    in Chips). Ein Admin stellt Kurs (z. B. 10 € = 1000 Chips), „mit/ohne
    Geld“, Blinds, Bierrunde und Blind-Steigerung ein – alle sehen das live.
  - Spiel: jeder spielt am eigenen Handy, eigener Stack unten angepinnt.
    Gewinner schlägt einer vor, alle mit Karten bestätigen; nächste Hand
    startet, wenn alle „Bereit“ getippt haben. Mehrere Admins (👑),
    zum Start automatisch zwei. Nachzügler treten mit dem Code bei und
    spielen ab der nächsten Hand. Admin kann bei Bedarf eine 30-s-Uhr
    starten. Ansagen verschwinden nach 3 s von selbst.
  - Ende: Bilanz für alle, Abrechnung in € (ohne Geld nur Chips).
- Neues Design nach docs/design.md läuft in Schritten (Kap. 11):
  1 Tokens/Schriften, 2 Texte zentral und Emojis raus, 3 Grundbausteine
  (`src/ui/components.jsx`), 4 Spieltisch Einzel-Handy (ActionBar,
  RaisePanel, Toolbar mit „Hände“ statt ?-Knopf, auch online),
  5 Showdown, Hand-Ende, Bilanz, Abrechnung (lokal und online) sind fertig. Sitzfarben-Kreis ist gebaut,
  erscheint aber erst mit Schritt 8 (feste Farbe pro Spieler).
  - Server: Edge Functions `lobby` und `game` prüfen jede Aktion (AK5),
    gleichzeitiges Tippen zählt nur einmal (Spalte `version`).
  - Getestet mit Server-Tests (gametest2, ~50 Prüfungen) und mit vier
    simulierten Handys im Browser.

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
   - [x] Spiellogik in reine Funktionen auslagern und mit Tests
         absichern (`supabase/functions/_shared/engine.js`, `npm test`)
   - [x] Z1–Z5 im Rechenkern umsetzen, jeweils mit Test
         (gilt für Einzel-Handy und Online gleich)
   - [x] Bilanz in €, Abrechnung mit Netting, „Abend beenden“
   - [x] Serverseitige Prüfung jeder Aktion (AK5) + Edge Function
         für Spielzüge (`supabase/functions/game/index.js`)
   - [x] Online-Spielbildschirm: Admin startet aus der Lobby, alle sehen
         den Tisch live, jeder tippt am eigenen Handy (`src/OnlineGame.jsx`)
   - [x] Spiellogik auf dem Server (Edge Functions nutzen den Rechenkern)
   - [x] Mehrere Admins, Nachzügler per Code, Uhr statt Timeout,
         eigener Buy-in, Spiel ohne Geld, neue Startseite
   - [ ] Am echten Tisch mit mehreren Handys ausprobieren
   - [ ] Offen aus architektur.md: Polling als Notlösung, falls
         Realtime ausfällt

## Offene Fragen
- Server des Vaters: Docker vorhanden? Node-Version? Subdomain frei?
  (relevant erst ab Schritt 6, Vercel reicht vorher)
- Ideen für später: Buy-in-Historie, „verlassen in Hand 3“ in der Bilanz
- Noch offene Regelfragen aus spielregeln.md Kap. 13: Z6, Z7, Z8

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
- 16.10.2026 — Online: Gewinner im Showdown schlägt einer vor, alle mit
  Karten bestätigen; die nächste Hand startet, wenn alle aktiven „Bereit“
  getippt haben. Admins können beides abkürzen. Grund: Wenn jeder allein
  wählen durfte, war das am echten Tisch verwirrend; ein einzelner Admin
  wäre ein Flaschenhals. (Ersetzt zwei frühere Fassungen: erst wählte nur
  der Host, dann jeder allein.)
- 16.10.2026 — Spiellogik liegt in `supabase/functions/_shared/engine.js`,
  App und Edge Functions benutzen dieselbe Datei. Umbau ohne
  Regeländerung: 39 Tests + Vergleich alte/neue Version über knapp
  3.000 zufällige Klickschritte, identisch. Dabei Z3 und Z4 im
  Zufallsspiel tatsächlich aufgetreten (kleine Stacks, steigende Blinds).
- 16.10.2026 — Z1–Z5 umgesetzt, und zwar auch im Einzel-Handy-Spiel
  (ein Regelwerk für beide). spielregeln.md markiert die Stellen mit ✅.
  47 Tests; Zufallsspiel über ~5.300 Schritte ohne Hänger.
- 16.10.2026 — Wer den Tisch verlässt, nimmt seinen Stack in die Bilanz
  mit. Rebuys zählen als Einkauf. Endbilanz in € (Buy-in-Preis im Setup),
  Abrechnung mit möglichst wenigen Überweisungen. „Abend beenden“ im
  Hand-Ende. Später evtl.: Buy-in-Historie, „verlassen in Hand 3“.
- 16.10.2026 — Online-Undo: nur Admins, bis zu 20 Schritte. Kommt
  jemand mitten im Spiel dazu, beginnt der Verlauf neu (Undo darf seinen
  Platz nicht löschen).
- 16.10.2026 — Mehrere Admins statt eines Hosts. Zum Start automatisch
  zwei (Ersteller + nächster Spieler). Admins ernennen/abwählen per 👑,
  mindestens einer bleibt. Pausiert der letzte aktive Admin oder geht,
  wird der nächste aktive Spieler zusätzlich Admin. Grund: Schließt ein
  Admin die App, kann der andere weitermachen.
- 16.10.2026 — Kein automatisches Timeout (zu viel Druck am Abend, man
  unterhält sich). Stattdessen startet ein Admin bei Bedarf eine Uhr
  (30 s); läuft sie ab, wird gecheckt, wenn gratis, sonst gefoldet.
- 16.10.2026 — Nachzügler treten direkt mit dem Code bei, ohne Freigabe,
  und spielen ab der nächsten Hand.
- 16.10.2026 — Online wählt jeder seinen Buy-in selbst, in der Lobby, in €
  (Kurs vom Admin). Admin kann „ohne Geld“ wählen: Buy-in in Chips, Bilanz
  nur in Chips, keine Abrechnung. Rebuy-Betrag wählt man ebenfalls selbst.
  Lokal (ein Handy) bleibt es bei einem Buy-in für alle.
- 16.10.2026 — Neue Startseite: Beitreten direkt auf der ersten Seite,
  darunter „Online-Tisch erstellen“ und „Lokal spielen“. Mit einem
  gespeicherten Online-Platz geht es nach dem Neuladen direkt zurück an
  den Tisch.
- 17.10.2026 — Alte Artefakt-Datei `pokerkasten.jsx` gelöscht. Die
  Zeilenangaben in spielregeln.md bleiben; die Datei ist im Git-Verlauf
  abrufbar (Befehl steht in spielregeln.md).
