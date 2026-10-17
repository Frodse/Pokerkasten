// Sitzfarben (docs/design.md 4.2) in der Reihenfolge, in der sie ohne eigene
// Wahl vergeben werden. Reine Anzeige, keine Spielregel. App und Edge
// Functions benutzen dieselbe Liste.
export const SEAT_COLORS = [
  "seat-red", "seat-blue", "seat-green", "seat-yellow", "seat-chalk",
  "seat-purple", "seat-orange", "seat-teal", "seat-pink",
];

export const isSeatColor = (color) => SEAT_COLORS.includes(color);

// Erste Farbe, die noch niemand hat (null, wenn alle neun vergeben sind)
export const firstFreeColor = (taken) => SEAT_COLORS.find((c) => !taken.includes(c)) ?? null;
