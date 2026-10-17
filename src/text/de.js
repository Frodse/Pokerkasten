/* Alle Texte der Oberfläche (docs/design.md, Kap. 7). Keine Texte direkt in
   Komponenten. Ton: kurz, freundlich, trocken, familientauglich, ohne Emojis.

   standard  – übliche Poker-Begriffe
   beginner  – Anfängermodus (Feld `noob`), überschreibt nur Beschriftungen
   common    – alles, was in beiden Modi gleich ist

   Texte aus dem Rechenkern (Hinweise, Ansagen, Ergebnistexte) und Fehler
   vom Server kommen unverändert von dort. */

const nf = new Intl.NumberFormat("de-DE");
export const num = (n) => nf.format(n);

export const standard = {
  fold: "Fold",
  check: "Check",
  call: (amt, allIn) => `Call ${num(amt)}${allIn ? " (All-In)" : ""}`,
  raise: "Raise",
  allIn: (amt) => `All-In ${num(amt)}`,
  allInConfirm: (amt) => `Wirklich All-In (${num(amt)})? Nochmal tippen`,
  raiseLabel: "Raise auf (gesamt diese Runde)",
  raiseConfirm: (amt) => `Raise auf ${num(amt)}`,
  toCall: (amt) => `${num(amt)} zum Callen`,
};

export const beginner = {
  fold: "Aufgeben",
  check: "Schieben (gratis)",
  call: (amt, allIn) => `Mitgehen – zahle ${num(amt)}${allIn ? " (alles!)" : ""}`,
  raise: "Mehr setzen",
  allIn: (amt) => `Alles rein (${num(amt)})`,
  allInConfirm: standard.allInConfirm,
  raiseLabel: "Auf wie viel willst du insgesamt erhöhen?",
  raiseConfirm: (amt) => `Setzen: ${num(amt)}`,
  toCall: (amt) => `${num(amt)} zum Mitgehen`,
  explainBet: (amt) => `Jemand hat gesetzt. Willst du dabei bleiben, musst du ${num(amt)} zahlen. Sonst: Karten weglegen (kostet nichts mehr) – oder selbst erhöhen.`,
  explainFree: "Niemand hat gesetzt. Du kannst gratis schieben und die nächste Karte sehen – oder selbst Chips setzen.",
  raiseExplain: "Die Zahl ist dein Gesamteinsatz in dieser Setzrunde – nicht was du zusätzlich drauflegst.",
};

// Beschriftungen je nach Modus der Person, die gerade handelt
export const labels = (noob) => (noob ? beginner : standard);

export const common = {
  appName: "pokerkasten",
  close: "Schließen",
  back: "Zurück",
  confirm: "Bestätigen",
  busy: "Moment …",
  cancel: "Abbrechen",
  noConnection: "Keine Verbindung zum Server. Bitte nochmal versuchen.",

  // Startseite und lokales Menü
  join: "Beitreten",
  tableCode: "Tisch-Code",
  yourName: "Dein Name",
  namePlaceholder: "Name",
  noTableWithCode: "Kein laufender Tisch mit diesem Code.",
  joinRunning: "Hier läuft schon ein Spiel – du spielst ab der nächsten Hand mit.",
  createOnline: "Online-Tisch erstellen",
  playLocal: "Lokal spielen (ein Handy für alle)",
  backToTable: "Zurück an deinen Tisch",
  localTitle: "Ein Handy für alle",
  savedFound: (hand, n) => `Gespeicherte Session gefunden – Hand #${hand}, ${n} Spieler.`,
  savedNone: "Keine alte Session vorhanden.",
  savedSearching: "Suche gespeicherte Session …",
  resumeSession: "Alte Session fortsetzen",
  newSession: "Neue Session",
  backToStart: "Zurück zur Startseite",

  // Online-Tisch: Erstellen, Laden
  createTitle: "Online-Tisch erstellen",
  createHint: "Jeder spielt am eigenen Handy. Du bekommst einen Code, den du den anderen sagst.",
  createButton: "Tisch erstellen",
  notConfigured: "Der Online-Tisch ist auf diesem Gerät noch nicht eingerichtet.",
  connecting: "Verbinde mit deinem Tisch …",
  connectFailed: "Verbindung fehlgeschlagen",
  retry: "Nochmal versuchen",
  toStart: "Zur Startseite",

  // Lobby
  codeHint: "Sag den Code den anderen – sie tippen ihn auf der Startseite unter „Beitreten“ ein.",
  atTable: (n) => `Am Tisch · ${n} von 9`,
  rules: "Regeln",
  withMoney: "Mit Geld",
  withoutMoney: "Ohne Geld",
  rateEuro: "Kurs: €",
  rateChips: "= Chips",
  suggestChips: "Vorschlag Start-Chips",
  startChips: "Start-Chips",
  smallBlind: "Small Blind",
  drinksEvery: "Getränkerunde alle … Hände (0 = aus)",
  blindsUpEvery: "Blinds ×2 alle … Hände (0 = aus)",
  buyInEuroLabel: "Buy-in in € (für die Start-Chips)",
  bigBlindHint: (bb) => `Big Blind = ${num(bb)}. Wer die meisten Chips hat, holt die Getränkerunde.`,
  moneyHint: "Jeder tippt seinen Buy-in in € ein, der Kurs rechnet ihn in Chips um.",
  noMoneyHint: "Jeder tippt seine Start-Chips ein, am Ende gibt es keine Abrechnung in €.",
  lobbyRate: (euro, chips) => `Kurs: ${euro} € = ${num(chips)} Chips`,
  lobbyNoMoney: "Ohne Geld – nur Chips",
  lobbyBlinds: (sb) => `Blinds ${num(sb)}/${num(sb * 2)}`,
  waitForAdmin: "Warte, bis ein Admin das Spiel startet …",
  waitForPlayers: "Warte auf Mitspieler …",
  startGame: (n) => `Spiel starten (${n} Spieler)`,
  toStartKeepSeat: "Zur Startseite (dein Platz bleibt)",
  leaveTable: "Tisch verlassen",
  leaveTableConfirm: "Wirklich verlassen? Nochmal tippen",

  // Buy-in
  yourBuyIn: "Dein Buy-in",
  rebuyLabel: "Rebuy",
  inEuro: "in €",
  inChips: "in Chips",
  buyInChips: (chips, euro, rateChips) => `= ${num(chips)} Chips (Kurs ${euro} € = ${num(rateChips)} Chips)`,
  buyInNoMoney: "Es wird ohne Geld gespielt – nur Chips.",
  buyInEuroShort: (euro) => `${euro} €`,
  buyInChipsShort: (chips) => `${num(chips)} Chips`,

  // Setup (Einzel-Handy)
  players: "Spieler",
  playerPlaceholder: (i) => `Spieler ${i}`,
  addPlayerRow: "+ Spieler",
  remove: "Entfernen",
  beginner: "Anfänger",
  beginnerHint: "Anfänger – erklärt die Knöpfe in einfacher Sprache, nur wenn diese Person dran ist.",
  startRound: "Runde starten",

  // Spieltisch
  playersButton: "Spieler",
  undo: "Rückgängig",
  hands: "Hände",
  pot: "Pot",
  mainPot: "Main Pot",
  sidePot: (i) => `Side Pot ${i}`,
  headLine: (hand, sb, bb, dealer) => `Hand ${hand} · Blinds ${num(sb)}/${num(bb)} · Dealer ${dealer}`,
  blindsRiseIn: (n) => ` · steigen in ${n}`,
  phoneTo: (name) => `Handy an ${name}`,
  yourTurn: "Du bist dran.",
  isTurn: (name) => `${name} ist dran.`,
  noBet: "Kein Einsatz offen",
  doubleTapHint: "Doppel-Tipp auf den Hintergrund = Check",
  doubleTapNotice: (name) => `${name} checkt (Doppel-Tipp)`,
  shortAllInHint: "Kurzes All-In vor dir: nur Call oder Fold.",
  pauseHint: "Pause = setzt ab der nächsten Hand aus",
  pause: "Pause",
  resume: "Fortsetzen",
  lieDown: "Leg das Handy ruhig hin. Es meldet sich, wenn du dran bist.",
  quick: { min: "Min", half: "½ Pot", twoThirds: "⅔ Pot", pot: "Pot", max: "Max" },
  bets: (amt) => `setzt ${num(amt)}`,
  spectator: "Du hast den Tisch verlassen und schaust nur noch zu. Dein Stack zählt in der Bilanz.",
  yourChips: "Deine Chips",
  yourFinal: "Dein Endstand",
  yourBet: (amt) => `${num(amt)} gesetzt`,

  // Uhr (online, Admin)
  clockStart: (who) => `Uhr starten (30 s) für ${who}`,
  clockYou: "dich",
  clockStop: "Uhr stoppen",
  clockSeconds: (s) => `${s} s`,
  clockThen: (fold, mine, name) => `Danach ${fold ? "Fold" : "Check"} – außer ${mine ? "du tippst" : `${name} tippt`} vorher.`,

  // Badges
  badge: {
    dealer: "Dealer", allIn: "All-In", pause: "Pause", pauseNext: "Pause ab nächster Hand", fold: "Fold",
    out: "Raus", you: "Du", admin: "Admin", beginner: "Anfänger", left: "Verlassen", inHand: "In der Hand", ready: "Bereit",
  },

  // Ansage
  tapToContinue: "Tippen zum Weiterspielen",

  // Showdown
  runout: "Alle All-In / nur einer kann noch setzen → Dealer deckt die restlichen Karten auf.",
  compareCards: "Karten vergleichen – wer gewinnt diesen Pot? (Split: mehrere antippen)",
  compareCardsOnline: "Karten vergleichen – wer gewinnt diesen Pot? (Split: mehrere antippen). Wer noch Karten hat, bestätigt danach.",
  comparingAtTable: "Am Tisch werden die Karten verglichen …",
  winner: "Gewinner",
  awardPot: (n) => `Pot vergeben (${n} Gewinner)`,
  awardSure: (names, n, amt) => `${names} ${n > 1 ? "bekommen je" : "bekommt"} ${num(amt)} Chips – sicher?`,
  pickWinner: "Gewinner antippen",
  propose: (names, n) => `Vorschlagen: ${names} ${n > 1 ? "teilen sich" : "gewinnt"} den Pot`,
  proposalGets: (n, amt, by) => `${n > 1 ? "bekommen je" : "bekommt"} ${num(amt)} Chips – Vorschlag von ${by}`,
  someone: "Jemand",
  agrees: "stimmt",
  waits: "wartet …",
  awardWhenAll: "Vergeben wird, sobald alle mit Karten zugestimmt haben.",
  agree: "Stimmt",
  disagree: "Stimmt nicht",
  withdraw: "Vorschlag zurückziehen",
  rejectAfter: "Doch nicht – Vorschlag ablehnen",
  forceAward: (missing) => `Trotzdem vergeben (Admin) – ${missing} fehlt`,

  // Hand-Ende
  handOver: (n) => `Hand ${n} beendet`,
  drinksRound: "Getränkerunde",
  drinksLeader: (name, chips) => `${name} führt mit ${num(chips)} Chips und holt die Runde.`,
  rebuy: "Rebuy",
  rebuyOpen: "Rebuy …",
  rebuyDefault: (label) => `Rebuy (${label})`,
  buyNow: "Einkaufen",
  blindsRise: (sb, bb) => `Nächste Hand steigen die Blinds auf ${num(sb)}/${num(bb)}.`,
  needTwoActive: "Mindestens 2 Spieler müssen aktiv sein – Pause aufheben.",
  nextHand: "Nächste Hand – Dealer wandert",
  ready: "Bereit für die nächste Hand",
  readyDone: "Du bist bereit (nochmal tippen = doch nicht)",
  sittingOut: "Du setzt gerade aus – mit Fortsetzen bzw. Rebuy bist du ab der nächsten Hand wieder dabei.",
  waitingFor: (names) => `Die nächste Hand startet, sobald alle bereit sind. Warten auf: ${names}`,
  forceStart: "Trotzdem starten (Admin)",
  endEvening: "Abend beenden → Bilanz",
  endEveningConfirm: "Wirklich Abend beenden? Nochmal tippen",

  // Bilanz und Abrechnung
  winsEvening: (name) => `${name} gewinnt den Abend`,
  chipsResult: (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n))} Chips`,
  balance: "Endbilanz",
  finalLine: (fin, bought) => `${num(fin)} Chips · ${num(bought)} eingekauft`,
  rateLine: (euro, chips) => `Buy-in ${euro} = ${num(chips)} Chips`,
  noMoneyLine: "Ohne Geld gespielt – nur Chips.",
  settle: "Abrechnen",
  allSquare: "Alle sind quitt – niemand muss etwas überweisen.",
  transfers: (n) => `${n} ${n === 1 ? "Überweisung" : "Überweisungen"} – danach sind alle quitt.`,
  backToBalance: "Zurück zur Bilanz",
  newGame: "Neues Spiel",
  doneToStart: "Fertig – zurück zum Start",

  // Spielerverwaltung
  manageTitle: "Spieler",
  seatOrderHint: "Reihenfolge = Sitzreihenfolge am Tisch (im Uhrzeigersinn). Danach laufen Dealer, Blinds und Züge.",
  up: "Hoch",
  down: "Runter",
  admin: "Admin",
  removeMidHandHint: "Entfernen mitten in der Hand wirkt wie ein Fold – bereits gesetzte Chips bleiben im Pot.",
  addPlayerTitle: "Spieler hinzufügen",
  name: "Name",
  newNamePlaceholder: "Wer kommt dazu?",
  buyInChipsLabel: "Buy-in (Chips)",
  addPlayer: "Hinzufügen – spielt ab nächster Hand",
  onlineManageTitle: (code) => `Spieler · Code ${code}`,
  lateJoinHint: "Wer später kommt, tippt den Code auf der Startseite unter „Beitreten“ ein und spielt ab der nächsten Hand mit.",
  adminsAre: (names) => `Admins: ${names || "–"}.`,
  adminCan: "Als Admin kannst du Plätze tauschen, Spieler entfernen und Admins ernennen oder abwählen.",
  adminsCan: "Admins können Plätze tauschen, Spieler entfernen und weitere Admins ernennen.",
  leaveMe: "Ich verlasse den Tisch",
  leaveMeConfirm: "Wirklich gehen? Dein Stack zählt in der Bilanz. Nochmal tippen",
  playersCode: (code) => `Spieler · Code ${code}`,
  toggleAdminOn: "Zum Admin machen",
  toggleAdminOff: "Admin-Rolle wegnehmen",

  // Hand-Rangfolge
  handsTitle: "Rangfolge der Hände",
  handsHint: "1 schlägt alles. Ausgegraute Karten sind nur Beiwerk (Kicker).",

  // Icons (Bildschirmleser)
  aria: { pause: "Pause", resume: "Fortsetzen", warning: "Hinweis" },
};

/* Hand-Rankings: [Wert, Farbe, dim?] — Farbe r = rot */
export const HANDS = [
  { n: "Royal Flush", d: "10 bis Ass, gleiche Farbe", c: [["10","♥","r"],["J","♥","r"],["Q","♥","r"],["K","♥","r"],["A","♥","r"]] },
  { n: "Straight Flush", d: "5 in Reihe, gleiche Farbe", c: [["5","♠"],["6","♠"],["7","♠"],["8","♠"],["9","♠"]] },
  { n: "Vierling (Quads)", d: "4 gleiche Werte", c: [["9","♠"],["9","♥","r"],["9","♦","r"],["9","♣"],["K","♠","","dim"]] },
  { n: "Full House", d: "Drilling + Paar", c: [["Q","♠"],["Q","♥","r"],["Q","♦","r"],["7","♣"],["7","♠"]] },
  { n: "Flush", d: "5 gleiche Farbe, egal welche Werte", c: [["2","♦","r"],["6","♦","r"],["9","♦","r"],["J","♦","r"],["A","♦","r"]] },
  { n: "Straße (Straight)", d: "5 in Reihe, Farben gemischt", c: [["4","♣"],["5","♦","r"],["6","♠"],["7","♥","r"],["8","♣"]] },
  { n: "Drilling (Trips)", d: "3 gleiche Werte", c: [["8","♠"],["8","♥","r"],["8","♦","r"],["K","♣","","dim"],["3","♠","","dim"]] },
  { n: "Zwei Paare", d: "2 × 2 gleiche Werte", c: [["J","♠"],["J","♥","r"],["4","♦","r"],["4","♣"],["A","♠","","dim"]] },
  { n: "Ein Paar (Pair)", d: "2 gleiche Werte", c: [["10","♠"],["10","♥","r"],["K","♦","r","dim"],["7","♣","","dim"],["2","♠","","dim"]] },
  { n: "High Card", d: "Nichts davon – höchste Karte zählt", c: [["A","♠"],["Q","♦","r","dim"],["9","♣","","dim"],["6","♥","r","dim"],["3","♠","","dim"]] },
];
