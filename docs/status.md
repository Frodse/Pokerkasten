# Pokerkasten — Status

Letzte Aktualisierung: 20.10.2026

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
- **Spielbildschirm als Slides (20.10.2026):** Spieler · Tisch · Rangliste ·
  Hände mit Tab-Leiste und Wischen, im Spiel wird nie gescrollt (geprüft mit
  9 Spielern bei 390 × 844 und 390 × 667). Wer dran ist, springt auf „Tisch“.
- **Am Spieleabend (20.10.2026):** Bildschirm bleibt an, kurzer Ton online,
  wenn man dran ist (auch iPhone, solange nicht stumm), Hinweis „Keine
  Verbindung“ mit Nachfragen alle 3 s, Start ohne Internet (Service Worker).
- **Tisch-Anzeige (20.10.2026):** zusätzliches Handy/iPad in der Mitte, per
  Code verbunden, nur lesend. Ovaler Tisch, Chipstapel in Sitzfarben, Side
  Pots, Chips gleiten zum Gewinner. Auf Wunsch Mini-Stapel auf dem eigenen
  Handy („Chips anzeigen“ im Slide „Spieler“).
- **Server:** Supabase (Postgres + Realtime). Edge Functions `lobby` und
  `game` prüfen jede Aktion (AK5), gleichzeitiges Tippen zählt nur einmal
  (Spalte `version`). Rechenkern `supabase/functions/_shared/engine.js`
  gilt für lokal und online gleich.
- **Design:** docs/design.md ist komplett umgesetzt (Kap. 11, Schritte
  1–11, abgeschlossen 17.10.2026). Bewusste Abweichungen stehen unten
  unter „Entscheidungen“ (17.10.2026).
- **Tests:** `npm test` – 82 Tests (Rechenkern, Chipstapel, Spielereignisse).
  Dazu Browser-Testläufe vom 17.10. und 20.10.2026 (siehe unten).

## UX-Runde nach Probespiel (20.10.2026, abends)
Umgesetzt nach Feedback, Details in design.md Kap. 15:
- Aktionsknöpfe fest unten über der Tab-Leiste, springen nicht mehr.
- Zeile „Lea erhöht auf 40“ und Kachel-Status check / call 40 / erhöht 40 / fold.
- Flop, Turn, River als Banner (1,5 s, blockiert nichts); nur der Handstart
  bleibt ein Overlay.
- Einladen per Link, QR-Code und „In WhatsApp teilen“.
- Kopfzeile: Phase gestrichen (steht im PhaseTrack), Blinds als Pille.
- Hand-Ende: „Lea gewinnt 120“, „+120“ auf der Kachel, „Abend beenden“ oben
  weit weg von „Nächste Hand“. Showdown: Chip mit Ring in Nacht plus Häkchen.
- Setup: eine Zeile pro Spieler mit Schalter und Papierkorb, Regeln
  eingeklappt mit −/+ in Klartext (auch Lobby), Zurück-Knopf.
- Lokal: „Zur Startseite (Spiel bleibt gespeichert)“ im Slide „Spieler“.
- **Offen für dich:** `game` neu hochladen (Rechenkern hat neue Anzeige-Felder),
  sonst fehlt online die Zeile „letzte Aktion“ und „+120“.

**Testlauf:** `npm test` 87 Tests grün (5 neue für die Anzeige-Felder),
Build grün. Lokal mit 9 Spielern bei 390 × 844, 390 × 667, 360 × 740:
Aktionsknöpfe in jeder Lage an derselben Stelle, „Tisch“ scrollt nicht,
Banner verschwindet von selbst, Hand-Ende, Showdown, Setup bei 360 px,
„Zur Startseite“ und Fortsetzen. Online mit 2 Browsern gegen den echten
Server: Link füllt den Code vor, QR in Lobby und Sheet, Banner, Spiel und
„Abend beenden“. Keine Fehler in der Konsole. Nicht geprüft: QR-Scan mit
echter Kamera, WhatsApp auf dem Handy, letzte Aktion online (erst nach dem
Hochladen von `game`).

## Testlauf 20.10.2026
Automatisch im unsichtbaren Chrome.
- **Slides lokal, 9 Spieler mit langen Namen, 100.000 Chips:** bei 390 × 844
  scrollt kein Slide, auch nicht mit offenem RaisePanel; bei 390 × 667 scrollt
  nur „Spieler“ (erlaubt). Wischen links/rechts, Widerstand am Rand, Tabs,
  Wischen auf Knöpfen wechselt nicht, „Weniger Bewegung“ blendet über.
  Doppel-Tipp = Check auf „Tisch“. Z7: Hand-Ende mit Rebuy statt Bilanz,
  richtiger Hinweis, Rückgängig.
- **Online gegen den echten Server, 3 Browser:** Tab-Leiste, „Tisch“ scrollt
  nicht, wer drankommt springt von „Rangliste“ zurück (11 von 11), Showdown
  auf „Tisch“, Vorschlag + Zustimmung, „Bereit“, Spieler-Slide mit Rechten,
  Hinweis „Keine Verbindung“ erscheint offline und verschwindet wieder,
  Abend beenden → Bilanz.
- **Tisch-Anzeige, 3 Spieler + iPad quer und hoch:** Code riesig, Spieler
  live, Pot-Zahl nach jedem Zug gleich auf Anzeige und Handys (auch im
  Showdown mit Side Pot), Anzeige neu geladen → verbindet sich selbst,
  Chips gleiten zum Gewinner (ein Flug pro Pot), Bilanz am Ende.
  „Chips anzeigen“ auf einem Handy: Mini-Stapel, „Tisch“ scrollt trotzdem nicht.
- **Offline-Start:** App einmal geöffnet, Server weg, neu geladen → Startseite
  und lokales Spiel laufen, Schriften da.
- Keine Fehler in der Browser-Konsole.
- Nicht automatisch prüfbar: echte Handys (Ton am iPhone, Wake Lock unter
  iOS/Android), echtes WLAN-Wackeln.
- Die Test-Tische liegen in der Datenbank (alle mit „Abend beenden“ geschlossen).

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
1. ✅ *Erledigt 20.10.2026 (Z7):* **Abend endet ohne Rebuy, wenn nur noch einer übrig ist** (RB3/Z7).
   Verlieren in einer Hand alle bis auf einen, springt die App sofort in
   die Bilanz – lokal und online. Regelfrage, braucht deine Entscheidung.
2. 🟡 *Teilweise erledigt 20.10.2026:* kurzer Ton, wenn man dran ist (Bildschirm
   bleibt jetzt an). Bei gesperrtem Handy hilft das nicht, dafür bräuchte es
   Push-Benachrichtigungen. **iPhone meldet sich nicht.** iOS kann im Browser nicht vibrieren, Töne
   gibt es nicht. „Es meldet sich, wenn du dran bist“ stimmt dort nur,
   solange man auf den Bildschirm schaut.
3. ✅ *Erledigt 20.10.2026 (Wake Lock):* **Bildschirm geht aus.** Kein Wach-Halten (Wake Lock); wer das Handy
   hinlegt, sieht nach kurzer Zeit nichts mehr.
4. ✅ *Erledigt 20.10.2026:* **Kein Hinweis bei Verbindungsabbruch.** Reißt die Live-Verbindung,
   zeigt das Handy still einen alten Stand (Polling-Ersatz ist offen).
5. ✅ *Erledigt 20.10.2026 (Service Worker, nach dem ersten Öffnen):* **Startet nicht ohne Netz.** Es gibt keinen Service Worker; auch das
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
- ✅ Tisch-Code als Link oder QR-Code teilen (20.10.2026)
- Verlauf der Hand („Tom erhöht auf 80“), Tabelle `actions` ist ungenutzt
  → teilweise 20.10.2026: die jeweils letzte Aktion steht unter den Kacheln
- Chips von Hand korrigieren (Admin), wenn Rückgängig nicht mehr reicht
- Ton oder Benachrichtigung, wenn man dran ist (wichtig fürs iPhone)
  → Ton erledigt 20.10.2026, Push-Benachrichtigung offen
- ✅ Bildschirm wach halten während des Spiels (20.10.2026)
- ✅ Verbindungsanzeige und Polling als Ersatz (20.10.2026)
- ✅ Offline-Start (Service Worker) (20.10.2026)
- Regeln online während des Spiels ändern
- Buy-in-Historie und „verlassen in Hand 3“ in der Bilanz (schon notiert)

## Als nächstes
1. [ ] Am echten Spieleabend mit mehreren Handys ausprobieren
2. [x] Z6, Z7, Z8 entscheiden (spielregeln.md Kap. 13), Z7 vor allem
       → entschieden und umgesetzt 20.10.2026
3. [x] Danach Schwächen 2–5 angehen (Handy meldet sich, Bildschirm,
       Verbindung, Offline) → erledigt 20.10.2026, iPhone nur mit Ton
       (ohne Push)
4. [x] Design-Umbau nach `docs/design.md` Kap. 11 abschließen (Schritte 1–11)
       → erledigt 17.10.2026
5. [x] Slides und Bewegung (`docs/design.md` Kap. 13) → erledigt 20.10.2026
6. [x] Tisch-Anzeige → erledigt 20.10.2026: zentrales Handy/iPad als Pokertisch, Pot als
       wachsender Chipstapel, optional Chips auf den Spieler-Handys,
       Gerüst für spätere Spielereignisse (`docs/design.md` Kap. 14)
7. [ ] Neue Startseite mit Tabs (Statistiken, Gruppen, Bilanz),
       wie Clash Royale. Hat Priorität.
8. [ ] Statistiken über mehrere Abende (Pflicht zum Launch, siehe
       Offene Fragen: wie ohne E-Mail-Login?)

## Launch-Backlog (Vorschlag 20.10.2026, noch zu priorisieren)

**Muss vor Launch**
- [ ] Reconnect im Alltag testen: Token-Wiedereinstieg ist gebaut
      (16.10.). Am echten Tisch prüfen: Handy 10 Minuten im Standby,
      App im Hintergrund, WLAN-Wechsel. Spieler darf nie „raus" sein.
- [x] Einladung per Link und QR-Code statt nur 4-stelligem Code, plus
      „In WhatsApp teilen". Code bleibt als Rückfall.
      → erledigt 20.10.2026 (Link `/?code=1234`, Lobby und Slide „Spieler“)
- [ ] Impressum und Datenschutzerklärung (Pflicht, sobald öffentlich).
      Mit Analytics ggf. Consent-Banner.
- [ ] KPIs messen: Tische, Spieler pro Tisch, Wiederkehr. Eigene Events
      in Supabase, kein Google Analytics.
- [ ] PWA fertig machen: Homescreen-Hinweis, Ladebildschirm (Icon prüfen).
- [ ] Feedback-Knopf für die Beta.

**Spieleabend-Crew**
- [ ] Recap-Karte am Abend-Ende im Story-Format (Platzierungen,
      größter Pot, häufigstes All-In), **ohne Euro-Beträge**.
- [x] Momente und Konfetti im Online-Spiel (design.md Kap. 9)
      → erledigt 17.10.2026, nur bei „Laut"
- [x] Hand-Rangfolge online prüfen (beschlossen 16.10.)
      → erledigt, Sheet „Rangfolge der Hände" auch im Online-Spiel

**Feste Runde**
- Reicht zum Launch: Blinds steigen, Rebuy, Undo.

**Unterwegs (Camping, Urlaub)**
- [ ] Offline-Fallback: ohne Verbindung automatisch „Ein Gerät für alle"
      anbieten. Das Einzel-Handy-Spiel gibt es schon, nur der Weg dorthin
      fehlt.

## Erledigt
- spielregeln.md aus dem Artefakt erzeugt, Vite-Projekt, GitHub, Vercel, PWA
- Supabase: Tabellen, Edge Functions, Rechenkern mit Tests, Z1–Z5
- Online-Tisch komplett (Lobby, Spiel, Abstimmungen, Admins, Uhr, Bilanz)
- Design nach docs/design.md, Schritte 1–11

## Offene Fragen
- Server des Vaters: Docker vorhanden? Node-Version? Subdomain frei?
  (erst relevant, falls Vercel/Supabase nicht mehr reichen)
- ✅ Regelfragen aus spielregeln.md Kap. 13: Z6, Z7, Z8 (entschieden 20.10.2026)
- ✅ Polling als Ersatz für Realtime (architektur.md) (umgesetzt 20.10.2026)
- Statistiken über mehrere Abende sind Pflicht zum Launch, E-Mail-Login
  erst später. Vorschlag: anonyme Anmeldung von Supabase. Jedes Gerät
  bekommt im Hintergrund eine ID ohne E-Mail, später kann man
  „Konto sichern" und die E-Mail ergänzen, ohne Daten zu verlieren.
  Entscheiden.
- Euro-Beträge: in der App okay, aber nie auf Recap-Karte, in Screenshots
  oder Videos. Prüfen, ob Bilanz intern in Chips rechnet und Euro nur
  optional zeigt.
- €-Zwischenstand in der Rangliste (design.md 13.6): ja oder nein?
- Figuren wie „Bigstack Bulli" auf der Tisch-Anzeige: widerspricht
  „kein Maskottchen" in design.md. Eigene Entscheidung.

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
- 16.10.2026 — Neues Design nach `docs/design.md` (V3). Ersetzt „Filz und
  Gold". Lautstärke Ruhig/Laut stellt nur der Host ein. Hand-Rangfolge
  auch online. Familientaugliche Texte, „Bierrunde" heißt „Getränkerunde".
- 17.10.2026 — Spielbildschirm als Slides mit Tab-Leiste (Spieler, Tisch,
  Rangliste, Hände), im Spiel wird nie gescrollt. Bewegung nach dem Skill
  `ui-animation` (design.md Kap. 13).
- 20.10.2026 — Tisch-Anzeige: eigenes Gerät per Code, nur lesend, kein
  Spieler. Chips in der Sitzfarbe dessen, der sie gesetzt hat
  (design.md Kap. 14).
- 20.10.2026 — Zum Launch kein E-Mail-Login für Mitspieler. Wer per Link
  einsteigt, braucht nur einen Namen. Login später optional.
- 20.10.2026 — Z6–Z8 entschieden und umgesetzt (spielregeln.md Kap. 13):
  Z7 Rebuy-Fenster statt sofortigem Spielende, Z6 richtiger Hinweis im
  Hand-Ende, Z8 Pot-Knopf als „Pot plus Call“. Betrifft auch den Server:
  `game` muss neu hochgeladen werden.
- 20.10.2026 — iPhone meldet sich mit einem kurzen Ton statt mit
  Push-Benachrichtigungen. Grund: Push bräuchte eine neue Tabelle, geheime
  Schlüssel und eine Server-Änderung, und am iPhone nur mit App auf dem
  Homescreen. Der Ton gilt nur online und in „Ruhig“ und „Laut“ gleich.
- 20.10.2026 — Bildschirm bleibt an (Screen Wake Lock) im Spiel, online auch
  in der Lobby und auf der Tisch-Anzeige.
- 20.10.2026 — Polling als Ersatz: ohne Live-Verbindung alle 3 s nachfragen,
  mit ihr alle 15 s zur Sicherheit; nach 8 s ohne neuen Stand Hinweis „Keine
  Verbindung“. Gemeinsam für Lobby, Spiel und Anzeige (`src/sessionFeed.js`).
- 20.10.2026 — Offline-Start mit eigenem kleinen Service Worker
  (`src/sw.js`, Dateiliste setzt `vite.config.js` beim Build ein), ohne
  zusätzliches Paket. Supabase-Anfragen laufen nie über die Ablage.
- 20.10.2026 — Slides (design.md Kap. 13) umgesetzt. Kleine Abweichungen,
  damit nichts scrollt, stehen in design.md 13.10.
- 20.10.2026 — Tisch-Anzeige (design.md Kap. 14) ohne Server-Änderung, liest
  über die bestehenden Leserechte. Abweichungen in design.md 14.9.
