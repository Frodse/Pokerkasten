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

Angelegt am 16.10.2026, maßgeblich ist
`supabase/migrations/20261016000000_tabellen_anlegen.sql`.

```
sessions
  id, code (4-stellig), status, created_at
  state (jsonb) — { settings, game }: Einstellungen + Spielzustand des
                  Rechenkerns, jeder Spieler trägt uid = players.id
  current_player_id
  version — steigt bei jeder Änderung; geschrieben wird nur, wenn sich
            seit dem Lesen nichts geändert hat (gleichzeitiges Tippen)
  history (jsonb) — Undo-Verlauf, höchstens 20 Spielstände

players
  id, session_id, name, chips, seat, is_host, last_seen

actions
  id, session_id, player_id, type, amount, created_at
  (Log aller Aktionen — Basis für Undo und Nachvollziehbarkeit)

player_secrets
  player_id, token_hash — für Handys unsichtbar, nur Edge Functions
```

Chips sind ganze Zahlen (beantwortet Z9 teilweise: keine Nachkommazahlen).
Wer den 4-stelligen Code kennt, kann einen Tisch ansehen, aber nichts tun.

## Wo die Logik läuft
Supabase Edge Functions (JavaScript). Handys lesen die Tabellen direkt
und bekommen Änderungen per Realtime. Schreiben dürfen sie nichts
(Row Level Security), jede Aktion geht an eine Edge Function.

## Wer darf was
- Host: Spiel starten, Spieler entfernen, Undo, Blinds anpassen
- Spieler: nur die eigene Aktion, nur wenn er am Zug ist
- Server prüft beides. Client-Buttons ausgrauen reicht nicht.

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
- [ ] Was passiert, wenn der Host die App schließt?
      (Verlässt der Host den Tisch, wird der nächste Spieler Host.
      Nur App zu, ohne Verlassen: noch offen.)
- [x] Undo: nur der Host, bis zu 20 Schritte wie bisher
      (spielregeln.md UN2) — entschieden 16.10.2026
- [ ] Timeout, wenn jemand nicht reagiert — oder gar keiner?
- [ ] Reicht Realtime-Broadcast oder Polling als Fallback?
- [ ] Z10 (All-In-Sperre bleibt hängen): im Multiplayer vermutlich
      erledigt, weil jeder seinen eigenen Knopf hat — prüfen

## Nicht in Scope (Phase 1)
Konten, Statistiken über Sessions hinweg, Echtgeld, mehrere
parallele Tische, Kartenverwaltung. Karten bleiben physisch.
