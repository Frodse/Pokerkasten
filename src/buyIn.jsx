import { common as T } from "./text/de.js";

/* Buy-in am Online-Tisch: Eingabe in der Einheit des Tisches (€ mit Kurs
   oder Chips ohne Geld) und Umrechnung in Chips. Die verbindliche Rechnung
   macht der Server (supabase/functions/_shared/settings.js). */

// Buy-in in der Einheit des Tisches (€ oder Chips) → Chips, nur zur Anzeige
export const chipsFor = (settings, buyIn) =>
  buyIn === null || buyIn === undefined ? settings.startChips
    : settings.money ? Math.round((buyIn * settings.startChips) / settings.buyInEuro) : buyIn;
export const buyInLabel = (settings, buyIn) =>
  settings.money ? T.buyInEuroShort((buyIn ?? settings.buyInEuro).toLocaleString("de-DE")) : T.buyInChipsShort(buyIn ?? settings.startChips);
export const defaultBuyIn = (settings) => (settings.money ? settings.buyInEuro : settings.startChips);
export const parseAmount = (text) => (text.trim() === "" ? null : +text.replace(",", "."));

// Eingabe für den eigenen Buy-in mit Umrechnung
export function BuyInField({ settings, value, onChange, label = T.yourBuyIn }) {
  const amount = parseAmount(value);
  return (
    <div>
      <span className="lbl">{label} {settings.money ? T.inEuro : T.inChips}</span>
      <input type="text" inputMode="decimal" autoComplete="off" placeholder={String(defaultBuyIn(settings))}
        value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))} />
      <div className="small" style={{ textAlign: "left" }}>
        {settings.money
          ? T.buyInChips(amount > 0 ? chipsFor(settings, amount) : chipsFor(settings, null), settings.buyInEuro.toLocaleString("de-DE"), settings.startChips)
          : T.buyInNoMoney}
      </div>
    </div>
  );
}

