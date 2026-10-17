// Einstellungen des Online-Tisches und Umrechnung des Buy-ins in Chips.
// Gemeinsam für die Edge Functions "lobby" und "game".
//
// settings = { money, buyInEuro, startChips, sb, beerEvery, blindUp, volume }
//   money true:  Kurs buyInEuro € = startChips Chips; jeder tippt seinen Buy-in in €
//   money false: ohne Geld; jeder tippt Chips, startChips ist der Vorschlag
// Der Rechenkern rechnet die Bilanz mit buyInEuro / startChips; ohne Geld ist buyInEuro 0.
// volume "quiet" | "loud" (docs/design.md Kap. 9): nur Anzeige, gilt für alle Geräte.
import { UserError } from "./server.js";

export const DEFAULT_SETTINGS = { money: true, buyInEuro: 10, startChips: 1000, sb: 10, beerEvery: 3, blindUp: 8, volume: "quiet" };

function intSetting(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) throw new UserError(`${label}: ganze Zahl von ${min} bis ${max}.`);
  return value;
}

// S4/S5, Z9: im Online-Spiel nur ganze Chips und sinnvolle Grenzen
export function cleanSettings(raw = {}) {
  const money = raw.money !== false;
  const settings = {
    money,
    startChips: intSetting(raw.startChips, 1, 1000000, money ? "Chips im Kurs" : "Start-Chips"),
    sb: intSetting(raw.sb, 1, 100000, "Small Blind"),
    beerEvery: intSetting(raw.beerEvery, 0, 1000, "Bierrunde"),
    blindUp: intSetting(raw.blindUp, 0, 1000, "Blind-Steigerung"),
    buyInEuro: 0,
    volume: raw.volume === "loud" ? "loud" : "quiet",
  };
  if (money) {
    const euro = raw.buyInEuro;
    if (typeof euro !== "number" || !(euro > 0 && euro <= 10000)) throw new UserError("Kurs in €: mehr als 0 bis 10.000.");
    settings.buyInEuro = Math.round(euro * 100) / 100;
  }
  return settings;
}

// Buy-in (in € oder Chips, je nach Tisch) → Chips. null = Vorschlag des Admins.
export function chipsFor(settings, buyIn) {
  if (buyIn === null || buyIn === undefined) return settings.startChips;
  const chips = settings.money ? Math.round((buyIn * settings.startChips) / settings.buyInEuro) : buyIn;
  if (!Number.isInteger(chips) || chips < 1) throw new UserError("Der Buy-in ist zu klein für einen Chip.");
  return chips;
}

// Prüft einen eingegebenen Buy-in in der Einheit des Tisches
export function cleanBuyIn(settings, raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) throw new UserError("Bitte einen Buy-in größer als 0 eingeben.");
  if (settings.money) {
    if (raw > 10000) throw new UserError("Buy-in höchstens 10.000 €.");
    const euro = Math.round(raw * 100) / 100;
    chipsFor(settings, euro);
    return euro;
  }
  if (!Number.isInteger(raw) || raw > 10000000) throw new UserError("Buy-in in ganzen Chips, höchstens 10.000.000.");
  return raw;
}
