# Pokerkasten Multiplayer — Architektur

## Ziel
Dezentraler Multiplayer: Jeder Spieler am eigenen Handy. Ein Server
hält den Spielzustand, alle Geräte zeigen ihn an und senden Aktionen.

## Grundprinzip
Der Server ist die einzige Wahrheit. Clients rechnen nichts selbst aus,
sie senden Aktionen und zeigen an, was zurückkommt.
Grund: sonst laufen Stacks und Pot auseinander, sobald jemand
Verbindung verliert oder zwei Leute gleichzeitig tippen.

## Datenmodell

Angelegt am 16.10.2026, maßgeblich sind die Dateien in
`supabase/migrations/` (in Reihenfolge des Datums ausgeführt).

```
sessions
  id, code (4-stellig), status, created_at
  state (jsonb) — { settings, game, clock }
                  settings: Regeln des Admins (Kurs, mit/ohne Geld, Blinds …)
                  game: Spielzustand des Rechenkerns, jeder Spieler trägt
                        uid = players.id (fehlt noch in der Lobby)
                  clock: vom Admin gestartete Uhr { uid, handNum, until }
  current_player_id
  version — steigt bei jeder Änderung; geschrieben wird nur, wenn sich
            seit dem Lesen nichts geändert hat (gleichzeitiges Tippen)
  history (jsonb) — Undo-Verlauf, höchstens 20 Spielstände

players
  id, session_id, name, chips, seat, is_host (= Admin, mehrere möglich),
  last_seen, buy_in (in der Lobby gewählt: € bzw. Chips ohne Geld)

actions
  id, session_id, player_id, type, amount, created_at
  (geplant als Log aller Aktionen; wird derzeit nicht beschrieben –
  Undo läuft über sessions.history)

player_secrets
  player_id, token_hash — für Handys unsichtbar, nur Edge Functions
```

Chips sind ganze Zahlen (beantwortet Z9 teilweise: keine Nachkommazahlen).
Wer den 4-stelligen Code kennt, kann einen Tisch ansehen, aber nichts tun.

## Wo die Logik läuft
Supabase Edge Functions (JavaScript). Handys lesen die Tabellen direkt
und bekommen Änderungen per Realtime. Schreiben dürfen sie nichts
(Row Level Security), jede Aktion geht an eine Edge Function.
- `lobby`: Tisch erstellen, beitreten (auch ins laufende Spiel),
  zurückkommen, verlassen (nur Lobby), Regeln und eigenen Buy-in setzen
- `game`: Start, Züge, Showdown, nächste Hand, Undo, Pause, Rebuy,
  Verlassen, Reihenfolge, Admins, Uhr, Abend beenden
- `_shared/`: Rechenkern (`engine.js`, auch von der App benutzt),
  Einstellungen und Buy-in-Umrechnung (`settings.js`), Token-Prüfung
  und Schreiben mit Versionsschutz (`server.js`)

## Wer darf was
Ziel: Die Admins sollen den Spielfluss nicht aufhalten (Entscheidung 16.10.2026).
- Jeder am Tisch: eigener Zug (nur wenn am Zug), Gewinner im Showdown
  wählen, nächste Hand starten, sich selbst pausieren, eigener Rebuy
  (Betrag frei), eigener Buy-in in der Lobby, Dumpfbacken-Modus,
  Tisch verlassen
- Admins zusätzlich: Regeln einstellen und Spiel starten, Undo
  (20 Schritte), Abend beenden, andere pausieren/entfernen,
  Reihenfolge ändern, Admins ernennen/abwählen, Uhr starten/stoppen
- Mehrere Admins: zum Start automatisch zwei, mindestens einer bleibt.
  Pausiert der letzte aktive Admin oder verlässt er den Tisch, wird der
  nächste aktive Spieler zusätzlich Admin.
- Tippen zwei gleichzeitig denselben Knopf (Pot vergeben, nächste Hand),
  zählt nur der erste – der Server vergleicht Hand-Nummer und Pot.
- Pots, um die nur noch einer spielt (nicht gecallte Chips), gehen ohne
  Tippen an ihn zurück. Der Ergebnistext nennt den Gewinner des letzten
  umkämpften Pots.
- Uhr: Läuft sie ab, melden das alle Handys; der Server prüft die Zeit
  selbst und führt Check (wenn gratis) bzw. Fold genau einmal aus.
- Server prüft alles. Client-Buttons ausblenden reicht nicht.

## Regelentscheidungen für den Umbau
Beziehen sich auf die Z-Punkte in docs/spielregeln.md. Alle fünf
weichen bewusst vom aktuellen Artefakt-Verhalten ab.
Umgesetzt am 16.10.2026 in `supabase/functions/_shared/engine.js`,
gültig für Einzel-Handy und Online-Tisch.

**Z1 — kurzes All-In-Raise (ÄNDERUNG gegenüber Artefakt)**
Ein Raise, dessen Zuwachs unter dem Mindest-Zuwachs liegt (nur per
All-In möglich), öffnet die Setzrunde NICHT neu. Spieler, die bereits
gehandelt und den vorherigen offenen Einsatz erreicht haben, dürfen
nur noch callen oder folden, nicht erneut erhöhen.
Der offene Einsatz steigt trotzdem auf das All-In-Ziel, der
Mindest-Zuwachs bleibt unverändert.
Betrifft AK3 und M6. Standard-Pokerregel.

**Z2 — Restchips bei Split**
Der erste Gewinner links vom Dealer bekommt den ersten Restchip,
dann im Uhrzeigersinn. Ersetzt die Antippreihenfolge aus SD3, die
es im Multiplayer nicht gibt. Deterministisch und serverseitig
reproduzierbar.

**Z3 — niemand am Zug beim Handstart**
Findet der Suchlauf nach dem Posten der Blinds keinen handlungsfähigen
Spieler, geht es direkt in den Showdown (Runout), statt in `play`.
Gleiche Behandlung wie E3.

**Z4 — Pot ohne Berechtigte**
Entsteht durch Entfernen des Spielers mit dem höchsten Einsatz ein Pot
ohne Berechtigte, wird sein Betrag dem letzten Pot zugeschlagen, der
Berechtigte hat. Keine Rückerstattung — der Spieler ist weg, das Geld
ist im Spiel.

**Z5 — Pause mitten in der Hand**
Pause wirkt erst ab der nächsten Hand. Der Knopf zeigt während einer
laufenden Hand "pausiert ab nächster Hand". Zusätzlich bekommt der
Suchlauf eine Abbruchbedingung (einmal rum, dann kein Treffer) —
im Server darf keine Schleife unbegrenzt laufen.

## Serverseitige Validierung (AK5)
Der Rechenkern des Artefakts prüft NICHT, ob eine Aktion erlaubt ist.
Das macht allein die Oberfläche. Im Multiplayer muss der Server jede
Bedingung aus Kapitel 3.1 der spielregeln.md selbst prüfen:
ist der Spieler am Zug, ist die Aktion in dieser Situation zulässig,
erreicht ein Raise das Mindest-Ziel, deckt der Stack den Betrag.
Ein Client-Bug erzeugt sonst denselben Schaden wie ein Angriff.
Umgesetzt: `validateAction` im Rechenkern, aufgerufen von der Edge
Function `game` vor jedem Zug (16.10.2026).

## Offene Entscheidungen
- [x] Wie kommt ein Spieler nach Verbindungsabbruch zurück?
      → Token im localStorage, Hash in `player_secrets` (16.10.2026)
- [x] Was passiert, wenn der Host die App schließt?
      → mehrere Admins, zum Start automatisch zwei (16.10.2026)
- [x] Undo: nur Admins, bis zu 20 Schritte wie bisher
      (spielregeln.md UN2) — entschieden 16.10.2026
- [x] Timeout, wenn jemand nicht reagiert?
      → kein automatisches Timeout; Admin startet bei Bedarf eine
      30-s-Uhr (16.10.2026)
- [ ] Reicht Realtime-Broadcast oder Polling als Fallback?
- [x] Z10 (All-In-Sperre bleibt hängen): online erledigt, die Sperre
      wird bei jedem neuen Stand zurückgesetzt (spielregeln.md ON11)

## Nicht in Scope (Phase 1)
Konten, Statistiken über Sessions hinweg, Echtgeld, mehrere
parallele Tische, Kartenverwaltung. Karten bleiben physisch.
