# Pokerkasten — Design

Verbindliche Gestaltung der Oberfläche. Ersetzt das Theme „Filz und Gold".
Gilt für das Einzel-Handy-Spiel (`App.jsx`) und den Online-Tisch
(`Lobby.jsx`, `OnlineGame.jsx`, `Results.jsx`).

**Grundsatz: Das Redesign ändert keine Funktion.** Jede Funktion aus dem
Inventar in Kapitel 2 existiert danach weiter: gleich schnell erreichbar,
nicht tiefer verschachtelt, nicht kleiner. Die Spiellogik bleibt, wie sie in
`docs/spielregeln.md` und `supabase/functions/_shared/engine.js` steht.
Dieses Dokument regelt nur Aussehen, Anordnung und Texte.

---

## 1. Kernidee

**Pokerabend, nicht Pokerstars.** Die App liegt auf einem echten Tisch,
zwischen echten Karten, bei Leuten, die sich kennen. Warm, klar, freundlich.
Kein Casino-Grün, kein Neon, keine Glücksspiel-Optik. Familientauglich.

Drei Prinzipien:

1. **Jeder ist eine Farbe.** Jeder Spieler hat eine feste Sitzfarbe. Sie
   steht überall für diese Person. Wer dran ist, sieht man am Tisch an der
   Farbe, ohne zu lesen.
2. **Das Handy liegt auf dem Tisch.** Wenig Infos, sehr groß gesetzt.
   Lesbar aus einem Meter, bedienbar mit einem Daumen.
3. **Zwei Lautstärken, ein Design.** „Ruhig" und „Laut" unterscheiden sich
   nur darin, wie viel die App von sich aus sagt und zeigt (Kap. 9).

---

## 2. Funktionsinventar

Stand des Codes vom 16.10.2026. Nach dem Redesign muss jede Zeile abgehakt
werden können. Spalte „Neu" sagt, wo die Funktion im neuen Design sitzt.

### 2.1 Start

| Funktion | Heute | Neu |
|---|---|---|
| Gespeicherte Session erkennen und anzeigen (Hand #, Spieler) | Karte mit Text | Start, Statuszeile (5.1) |
| Alte Session fortsetzen | gold, deaktiviert ohne Speicherstand | Start, Primärknopf |
| Neue Session (Einzel-Handy) | ghost | Start, Sekundärknopf |
| Online-Tisch | ghost | Start, Sekundärknopf |
| Automatischer Wiedereinstieg in den Online-Tisch nach Neuladen | `loadSeat()` | unverändert, Ladezustand 5.2.5 |

### 2.2 Setup (Einzel-Handy)

| Funktion | Neu |
|---|---|
| Spielerzeilen 2–9, Name eingeben | 5.3 |
| Zeile entfernen (✕, nur bei > 2 Zeilen) | 5.3, 48-px-Knopf |
| „+ Spieler" bis 9 | 5.3 |
| Anfängermodus pro Spieler (🐣) | 5.3, Schalter pro Zeile |
| Start-Chips, Small Blind | 5.3 |
| Getränkerunde alle X Hände (heute „Bierrunde", 0 = aus) | 5.3 |
| Blinds ×2 alle X Hände (0 = aus) | 5.3 |
| Buy-in in € | 5.3 |
| Hinweis „Big Blind = …" | 5.3 |
| Runde starten (erst ab 2 Namen) | 5.3, Primärknopf |
| **Neu:** Sitzfarbe pro Spieler | 5.3, SeatChip pro Zeile |
| **Neu:** Lautstärke Ruhig / Laut | 5.3, VolumeToggle |

### 2.3 Online-Lobby

| Funktion | Neu |
|---|---|
| Auswahl: Tisch erstellen / Beitreten / Zurück | 5.2.1 |
| Erstellen: Name | 5.2.2 |
| Beitreten: 4-stelliger Zahlen-Code + Name | 5.2.2 |
| Fehlermeldungen vom Server | Fehlerbanner (4.12) |
| „Moment …" während Server-Aufruf | Knopf-Ladezustand (4.11) |
| Lobby-Tisch: Code groß anzeigen + Hinweis | 5.2.3 |
| Spielerliste live mit HOST und DU | 5.2.3 |
| Regeln einstellen (nur Host): Start-Chips, SB, Getränkerunde, Blinds ×2, Buy-in € | 5.2.3 |
| Nicht-Host: „Warte, bis der Host das Spiel startet" | 5.2.3 |
| Spiel starten (Host, ab 2 Spielern, mit Spielerzahl im Text) | 5.2.3 |
| Zurück zum Start (Platz bleibt) | 5.2.3 |
| Tisch verlassen (zwei Taps) | 5.2.3, TwoTapButton |
| Verbinden / Verbindung fehlgeschlagen / Nochmal versuchen | 5.2.5 |
| „Online-Tisch auf diesem Gerät nicht eingerichtet" | 5.2.5 |
| **Neu:** Sitzfarbe wählen | 5.2.2 und 5.2.3 |
| **Neu:** Lautstärke (Host) | 5.2.3 |

### 2.4 Spieltisch

| Funktion | Einzel | Online | Neu |
|---|---|---|---|
| Spielerverwaltung öffnen (👥) | ✓ | ✓ | Toolbar (4.7) |
| Rückgängig (Undo) | ✓ | nur Host | Toolbar |
| Hand-Rangfolge (?) | ✓ | — heute nicht | Toolbar, **auch online** (gleiche Daten, bestätigt) |
| Pot-Betrag | ✓ | ✓ | PotDisplay |
| Phasenanzeige Pre-Flop · Flop · Turn · River | ✓ | ✓ | PhaseTrack (4.4) |
| Hand #, Blinds, Dealer, „steigen in n Händen" | ✓ | ✓ | Kopfzeile |
| Hinweistext (`notice`) | ✓ | ✓ | NoticeLine (4.10) |
| Wer am Zug ist („Handy geht an X" / „Du bist dran" / „Am Zug") | ✓ | ✓ | Kopf + SeatFrame / TurnBanner |
| Offener Betrag („80 zum Mitgehen" / „Kein Einsatz offen") | ✓ | ✓ | unter dem Kopf |
| Anfänger-Erklärung zur Situation | ✓ | ✓ | ExplainLine (4.9) |
| Fold | ✓ | nur am Zug | ActionBar |
| Check bzw. Call (mit „(All-In)", wenn der Stack nicht reicht) | ✓ | nur am Zug | ActionBar |
| Raise (deaktiviert nach Z1/M7) | ✓ | nur am Zug | ActionBar |
| All-In mit zwei Taps, deaktiviert nach Z1 | ✓ | nur am Zug | ActionBar |
| Hinweis „Kurzes All-In vor dir: nur Call oder Fold" | ✓ | ✓ | HintLine unter ActionBar |
| Hinweis „Doppel-Tipp = Check" | ✓ | — | HintLine |
| Doppel-Tipp auf den Hintergrund = Check (U2) | ✓ | — | unverändert |
| Raise-Panel: −/+, Min, ½ Pot, ⅔ Pot, Pot, Max, Zurück, Bestätigen | ✓ | ✓ | RaisePanel (4.6) |
| Spielerliste: Name, Dealer, ALL-IN, PAUSE / PAUSE AB NÄCHSTER HAND, FOLD, Anfänger, Einsatz ▲, Stack | ✓ | ✓ + DU | PlayerRow |
| Pause / Fortsetzen pro Spieler | alle | sich selbst, Host alle | PlayerRow, 48-px-Knopf |
| Hinweis „⏸ = setzt ab der nächsten Hand aus" | ✓ | ✓ | HintLine unter der Liste |
| Server-Fehler | — | ✓ | Fehlerbanner |
| Zuschauer-Hinweis nach Verlassen | — | ✓ | NoticeLine |

### 2.5 Ansagen

| Funktion | Neu |
|---|---|
| Vollbild-Ansage Handstart und Phasenwechsel (Titel + Hinweis) | Announcement (4.13) |
| Schließen per Tipp | unverändert |
| Online: verschwindet nach 3 s von selbst | unverändert |
| Einzel-Handy: „Tippen zum Weiterspielen" | unverändert |

### 2.6 Showdown

| Funktion | Neu |
|---|---|
| Rückgängig | Toolbar |
| Runout-Hinweis | NoticeLine |
| Pot-Betrag mit MAIN POT / SIDE POT n / POT | PotDisplay |
| Anleitung „Karten vergleichen …" (online mit Zusatz) | HintLine |
| Gewinner an-/abwählen, mehrere = Split | WinnerRow (4.8) |
| Online: Wählen nur für Spieler am Tisch | unverändert |
| Pot vergeben (n Gewinner) → Bestätigung mit Betrag → Zurück / Bestätigen | 5.7 |

### 2.7 Hand-Ende

| Funktion | Einzel | Online | Neu |
|---|---|---|---|
| Konfetti | ✓ | ✓ | nur „Laut" (Kap. 9) |
| Spielerverwaltung, Rückgängig | ✓ | ✓ | Toolbar |
| Getränkerunde (Chip-Leader holt) | ✓ | ✓ | RoundCard (5.8) |
| „Hand #N beendet" + Ergebnistext | ✓ | ✓ | Kopf |
| Liste: RAUS, PAUSE, DU, Stack | ✓ | ✓ | PlayerRow |
| Rebuy für ausgeschiedene Spieler | alle | sich selbst, Host alle | PlayerRow |
| Pause / Fortsetzen | alle | sich selbst, Host alle | PlayerRow |
| Hinweis „Blinds steigen auf …" | ✓ | ✓ | NoticeLine |
| Hinweis „Mindestens 2 aktiv – Pause aufheben" | ✓ | ✓ | NoticeLine |
| Nächste Hand (ab 2 aktiven) | ✓ | jeder am Tisch | Primärknopf |
| Abend beenden → Bilanz (zwei Taps) | ✓ | nur Host | TwoTapButton |

### 2.8 Bilanz und Abrechnung

| Funktion | Neu |
|---|---|
| Sieger mit €-Ergebnis und Chips | 5.9 |
| Rangliste: Platz, Name, VERLASSEN, € (+/−), Chips, eingekauft | 5.9 |
| Hinweis Buy-in = Chips | 5.9 |
| Abrechnen: Überweisungen „A → B Betrag", Anzahl, „alle quitt" | 5.9 |
| Zurück zur Bilanz / Neues Spiel / Fertig – zurück zum Start | 5.9 |

### 2.9 Spielerverwaltung (Sheet)

| Funktion | Einzel | Online | Neu |
|---|---|---|---|
| Hinweis Sitzreihenfolge | ✓ | — | Sheet-Kopf |
| Hinweis Host + Rechte | — | ✓ | Sheet-Kopf |
| Liste mit RAUS, PAUSE, IN DER HAND, DU, HOST, Stack | ✓ | ✓ | PlayerRow |
| Platz tauschen ↑ / ↓ | ✓ | Host | ManageRow (4.14) |
| Anfängermodus umschalten | alle | nur sich selbst | ManageRow |
| Host-Rolle weitergeben (👑) | — | Host | ManageRow |
| Spieler entfernen / verlässt den Tisch (✕) | alle | Host für andere | ManageRow |
| Hinweis „Entfernen mitten in der Hand wirkt wie ein Fold" | ✓ | — | HintLine |
| Spieler hinzufügen: Name + Buy-in, „spielt ab nächster Hand", max. 9 | ✓ | — | Sheet-Ende |
| Selbst verlassen (zwei Taps) | — | ✓ | TwoTapButton |
| Schließen | ✓ | ✓ | großer Knopf + Tipp daneben |

### 2.10 Hand-Rangfolge (Sheet)

Zehn Hände mit Rang, Name, Beschreibung und fünf Mini-Karten; Beiwerk
ausgegraut. Inhalt unverändert übernehmen, nur neu gestalten (4.15).

---

## 3. Harte Regeln

- **Farbe = Person.** Sitzfarben werden nur für Spieler verwendet. Knöpfe,
  Hinweise, Fehler und Beträge sind nie in einer Sitzfarbe.
  Einzige Ausnahme: rote Kartenfarben (♥ ♦) in der Hand-Rangfolge.
- Farbe ist **nie** die einzige Information. Neben jeder Sitzfarbe steht der
  Name.
- Text auf einer Sitzfarbe ist immer `--c-night`. Alle neun Sitzfarben
  erreichen damit mindestens 4.5:1 Kontrast.
- **Keine Aktion wird bevorzugt.** Fold, Check/Call, Raise und All-In sind
  gleich groß, gleich gefärbt und stehen immer am selben Platz (4.5).
- Tap-Flächen: Spielaktionen mindestens 64 px hoch, alles andere mindestens
  48 × 48 px. Heute gibt es 32-px-Knöpfe (Pause, ↑↓, 🐣, ✕, 👑) — die werden
  auf 48 px vergrößert.
- Keine Dialoge mit kleinem Schließen-Kreuz. Sheets schließen über einen
  großen Knopf oder einen Tipp außerhalb.
- Keine Emojis in der Oberfläche. Wo heute Emojis stehen, kommt Text oder ein
  einfaches Strich-Icon (2 px, `currentColor`). Liste in 4.16.
- Keine Verläufe, kein Glow, kein `backdrop-filter`. Tiefe nur über
  `--c-night` und `--c-table`.
- Zweistufige Bestätigungen (All-In, Abend beenden, Tisch verlassen,
  Pot vergeben) bleiben zweistufig.
- `touch-action: manipulation` bleibt (U2).
- `prefers-reduced-motion`: Animationen werden zu einfachen Einblendungen.

---

## 4. Tokens und Komponenten

### 4.1 Grundfarben (`src/styles/tokens.css`)

| Token | Wert | Verwendung |
|---|---|---|
| `--c-night` | `#17130F` | Hintergrund, Text auf hellen Flächen |
| `--c-table` | `#231D18` | Karten, Felder, Aktionsknöpfe |
| `--c-line` | `#3A322B` | Ränder |
| `--c-line-soft` | `#2E2620` | Trennlinien in Listen |
| `--c-chalk` | `#F3EBDD` | Haupttext, Primärknöpfe |
| `--c-chalk-2` | `#CFC3B2` | Nebentext |
| `--c-muted` | `#A89A88` | Labels, Hinweise |
| `--c-off` | `#6E6255` | Inaktiv (gefoldet, raus, pausiert) |

### 4.2 Sitzfarben

| Token | Name | Wert | Zeichen |
|---|---|---|---|
| `--seat-red` | Rot | `#E5484D` | Herz |
| `--seat-blue` | Blau | `#3E7BFA` | Pik |
| `--seat-green` | Grün | `#2FB36D` | Kreuz |
| `--seat-yellow` | Gelb | `#F2B33D` | Karo |
| `--seat-chalk` | Kreide | `#F3EBDD` | Stern |
| `--seat-purple` | Lila | `#9B6BFF` | Karo |
| `--seat-orange` | Orange | `#FF7A2F` | Pik |
| `--seat-teal` | Türkis | `#22C3B5` | Herz |
| `--seat-pink` | Pink | `#F25FA6` | Kreuz |

Ohne eigene Wahl wird in dieser Reihenfolge vergeben. Komponenten bekommen
die Farbe über `--seat` (`style={{ '--seat': 'var(--seat-red)' }}`).

Das Zeichen hängt fest an der Farbe, es wird nicht gespeichert und nicht
gewählt. Die Zuordnung ist so gewählt, dass Farben, die bei Farbenblindheit
verwechselt werden (Rot/Grün/Orange/Gelb, Blau/Lila, Pink/Rot), immer
verschiedene Zeichen haben.

### 4.2a SeatChip
Kreis in der Sitzfarbe, gestrichelter Kreide-Rand innen, in der Mitte das
Kartenzeichen in `--c-night`. Bei Kreide ist der Rand Nacht mit 45 % Deckkraft.
Als Inline-SVG, nicht mit Unicode-Zeichen (iOS macht aus ♥ sonst ein
farbiges Emoji). Vorlage im 48er-Raster:
```
<circle cx=24 cy=24 r=23 fill=var(--seat)/>
<circle cx=24 cy=24 r=19 fill=none stroke=#F3EBDD stroke-width=4 stroke-dasharray="6 3.95"/>
<g transform="translate(14 14) scale(0.8333)" fill=#17130F> Zeichen im 24er-Raster </g>
```
Zeichen (24er-Raster):
- Herz: `M12 21s-9-6-9-12.2C3 5.6 5.4 3.5 8.1 3.5c1.7 0 3.1.9 3.9 2.3.8-1.4 2.2-2.3 3.9-2.3 2.7 0 5.1 2.1 5.1 5.3C21 15 12 21 12 21z`
- Pik: `M12 2C9 6 3 9 3 14c0 3 2.5 5 5 5 1.6 0 2.8-.8 3.3-2-.3 2-1 3.6-2.3 5h6c-1.3-1.4-2-3-2.3-5 .5 1.2 1.7 2 3.3 2 2.5 0 5-2 5-5 0-5-6-8-9-12z`
- Karo: `M12 2l8 10-8 10-8-10z`
- Kreuz: Kreise (12,7,r4.6), (7,13.2,r4.6), (17,13.2,r4.6), (12,12,r3) und Stiel `M11 12h2l1.6 10h-5.2z`
- Stern: `M12 2l2.6 6.6 6.9.6-5.3 4.5 1.7 6.9L12 16.8l-5.9 3.8 1.7-6.9-5.3-4.5 6.9-.6z`

Unter 24 px wird der gestrichelte Rand weggelassen, das Zeichen bleibt.
Das `aria-label` nennt Farbe und Zeichen („Grün mit Kreuz").

### 4.3 Schrift und Zahlen

| Rolle | Schrift |
|---|---|
| Display, Zahlen, Knöpfe | Bricolage Grotesque 600 / 800 |
| Fließtext, Labels | Instrument Sans 400 / 600 |

Einbinden über `@fontsource` (npm), nicht über Google Fonts: Die PWA soll
auch mit schlechtem WLAN starten.

| Token | Größe | Verwendung |
|---|---|---|
| `--t-hero` | 88 px, 800, −3px | Pot |
| `--t-moment` | 156 px, 800, −8px | Moment-Overlay |
| `--t-h1` | 44 px, 800, −1.5px | „Du bist dran." / Bildschirmtitel |
| `--t-action` | 22 px, 800 | Aktionsknöpfe |
| `--t-row` | 17 px Instrument 600; Zahlen 18 px Bricolage 800 | Listen |
| `--t-body` | 16 px | Hinweise |
| `--t-label` | 13 px, 600, 2px Sperrung, Großbuchstaben | „POT", „DEIN NAME" |

Chips mit Tausenderpunkt (`Intl.NumberFormat('de-DE')`), Euro wie heute über
`euro()` aus `Results.jsx`.

### 4.4 Kopfzeile und PhaseTrack
Kopfzeile: „Hand 24 · Blinds 40/80 · Dealer Lea · steigen in 3" in
`--t-body`, `--c-muted`. Darunter der PhaseTrack: vier gleich breite
Segmente „Pre-Flop · Flop · Turn · River", 32 px hoch, aktives Segment
Kreide gefüllt mit Nacht-Text, die anderen `--c-table`.

### 4.5 ActionBar
Vier gleich große Knöpfe im 2×2-Raster, feste Plätze wie im heutigen Code:
```
[ Fold          ] [ Check / Call 80   ]
[ Raise         ] [ All-In 1.380      ]
```
- Alle vier: 72 px hoch, `--c-table`, Rand 1.5 px `--c-line`, Text Kreide,
  `--t-action`. Keiner ist hervorgehoben.
- Deaktiviert (Raise nach M7/Z1, All-In nach Z1): `opacity: .4`, Platz bleibt.
- All-In nach dem ersten Tipp: Kreide-Fläche, Nacht-Text,
  „Wirklich All-In (1.380)? Nochmal tippen". Rücksetzen wie heute.
- Darunter HintLines: „Kurzes All-In vor dir: nur Call oder Fold." und
  (Einzel-Handy, toCall = 0) „Doppel-Tipp auf den Hintergrund = Check".
- Dass man dran ist, zeigen SeatFrame und Kopf, nicht die Knöpfe.

### 4.6 RaisePanel
Ersetzt die ActionBar an derselben Stelle (wie heute, kein Overlay), damit
Pot und Liste sichtbar bleiben.
- Label „Raise auf (gesamt diese Runde)", Anfänger: „Auf wie viel willst du
  insgesamt erhöhen?" plus der heutige Zusatzsatz.
- Zielbetrag in `--t-hero`, links − und rechts + als 64-px-Knöpfe.
  Schrittweite und Grenzen nach U0.
- Schnellwahl als eine Reihe aus fünf gleich breiten 56-px-Knöpfen:
  Min · ½ Pot · ⅔ Pot · Pot · Max. Berechnung über `engine.potBet`, nicht
  ändern (Z8).
- Unten zwei gleich große Knöpfe: „Zurück" (sekundär) und „Raise auf 240"
  (Kreide), Anfänger: „Setzen: 240".

### 4.7 Toolbar
Rechtsbündige Reihe unter der Kopfzeile, Knöpfe 48 px hoch mit Icon und Wort:
„Spieler", „Rückgängig", „Hände". Rückgängig nur, wo es heute existiert
(online nur Host), deaktiviert ohne Verlauf. „Hände" ersetzt den runden
Hilfe-Knopf unten rechts, der heute über der ActionBar schwebt.

### 4.8 PlayerRow und WinnerRow
**PlayerRow:** 56 px hoch, Trennlinie oben `--c-line-soft`.
SeatChip 24 · Name · Badges · rechts: Einsatz dieser Runde (`--c-muted`,
„setzt 80") · Stack (Bricolage 800, 70 px breit, rechtsbündig) ·
Aktionsknopf 48 × 48 (Pause/Fortsetzen oder Rebuy), falls erlaubt.
Badges als Text-Pillen auf `--c-table`: DEALER, ALL-IN, PAUSE,
PAUSE AB NÄCHSTER HAND, FOLD, RAUS, DU, HOST, ANFÄNGER, VERLASSEN, IN DER HAND.
Gefoldet, raus und pausiert: Zeile in `--c-off`, SeatChip `opacity: .35`.
Am Zug (Einzel-Handy): SeatChip 32 px mit Kreide-Outline.

**WinnerRow:** 64 px, ganze Breite, SeatChip + Name. Ausgewählt: Fläche in
der Sitzfarbe, Text Nacht, rechts „Gewinner". Mehrere gleichzeitig = Split.

### 4.9 ExplainLine (Anfänger)
Eine Karte auf `--c-table` direkt über der ActionBar mit den heutigen
Anfänger-Erklärungen (Text in Kap. 7), ohne Emoji.

### 4.10 NoticeLine und HintLine
NoticeLine: Karte `--c-table`, Rand gestrichelt `--c-line`, 15 px Kreide.
HintLine: 13 px `--c-muted`, ohne Fläche.

### 4.11 Buttons
- **Primär:** Kreide, Text Nacht, 64 px (Fortsetzen, Runde starten,
  Nächste Hand, Pot vergeben, Spiel starten, Beitreten, Abrechnen).
- **Sekundär:** `--c-table`, Rand `--c-line`, Text Kreide, 56 px.
- **TwoTapButton:** erst sekundär, nach dem ersten Tipp Kreide-Fläche mit
  Rückfrage („Wirklich Abend beenden? Nochmal tippen"). Gilt für All-In,
  Abend beenden, Tisch verlassen, Ich verlasse den Tisch.
- **Laden:** Text wird „Moment …", Knopf deaktiviert.
- Gedrückt: `scale(.97)`, 120 ms.

### 4.12 Fehlerbanner
Kreide-Fläche, Text Nacht, Warn-Icon links. Bewusst keine rote Fläche,
weil Rot eine Sitzfarbe ist.

### 4.13 SeatFrame, TurnBanner, Announcement
- **SeatFrame:** Innenrahmen 7 px in der Sitzfarbe
  (`box-shadow: inset 0 0 0 7px var(--seat)`). Einzel-Handy: Farbe des
  Spielers am Zug. Online: nur auf dem eigenen Gerät, wenn man dran ist.
- **TurnBanner (online, nicht am Zug):** Block oben, 240–320 px, Sitzfarbe des
  aktiven Spielers, unten 32 px Radius. Darüber ein feines
  Kartenrücken-Muster: zwei diagonale Linienscharen
  (`repeating-linear-gradient(±45deg, rgba(23,19,15,.07) 0 2px, transparent 2px 18px)`).
  Es soll nur als Struktur wirken, nicht als Motiv. Deckkraft nicht erhöhen. SeatChip 56, „Lea ist dran.",
  darunter der offene Betrag; wenn zutreffend „Du bist als Nächstes dran".
- **Announcement:** Vollbild `--c-night`, Titel `--t-h1`, Hinweis in
  `--t-body`. Dealer-Hinweis mit SeatChip des Dealers.

### 4.14 Sheet und ManageRow
Sheet von unten, `--c-table`, oben 24 px Radius, max. 90 % Höhe, scrollt.
Unten immer ein großer „Schließen"-Knopf. Tipp außerhalb schließt.
**ManageRow:** PlayerRow plus eine Reihe 48-px-Knöpfe darunter, jeweils mit
Wort: „Hoch", „Runter", „Anfänger", „Host", „Entfernen". Es erscheinen nur
die Knöpfe, die heute für diese Person erlaubt sind.

### 4.15 Hand-Rangfolge
Sheet. Pro Hand eine Zeile: Rang (Bricolage 800), Name, Beschreibung, fünf
Mini-Karten 26 × 36 auf Kreide. ♥ ♦ in `#C8332B`, ♠ ♣ in Nacht, Beiwerk
`opacity: .35`.

### 4.16 Emojis ersetzen

| Heute | Neu |
|---|---|
| 👥 Spieler | Icon Personen + „Spieler" |
| ↩︎ Rückgängig | Icon Pfeil zurück + „Rückgängig" |
| ? (Hilfe) | „Hände" |
| ⏸ / ▶ | Icon Pause / Play, `aria-label` „Pause" / „Fortsetzen" |
| 🐣 | Badge „ANFÄNGER", Schalter „Anfänger" |
| 👑 | „Host" |
| ✕ | „Entfernen" |
| ↑ / ↓ | „Hoch" / „Runter" |
| 🍺 📈 💶 in Labels | weglassen |
| 🏆 im Showdown | „Gewinner" |
| 🥇🥈🥉 | „1.", „2.", „3." in Bricolage 800 |
| 🙅 👊 ✅ 📈 🔥 in Knöpfen | weglassen (Texte Kap. 7) |
| 🃏 📱 auf Start/Lobby | Wortmarke bzw. nichts |

---

## 5. Screens

Basisbreite 390 px, funktionieren ab 360 px, Safe Areas beachten.
Inhalt max. 440 px breit wie heute.

### 5.1 Start
Wortmarke, darunter Statuszeile zum Speicherstand (Texte wie heute).
Knöpfe: „Alte Session fortsetzen" (primär, deaktiviert ohne Speicherstand),
„Neue Session" und „Online-Tisch" (sekundär).

### 5.2 Online-Tisch
**5.2.1 Auswahl:** Titel „Online-Tisch", Satz „Jeder am eigenen Handy …",
Knöpfe „Tisch erstellen" (primär), „Beitreten", „Zurück".

**5.2.2 Erstellen / Beitreten:** Beim Beitreten der Code als vier Felder
(nur Ziffern, `inputMode="numeric"`, 72 px hoch, Bricolage 800 38 px),
dann „DEIN NAME", dann „DEINE FARBE" (ColorPicker: 5 Spalten, SeatChips
56 px als `<button>` mit `aria-label`; vergeben = `opacity: .32` + Name
darunter; ausgewählt = Kreide-Outline + „Du"). Primärknopf „Tisch erstellen"
bzw. „Beitreten". Vorausgewählt ist die erste freie Farbe.

**5.2.3 Lobby-Tisch:** Code groß (Bricolage 800, 72 px), Hinweis darunter.
„AM TISCH · 4 VON 9" mit PlayerRows (SeatChip, HOST, DU). Eigene Zeile:
Tipp auf den SeatChip öffnet den ColorPicker. Host: Regeln-Karte mit allen
heutigen Feldern plus VolumeToggle, dann „Spiel starten (4 Spieler)".
Andere: NoticeLine „Warte, bis der Host das Spiel startet …". Darunter
„Zurück zum Start (dein Platz bleibt)" und TwoTapButton „Tisch verlassen".

**5.2.5 Laden / Fehler:** Karte „Verbinde mit deinem Tisch …" bzw.
„Verbindung fehlgeschlagen", Fehlerbanner, „Nochmal versuchen", „Zurück".

### 5.3 Setup (Einzel-Handy)
Karte „SPIELER": pro Zeile SeatChip (Tipp = Farbe wählen) · Namensfeld ·
Schalter „Anfänger" · „Entfernen" (ab 3 Zeilen). „+ Spieler" bis 9. HintLine
zum Anfängermodus. Karte „REGELN": Start-Chips, Small Blind, Getränkerunde
alle … Hände, Blinds ×2 alle … Hände, Buy-in in €, VolumeToggle, HintLine
„Big Blind = 20". Primärknopf „Runde starten".

### 5.4 Spieltisch
Reihenfolge von oben nach unten, in allen Varianten gleich:
1. Kopfzeile + PhaseTrack, Toolbar
2. PotDisplay („POT", Betrag in `--t-hero`)
3. Zug-Kopf (je nach Variante, siehe unten), offener Betrag
4. NoticeLine, Fehlerbanner, ExplainLine
5. ActionBar bzw. RaisePanel
6. Spielerliste mit HintLine zur Pause

**A Einzel-Handy:** SeatFrame in der Farbe des Spielers am Zug.
Zug-Kopf: SeatChip + „Handy an Lea" (`--t-h1`). Darunter „80 zum Callen"
bzw. „Kein Einsatz offen".

**B Online, ich bin dran:** SeatFrame in der eigenen Farbe, kurze Vibration
beim Wechsel (`navigator.vibrate(80)`, falls vorhanden). Zug-Kopf
„Du bist dran."
Dazu ein kurzer Ton (zwei aufsteigende Sinustöne, zusammen gut 0,3 s, leise),
in „Ruhig" und „Laut" gleich, weil er eine Funktion ist und keine Deko
(entschieden 20.10.2026). Gilt nur online; am Einzel-Handy bleibt es still.
Ein stummgeschaltetes iPhone bleibt still.

**Alle Spielbildschirme:** Der Bildschirm bleibt an (Screen Wake Lock, falls
vorhanden), online auch in der Lobby. Ist der Stand online vermutlich
veraltet (keine Live-Verbindung und 8 s nichts Neues, oder das Handy ist
offline), steht ganz oben ein Fehlerbanner (4.12): „Keine Verbindung – was
du siehst, ist vielleicht nicht aktuell. Die App versucht es weiter."

**C Online, jemand anderes ist dran:** TurnBanner statt Zug-Kopf, keine
ActionBar. Alles andere (Toolbar, Pot, Liste mit Pause) bleibt sichtbar.
Ganz unten HintLine „Leg das Handy ruhig hin. Es meldet sich, wenn du dran
bist."

### 5.5 Ansagen
Wie heute ausgelöst. Gestaltung nach 4.13.

### 5.6 Moment-Overlays
Nur bei „Laut", siehe Kap. 9.

### 5.7 Showdown
Toolbar, Runout-NoticeLine, PotDisplay mit „MAIN POT" / „SIDE POT n" /
„POT", HintLine mit der heutigen Anleitung, WinnerRows, dann Primärknopf
„Pot vergeben (2 Gewinner)". Zweiter Schritt: NoticeLine „Lea & Jonas
bekommen je 170 Chips – sicher?" und zwei gleich große Knöpfe „Zurück" /
„Bestätigen". Jede Änderung der Auswahl nimmt die Bestätigung zurück (SD2).

### 5.8 Hand-Ende
Toolbar, Titel „Hand 24 beendet" (`--t-h1`), Ergebnistext. Wenn fällig:
**RoundCard** auf Kreide mit Nacht-Text: SeatChip des Chip-Leaders,
„Getränkerunde", „Benedikt führt mit 4.820 Chips und holt die Runde."
Dann PlayerRows mit Rebuy / Pause, NoticeLines (Blinds steigen, mindestens
2 aktiv), Primärknopf „Nächste Hand – Dealer wandert", TwoTapButton
„Abend beenden → Bilanz" (online nur Host).

### 5.9 Bilanz und Abrechnung
**Bilanz:** Sieger-Block in seiner Sitzfarbe (Text Nacht): Name, €-Ergebnis
groß, Chips-Ergebnis. Rangliste: Platz, SeatChip, Name, VERLASSEN,
rechts € mit Vorzeichen (Plus in Kreide 800, Minus in `--c-chalk-2` mit
echtem Minuszeichen „−"), darunter „1.840 Chips · 2.000 eingekauft".
HintLine „Buy-in 10,00 € = 1.000 Chips". Knöpfe „Abrechnen" (primär),
„Neues Spiel" bzw. „Fertig – zurück zum Start".
**Abrechnung:** Pro Überweisung eine Zeile 64 px: SeatChip + Name →
SeatChip + Name, Betrag rechts in Bricolage 800 26 px. Anzahl bzw.
„Alle sind quitt". Knöpfe wie heute.

---

## 6. Online-Rechte

Das Design ändert keine Rechte. Es zeigt nur, was der Server heute erlaubt:
Aktionen nur am Zug; Pause und Rebuy für sich selbst, der Host für alle;
Undo, Plätze tauschen, Entfernen, Host weitergeben und Abend beenden nur
Host; Gewinner wählen und „Nächste Hand" jeder, der am Tisch sitzt.
Knöpfe ohne Recht werden nicht angezeigt (nicht nur ausgegraut).

---

## 7. Begriffe und Texte

Standard ist die übliche Poker-Terminologie. Nur der **Anfängermodus**
(Feld `noob`, in der Oberfläche „Anfänger", nicht mehr „Dumpfbacken-Modus")
ändert Beschriftungen und zeigt Erklärungen. Online sieht jeder seine eigene
Einstellung.

| Stelle | Standard | Anfänger (heutiger Text ohne Emoji) |
|---|---|---|
| Fold | Fold | Aufgeben |
| Check | Check | Schieben (gratis) |
| Call | Call 80 / Call 80 (All-In) | Mitgehen – zahle 80 / … (alles!) |
| Raise | Raise | Mehr setzen |
| All-In | All-In 1.380 | Alles rein (1.380) |
| All-In bestätigen | Wirklich All-In (1.380)? Nochmal tippen | gleich |
| Raise-Label | Raise auf (gesamt diese Runde) | Auf wie viel willst du insgesamt erhöhen? |
| Raise bestätigen | Raise auf 240 | Setzen: 240 |
| Offener Betrag | 80 zum Callen | 80 zum Mitgehen |

Anfänger-Erklärungen (ExplainLine), wörtlich wie heute:
- Einsatz offen: „Jemand hat gesetzt. Willst du dabei bleiben, musst du
  80 zahlen. Sonst: Karten weglegen (kostet nichts mehr) – oder selbst
  erhöhen."
- Kein Einsatz: „Niemand hat gesetzt. Du kannst gratis schieben und die
  nächste Karte sehen – oder selbst Chips setzen."
- Raise-Zusatz: „Die Zahl ist dein Gesamteinsatz in dieser Setzrunde –
  nicht was du zusätzlich drauflegst."

Pot, Blinds, Dealer, Side Pot, Showdown, Stack, Pre-Flop/Flop/Turn/River
bleiben in beiden Modi gleich.

Alle Texte liegen in `src/text/de.js` (`standard`, `beginner`, `common`).
Keine Texte direkt in Komponenten.

### Ton
Kurz, freundlich, trocken. Familientauglich: keine Alkohol-Witze, keine
Trinkaufforderungen, kein Spott über Personen, kein Glücksspiel-Slang,
keine Ausrufezeichen-Ketten.
Änderungen an heutigen Texten:
- „Bierrunde" → „Getränkerunde"
- „⏸ = setzt ab der nächsten Hand aus (Klo, Bier holen)" → „Pause = setzt
  ab der nächsten Hand aus"
- „✓ Karten auf den Tisch!" → „Bestätigen"
- „🏆 X räumt ab!" → „X gewinnt den Abend"
- „Dumpfbacken-Modus" → „Anfänger"

---

## 8. App-Icon und Wortmarke

Markenidee dahinter (nur für Texte wie Store-Beschreibung oder Startseite,
nicht im Spiel): Ein Kartenspiel hat 52 Karten und einen Narren. Beim Poker
bleibt der Narr im Kasten. Hier führt er den Tisch: Er spielt nicht mit,
er zählt mit.

**Icon:** Narrenkappe mit drei Zipfeln auf `--c-night`:
```
Kachel 160×160, rx 36, fill #17130F
Kappe in <g transform="translate(8 14) scale(0.9)">:
  linker Zipfel   M44 108 C30 88 18 68 20 46 C40 58 58 80 72 106 Z   fill #E5484D
  rechter Zipfel  M116 108 C130 88 142 68 140 46 C120 58 102 80 88 106 Z   fill #3E7BFA
  mittlerer Zipfel M62 106 C62 78 70 50 80 24 C90 50 98 78 98 106 Z   fill #F2B33D
  Glöckchen r=10 bei (20,42), (140,42), (80,20)   fill #F3EBDD
  Band rect x=36 y=102 w=88 h=24 rx=12   fill #F3EBDD
```
Ersetzt `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, dazu
eine maskable-Variante 512 mit 10 % mehr Innenabstand. Manifest-Farben
`theme_color` und `background_color` auf `#17130F`.

**Wortmarke:** Kappe (gleiche Form, ohne Kachel) links, daneben
„pokerkasten" klein, Bricolage 800, −1.5px. Ersetzt „POKERKASTEN" und die
Unterzeile oben auf jeder Seite.

Die Kappe kommt sonst nur an einer Stelle vor: klein im Moment-Overlay
(Kap. 9). Keine Figur, kein Maskottchen, keine weiteren Auftritte.

---

## 9. Lautstärke und Momente

Einstellung „Ruhig" / „Laut" im Setup bzw. in den Lobby-Regeln (Host).
Standard: **Ruhig**. Gespeichert in den Einstellungen (`settings.volume`),
also im Speicherstand bzw. in `sessions.state.settings`.
Online gilt nur die Einstellung des Hosts für alle Geräte. Es gibt keinen
Schalter pro Spieler.

| | Ruhig | Laut |
|---|---|---|
| Ansagen (Handstart, Phasen) | ja | ja |
| Getränkerunde | ja (wenn eingestellt) | ja |
| Konfetti am Hand-Ende und in der Bilanz | nein | ja, in Sitzfarben |
| Moment-Overlays | nein | ja |
| Zusatzkommentare | nein | ja |

### Moment-Overlays (nur Laut)
Vollbild in der Sitzfarbe der Person, Text Nacht: oben links klein die
Narrenkappe (88 px, Zipfel und Band in Nacht, Glöckchen Kreide), große Zeile
in `--t-moment`, darunter SeatChip, Name, ein Satz. Ein Tipp schließt, sonst
nach 2 s von selbst. Online auf allen Geräten aus demselben Server-Stand.

| Moment | Auslöser | Große Zeile | Satz |
|---|---|---|---|
| All-In | Spieler setzt seinen ganzen Stack | ALL-IN. | „Marvin setzt 420." |
| Raus | Spieler wird am Handende `out` | RAUS. | „Lea ist ausgeschieden. Rebuy?" |
| Sieg | Abend beendet | 1. | „Benedikt gewinnt den Abend." |

Regeln: höchstens ein Moment gleichzeitig; ein Moment verzögert nie eine
Eingabe um mehr als 2 s; Eingang von unten in 220 ms, große Zeile skaliert
von 0.9 auf 1.

### Zusatzkommentare (nur Laut, als NoticeLine)
- „Lea überlegt noch." (TurnBanner, nach 30 s am Zug)
- „Es wird teurer: 80/160." (statt des Blind-Hinweises)

---

## 10. Änderungen außerhalb der Oberfläche

Vor der Umsetzung jeweils bestätigen lassen.

- **Sitzfarbe:** Neues Feld `color` (Token-Name, z. B. `seat-red`) am
  Spieler im Spielzustand und in der Tabelle `players`. Der Server prüft,
  dass jede Farbe pro Tisch nur einmal vergeben ist. Reine Anzeige, keine
  Regel. Braucht eine Migration und eine kleine Erweiterung von
  `engine.startGame` / `engine.addPlayer` (Farbe durchreichen). Das
  Kartenzeichen folgt aus der Farbe und braucht kein eigenes Feld.
- **Lautstärke:** `settings.volume` (`quiet` | `loud`), Standard `quiet`.
  Alte Speicherstände ohne das Feld gelten als `quiet` (wie SP4).
- **Hand-Rangfolge online (bestätigt):** gleiche Daten wie im Einzel-Handy-Spiel. Die
  Liste `HANDS` dafür aus `App.jsx` in eine eigene Datei ziehen.
- **CLAUDE.md:** Abschnitt „Design" auf dieses Dokument verweisen lassen.

---

## 11. Reihenfolge der Umsetzung

Stand 17.10.2026: alle Schritte umgesetzt. Abweichungen (Startseite nach
der Entscheidung vom 16.10., Setup-Schalter unter dem Namen, „Admin“
statt „Host“) stehen in docs/status.md unter „Entscheidungen“.

Kleine Schritte, nach jedem Schritt muss die App laufen. Nach jedem Schritt
die betroffenen Zeilen aus Kapitel 2 prüfen.

1. `tokens.css`, Schriften über `@fontsource`. Altes CSS-Objekt in `App.jsx`
   durch Klassen auf Basis der Tokens ersetzen.
2. `src/text/de.js` anlegen, alle Texte dorthin, Emojis raus (4.16, Kap. 7).
3. Grundkomponenten: Button, TwoTapButton, SeatChip, PlayerRow, NoticeLine,
   HintLine, Fehlerbanner, Sheet. Gemeinsam für Einzel-Handy und Online.
4. Spieltisch 5.4 A mit ActionBar, RaisePanel, Toolbar (Einzel-Handy).
5. Showdown, Hand-Ende, Bilanz, Abrechnung.
6. Setup 5.3 und Start 5.1.
7. Spielerverwaltung und Hand-Rangfolge als Sheets.
8. Sitzfarben einführen (Kap. 10, nach Bestätigung): Einzel-Handy zuerst.
9. Online: Lobby 5.2, Spieltisch 5.4 B und C, Farbe beim Beitreten.
10. App-Icon, Manifest, Wortmarke.
11. Lautstärke und Momente (Kap. 9).
12. Nächste Ausbaustufe: Slides und Bewegung (Kap. 13). Erst beginnen,
    wenn 1–11 laufen. → umgesetzt 20.10.2026
13. Tisch-Anzeige (Kap. 14). Erst beginnen, wenn der laufende Design-Umbau
    abgeschlossen ist. → umgesetzt 20.10.2026

---

## 12. Offen

- [x] Lautstärke: nur der Host stellt sie ein, kein Übersteuern pro Gerät
      (entschieden 16.10.2026)
- [x] Hand-Rangfolge auch online (bestätigt 16.10.2026)
- [x] Gewinner im Showdown: einer schlägt vor, alle mit Karten bestätigen,
      Admins können abkürzen (entschieden 16.10.2026, siehe status.md)
- [ ] €-Zwischenstand in der Rangliste (13.6): ja oder nein?
- [ ] Bigstack Bulli und andere Figuren auf der Tisch-Anzeige (14.6):
      widerspricht „kein Maskottchen" (Kap. 8). Eigene Entscheidung nötig,
      bis dahin nur das Ereignis-Gerüst bauen.

---

## 13. Nächste Ausbaustufe: Slides und Bewegung

Stand 17.10.2026. Baut auf Kapitel 1–12 auf und kommt **nach** Schritt 11 aus
Kapitel 11. Wo dieses Kapitel etwas anders regelt als Kapitel 4 und 5, gilt
ab der Umsetzung dieses Kapitel. Alle anderen Regeln bleiben, vor allem das
Funktionsinventar (Kap. 2) und die harten Regeln (Kap. 3).

Mockups: Canvas „Pokerkasten – Brand-Konzept", Abschnitt „V3 als Slides".

### 13.1 Ziel

Im Spiel wird nie gescrollt. Der Spieltisch wird auf vier Slides verteilt,
zwischen denen man wischt oder über eine Tab-Leiste unten wechselt (wie in
Clash Royale).

| Slide | Inhalt |
|---|---|
| **Spieler** | volle Spielerliste, Pause, Verwaltung |
| **Tisch** (Start) | Kopfzeile, PhaseTrack, Pot, alle Mitspieler als Kacheln, Zug, Aktionen |
| **Rangliste** | Spieler nach Chips, nächste Getränkerunde, nächste Blind-Stufe |
| **Hände** | Hand-Rangfolge, alle zehn Hände |

Reihenfolge von links nach rechts wie oben. Die App startet auf **Tisch**.

### 13.2 Harte Regeln für Slides

- **Alles für die Entscheidung steht auf „Tisch".** Wer dran ist, muss nie
  wischen: Pot, offener Betrag, Einsatz und Status aller Mitspieler, alle
  vier Aktionen und das RaisePanel liegen dort.
- **Zug holt zurück.** Wird man dran, springt die App sofort auf „Tisch",
  egal auf welchem Slide man ist, und vibriert (`navigator.vibrate(80)`).
  Einzel-Handy: nach jeder Aktion zurück auf „Tisch".
- **Keine Scrollbalken im Spiel.** Ziel ist 390 × 844 mit 9 Spielern. Auf
  Geräten unter 667 px Höhe darf nur der Slide „Spieler" scrollen, alle
  anderen müssen passen (Zeilenhöhe darf dafür bis 44 px sinken).
- **Wischen nur außerhalb von Knöpfen und dem RaisePanel.** Der −/+-Bereich
  und die Schnellwahl dürfen keinen Slide-Wechsel auslösen. Bei offenem
  RaisePanel ist Wischen ganz aus.
- **Showdown und Hand-Ende** ersetzen in diesen Phasen den Inhalt von
  „Tisch". Die anderen Slides bleiben erreichbar.
- **Doppel-Tipp = Check** (Einzel-Handy, U2) gilt nur auf „Tisch".
- **Rechte** wie in Kap. 6. Was jemand nicht darf, wird auch auf den
  Slides nicht angezeigt.

### 13.3 Tab-Leiste

Unten fest, 72–80 px inklusive Safe Area, `--c-table`, Rand oben `--c-line`.
Vier gleich breite Tabs mit Strich-Icon (2 px) und Wort: Spieler, Tisch,
Rangliste, Hände. Aktiver Tab: Kreide, 3-px-Linie oben. Inaktive: `--c-muted`.
Als `<nav aria-label="Bereiche">` mit echten `<button>`s, aktiver Tab mit
`aria-current="page"`. Unterhalb der Tab-Leiste liegt nichts.

Die Toolbar aus 4.7 entfällt dadurch:
- „Spieler" und „Hände" werden Tabs.
- „Rückgängig" bleibt als 44-px-Knopf rechts in der Kopfzeile von „Tisch"
  (Rechte wie heute: Einzel-Handy alle, online nur Host).

### 13.4 Slide „Tisch"

Von oben nach unten:
1. Kopfzeile (Hand, Phase, Blinds, steigen in n) links, Rückgängig rechts
2. PhaseTrack (4.4), 28 px
3. Pot (`--t-hero`, bei Platzmangel bis 72 px)
4. **SeatTiles:** alle Spieler im Spiel als Raster, 3 Spalten, Kachel
   62 px hoch, `--c-table`, Radius 14. Inhalt: SeatChip 18 px, Name, Stack
   (Bricolage 800 16 px), rechts Einsatz oder Status („setzt 80",
   „all-in 420", „raus", „Pause"). Dealer als kleiner Kreide-Kreis „D".
   Spieler am Zug: Kachel mit 2-px-Outline in seiner Sitzfarbe.
   Gefoldet/raus/pausiert: Fläche `#1E1915`, Text `--c-off`. Eigene Kachel:
   Zusatz „du".
   Mit 9 Spielern sind das 3 Reihen, mehr nie.
5. NoticeLine, Fehlerbanner, ExplainLine (wie bisher)
6. Zug-Kopf („Du bist dran." / „Handy an Lea") und offener Betrag
7. ActionBar (4.5) bzw. RaisePanel (4.6), Knöpfe 62–64 px

Online, nicht am Zug: TurnBanner (4.13) oben, darunter Pot und „Dein Stack"
nebeneinander, dann SeatTiles, unten HintLine „Leg das Handy ruhig hin.
Wenn du dran bist, springt es von selbst auf den Tisch."

Showdown auf „Tisch": PotDisplay, WinnerRows, Bestätigung (5.7). Ab 7
Berechtigten werden WinnerRows zu 2-spaltigen Kacheln (64 px), damit nichts
scrollt.

Hand-Ende auf „Tisch": Titel, Ergebnis, RoundCard, SeatTiles mit Endstand.
Ausgeschiedene Spieler bekommen auf ihrer Kachel einen Knopf „Rebuy"
(Rechte wie heute), damit Rebuy nicht schwerer erreichbar wird. Darunter
NoticeLines, „Nächste Hand", „Abend beenden".

### 13.5 Slide „Spieler"

Ersetzt das Sheet „Spielerverwaltung" (4.14). Titel „Spieler", darunter
HintLine (Sitzreihenfolge bzw. Host + Rechte, Texte wie heute).
PlayerRows 54 px (bei 9 Spielern 48 px) mit SeatChip, Name, Badges, Stack
und 44-px-Knopf Pause/Fortsetzen.
Tipp auf eine Zeile klappt darunter eine Reihe 48-px-Knöpfe auf: „Hoch",
„Runter", „Anfänger", „Host", „Entfernen" (nur die erlaubten). Es ist immer
höchstens eine Zeile aufgeklappt.
Unten:
- Einzel-Handy: Knopf „Spieler hinzufügen" öffnet ein Sheet mit Name und
  Buy-in (wie heute, max. 9, „spielt ab nächster Hand").
- Online: TwoTapButton „Ich verlasse den Tisch".
HintLine „Pause gilt ab der nächsten Hand."

### 13.6 Slide „Rangliste"

Titel „Rangliste", HintLine „Nach Chips, Stand jetzt. Pausierte zählen mit."
Platz 1 als Block in seiner Sitzfarbe (Text Nacht): Platz, Name, Chips.
Danach Zeilen 54 px: Platz, SeatChip, Name, Chips. Verlassene Spieler mit
Badge VERLASSEN am Ende.
Unten zwei Info-Karten (`--c-table`), nur wenn eingestellt:
- „Getränkerunde nach Hand 24 – wenn es so bleibt, holt Benedikt."
- „Blinds steigen in 3 Händen – von 40/80 auf 80/160."
Beide nutzen vorhandene Werte (Chip-Leader, `blindsFor`), keine neue Logik.

**Offen:** €-Zwischenstand pro Spieler („+38,20 €, wenn jetzt Schluss
wäre"). Würde `engine.balance` mitten im Spiel aufrufen. Erst einbauen,
wenn entschieden.

### 13.7 Slide „Hände"

Ersetzt das Sheet „Hand-Rangfolge" (4.15). Gleicher Inhalt, alle zehn
Zeilen à 54 px ohne Scrollen. Kartensymbole mit Text-Variante (`&#xFE0E;`
hinter ♠ ♥ ♦ ♣), damit iOS keine Emojis daraus macht.

### 13.8 Bewegung

Grundlage: Skill `ui-animation` (im Projekt installiert). Feste Werte, damit
nicht improvisiert wird. Bewegt werden nur `transform` und `opacity`, nie
`width`, `height`, `top`, `left`, nie `transition: all`.

| Was | Dauer | Kurve |
|---|---|---|
| Knopf drücken | sofort beim Antippen, 120 ms zurück | `cubic-bezier(0.25, 0.46, 0.45, 0.94)`, `scale(.97)` |
| Slide wechseln (Tab oder Wisch) | 250 ms | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Sheet öffnen / schließen | 280 ms / 200 ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| SeatFrame „Du bist dran" einblenden | 200 ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| TurnBanner-Farbe wechseln | 200 ms | `ease`, nur `background-color` |
| Zeile in „Spieler" aufklappen | 200 ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Moment-Overlay rein / raus | 220 ms / 150 ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Pot-Betrag ändert sich | 180 ms | kurzes Aufploppen der Zahl, kein Hochzählen |

Regeln:
- **Wischen klebt am Finger.** Während des Wischens folgt der Slide dem
  Finger ohne Kurve. Erst nach dem Loslassen gleitet er weiter oder zurück.
  Ab einem Drittel der Breite oder bei schnellem Wisch wechselt er.
  Am ersten und letzten Slide gibt es leichten Widerstand statt hartem Stopp.
- **Richtung passt zur Lage.** Nach rechts wischen = Slide links davon.
  Auch der Tab-Wechsel bewegt sich in diese Richtung.
- **Unterbrechbar.** Jede Bewegung lässt sich mitten drin umkehren
  (CSS-Transitions statt Keyframes). Kein Tipp wartet auf eine Animation.
- **Weniger Bewegung:** Bei `prefers-reduced-motion` gibt es keine
  Bewegung über den Bildschirm. Slides wechseln mit kurzer Überblendung
  (120 ms), Overlays erscheinen sofort. Farbwechsel bleiben.
- **Keine Animation ohne Anlass.** Nichts bewegt sich beim Öffnen einer
  Seite von selbst, keine Dauerschleifen.
- Wischen braucht `touch-action: pan-y` auf dem Slide-Container, damit
  horizontales Wischen nicht mit dem Browser kollidiert.

### 13.9 Reihenfolge

1. Tab-Leiste und Slide-Container mit Wischen (13.3, 13.8), zuerst mit den
   bisherigen Inhalten.
2. Slide „Tisch" mit SeatTiles (13.4), inklusive Showdown und Hand-Ende.
3. Slide „Spieler" (13.5), Sheet „Spielerverwaltung" entfernen.
4. Slide „Hände" (13.7), Sheet „Hand-Rangfolge" entfernen.
5. Slide „Rangliste" (13.6), ohne €-Zwischenstand.
6. Bewegung feinjustieren (13.8) und mit „Weniger Bewegung" am Handy testen.

Nach jedem Schritt: `npm run build` und `npm test` grün, Funktionsinventar
(Kap. 2) für die betroffenen Bereiche prüfen, mit 9 Spielern prüfen, dass
nichts scrollt.

### 13.10 Umsetzung (20.10.2026)

Umgesetzt in `src/ui/slides.jsx`, gemeinsam für Einzel-Handy und Online.
Den Skill `ui-animation` gibt es im Projekt nicht; die Werte stammen aus
13.8. Kleine Abweichungen, damit mit 9 Spielern nichts scrollt:
- Unter 700 px Höhe: PhaseTrack ausgeblendet (die Phase steht in der
  Kopfzeile), „POT“ steht neben der Zahl, Kacheln 50 px, Abstände knapper.
  Bei offenem RaisePanel sind Zug-Kopf und offener Betrag ausgeblendet.
- Zug-Kopf („Handy an …“) und Namen auf den Kacheln bleiben einzeilig, sehr
  lange Namen werden mit „…“ gekürzt.
- Slide „Spieler“: das Badge „In der Hand“ entfällt (der Status steht auf
  den Kacheln). Im Showdown wird dort nichts verwaltet, wie bisher (die
  Toolbar hatte im Showdown keinen Knopf „Spieler“).
- Showdown und Hand-Ende holen alle auf „Tisch“, nicht nur wer dran ist.
- Die Kopfzeile mit Rückgängig steht auch im Showdown und Hand-Ende.
- Online-Bestätigung im Showdown: wer zustimmt, steht als SeatTiles mit
  „stimmt“ / „wartet“ da, statt als Liste.
- Der unten angepinnte eigene Stack (Online) entfällt; „Dein Stack“ steht
  neben dem Pot.
- Rangliste: die HintLine ist unter 700 px Höhe ausgeblendet.
- Bekannt: Bei 667 px Höhe kann „Tisch“ noch scrollen, wenn der Spieler am
  Zug im Anfängermodus ist (Erklärzeile) oder als Admin online selbst dran
  ist (Knopf für die Uhr).

---

## 14. Tisch-Anzeige

Stand 20.10.2026. Kommt nach dem laufenden Design-Umbau (Kap. 11, Schritt 13).
Nur für den Online-Tisch, das Einzel-Handy-Spiel bleibt unverändert.

Ein zusätzliches Handy oder iPad liegt in der Mitte des Tisches und zeigt
den Tisch für alle. Es ist **kein Spieler**: Es belegt keinen Platz, zählt
nicht mit und kann nichts auslösen. Es liest nur den Spielstand.

### 14.1 Verbinden

- Im Online-Bereich (5.2.1) ein dritter Knopf „Als Tisch-Anzeige
  verbinden". Danach nur der 4-stellige Code, kein Name, keine Farbe.
- Geht in der Lobby und mitten im Spiel.
- Code in localStorage merken, nach Neuladen automatisch wieder verbinden.
  Knopf „Anzeige trennen" klein in der Ecke (48 px, zwei Taps).
- Bildschirm wach halten (Screen Wake Lock API, falls vorhanden).
  Querformat bevorzugt, Hochformat muss auch gehen.
- Lesen über die bestehenden Leserechte (laut architektur.md darf jeder mit
  Code einen Tisch ansehen). Reichen die RLS-Regeln ohne Spieler-Eintrag
  nicht: vor jeder Server-Änderung fragen.

### 14.2 Inhalt je nach Phase

| Phase | Anzeige |
|---|---|
| Lobby | Code riesig (`--t-moment`), „Tritt bei mit Code 4827", Spieler erscheinen live mit SeatChip |
| Spiel | ovaler Tisch, Spieler drumherum, Pot in der Mitte (14.3) |
| Showdown | „Karten zeigen", Pot bzw. Side-Pots sichtbar, nach der Vergabe wandern die Chips zum Gewinner |
| Hand-Ende | Ergebnistext, RoundCard (Getränkerunde), Hinweis Blinds steigen |
| Abend beendet | Bilanz wie 5.9, ohne Knöpfe |

Ansagen (4.13) und, bei „Laut", Moment-Overlays (Kap. 9) erscheinen auf der
Anzeige genauso wie auf den Handys.

### 14.3 Tisch-Ansicht

- Hintergrund `--c-night`, Tischfläche als Oval in `--c-table` mit Rand
  `--c-line`. Kein Casino-Grün, kein Filz, kein Glow.
- Spieler in Sitzreihenfolge im Uhrzeigersinn um das Oval: SeatChip 40 px,
  Name, Stack (Bricolage 800). Dealer als Kreide-Kreis „D".
- Spieler am Zug: Ring in seiner Sitzfarbe um SeatChip und Name, dazu
  „ist dran" in `--c-muted`. Gefoldet, raus, pausiert: `--c-off`.
- Vor jedem Spieler auf dem Tisch: seine Chips dieser Setzrunde (`bet`)
  als kleiner Stapel plus Zahl.
- Mitte: Pot als Chipstapel (14.4), darunter die Zahl in `--t-hero`.
- Oben: Hand, PhaseTrack (4.4), Blinds und „steigen in n".
- Unten: NoticeLine, wenn vorhanden.
- Alles lesbar aus 1,5 m. Mindestgrößen auf dem iPad: Namen 22 px,
  Stacks 28 px, Pot 120 px.

### 14.4 Chipstapel

- **Chips haben die Sitzfarbe des Spielers, der sie gesetzt hat.** Das
  passt zu „Farbe = Person" (Kap. 3). Der Pot besteht aus einem Stapel pro
  Spieler, berechnet aus `contrib` im Spielzustand.
- Chip-Form wie SeatChip: Kreis in der Sitzfarbe, gestrichelter
  Kreide-Rand, von der Seite als flacher Zylinder. Ohne Kartenzeichen.
- 1 Chip = 1 Big Blind der aktuellen Stufe. Höchstens 20 Chips pro Stapel,
  darüber ein weiterer Stapel daneben. Insgesamt höchstens ca. 60
  sichtbare Chips, danach wächst nur noch die Zahl.
- **Die Zahl ist immer die Wahrheit, die Chips sind nur Bild.** Gerundet
  wird nur beim Bild, nie bei der Zahl.
- Side-Pots: eigene Stapelgruppe mit Beschriftung „Side Pot 1".
- Bewegung (Werte aus 13.8): neue Chips fallen in 220 ms auf den Stapel,
  bei Vergabe gleiten die Stapel in 400 ms zum Gewinner. Bei
  „Weniger Bewegung" erscheinen und verschwinden sie ohne Bewegung.

### 14.5 Chips auf den Spieler-Handys

- Schalter „Chips anzeigen" im Slide „Spieler" (13.5), pro Gerät in
  localStorage gespeichert, Standard aus. Jeder entscheidet für sein Handy.
- Wenn an: kleiner Stapel in der eigenen Sitzfarbe neben dem eigenen Stack
  und neben dem Pot auf „Tisch". Gleiche Regeln wie 14.4, höchstens 10
  Chips pro Stapel.
- Darf die Regel „nie scrollen" (13.2) nicht brechen. Passt es nicht,
  wird der Stapel kleiner, nicht der Inhalt verschoben.

### 14.6 Vorbereitung für Spielereignisse

Jetzt nur das Gerüst, keine neuen Inhalte:
- Eine reine Funktion `deriveEvents(prevState, nextState)`, die Ereignisse
  ableitet: All-In, großer Pot (≥ 50 % aller Chips), Spieler raus, neuer
  Chip-Leader. Mit Tests.
- Auf der Anzeige ein fester Platz, an dem Ereignisse später als
  Animation erscheinen (Figuren, Streaks, Musik).
- Angeschlossen wird jetzt nur, was es schon gibt: die Moment-Overlays aus
  Kap. 9, und nur bei „Laut".
- Figuren wie „Bigstack Bulli" sind offen (Kap. 12).

### 14.7 Grenzen

- Keine Änderung an der Spiellogik (spielregeln.md, engine.js).
- Server-Änderungen nur nach Rückfrage, Ziel ist: ganz ohne.
- Die Anzeige zeigt nichts, was Spieler nicht auch auf ihren Handys sehen.

### 14.8 Test

Drei Fenster: zwei Spieler und eine Anzeige. Eine ganze Hand inklusive
Side-Pot und Showdown. Die Pot-Zahl auf der Anzeige muss jederzeit genau
der Pot-Zahl auf den Spieler-Handys entsprechen. Anzeige neu laden: verbindet
sich von selbst wieder.

### 14.9 Umsetzung (20.10.2026)

Umgesetzt in `src/table/` (Anzeige, Chipstapel, Ereignisse), ohne
Server-Änderung und ohne Änderung an `engine.js`.
- Mitte im Spiel: Stapel aus den früheren Setzrunden je Spieler, die
  laufende Runde liegt vor den Spielern. Die Zahl ist der ganze Pot, wie auf
  den Handys.
- Showdown: die große Zahl ist der Pot, um den es gerade geht (wie auf den
  Handys); alle offenen Pots stehen als Stapelgruppe mit Betrag darüber.
- Chips gleiten bei jeder Vergabe zum Gewinner, auch wenn alle anderen
  gefoldet haben; bei Split bekommt jeder Gewinner seinen Anteil.
- 14.5: die Mini-Stapel stehen neben den Beschriftungen „POT“ und „DEIN
  STACK“, damit nichts verrutscht. Ist der Schalter an, steht „Dein Stack“
  auch dann neben dem Pot, wenn man selbst dran ist.
- 14.6: `deriveEvents` in `src/table/events.js` mit Tests. Der feste Platz
  für spätere Animationen ist `.tdEvents` über der Tischmitte, er zeigt
  jetzt noch nichts. Angeschlossen sind nur die Moment-Overlays (bei „Laut“).
- Die App ist im Manifest auf Hochformat gestellt. Als installierte App kann
  ein Tablet deshalb im Hochformat bleiben; im Browser geht quer.

---

## 15. UX-Runde nach dem Probespiel (20.10.2026)

Ergänzt und ändert Kap. 4, 5 und 13. Wo es abweicht, gilt dieses Kapitel.

### 15.1 Infos oben, Entscheidungen unten (ändert 4.5, 13.4)
„Tisch“ ist eine Spalte über die volle Höhe. Unten, direkt über der
Tab-Leiste, sitzt das **Dock** (`TableDock`): Zug-Kopf, offener Betrag,
ExplainLine, HintLines, Uhr-Knopf, zuletzt ActionBar bzw. RaisePanel. Die
Knöpfe sind immer das Letzte; Hinweise wachsen nach oben, die Knöpfe stehen
in jeder Lage an derselben Stelle. Showdown und Hand-Ende legen ihren
Hauptknopf („Pot vergeben“, „Stimmt“, „Nächste Hand“, „Bereit“) ebenfalls ins Dock.

### 15.2 Letzte Aktion (ändert 13.4)
Unter den Kacheln eine Zeile mit SeatChip 18: „Lea erhöht auf 40“, „Lea
callt 40“, „Lea checkt“, „Lea foldet“, „Lea geht all-in (420)“. Sie bleibt
über den Straßenwechsel stehen und ist zu Beginn einer Hand leer.
Kachel-Status: raus › Pause › all-in › fold › „erhöht 40“ / „call 40“ /
„check“; Blinds ohne Aktion weiter „setzt 10“. Grundlage sind reine
Anzeige-Felder im Rechenkern (`lastAction`, je Spieler `last`, `won`).

### 15.3 Ansagen (ändert 4.13, 5.5)
Nur der Handstart bleibt ein Vollbild-Overlay. Flop, Turn, River erscheinen
als **PhaseBanner**: Kreide-Streifen oben, Titel 30 px Bricolage 800 plus
Dealer-Hinweis, `pointer-events: none`, verschwindet nach 1,5 s.
Bewegung (Ergänzung zu 13.8): rein 220 ms `cubic-bezier(0.22, 1, 0.36, 1)`
von oben, raus 150 ms, nur `transform`/`opacity` per Transition; bei
„Weniger Bewegung“ nur Ein- und Ausblenden. Den Skill `ui-animation` gibt es
weiterhin nicht, die Werte folgen 13.8.

### 15.4 Kopfzeile (ändert 4.4, 13.4)
„Hand 12“ · Blinds-Pille „10/20“ (Bricolage 800, 18 px, `--c-table`, Rand
`--c-line`, bricht nie um) · „steigen in 8“, 17 px. Die Phase steht nur im
PhaseTrack; im Showdown steht „Showdown“ dabei, im Hand-Ende nichts (der
Titel sagt es). Der PhaseTrack bleibt auch bei wenig Höhe sichtbar (24 px).
Die kompakte Darstellung aus 13.10 gilt jetzt unter 760 px Höhe (statt 700),
damit 9 Spieler auch bei 360 × 740 ohne Scrollen passen.

### 15.5 Hand-Ende und Showdown (ändert 4.8, 5.8)
Titel aus dem Gewinn: „Lea gewinnt 120“, Split „Lea & Jonas teilen 240“,
verschiedene Side Pots „Lea & Jonas gewinnen“; bei Fold-Sieg darunter „Alle
anderen haben gefoldet.“ Gewinner-Kachel mit Rahmen in der Sitzfarbe und
„+120“ in Kreide. „Abend beenden“ steht oben unter den Kacheln, „Nächste
Hand“ bzw. „Bereit“ unten im Dock.
WinnerRow ausgewählt: SeatChip mit 2,5-px-Ring in Nacht, rechts Häkchen +
„Gewinner“ (im 2-Spalten-Raster nur das Häkchen).

### 15.6 Einladen (ergänzt 5.2.3, 13.5)
Link `https://pokerkasten.vercel.app/?code=1234` füllt das Beitreten vor
(Fokus aufs Namensfeld). Lobby: unter dem großen Code QR-Code (200 px, Nacht
auf Kreide), der Link als Text, „In WhatsApp teilen“ (primär), „Link
kopieren“. Slide „Spieler“ online: Knopf „Einladen“ öffnet dasselbe als Sheet.

### 15.7 Setup und Regeln (ändert 5.3, 5.2.3)
Eine Zeile pro Spieler: SeatChip-Knopf · Namensfeld · Schalter · Papierkorb
48 px (ab 3 Zeilen). Spaltenkopf „Anfänger“ einmal oben. Schalter: Bahn
48 × 28, aus = Linie mit grauem Knopf, an = Kreide mit Knopf rechts.
Regel-Karte eingeklappt: „1.000 Chips · Blinds 10/20 · 10 €“ und „Getränkerunde
alle 3 Hände · Blinds steigen alle 8 · Ruhig“, Knopf „Ändern“. Aufgeklappt
Labels in normaler Schreibweise, Getränkerunde und Blind-Verdopplung als −/+
mit Klartext („alle 3 Hände“ / „aus“). Gleiche Karte in der Lobby; nur
Admins können aufklappen. Unter „Runde starten“ ein Knopf „Zurück“.
Lokal im Slide „Spieler“: „Zur Startseite (Spiel bleibt gespeichert)“.
