# Pokerkasten — Status

Letzte Aktualisierung: 17.10.2026

## Wo wir stehen
- Live auf https://pokerkasten.vercel.app (Vercel deployt bei jedem Push
  auf `main`). PWA zum Homescreen hinzufügbar, Icon: Narrenkappe.
- **Lokal (ein Handy für alle):** Setzrunden, Blind-Steigerung, Side-Pots,
  Split, Undo (20 Schritte), Speicherstand im Browser, Getränkerunde,
  Anfängermodus, Spieler hinzufügen/umsetzen/entfernen, Pause, Rebuy,
  Bilanz in € und Abrechnung mit möglichst wenigen Überweisungen.
- **Online (jeder am eigenen Handy):** Startseite mit Code-Eingabe in vier
  Feldern, Tisch erstellen, Lobby mit eigenem Buy-in, Sitzfarbe und Regeln
  des Admins (Kurs, mit/ohne Geld, Blinds, Getränkerunde, Lautstärke).
  Im Spiel: Farbblock „Lea ist dran.“, Farbrahmen + Vibration (Android)
  für den, der dran ist, Gewinner vorschlagen und bestätigen, „Bereit“ für
  die nächste Hand, mehrere Admins, Nachzügler, 30-s-Uhr, Undo für Admins,
  Verlassen, Bilanz und Abrechnung für alle.
- **Server:** Supabase (Postgres + Realtime). Edge Functions `lobby` und
  `game` prüfen jede Aktion (AK5), gleichzeitiges Tippen zählt nur einmal
  (Spalte `version`). Rechenkern `supabase/functions/_shared/engine.js`
  gilt für lokal und online gleich.
- **Design:** docs/design.md ist komplett umgesetzt (Kap. 11, Schritte
  1–11, abgeschlossen 17.10.2026). Bewusste Abweichungen stehen unten
  unter „Entscheidungen“ (17.10.2026).
- **Tests:** `npm test` – 70 Tests für den Rechenkern. Dazu Browser-Testlauf
  vom 17.10.2026 (siehe unten).

## Testlauf 17.10.2026
Automatisch im unsichtbaren Chrome, Handybreite 360 und 390 px.
- **Lokal:** 35 Prüfungen bestanden – Setup mit Farben und Anfänger,
  Raise-Fenster (Grenzen von −/+, Schnellwahl), Rückgängig, Doppel-Tipp =
  Check, Pause ab nächster Hand, Split mit Rückfrage, Rebuy, Spieler
  hinzufügen/umsetzen/entfernen, Hände, Neuladen + Fortsetzen,
  Getränkerunde, „Laut“ (Konfetti, Momente, „Es wird teurer“), Bilanz
  (Summe 0 €, echtes Minus), Abrechnung. Chips-Summe nach jedem Schritt
  geprüft. 9 Spieler mit 20 Zeichen langen Namen und 100.000 Chips passen.
- **Online gegen den echten Server, 4 Browser:** alle Prüfungen bestanden –
  Erstellen, Beitreten mit Farbe, doppelter Name abgelehnt, Farbwechsel
  live, Regeln live, genau ein Handy hat die Aktionsknöpfe, Farbrahmen,
  All-In-Moment auf allen Handys, Vorschlag ablehnen/neu/zustimmen,
  veralteter Klick wird erkannt, Nachzügler mit Buy-in, eigener Rebuy,
  alle „Bereit“ → nächste Hand, Admin-Rückgängig, Uhr läuft ab → Fold,
  Verlassen → Zuschauer, Abend beenden, Bilanz und Abrechnung.
- Keine Fehler in der Browser-Konsole. Dauer einer Server-Aktion
  0,7–2,5 s (Knopf zeigt so lange „Moment …“).
- Dabei behoben: Toolbar brach bei 360 px um; Anfänger-Schalter ging nach
  „Fortsetzen“ + „Neues Spiel“ ab Spieler 3 nicht.
- Nicht automatisch prüfbar: echte Handys (iOS/Android), Vibration,
  schlechtes WLAN, Bildschirm aus.

## Schwächen (Stand 17.10.2026)
Nach Wirkung am Spieleabend sortiert.
1. **Abend endet ohne Rebuy, wenn nur noch einer übrig ist** (RB3/Z7).
   Verlieren in einer Hand alle bis auf einen, springt die App sofort in
   die Bilanz – lokal und online. Regelfrage, braucht deine Entscheidung.
2. **iPhone meldet sich nicht.** iOS kann im Browser nicht vibrieren, Töne
   gibt es nicht. „Es meldet sich, wenn du dran bist“ stimmt dort nur,
   solange man auf den Bildschirm schaut.
3. **Bildschirm geht aus.** Kein Wach-Halten (Wake Lock); wer das Handy
   hinlegt, sieht nach kurzer Zeit nichts mehr.
4. **Kein Hinweis bei Verbindungsabbruch.** Reißt die Live-Verbindung,
   zeigt das Handy still einen alten Stand (Polling-Ersatz ist offen).
5. **Startet nicht ohne Netz.** Es gibt keinen Service Worker; auch das
   lokale Spiel braucht beim Öffnen Internet.
6. Regeln (Blinds, Getränkerunde, Lautstärke) lassen sich online nach dem
   Start nicht mehr ändern.
7. Nicht-Admins sehen in der Lobby die Lautstärke nicht.
8. „Wirklich All-In (…)? Nochmal tippen“ wird auf schmalen Handys drei- bis
   vierzeilig und macht den Knopf höher.
9. Im Farbblock „… ist dran.“ ist der Farbkreis gleichfarbig mit dem
   Hintergrund, man sieht nur den gestrichelten Rand (so in design.md).
10. Nach dem Neuladen eines lokalen Spiels reicht Rückgängig nur 8 statt
    20 Schritte zurück.
11. Alte Tische bleiben in der Datenbank liegen (keine Aufräum-Regel).

## Fehlende Funktionen (Ideen, nichts davon beauftragt)
- Tisch-Code als Link oder QR-Code teilen, statt Ziffern vorzulesen
- Verlauf der Hand („Tom erhöht auf 80“), Tabelle `actions` ist ungenutzt
- Chips von Hand korrigieren (Admin), wenn Rückgängig nicht mehr reicht
- Ton oder Benachrichtigung, wenn man dran ist (wichtig fürs iPhone)
- Bildschirm wach halten während des Spiels
- Verbindungsanzeige und Polling als Ersatz
- Offline-Start (Service Worker)
- Regeln online während des Spiels ändern
- Buy-in-Historie und „verlassen in Hand 3“ in der Bilanz (schon notiert)

## Als nächstes
1. [ ] Am echten Spieleabend mit mehreren Handys ausprobieren
2. [ ] Z6, Z7, Z8 entscheiden (spielregeln.md Kap. 13), Z7 vor allem
3. [ ] Danach Schwächen 2–5 angehen (Handy meldet sich, Bildschirm,
       Verbindung, Offline)

## Erledigt
- spielregeln.md aus dem Artefakt erzeugt, Vite-Projekt, GitHub, Vercel, PWA
- Supabase: Tabellen, Edge Functions, Rechenkern mit Tests, Z1–Z5
- Online-Tisch komplett (Lobby, Spiel, Abstimmungen, Admins, Uhr, Bilanz)
- Design nach docs/design.md, Schritte 1–11

## Offene Fragen
- Server des Vaters: Docker vorhanden? Node-Version? Subdomain frei?
  (erst relevant, falls Vercel/Supabase nicht mehr reichen)
- Regelfragen aus spielregeln.md Kap. 13: Z6, Z7, Z8
- Polling als Ersatz für Realtime (architektur.md)

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
  zwei (Ersteller + nächster Spieler). Admins ernennen/abwählen (Knopf „Admin“),
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
- 17.10.2026 — Sitzfarben (docs/design.md Kap. 10): neue Spalte
  `players.color`, pro Tisch eindeutig (Datenbank-Index). Wählbar beim
  Erstellen/Beitreten und in der Lobby (Tipp auf den eigenen Kreis),
  lokal im Setup. Ohne Wahl die nächste freie Farbe. Der Rechenkern reicht
  die Farbe nur durch (startGame, addPlayer), keine Regeländerung.
  Spieler von vor der Einführung haben keine Farbe und werden neutral
  angezeigt.
- 17.10.2026 — Startseite bleibt wie am 16.10. entschieden (Beitreten
  zuerst); design.md 5.1/5.2.1 beschreibt noch den älteren Aufbau, das
  neue Aussehen gilt trotzdem. Setup: Anfänger/Entfernen stehen unter dem
  Namen statt in derselben Zeile (passt sonst nicht auf 360 px).
- 17.10.2026 — Lautstärke (`settings.volume`, Standard „Ruhig“): Konfetti
  gibt es nur noch bei „Laut“. Momente (All-In, Raus, Sieg) stehen als
  `moment` im Spielstand, damit online alle Geräte denselben zeigen; der
  Rechenkern setzt sie nur, an den Regeln ändert sich nichts.
