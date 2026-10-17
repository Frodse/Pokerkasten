import * as engine from "../supabase/functions/_shared/engine.js";
import { common as T } from "./text/de.js";
import { SeatChip, Badge, HintLine, seatStyle } from "./ui/components.jsx";
import { SEAT_COLORS } from "../supabase/functions/_shared/seats.js";

/* Bausteine, die Einzel-Handy-Spiel und Online-Tisch gemeinsam nutzen:
   Konfetti (in Sitzfarben, nur „Laut“), Euro-Anzeige, Endbilanz und Abrechnung. */

// Mit Vorzeichen: „+“ bzw. echtes Minuszeichen „−“ (docs/design.md 5.9)
export const euro = (cents, signed) =>
  (signed && cents > 0 ? "+" : "") +
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }).replace("-", "−");

export const Confetti = ({ seed }) => (
  <div className="confetti">
    {Array.from({ length: 44 }).map((_, i) => {
      const r = (n) => (((seed + 1) * (i + 3) * n) % 100) / 100;
      return (
        <div key={i} className="cf" style={{
          left: `${r(7) * 100}%`,
          background: `var(--${SEAT_COLORS[i % SEAT_COLORS.length]})`,
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
// Konfetti nur bei Lautstärke „Laut“ (Kap. 9)
export function BalanceView({ players, settings, seed }) {
  const rows = engine.balance(players, settings);
  const top = rows[0];
  const money = settings.money !== false;
  const colorOf = (id) => players.find((p) => p.id === id)?.color;
  return (
    <>
      {settings.volume === "loud" && <Confetti seed={seed} />}
      {top && (
        <div className="winnerBlock" style={seatStyle(colorOf(top.id))}>
          <div className="h">{T.winsEvening(top.name)}</div>
          {money && <div className="big">{euro(top.cents, true)}</div>}
          <div className="line">{T.chipsResult(top.result)}</div>
        </div>
      )}
      <div className="card">
        <h3 className="sec">{T.balance}</h3>
        {rows.map((r, i) => {
          const minus = money ? r.cents < 0 : r.result < 0;
          return (
            <div key={r.id} className="playerRow">
              <span className="place">{i + 1}.</span>
              <SeatChip color={colorOf(r.id)} />
              <div className="name">
                <span className="who">{r.name}</span>
                {r.left && <Badge>{T.badge.left}</Badge>}
              </div>
              <div className="result">
                <div className={`money ${minus ? "minus" : ""}`}>{money ? euro(r.cents, true) : T.chipsResult(r.result)}</div>
                <div className="meta">{T.finalLine(r.final, r.buyIn)}</div>
              </div>
            </div>
          );
        })}
        <HintLine>{money ? T.rateLine(euro(Math.round(settings.buyInEuro * 100)), settings.startChips) : T.noMoneyLine}</HintLine>
      </div>
    </>
  );
}

// Abrechnung: so wenige Überweisungen wie möglich
export function SettleView({ players, settings }) {
  const transfers = engine.settle(engine.balance(players, settings));
  const colorOf = (name) => players.find((p) => p.name === name)?.color;
  return (
    <div className="card">
      <h3 className="sec">{T.settle}</h3>
      {transfers.length === 0 && <HintLine>{T.allSquare}</HintLine>}
      {transfers.map((t, i) => (
        <div key={i} className="transferRow">
          <div className="who">
            <SeatChip color={colorOf(t.from)} /><span>{t.from}</span>
            <span className="arrow">→</span>
            <SeatChip color={colorOf(t.to)} /><span>{t.to}</span>
          </div>
          <div className="amt">{euro(t.cents)}</div>
        </div>
      ))}
      {transfers.length > 0 && <HintLine>{T.transfers(transfers.length)}</HintLine>}
    </div>
  );
}
