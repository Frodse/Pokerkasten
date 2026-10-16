/* Buy-in am Online-Tisch: Eingabe in der Einheit des Tisches (€ mit Kurs
   oder Chips ohne Geld) und Umrechnung in Chips. Die verbindliche Rechnung
   macht der Server (supabase/functions/_shared/settings.js). */

// Buy-in in der Einheit des Tisches (€ oder Chips) → Chips, nur zur Anzeige
export const chipsFor = (settings, buyIn) =>
  buyIn === null || buyIn === undefined ? settings.startChips
    : settings.money ? Math.round((buyIn * settings.startChips) / settings.buyInEuro) : buyIn;
export const buyInLabel = (settings, buyIn) =>
  settings.money ? `${(buyIn ?? settings.buyInEuro).toLocaleString("de-DE")} €` : `${buyIn ?? settings.startChips} Chips`;
export const defaultBuyIn = (settings) => (settings.money ? settings.buyInEuro : settings.startChips);
export const parseAmount = (text) => (text.trim() === "" ? null : +text.replace(",", "."));

// Eingabe für den eigenen Buy-in mit Umrechnung
export function BuyInField({ settings, value, onChange, label = "Dein Buy-in" }) {
  const amount = parseAmount(value);
  return (
    <div>
      <span className="lbl">{label} {settings.money ? "in €" : "in Chips"}</span>
      <input type="text" inputMode="decimal" autoComplete="off" placeholder={String(defaultBuyIn(settings))}
        value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))} />
      <div className="small" style={{ textAlign: "left" }}>
        {settings.money
          ? `= ${amount > 0 ? chipsFor(settings, amount) : chipsFor(settings, null)} Chips (Kurs ${settings.buyInEuro.toLocaleString("de-DE")} € = ${settings.startChips} Chips)`
          : "Es wird ohne Geld gespielt – nur Chips."}
      </div>
    </div>
  );
}

