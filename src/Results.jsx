import * as engine from "../supabase/functions/_shared/engine.js";
import { common as T } from "./text/de.js";

/* Bausteine, die Einzel-Handy-Spiel und Online-Tisch gemeinsam nutzen:
   Konfetti, Euro-Anzeige, Endbilanz und Abrechnung. */

export const euro = (cents, signed) =>
  (signed && cents > 0 ? "+" : "") + (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export const Confetti = ({ seed }) => (
  <div className="confetti">
    {Array.from({ length: 44 }).map((_, i) => {
      const r = (n) => (((seed + 1) * (i + 3) * n) % 100) / 100;
      const colors = ["#E4B04A", "#C8332B", "#F3EBD8", "#F0C468", "#9DBFAE"];
      return (
        <div key={i} className="cf" style={{
          left: `${r(7) * 100}%`,
          background: colors[i % colors.length],
          animationDuration: `${2 + r(13) * 1.8}s`,
          animationDelay: `${r(17) * 0.9}s`,
          transform: `rotate(${r(23) * 360}deg)`,
        }} />
      );
    })}
  </div>
);

// Endbilanz: alle Spieler der Session, auch wer gegangen ist.
// Online „ohne Geld“ (settings.money === false) zählen nur die Chips.
export function BalanceView({ players, settings, seed }) {
  const rows = engine.balance(players, settings);
  const top = rows[0];
  const money = settings.money !== false;
  const chipsText = T.chipsResult;
  return (
    <>
      <Confetti seed={seed} />
      <div className="beer">
        <h2>{T.winsEvening(top?.name)}</h2>
        <div style={{ fontWeight: 800 }}>{money ? `${euro(top?.cents ?? 0, true)} · ` : ""}{chipsText(top?.result ?? 0)}</div>
      </div>
      <div className="card">
        <h3 className="sec">{T.balance}</h3>
        {rows.map((r, i) => (
          <div key={r.id} className="pl">
            <div className="nm">
              <span className="place">{i + 1}.</span> {r.name}
              {r.left && <span className="tag gray">{T.badge.left}</span>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="chips" style={{ color: r.result > 0 ? "#E4B04A" : r.result < 0 ? "#E8776F" : "#F3EBD8" }}>{money ? euro(r.cents, true) : chipsText(r.result)}</div>
              <div style={{ fontSize: 11, color: "#9DBFAE" }}>{T.finalLine(r.final, r.buyIn)}</div>
            </div>
          </div>
        ))}
        <div className="small">{money ? T.rateLine(euro(Math.round(settings.buyInEuro * 100)), settings.startChips) : T.noMoneyLine}</div>
      </div>
    </>
  );
}

// Abrechnung: so wenige Überweisungen wie möglich
export function SettleView({ players, settings }) {
  const transfers = engine.settle(engine.balance(players, settings));
  return (
    <div className="card">
      <h3 className="sec">{T.settle}</h3>
      {transfers.length === 0 && <div className="small">{T.allSquare}</div>}
      {transfers.map((t, i) => (
        <div key={i} className="pl" style={{ padding: "14px 12px" }}>
          <div className="nm" style={{ fontSize: 16 }}>{t.from} <span style={{ color: "#9DBFAE" }}>→</span> {t.to}</div>
          <div className="chips" style={{ fontSize: 26, color: "#E4B04A" }}>{euro(t.cents)}</div>
        </div>
      ))}
      {transfers.length > 0 && <div className="small">{T.transfers(transfers.length)}</div>}
    </div>
  );
}
