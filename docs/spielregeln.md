# Pokerkasten – Spielregeln (Ist-Stand)

Dokumentiert die Logik von `pokerkasten.jsx` (883 Zeilen, Stand 13.10.2026) so, dass sie ohne den Code nachgebaut werden kann. Alles stammt aus dem Code, nicht aus Erinnerung an Gespräche.

**Prüfstatus**
- Die Side-Pot-Beispiele in Kapitel 5 habe ich durch die echte `computePots`-Funktion aus der Datei laufen lassen. Die Ergebnisse stimmen mit dem Text überein.
- Blind-Stufen, Mindest-Raise und Restverteilung sind aus den Formeln im Code nachgerechnet.
- Alles andere ist durch Lesen abgeleitet. Die App selbst habe ich nicht gestartet. Stellen, bei denen das Verhalten aus dem Code folgt, ich es aber nie am Tisch gesehen habe, stehen unter „Zu klären".

**Markierungen**
- 🔧 Sonderbehandlung, die nach Bugfix aussieht. Hier geht beim Nachbauen am ehesten etwas verloren.
- ⚠️ Abweichung von üblichen Pokerregeln oder Lücke im Code. Details unter „Zu klären" (Z1 …).

Zeilenangaben beziehen sich auf die 883-Zeilen-Fassung.

**Änderungen seit dem 13.10.2026**
- Die Logik liegt jetzt in `supabase/functions/_shared/engine.js` und gilt für Einzel-Handy-Spiel und Online-Tisch gleich. Zeilenangaben unten beziehen sich weiter auf das alte `pokerkasten.jsx`.
- 16.10.2026: Bilanz und Abrechnung in € (Kap. 9.1), Verlassen statt Entfernen (X2), Rebuys zählen (RB2), „Abend beenden“ (G1). Auf ausdrückliche Ansage.
- 16.10.2026: Z1–Z5 nach `docs/architektur.md` umgesetzt, auf ausdrückliche Ansage. Betroffene Regeln sind mit ✅ markiert, das alte Verhalten steht jeweils dabei. Abgesichert durch `tests/engine.test.js` (`npm test`).

---

## 0. Grundbegriffe

### 0.1 Spieler-Zustand

| Feld | Bedeutung |
|---|---|
| `id` | Eindeutige Nummer. Wird nie neu vergeben: ein neuer Spieler bekommt die höchste bisherige id + 1, entfernte Spieler zählen dabei mit. |
| `name` | Anzeigename. Doppelte Namen werden nicht geprüft. |
| `chips` | Stack, ohne die Chips, die schon gesetzt wurden. |
| `bet` | Was der Spieler in der laufenden Setzrunde schon gesetzt hat. Wird bei jedem Phasenwechsel und am Handende auf 0 gesetzt. |
| `contrib` | Alles, was der Spieler in dieser Hand insgesamt gesetzt hat (alle Phasen). Grundlage für Pot und Side Pots. Am Handende 0. |
| `folded` | Hat in dieser Hand gefoldet oder sitzt sie aus. |
| `allIn` | Stack ist 0, Spieler ist noch in der Hand. |
| `acted` | Hat seit Rundenbeginn bzw. seit dem letzten Raise gehandelt. Steuert, wer noch dran ist. |
| `out` | Ausgeschieden (Stack 0 am Handende). Spielt nicht mit, bis ein Rebuy erfolgt. |
| `away` | Pausiert (⏸). |
| `gone` | Aus dem Spiel entfernt. |
| `noob` | Anfängermodus 🐣. Ändert nur Beschriftungen und Erklärtexte, keine Regel. |

### 0.2 Spielermengen

- **alive**: weder `out` noch `gone`. Pausierte Spieler zählen mit.
- **active**: weder `out` noch `away` noch `gone`. Nur aktive Spieler spielen eine neue Hand mit.
- **in der Hand**: weder `out` noch `gone` noch `folded`.
- **Pot (Anzeige)**: Summe aller `contrib`.

### 0.3 Sitzreihenfolge und Suchläufe

- Die Reihenfolge der Spielerliste ist die Sitzreihenfolge im Uhrzeigersinn. Nach dem letzten Platz kommt wieder der erste. Dealer und aktueller Spieler werden als Position in dieser Liste gehalten.
- Die Liste wird nie kürzer. Entfernte und ausgeschiedene Spieler bleiben als Platzhalter stehen. Neue Spieler werden hinten angehängt. Nur ↑/↓ in der Verwaltung vertauscht Plätze.
- Es gibt zwei verschiedene Suchläufe nach „dem nächsten Spieler". Sie nicht zu verwechseln ist wichtig:
  - **Nächster aktiver Spieler ab Platz X** (für Dealer, Blinds, Postflop-Start). Beginnt beim Platz **nach** X, überspringt `out`/`away`/`gone`, überspringt gefoldete Spieler **nicht**.
  - **Nächster Spieler am Zug ab Platz X**. Beginnt **bei X selbst**, geht einmal im Kreis und nimmt den ersten Spieler, der nicht `out`, nicht `gone`, nicht `folded`, nicht `allIn` ist **und** (noch nicht gehandelt hat **oder** weniger als den offenen Einsatz gesetzt hat). Findet er niemanden, ist die Setzrunde vorbei. `away` wird hier nicht geprüft.

### 0.4 Bildschirme und Übergänge

`start` → `setup` → `play` ⇄ `showdown` → `handEnd` → `play` … → `over` → `setup`

- `start` → `setup` bei „Neue Session". Bei „Alte Session fortsetzen" direkt in den gespeicherten Bildschirm.
- `setup` → `play` bei „Runde starten".
- `play` → `showdown`, wenn die Setzrunden durch sind (Kap. 2.3).
- `play` → `handEnd`, wenn alle bis auf einen gefoldet haben (Kap. 2.3).
- `showdown` → `handEnd`, wenn der letzte Pot vergeben ist.
- `handEnd` → `play` bei „Nächste Hand".
- Nach jeder Hand: weniger als 2 alive → `over`. Von `over` aus geht es nur über „Neues Spiel" zurück nach `setup`.

### 0.5 Nicht im Code vorhanden

Handbewertung (die App kennt keine Karten, der Gewinner wird per Tap gewählt), Antes, Straddle, Dead Button, verpasste Blinds, Einstiegs-Blind, Min-/Max-Buy-in, Zugzeit/Timer, Hand-Historie, Rake, Rebuy-Zähler.

---

## 1. Setup

- **S1.** Das Setup zeigt zu Beginn 2 leere Spielerzeilen. „+ Spieler" fügt Zeilen hinzu, bis es 9 sind. ✕ pro Zeile gibt es nur, solange mehr als 2 Zeilen da sind.
- **S2.** Zeilen mit leerem Namen (nach Trim) werden ignoriert. Gestartet werden kann nur mit mindestens 2 nicht-leeren Namen.
- **S3.** Die `id`s werden **nach** dem Herausfiltern leerer Zeilen von 0 an in Zeilenreihenfolge vergeben. Die Zeilenreihenfolge ist die Sitzreihenfolge.
- **S4.** Einstellbar sind:
  - Start-Chips, Default 1000, Minimum 1.
  - Small Blind, Default 10, Minimum 1.
  - Big Blind ist immer 2 × Small Blind und nicht separat einstellbar.
  - Bierrunde alle X Hände, Default 3, 0 = aus.
  - Blinds ×2 alle X Hände, Default 8, 0 = aus.
  - ✅ Buy-in in € für die Start-Chips, Default 10, Minimum 0, Nachkommastellen erlaubt. Rebuys kosten dasselbe, späteres Dazukommen anteilig nach Chips.
- **S5.** ⚠️ Eingaben werden als Zahl gelesen und bei ungültigem oder leerem Feld als 0 behandelt, dann auf das Minimum angehoben. Ein leeres Feld ergibt also 1 (Start-Chips, SB) bzw. 0 (Bierrunde, Blind-Steigerung). Nachkommazahlen werden nicht abgefangen. Es wird nicht geprüft, ob Start-Chips zu den Blinds passen (siehe Z9).
- **S6.** Alle Spieler starten mit demselben Stack (Start-Chips). Pro Spieler kann der Anfängermodus 🐣 gesetzt werden.
- **S7.** Der Dealer der ersten Hand wird zufällig (gleichverteilt) unter allen Spielern gewählt. Die erste Hand hat die Nummer 1.
- **S8.** Beim Start werden Undo-Verlauf und ein eventuell vorhandener alter Speicherstand verworfen. Die Setup-Werte (SB, Start-Chips, Blind-Steigerung, Bier) lassen sich im laufenden Spiel nicht mehr ändern.

---

## 2. Ablauf einer Hand

### 2.1 Handstart

- **H1.** Die Handnummer ist die der vorherigen Hand + 1.
- **H2.** Zurücksetzen: Wer `out`, `away` oder `gone` ist, gilt für diese Hand als gefoldet (`folded` = true, `acted` = true, `bet`/`contrib` = 0, `allIn` = false). Alle anderen bekommen `folded` = false, `allIn` = false, `bet` = 0, `contrib` = 0, `acted` = false. Die Chips bleiben unverändert.
- **H3.** 🔧 Gibt es weniger als 2 Spieler, die weder `out` noch `gone` sind (Pausierte zählen mit), geht das Spiel direkt in den Endbildschirm. In der Praxis ist das nicht erreichbar, weil eine Hand nur aus dem Setup (mindestens 2 Spieler) oder aus `handEnd` (nur bei mindestens 2 alive) gestartet wird.
- **H4.** Dealer: In Hand 1 zufällig. Danach wandert der Button zum nächsten aktiven Spieler nach dem bisherigen Dealer. 🔧 Wäre der übergebene Dealer trotzdem `out`/`away`/`gone`, wird er zusätzlich zum nächsten aktiven Spieler weitergeschoben. Derzeit ist das redundant, weil beide Aufrufer schon einen aktiven Dealer übergeben.
- **H5.** Die Blindhöhe ergibt sich aus der Handnummer (Kap. 7).
- **H6.** Mit 3 oder mehr aktiven Spielern ist SB der nächste aktive Spieler nach dem Dealer und BB der nächste aktive Spieler nach dem SB. Heads-up siehe Kapitel 4.
- **H7.** 🔧 Blinds werden gepostet als `min(Blind, Stack)`. Wer dabei seinen ganzen Stack setzt, ist all-in. Der gepostete Betrag zählt als `bet` und als `contrib`.
- **H8.** Startwerte der Setzrunde: Phase Pre-Flop, offener Einsatz = **volle** Big Blind der Hand, Mindest-Raise-Zuwachs = Big Blind. 🔧 Der offene Einsatz bleibt die volle BB, auch wenn der BB-Spieler weniger posten konnte.
- **H9.** Beide Blind-Spieler starten mit `acted` = false. Der BB bekommt dadurch eine Option, wenn alle nur callen. Der SB muss auf den offenen Einsatz nachlegen.
- **H10.** Wer als Erster dran ist, regelt Kapitel 2.2.
- **H11.** Anzeige: Vollbild „Hand #N" mit dem Hinweis „<Dealer> mischt und gibt jedem 2 Karten · Blinds SB/BB". Tippen schließt den Hinweis. Zusätzlich steht oben ein Infotext „Blinds gesetzt · SB … · BB …".

### 2.2 Wer ist wann dran

- **T1.** Pre-Flop mit 3 oder mehr aktiven Spielern beginnt der nächste aktive Spieler nach dem BB (Under the Gun). Heads-up beginnt der Dealer (Kap. 4).
- **T2.** Nach jeder Aktion wird ab dem Platz **hinter** dem Handelnden der nächste Spieler am Zug gesucht (Suchlauf 2 aus 0.3). Wer gefoldet hat, all-in ist, `out`/`gone` ist, oder schon gehandelt hat und den offenen Einsatz erreicht hat, wird übersprungen.
- **T3.** Ein Raise mit Zielbetrag über dem offenen Einsatz setzt bei **allen anderen** Spielern, die nicht gefoldet, nicht all-in und nicht `out` sind, `acted` auf false. Sie müssen dann erneut handeln. Der Raiser selbst hat `acted` = true.
- **T4.** Der BB hat Pre-Flop `acted` = false. Callen alle nur, kommt er nochmal dran und kann checken oder erhöhen.
- **T5.** Postflop beginnt der erste aktive Spieler ab dem Platz nach dem Dealer (✅ seit Z5: Suchlauf 2 mit offenem Einsatz 0 direkt ab dem Platz nach dem Dealer, damit mitten in der Hand Pausierte nicht übersprungen werden). Gefoldete und all-in Spieler werden übersprungen. Heads-up beginnt dadurch der Nicht-Dealer.
- **T6.** Gefoldete, all-in, `out` und entfernte Spieler werden nie gefragt.

### 2.3 Ende einer Setzrunde

Nach jeder Aktion und nach jedem Entfernen eines Spielers prüft das Spiel in dieser Reihenfolge:

- **E1.** 🔧 Ist nur noch **ein** Spieler in der Hand, endet die Hand sofort. Der Spieler bekommt die Summe aller `contrib` (Fold-Win). Es gibt keinen Showdown und keine Side Pots. Dazu gehört auch ein nicht gecallter Überschuss des Gewinners: er bekommt alles. Ergebnistext: „<Name> gewinnt <Summe> – alle anderen haben gefoldet."
- **E2.** Gibt es noch einen Spieler am Zug (Suchlauf 2), ist er dran. Die Runde läuft weiter.
- **E3.** Ist die Setzrunde vorbei und die Phase ist **River** oder es ist **höchstens ein Spieler in der Hand nicht all-in**, geht es sofort in den Showdown. 🔧 Bei höchstens einem handlungsfähigen Spieler vor dem River gilt das als Runout: Der Showdown-Bildschirm zeigt dann den Hinweis „Alle All-In / nur einer kann noch setzen → Dealer deckt die restlichen Karten auf." Es gibt dafür keine eigenen Ansagen pro Straße.
- **E4.** Sonst folgt der Phasenwechsel Pre-Flop → Flop → Turn → River:
  - `bet` aller Spieler wird 0, `contrib` bleibt.
  - 🔧 `acted` wird für gefoldete, all-in, `out` und entfernte Spieler true, für alle anderen false. Dadurch fragt der Suchlauf nur Handlungsfähige.
  - Der offene Einsatz wird 0, der Mindest-Raise-Zuwachs wird auf die aktuelle Big Blind zurückgesetzt.
  - Vollbild-Ansage mit der Phase und dem Dealer-Hinweis: Flop „Dealer: 3 Karten aufdecken", Turn „Dealer: 4. Karte aufdecken", River „Dealer: 5. Karte aufdecken".
  - Beginn: Regel T5.

---

## 3. Aktionen

### 3.1 Aktionen und ihre Bedingungen

`toCall` ist der offene Einsatz minus der eigene `bet`.

| Aktion | Angeboten, wenn | Wirkung |
|---|---|---|
| **Fold** | immer, auch wenn Check möglich wäre | `folded` = true, `acted` = true. Gesetzte Chips bleiben im Pot. |
| **Check** | `toCall` = 0 | `acted` = true. |
| **Call** | `toCall` > 0 | Zahlt `min(toCall, Stack)`. `bet` und `contrib` steigen, `acted` = true, Stack 0 → all-in. Das Label zeigt „(All-In)", wenn `toCall` ≥ Stack. |
| **Raise** | Stack + `bet` > offener Einsatz. Der Spieler wählt ein Ziel (Gesamteinsatz in dieser Runde, nicht der Zuwachs). | siehe AK1–AK3 |
| **All-In** | immer, nach Bestätigung (U1) | Wie Raise mit Ziel = Stack + `bet`. |

- **AK1.** 🔧 Das Raise-Ziel wird auf Stack + `bet` gekappt.
- **AK2.** Der Spieler zahlt Ziel − `bet`. `acted` = true. Ist der Stack danach 0, ist er all-in.
- **AK3.** Ist das Ziel **größer** als der offene Einsatz: Der Mindest-Raise-Zuwachs wird `max(alter Zuwachs, Ziel − alter offener Einsatz)` und der offene Einsatz wird das Ziel. ✅ Nur wenn der Zuwachs mindestens den Mindest-Zuwachs erreicht (voller Raise), bekommen alle anderen Spieler `acted` = false (T3). Ein kürzeres All-In-Raise öffnet die Runde nicht neu (Z1). *Bis 16.10.2026: jedes Raise über dem offenen Einsatz öffnete neu.*
- **AK4.** 🔧 Ist das Ziel **kleiner oder gleich** dem offenen Einsatz (All-In unter dem Call-Betrag), wirkt die Aktion wie ein Call: Der offene Einsatz und der Mindest-Zuwachs bleiben, niemand bekommt `acted` = false.
- **AK5.** ⚠️ Der Rechenkern prüft **nicht**, ob eine Aktion erlaubt ist oder ob ein Raise das Mindestziel erreicht. Er kappt nur auf den Stack. Alle Bedingungen in der Tabelle werden allein durch die Oberfläche erzwungen. Bei einem Server-Nachbau muss der Server sie selbst prüfen.

### 3.2 Mindest-Raise-Regel

- **M1.** Der Mindest-Zuwachs ist der größte Raise-Zuwachs in der laufenden Setzrunde. Zuwachs heißt: neuer Gesamteinsatz minus bisheriger offener Einsatz. Er startet bei jedem Handstart mit der Big Blind der Hand und bei jedem Phasenwechsel mit der aktuellen Big Blind.
- **M2.** Das Mindest-Ziel eines Raises ist offener Einsatz + Mindest-Zuwachs.
  - Pre-Flop, erster Raise: 2 × BB (offener Einsatz = BB, Zuwachs = BB).
  - Postflop, erste Wette: BB (offener Einsatz 0, Zuwachs = BB).
- **M3.** Der Zuwachs wird nie kleiner, nur größer oder gleich.
- **M4.** Beispiel mit BB = 20: Offener Einsatz 20, Zuwachs 20. A erhöht auf 100 (Zuwachs 80). Jetzt ist der offene Einsatz 100 und der Zuwachs 80, das Mindest-Ziel für den nächsten Raise ist 180. B erhöht auf 180 (Zuwachs 80, bleibt 80). Das Mindest-Ziel ist nun 260.
- **M5.** Ist der Stack kleiner als das Mindest-Ziel, darf der Spieler trotzdem erhöhen: Das Ziel ist dann sein ganzer Stack plus `bet`. Der „Min"-Knopf liefert in diesem Fall den All-In-Betrag.
- **M6.** ✅ Ein All-In-Raise mit kleinerem Zuwachs als dem Mindest-Zuwachs ist möglich. Der offene Einsatz steigt, der Mindest-Zuwachs bleibt. Wer in dieser Runde schon gehandelt hat, muss nachziehen, darf aber nur noch callen oder folden: Raise ist ausgegraut, All-In nur, wenn es höchstens ein Call ist. Wer noch nicht gehandelt hat, darf normal erhöhen. Siehe Z1.
- **M7.** Raise-Knopf deaktiviert, wenn Stack + `bet` ≤ offener Einsatz. Dann bleibt nur Fold, Call (oder Check) und All-In. ✅ Ebenfalls deaktiviert nach kurzem All-In (M6).

### 3.3 Eingabehilfen und Schutz (reine Oberfläche, aber verhaltensrelevant)

- **U0.** Im Raise-Fenster ändert ± den Zielbetrag um die aktuelle Big Blind. „−" geht nie unter das Mindest-Ziel, „+" nie über All-In. Schnellwahl: Min, ½ Pot, ⅔ Pot, Pot, Max. ½/⅔/Pot rechnen `Pot × Anteil`, runden auf ein Vielfaches des **Small Blinds** und klemmen das Ergebnis zwischen Mindest-Ziel und All-In. Der Pot ist dabei der aktuelle Pot **vor** dem eigenen Call, und das Ergebnis wird als **Gesamtziel** genommen (siehe Z8).
- **U1.** 🔧 All-In braucht zwei Taps. Der erste färbt den Knopf rot („Wirklich ALLES (X)? Nochmal tippen!"), der zweite führt aus. Die Sperre wird bei jeder ausgeführten Aktion und bei Undo zurückgesetzt, aber **nicht**, wenn der Zug durch Entfernen eines Spielers weiterwandert (siehe Z10).
- **U2.** 🔧 Doppel-Tipp auf den Hintergrund (zwei Taps innerhalb von 350 ms) löst „Check" aus. Nur auf dem Bildschirm `play`, nur wenn `toCall` = 0 und der Spieler am Zug weder gefoldet noch all-in ist. Wirkungslos, wenn das Raise-Fenster, eine Ansage, die Spielerverwaltung oder die Rangfolge offen ist, und wenn der Tap auf einen Knopf, ein Eingabefeld oder ein Overlay fällt. Die Seite unterdrückt den Browser-Doppeltipp-Zoom (`touch-action: manipulation`).
- **U3.** Die Pot-Vergabe im Showdown braucht zwei Schritte (Kap. 6, SD2).
- **U4.** Ansagen (Handstart, Phasenwechsel) liegen als Vollbild über allem. Solange eine Ansage offen ist, kommt man nicht an die Aktionsknöpfe.

---

## 4. Heads-up-Sonderfälle

- **HU1.** Heads-up gilt, wenn **genau 2 aktive** Spieler die Hand beginnen. Pausierte, ausgeschiedene und entfernte zählen nicht mit.
- **HU2.** 🔧 Der Dealer ist zugleich Small Blind. Der andere aktive Spieler ist Big Blind.
- **HU3.** 🔧 Pre-Flop beginnt der Dealer (= SB). Postflop beginnt der Nicht-Dealer (= BB), weil der Postflop-Start ab dem Platz nach dem Dealer sucht (T5).
- **HU4.** Der Dealer wechselt dadurch jede Hand zwischen den zwei Spielern.
- **HU5.** Beim Übergang von 3 auf 2 Spieler wird der Dealer normal weitergeschoben (H4) und danach die Heads-up-Regel angewendet. Es gibt keine Dead-Button-Regel: Ein Spieler kann dadurch in aufeinanderfolgenden Händen zweimal BB sein.
- **HU6.** ✅ Posten beide Heads-up-Spieler mit den Blinds ihren ganzen Stack, geht es direkt in den Showdown mit Runout-Hinweis (Z3). *Bis 16.10.2026 hing die App hier.*

---

## 5. Side-Pot-Berechnung

Die Berechnung läuft einmal beim Eintritt in den Showdown (nicht nach jeder Aktion).

### 5.1 Algorithmus

- **P1.** Eingabe: `contrib` und `folded` jedes Spielers. Entfernte Spieler gelten als gefoldet.
- **P2.** Ebenen: alle **verschiedenen** `contrib`-Werte größer 0 von **allen** Spielern, auch von gefoldeten und entfernten, aufsteigend sortiert.
- **P3.** Für jede Ebene L mit vorheriger Ebene V (am Anfang 0):
  - **Betrag** = Summe über alle Spieler von `max(0, min(contrib, L) − V)`.
  - **Berechtigt** = alle Spieler, die nicht `out` und nicht gefoldet sind und `contrib` ≥ L haben.
- **P4.** 🔧 Folgen zwei Ebenen direkt aufeinander und haben **dieselbe Berechtigtenliste**, werden sie zu **einem** Pot zusammengelegt (Beträge addiert). Das passiert, wenn eine Ebene nur durch einen gefoldeten Spieler entsteht: Sein Anteil bekommt keinen eigenen Pot, sondern liegt im Pot der Berechtigten.
- **P5.** Reihenfolge: Pot 1 (niedrigste Ebene) ist der Main Pot, danach Side Pot 1, 2, … aufsteigend. Anzeige: „POT", wenn es nur einen gibt, sonst „MAIN POT" und „SIDE POT n".
- **P6.** 🔧 Hat jemand mehr gesetzt als alle anderen, entsteht ganz oben ein Pot mit **nur einem** Berechtigten (nicht gecallter Überschuss). Er wird **nicht** automatisch zurückgegeben. Der Berechtigte muss ihn im Showdown wie jeden anderen Pot per Tap und Bestätigung „gewinnen".
- **P7.** Die Summe aller Pots ist immer die Summe aller `contrib`.
- **P8.** ✅ Entsteht ein Pot mit **leerer** Berechtigtenliste (Spieler mit dem höchsten Einsatz mitten in der Hand entfernt), wird sein Betrag dem letzten Pot mit Berechtigten zugeschlagen (Z4). *Bis 16.10.2026 ließ sich der Showdown dann nicht abschließen.*

### 5.2 Durchgerechnetes Beispiel

Hand ist im Showdown angekommen:

| Spieler | `contrib` | Status |
|---|---|---|
| A | 100 | all-in |
| B | 300 | all-in |
| C | 500 | in der Hand |
| D | 40 | gefoldet |

Summe aller Einsätze: 940. Ebenen (verschieden, aufsteigend): 40, 100, 300, 500.

| Ebene | Vorherige | Beitrag je Spieler | Betrag | Berechtigt | Ergebnis |
|---|---|---|---|---|---|
| 40 | 0 | A 40, B 40, C 40, D 40 | 160 | A, B, C (D gefoldet) | neuer Pot 1: 160 |
| 100 | 40 | A 60, B 60, C 60, D 0 | 180 | A, B, C | gleiche Berechtigte wie Pot 1 → 🔧 zusammengelegt, Pot 1 = **340** |
| 300 | 100 | A 0, B 200, C 200, D 0 | 400 | B, C | Pot 2: **400** |
| 500 | 300 | C 200 | 200 | nur C | Pot 3: **200** |

Ergebnis: Main Pot 340 (A, B, C), Side Pot 1 400 (B, C), Side Pot 2 200 (nur C, nicht gecallter Überschuss). Summe 340 + 400 + 200 = 940. ✓

Weitere durchgerechnete Fälle (mit der echten Funktion geprüft):

- A 500, B 200 (all-in), sonst niemand: Pot 1 = 400 (A, B), Pot 2 = 300 (nur A).
- A 200, B 200, C 60 gefoldet, D 120 gefoldet: ein einziger Pot von 580 (A, B), weil alle Ebenen dieselben Berechtigten haben.
- A 100 entfernt, B 50 all-in, C 50 all-in: Pot 1 = 150 (B, C), Pot 2 = 50 mit **leerer** Berechtigtenliste (P8).

---

## 6. Showdown und Pot-Verteilung

- **SD1.** Der Showdown zeigt die Pots der Reihe nach, mit dem Main Pot zuerst. Wählbar sind nur die Berechtigten des gerade angezeigten Pots. Die App bewertet keine Hände. Der Gewinner wird per Tap gewählt.
- **SD2.** Gewinner werden per Tap ein- und ausgewählt. Mehrere Gewinner bedeuten Split. „Pot vergeben" ist erst mit mindestens einem Gewinner aktiv und zeigt dann „<Namen> bekommt N Chips – sicher?" (bei Split „je N"). Erst „✓ Karten auf den Tisch!" vergibt den Pot, „Zurück" bricht ab. 🔧 Jede Änderung der Gewinnerauswahl nimmt die Bestätigung wieder zurück, man muss neu bestätigen.
- **SD3.** Verteilung eines Pots mit Betrag B an k Gewinner: Jeder bekommt `floor(B / k)`. Der Rest `r = B − floor(B / k) × k` wird in Einzelchips verteilt (je 1 Chip). ✅ Reihenfolge: erster Gewinner links vom Dealer, dann im Uhrzeigersinn (Z2). *Bis 16.10.2026: Antipp-Reihenfolge.*
  - 340 an 2 → 170 / 170.
  - 340 an 3 → 114 / 113 / 113 (114 bekommt der Gewinner, der links vom Dealer zuerst kommt).
  - 100 an 3 → 34 / 33 / 33.
  - 5 an 2 → 3 / 2.
  - Die Bestätigungszeile zeigt „je floor(B / k)" und ignoriert den Rest.
- **SD4.** Nach jedem Pot außer dem letzten springt der Showdown zum nächsten Pot (Auswahl leer). Nach dem letzten Pot endet die Hand.
- **SD5.** Die Chips werden pro Pot sofort gutgeschrieben. Jeder vergebene Pot ist ein eigener Undo-Schritt.
- **SD6.** 🔧 Handende: `bet` und `contrib` aller Spieler werden 0. Wer 0 Chips hat, wird `out` (`out` = `out` oder Stack 0). Sind danach weniger als 2 alive, geht es in den Endbildschirm, sonst in den Bildschirm `handEnd`.
- **SD7.** Der Ergebnistext nach einem Showdown lautet „Pot verteilt – letzter Pot an <Namen>." und nennt nur die Gewinner des letzten Pots. Das ist nur Anzeige.

---

## 7. Blind-Eskalation

- **B1.** Die Blinds werden nicht gespeichert. Sie werden jedes Mal aus der Handnummer H berechnet: Stufe = `floor((H − 1) / X)`, wobei X der Wert „Blinds ×2 alle X Hände" ist. SB = Start-SB × 2^Stufe, BB = 2 × SB. Bei X = 0 ist die Stufe immer 0.
- **B2.** Beispiel mit Start-SB 10 und X = 8 (nachgerechnet): Hände 1–8: 10/20. Hände 9–16: 20/40. Hände 17–24: 40/80. Hände 25–32: 80/160. Bei X = 0 bleibt es bei 10/20.
- **B3.** Die Stufe wechselt mit dem Start der Hand, die die Nummer X + 1, 2X + 1, … trägt. Es gibt keine Zeitkomponente.
- **B4.** Anzeige im Spiel: „steigen in n Hand(en)" mit n = X − ((H − 1) mod X). Am Handende erscheint ein Hinweis, wenn die nächste Hand eine höhere Big Blind hat.
- **B5.** Die aktuelle Big Blind wirkt auf den Mindest-Zuwachs nach Phasenwechsel (M1), auf die ±-Schrittweite im Raise-Fenster und auf die Anzeige. Die Rundung der Pot-Schnellwahl nutzt den Small Blind.
- **B6.** Die Handnummer zählt jede gestartete Hand. Undo setzt sie über den Snapshot zurück. Pausierte oder entfernte Spieler ändern nichts daran.

---

## 8. Spielerverwaltung

Die Verwaltung (👥) lässt sich nur in den Bildschirmen `play` und `handEnd` öffnen, nicht im Showdown und nicht im Endbildschirm.

### 8.1 Pause (⏸/▶)

- **V1.** Der Pause-Knopf steht in der Spielerliste (`play`) und in der Hand-Ende-Liste, nicht in der Verwaltung. Er schaltet `away` um.
- **V2.** Die Pause wirkt ab der **nächsten Hand**: Dann gilt der Spieler als gefoldet, zahlt keine Blinds, wird nie gefragt, kann nicht Dealer, SB oder BB werden, und der Button überspringt ihn. Die Chips bleiben unverändert.
- **V3.** Pausierte zählen zu alive. Das Spielende wird dadurch nicht ausgelöst, und ein Pausierter kann der Chip-Leader für die Bierrunde sein. „Nächste Hand" ist deaktiviert, solange weniger als 2 aktive Spieler da sind (mit Hinweis „Pause aufheben").
- **V4.** ✅ Pause mitten in der Hand wirkt erst ab der nächsten Hand. Der Spieler spielt die laufende Hand normal zu Ende, auch postflop an seinem Platz. In der Spielerliste steht „PAUSE AB NÄCHSTER HAND“, solange er noch in der Hand ist (Z5).
- **V5.** Pause ist **nicht** per Undo zurücknehmbar (UN3).

### 8.2 Entfernen (✕ in der Verwaltung)

- **X1.** Der Spieler bekommt `gone` = true, `folded` = true, `acted` = true. Er verschwindet aus allen Listen, sein Platz bleibt in der Liste als Platzhalter.
- **X2.** ✅ Wer entfernt wird, **verlässt den Tisch**: Sein Stack bleibt bei ihm stehen und zählt als Endstand in der Bilanz (Kap. 9.1). Er spielt nicht mehr mit. *Bis 16.10.2026 verschwand der Stack aus dem Spiel.*
- **X3.** 🔧 Im Bildschirm `play` wirkt das Entfernen wie ein Fold. Seine bereits gesetzten Chips bleiben im Pot (`contrib` bleibt). Der offene Einsatz bleibt unverändert, auch wenn der Entfernte der letzte Raiser war. Danach läuft dieselbe Prüfung wie nach einer Aktion (Kap. 2.3): ein Spieler übrig → Fold-Win, Runde fertig → nächste Phase oder Showdown, sonst geht es weiter. Der Suchlauf nach dem nächsten Spieler am Zug startet beim **aktuellen** Platz. Der Spieler am Zug bleibt also dran, außer er wurde selbst entfernt.
- **X4.** Im Bildschirm `handEnd` wird nur das Flag gesetzt. Es gibt keine Prüfung auf das Spielende (siehe Z6).
- **X5.** Wird der **Dealer** entfernt, zeigt die Anzeige bis zum Ende der Hand weiter seinen Namen. In der nächsten Hand geht der Button zum nächsten aktiven Spieler nach seinem Platz.
- **X6.** Wird ein SB- oder BB-Spieler mitten in der Hand entfernt, bleibt sein Einsatz im Pot und wird nicht erstattet.
- **X7.** Das Entfernen ist per Undo zurücknehmbar. Entfernte Spieler tauchen in der Bierrunde nicht mehr auf. ✅ In der Endbilanz stehen sie mit dem Hinweis „VERLASSEN“.

### 8.3 Rebuy

- **RB1.** Der Rebuy-Knopf erscheint nur im Bildschirm `handEnd`, in der Zeile eines `out`-Spielers. Er setzt `out` = false und den Stack auf die **Start-Chips** aus dem Setup (nicht einstellbar). Sitzplatz, Dealer und Blinds bleiben unberührt. Der Spieler spielt ab der nächsten Hand mit. Per Undo zurücknehmbar. ✅ Jeder Rebuy erhöht den Einkauf des Spielers um die Start-Chips.
- **RB2.** ✅ Rebuys zählen als Einkauf in der Bilanz (Kap. 9.1). Bierrunde zählt weiter nur Chips. *Bis 16.10.2026 wurden Rebuys nirgends gezählt.*
- **RB3.** ⚠️ Bleibt nach einer Hand nur noch ein Spieler alive, geht es sofort in den Endbildschirm, ohne Rebuy-Möglichkeit (siehe Z7).

### 8.4 Spieler mitten im Spiel hinzufügen

- **AD1.** Eingabe: Name und Buy-in. Der Buy-in ist beim Öffnen der Verwaltung mit den Start-Chips vorbelegt, frei änderbar, Minimum 1. Hinzufügen ist nur mit nicht-leerem Namen und nur möglich, solange weniger als 9 Spieler alive sind (Pausierte zählen mit, ausgeschiedene und entfernte nicht).
- **AD2.** 🔧 Der neue Spieler wird **am Ende** der Sitzreihenfolge angehängt, bekommt die höchste bisherige `id` + 1 und wird mit `folded` = true und `acted` = true angelegt. Er sitzt damit die laufende Hand aus und stört weder Pot noch Setzrunde.
- **AD3.** Er spielt ab der nächsten Hand mit. Es gibt keinen Einstiegs-Blind: Er zahlt Blinds erst, wenn ihn die Position trifft.
- **AD4.** Dealer- und Blind-Positionen ändern sich durch das Hinzufügen nicht, weil Anhängen keine Plätze verschiebt. Der Neue kommt erst in der Rotation vor, wenn der Button oder ein Suchlauf seinen Platz erreicht.
- **AD5.** Hinzufügen ist per Undo zurücknehmbar. Es erscheint im Bildschirm `play` ein Hinweis „<Name> spielt ab der nächsten Hand mit (<Chips> Chips)."

### 8.5 Reihenfolge ändern (↑/↓)

- **O1.** Die Reihenfolge in der Verwaltung ist die Sitzreihenfolge. ↑/↓ **tauscht** den Spieler mit dem nächsten nicht entfernten Nachbarn. Es wird getauscht, nicht eingefügt. Auch ausgeschiedene und pausierte Spieler stehen in der Liste und lassen sich verschieben.
- **O2.** 🔧 Nach dem Tausch werden Dealer und aktueller Spieler über ihre `id` neu gefunden. Beide bleiben bei ihrer Person, auch wenn sich deren Platz ändert.
- **O3.** Mitten in der Hand bleiben Einsätze, Blinds und Status bei der jeweiligen Person. Geändert wird nur, **wer danach nach wem dran ist** und wer postflop beginnt. Die Pot-Berechtigten laufen über die `id` und sind nicht betroffen. Für die **nächste** Hand entstehen Dealer, SB und BB aus der neuen Reihenfolge.
- **O4.** ⚠️ Umsortieren ist **nicht** per Undo zurücknehmbar. Ein späteres Undo setzt die Reihenfolge aber auf den Stand des wiederhergestellten Snapshots zurück (UN6).

---

## 9. Spielende, Bilanz und Abrechnung

- **G1.** Das Spiel endet nach einer Hand, wenn weniger als 2 Spieler alive sind (weder `out` noch `gone`, Pausierte zählen mit). ✅ Zusätzlich kann der Abend im Bildschirm `handEnd` jederzeit mit „Abend beenden“ beendet werden (zwei Taps wie All-In).
- **G2.** ✅ Der Endbildschirm nennt als Sieger den Spieler mit dem **besten Ergebnis** (Kap. 9.1), mit Ergebnis in € und Chips, und zeigt Konfetti. *Bis 16.10.2026: erster alive Spieler in Listenreihenfolge mit seinem Stack.*
- **G3.** ✅ Die **Endbilanz** enthält **alle** Spieler der Session, auch wer den Tisch verlassen hat oder später dazukam, sortiert nach Ergebnis absteigend, bei Gleichstand Sitzreihenfolge. Die ersten drei bekommen 🥇🥈🥉. Pro Spieler: Ergebnis in € (+/−), Endstand und Einkauf in Chips. *Bis 16.10.2026: Rangliste nach Chips ohne entfernte Spieler.*
- **G4.** „Neues Spiel" führt zurück ins Setup. Die zuletzt eingegebenen Namen sind dort vorbelegt.
- **G5.** ✅ „Abrechnen“ führt in eine eigene Ansicht mit den Überweisungen („Ben → Anna 12,50 €“), von dort „Zurück zur Bilanz“ oder „Neues Spiel“.

### 9.1 Bilanz und Abrechnung (seit 16.10.2026)

- **BI1.** Pro Spieler wird der **Einkauf** in Chips mitgeführt: Start-Chips, jeder Rebuy (+ Start-Chips), beim späteren Dazukommen der eigene Buy-in.
- **BI2.** **Endstand** ist der Stack am Ende bzw. beim Verlassen des Tisches. Was ein Spieler in der laufenden Hand schon gesetzt hatte, bleibt im Pot.
- **BI3.** **Ergebnis** = Endstand − Einkauf. Nach Handende ist die Summe aller Ergebnisse immer 0.
- **BI4.** Umrechnung in €: Ergebnis × Buy-in-€ / Start-Chips, in Cent gerundet. Die Rundung verteilt Restcents an die größten Nachkommareste, sodass die Summe exakt 0,00 € bleibt.
- **BI5.** **Netting:** Der größte Schuldner überweist an den größten Gläubiger, so viel, bis einer von beiden quitt ist, dann der nächste. Das ergibt höchstens (Beteiligte − 1) Überweisungen. Sind alle quitt, zeigt die Ansicht „Alle sind quitt“.
- **BI6.** Alte Speicherstände ohne Einkauf zählen nur die Start-Chips als Einkauf, ohne Buy-in-€ gilt 10 €.

---

## 10. Undo und Speicherstand

### 10.1 Undo

- **UN1.** Vor jeder undo-fähigen Aktion wird ein Snapshot des **gesamten Spielzustands** abgelegt. Er enthält: Bildschirm, komplette Spielerliste mit allen Feldern und Reihenfolge, Dealer, Phase, aktueller Spieler, offener Einsatz, Mindest-Zuwachs, Handnummer, Hinweistext, Runout-Flag, Pots, aktueller Pot-Index, Gewinnerauswahl, Ergebnistext sowie die Setup-Werte (Namen, Start-Chips, SB, Bierrunde, Blind-Steigerung).
- **UN2.** Undo-fähig (legen einen Snapshot **vor** der Aktion an) sind genau sechs Aktionen: jede Spieleraktion (Fold, Check, Call, Raise, All-In), die Vergabe eines Pots, „Nächste Hand", Spieler hinzufügen, Spieler entfernen und Rebuy.
- **UN3.** 🔧 **Nicht** undo-fähig (kein Snapshot): Pause/Fortsetzen, Anfängermodus umschalten, Reihenfolge ändern.
- **UN4.** Ein Undo-Schritt macht eine Aktion samt **allen Folgen** rückgängig. Beispiele: Der Fold, der die Hand beendet hat, führt zurück in den Bildschirm `play` vor dem Fold. Die Aktion, die eine Phase abschloss, führt zurück in die vorherige Phase mit demselben Spieler am Zug. „Nächste Hand" führt zurück in den Hand-Ende-Bildschirm. Ein Pot-Schritt führt zurück zum Showdown-Bildschirm mit diesem Pot, die ursprünglich gewählten Gewinner sind wieder vorausgewählt, die Bestätigung muss neu erfolgen.
- **UN5.** Tiefe: höchstens 20 Schritte im Arbeitsspeicher. Es gibt kein Redo.
- **UN6.** ⚠️ Beim Wiederherstellen wird das **komplette** Spielerarray aus dem Snapshot gesetzt. Änderungen, die nach dem Snapshot gemacht wurden und nicht undo-fähig sind (UN3), gehen dabei verloren.
- **UN7.** 🔧 Beim Wiederherstellen werden flüchtige Zustände zurückgesetzt: Raise-Fenster geschlossen, Ansage weg, All-In-Sperre gelöscht, Pot-Bestätigung gelöscht.
- **UN8.** Der Undo-Knopf existiert nur in den Bildschirmen `play`, `showdown` und `handEnd`. Im Endbildschirm gibt es kein Undo.
- **UN9.** Ein neues Spiel leert den Verlauf.

### 10.2 Speicherstand

- **SP1.** Sobald der Bildschirm nicht `start` oder `setup` ist, wird bei jeder Änderung von Spielern, Bildschirm, aktuellem Spieler, Phase, offenem Einsatz, Pot-Index, Gewinnerauswahl oder Ergebnistext der Snapshot gespeichert, zusammen mit den **letzten 8** Undo-Schritten.
- **SP2.** Beim Start sucht die App einen Speicherstand. „Alte Session fortsetzen" ist nur aktiv, wenn einer existiert und nicht in `start`/`setup` steht. Die Anzeige „Hand #N, k Spieler" zählt alle nicht ausgeschiedenen Spieler, auch pausierte und entfernte.
- **SP3.** Das Fortsetzen stellt den gespeicherten Zustand und die gespeicherten Undo-Schritte wieder her, mit den Rücksetzungen aus UN7.
- **SP4.** 🔧 Beim Wiederherstellen wird die Blind-Steigerung als 0 gelesen, wenn der Speicherstand sie nicht enthält (alte Speicherstände ohne dieses Feld). Fehlende Spielerfelder `away`, `gone`, `noob` zählen als „aus". Auch der Endbildschirm wird gespeichert: „Alte Session fortsetzen" zeigt dann wieder den Endbildschirm.

---

## 11. Bierrunde

- **BR1.** Die Bierrunde erscheint nur im Bildschirm `handEnd`, wenn die Handnummer ein Vielfaches von X ist (X > 0, Setup „Bierrunde alle X Hände"). Bei X = 0 gibt es sie nicht.
- **BR2.** Es holt der Spieler mit den **meisten Chips** unter den alive Spielern (Pausierte zählen mit, ausgeschiedene und entfernte nicht). Bei Gleichstand der erste in Sitzreihenfolge. Anzeige: „<Name> führt mit <Chips> Chips – und holt die Runde."
- **BR3.** Es gibt keine Chip-Wirkung. Die Bierrunde ist reine Anzeige.
- **BR4.** Der Bierholer wird bei jeder Darstellung des Bildschirms neu aus den aktuellen Stacks berechnet und nicht gespeichert. Rebuy, Hinzufügen, Entfernen oder Undo im Hand-Ende-Bildschirm können ihn daher verändern. Nach der letzten Hand eines Spiels (Endbildschirm) gibt es keine Bierrunde.

---

## 12. Sonderbehandlungen auf einen Blick (🔧)

Die Stellen, die nach Bugfix aussehen. Beim Nachbau jede einzeln testen:

| # | Stelle | Siehe |
|---|---|---|
| 1 | Blinds posten mit `min(Blind, Stack)`, all-in bei komplettem Stack | H7 |
| 2 | Offener Einsatz ist die volle BB, auch bei zu kurzem BB-Spieler | H8 |
| 3 | Heads-up: Dealer = SB, Dealer zuerst Pre-Flop, Nicht-Dealer zuerst Postflop | HU2, HU3 |
| 4 | Heads-up-Erkennung zählt nur aktive Spieler | HU1 |
| 5 | Dealer-Weiterschiebung, wenn der Dealer inaktiv wäre | H4 |
| 6 | Raise-Ziel auf Stack gekappt | AK1 |
| 7 | All-In unter dem Call-Betrag wirkt wie Call, kein Neu-Öffnen | AK4 |
| 8 | Fold-Win wird vor der Rundenende-Prüfung geprüft, Gewinner bekommt alles | E1 |
| 9 | Runout, wenn höchstens ein Spieler handlungsfähig ist | E3 |
| 10 | Phasenwechsel: `acted` = true für gefoldete/all-in/out/entfernte | E4 |
| 11 | Pots mit identischer Berechtigtenliste werden zusammengelegt | P4 |
| 12 | Nicht gecallter Überschuss als Pot mit einem Berechtigten, manuell zu vergeben | P6 |
| 13 | Änderung der Gewinnerauswahl nimmt die Bestätigung zurück | SD2 |
| 14 | Stack 0 am Handende → `out` | SD6 |
| 15 | Neuer Spieler mit `folded` = true / `acted` = true, ans Ende angehängt | AD2 |
| 16 | Entfernen mitten in der Hand: Flag + gemeinsame Rundenende-Prüfung, Suchlauf ab aktuellem Platz | X3 |
| 17 | Umsortieren: Dealer und aktueller Spieler über `id` neu finden | O2 |
| 18 | Pause/Anfängermodus/Umsortieren nicht undo-fähig | UN3 |
| 19 | Flüchtige Zustände beim Wiederherstellen zurücksetzen | UN7 |
| 20 | Blind-Steigerung als 0 lesen bei alten Speicherständen | SP4 |
| 21 | All-In mit zwei Taps | U1 |
| 22 | Doppel-Tipp-Check mit allen Schutzbedingungen | U2 |

---

## 13. Zu klären

Hier ist der Code mehrdeutig, lückenhaft oder verhält sich anders als üblich. Ich habe nichts geraten: Zu jedem Punkt steht, was der Code tut und was ich nicht weiß.

**Z1. Kurzes All-In-Raise öffnet die Runde neu** (`applyAction`, Z. 306–312)
Jedes Raise mit Ziel über dem offenen Einsatz setzt `acted` = false für alle anderen, auch wenn der Zuwachs kleiner als der Mindest-Zuwachs ist (nur per All-In möglich). Üblich ist, dass ein solches unvollständiges Raise die Runde für Spieler, die schon gehandelt haben, nicht neu öffnet. Unklar: Hausregel oder Zufall? Ich habe die Code-Variante dokumentiert (AK3, M6).
✅ **Entschieden und umgesetzt 16.10.2026:** Standard-Pokerregel, siehe AK3, M6 und architektur.md.

**Z2. Reihenfolge der Restchips** (`awardPot`, Z. 380–386)
Die Restchips gehen an die Gewinner in der Reihenfolge, in der sie angetippt wurden. Üblich wäre der Spieler links vom Dealer. Unklar: gewollt? Im Multiplayer gibt es keine Antippreihenfolge, der Nachbau braucht dafür eine definierte Regel.
✅ **Entschieden und umgesetzt 16.10.2026:** erster Gewinner links vom Dealer, siehe SD3.

**Z3. Niemand am Zug beim Handstart** (`beginHand`, Z. 279)
Aus dem Code abgeleitet, nicht ausprobiert: Posten beide Heads-up-Spieler mit ihren Blinds den ganzen Stack (beide Stacks ≤ ihre Blinds), ist niemand handlungsfähig. Der aktuelle Spieler wird −1, der Spielbildschirm rendert nichts. Weil Undo, Verwaltung und alle Aktionen im selben Block stehen, gibt es auch keinen Undo-Knopf, und der Speicherstand zeigt wieder dasselbe. Es gibt keinen Pfad in den Showdown. Frage: Soll in diesem Fall direkt der Showdown mit Runout folgen?
✅ **Entschieden und umgesetzt 16.10.2026:** direkt Showdown mit Runout, siehe HU6. Im Zufallstest vor der Änderung tatsächlich aufgetreten (kleine Stacks, steigende Blinds).

**Z4. Pot ohne Berechtigte** (`computePots`, Z. 351–364)
Mit der echten Funktion nachgerechnet: A 100 (entfernt), B 50 (all-in), C 50 (all-in) ergibt Pot 1 = 150 (B, C) und Pot 2 = 50 mit leerer Berechtigtenliste. Der Showdown ist dann nicht abschließbar (kein wählbarer Gewinner), nur Undo hilft. Entsteht nur, wenn der Spieler mit dem höchsten Einsatz entfernt wird. Frage: Wohin soll dieser Betrag gehen?
✅ **Entschieden und umgesetzt 16.10.2026:** Betrag geht in den letzten Pot mit Berechtigten, siehe P8. Im Zufallstest vor der Änderung tatsächlich aufgetreten.

**Z5. Pause mitten in der Hand und Endlosschleife** (`nextAliveIdx`, Z. 240–244)
(a) Pause wird erst beim nächsten Handstart ausgewertet. Aber `away` fließt schon in den Suchlauf „nächster aktiver Spieler" ein, der beim Phasenwechsel den Startpunkt bestimmt. Ein mitten in der Hand pausierter Spieler, der noch in der Hand ist, wird dadurch als Startpunkt übersprungen und kommt Postflop eventuell als Letzter statt als Erster dran. Sonst spielt er die Hand normal weiter. (b) `nextAliveIdx` hat keine Abbruchbedingung. Sind alle Spieler `out`/`away`/`gone`, läuft die Schleife endlos und die App hängt. Das ist nur über Pause mitten in der Hand erreichbar, z. B. wenn beide Heads-up-Spieler pausieren und die Setzrunde endet. Frage: Soll Pause mitten in der Hand erlaubt sein, und was soll dann passieren (sofort folden oder erst nach der Hand)?
✅ **Entschieden und umgesetzt 16.10.2026:** Pause wirkt ab der nächsten Hand (V4, T5). Der Suchlauf bricht nach einer Runde ab; ohne 2 aktive Spieler startet keine Hand.

**Z6. Entfernen im Hand-Ende-Bildschirm** (`removePlayer`, Z. 428–430)
Bleiben danach weniger als 2 alive, wechselt das Spiel nicht in den Endbildschirm. „Nächste Hand" ist deaktiviert, und der Hinweis sagt „Pause aufheben", obwohl das Problem entfernte Spieler sind. Weiter geht es nur mit Hinzufügen oder Undo. Außerdem verschwindet der Stack des Entfernten aus dem Spiel. Frage: Beides gewollt?

**Z7. Rebuy-Fenster** (`endHand`, Z. 399; `rebuy`, Z. 455–458)
Rebuy gibt es nur im Hand-Ende-Bildschirm und nur, wenn danach noch mindestens 2 alive sind. Scheidet der vorletzte Spieler aus, endet das Spiel sofort ohne Rebuy-Möglichkeit. Der Rebuy-Betrag ist fest die Start-Chips (beim Hinzufügen ist der Betrag einstellbar). Rebuys werden nirgends gezählt. Frage: So beabsichtigt, besonders das sofortige Spielende im Heads-up?

**Z8. Pot-Schnellwahl** (`potBet`, Z. 463–469)
½ Pot, ⅔ Pot und Pot rechnen `Anteil × aktueller Pot (vor dem eigenen Call)`, runden auf ein Vielfaches des Small Blinds und nehmen das Ergebnis als Gesamtziel. Üblich ist bei „Pot-Size-Raise" Pot plus Call-Betrag. Frage: Absicht? Wichtig, damit die Formel beim Nachbau nicht still „korrigiert" wird.

**Z9. Zahleneingaben im Setup** (Z. 563–571)
Leeres Feld ergibt 1 (Start-Chips, SB) bzw. 0 (Bierrunde, Blind-Steigerung). Nachkommazahlen werden akzeptiert (SB 2,5 ergäbe Blinds 2,5/5). Es gibt keine Prüfung, ob Start-Chips zu den Blinds passen. Frage: Welche Grenzen sollen im Nachbau gelten?

**Z10. All-In-Sperre bleibt beim Zugwechsel durch Entfernen hängen** (`removePlayer`, Z. 422–431)
Die Sperre wird nur bei Aktion und Undo gelöscht. Tippt der Spieler am Zug auf All-In (Sperre scharf) und wird dann über die Verwaltung entfernt, sieht der nächste Spieler den roten Knopf „Wirklich ALLES?" und löst mit einem einzigen Tap aus. Aus dem Code abgeleitet, nicht ausprobiert. Reine Oberflächenfrage, im Multiplayer vermutlich erledigt.
