import { useState, useEffect, useRef } from "react";
import Lobby from "./Lobby.jsx";
import * as engine from "../supabase/functions/_shared/engine.js";

/* ── Design tokens: Filz & Gold ────────────────
   Felt:   #0E3B2E deep table green
   Cream:  #F3EBD8 card face
   Chip:   #C8332B red / #E4B04A gold
   Sage:   #9DBFAE muted
   Ink:    #10241D
──────────────────────────────────────────────── */

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;touch-action:manipulation}
html,body,#root{height:100%}
body{background:#0A2C22}
.app{min-height:100vh;background:radial-gradient(120% 90% at 50% 0%,#155741 0%,#0E3B2E 55%,#0A2C22 100%);color:#F3EBD8;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;padding:16px 14px 40px}
.wrap{width:100%;max-width:440px}
.marquee{font-family:'Bebas Neue',sans-serif;letter-spacing:.06em;text-align:center;font-size:40px;line-height:1;color:#F3EBD8;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.sub{text-align:center;color:#9DBFAE;font-size:12px;letter-spacing:.18em;text-transform:uppercase;margin:4px 0 20px}
.card{background:rgba(16,36,29,.55);border:1px solid rgba(243,235,216,.14);border-radius:14px;padding:14px;margin-bottom:12px;backdrop-filter:blur(4px)}
.lbl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9DBFAE;margin-bottom:6px;display:block}
input[type=text],input[type=number]{width:100%;background:#0A2C22;border:1px solid rgba(243,235,216,.22);border-radius:8px;color:#F3EBD8;font:600 16px Inter;padding:10px 12px;outline:none}
input:focus{border-color:#E4B04A}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:12px;font:800 16px Inter;padding:15px 16px;cursor:pointer;transition:transform .06s,filter .15s;color:#10241D;background:#F3EBD8;width:100%}
.btn.xl{padding:20px 16px;font-size:19px;border-radius:14px}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.35;cursor:default}
.btn.gold{background:linear-gradient(180deg,#F0C468,#DFA53B);}
.btn.red{background:linear-gradient(180deg,#D8463C,#B7271F);color:#FFF}
.btn.ghost{background:transparent;border:1px solid rgba(243,235,216,.3);color:#F3EBD8}
.btn.sm{padding:9px 10px;font-size:13px;border-radius:8px;width:auto}
.row{display:flex;gap:8px}
.row>*{flex:1}
.turnBanner{background:rgba(16,36,29,.55);color:#F3EBD8;border:1px dashed rgba(228,176,74,.55);border-radius:14px;padding:14px;text-align:center;margin-bottom:12px}
.turnBanner .who{font-family:'Bebas Neue';font-size:38px;line-height:1;letter-spacing:.04em;color:#E4B04A}
.turnBanner .todo{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9DBFAE}
.potChip{width:120px;height:120px;border-radius:50%;margin:0 auto 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:repeating-conic-gradient(#C8332B 0 30deg,#F3EBD8 30deg 60deg);position:relative;box-shadow:0 8px 22px rgba(0,0,0,.45), inset 0 0 0 6px rgba(0,0,0,.15)}
.potChip::after{content:'';position:absolute;inset:14px;border-radius:50%;background:#C8332B;box-shadow:inset 0 0 0 2px rgba(243,235,216,.5)}
.potChip .amt{position:relative;z-index:1;font-family:'Bebas Neue';font-size:30px;color:#F3EBD8}
.potChip .cap{position:relative;z-index:1;font-size:9px;letter-spacing:.2em;color:#F3EBD8;opacity:.85}
.phaseTrack{display:flex;gap:6px;justify-content:center;margin:10px 0 14px}
.phaseTrack span{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:99px;border:1px solid rgba(243,235,216,.2);color:#9DBFAE}
.phaseTrack span.on{background:#F3EBD8;color:#10241D;border-color:#F3EBD8}
.pl{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;margin-bottom:6px;background:rgba(10,44,34,.6);border:1px solid transparent}
.pl.turn{border-color:#E4B04A;background:rgba(228,176,74,.12)}
.pl.folded{opacity:.4}
.pl .nm{font-weight:800;flex:1;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pl .chips{font-family:'Bebas Neue';font-size:20px;letter-spacing:.03em}
.pl .bet{font-size:12px;color:#E4B04A;font-weight:800;min-width:54px;text-align:right}
.pauseBtn{width:32px;height:32px;border-radius:8px;border:1px solid rgba(243,235,216,.3);background:transparent;color:#9DBFAE;font-size:13px;cursor:pointer}
.tag{font-size:9px;font-weight:800;letter-spacing:.08em;padding:2px 6px;border-radius:99px;background:#F3EBD8;color:#10241D}
.tag.d{background:#E4B04A}
.tag.gray{background:rgba(243,235,216,.25);color:#F3EBD8}
.tag.mint{background:#9DBFAE;color:#10241D}
.beer{background:linear-gradient(180deg,#F0C468,#DFA53B);color:#10241D;border-radius:14px;padding:18px;text-align:center;margin-bottom:12px}
.beer h2{font-family:'Bebas Neue';font-size:34px;line-height:1.05}
.notice{background:rgba(243,235,216,.1);border:1px dashed rgba(243,235,216,.35);border-radius:10px;padding:10px 12px;font-size:13px;text-align:center;margin-bottom:12px;color:#F3EBD8}
.stepper{display:flex;align-items:center;gap:10px;margin:10px 0}
.stepper button{width:52px;height:44px;border-radius:10px;border:1px solid rgba(243,235,216,.3);background:transparent;color:#F3EBD8;font:800 20px Inter;cursor:pointer}
.stepper .val{flex:1;text-align:center;font-family:'Bebas Neue';font-size:34px}
.winnerBtn{display:flex;justify-content:space-between;align-items:center;width:100%;padding:12px;border-radius:10px;border:1px solid rgba(243,235,216,.25);background:rgba(10,44,34,.6);color:#F3EBD8;font:800 15px Inter;margin-bottom:8px;cursor:pointer}
.winnerBtn.sel{border-color:#E4B04A;background:rgba(228,176,74,.18)}
.small{font-size:12px;color:#9DBFAE;text-align:center;margin-top:6px}
.setupPl{display:flex;gap:8px;margin-bottom:8px;align-items:center}
.setupPl input{flex:1}
.setupPl .x{width:40px;height:40px;border-radius:8px;border:1px solid rgba(243,235,216,.25);background:transparent;color:#F3EBD8;font-size:16px;cursor:pointer}
h3.sec{font-family:'Bebas Neue';font-size:22px;letter-spacing:.05em;margin-bottom:8px}
.helpFab{position:fixed;bottom:18px;right:18px;width:52px;height:52px;border-radius:50%;border:none;background:linear-gradient(180deg,#F0C468,#DFA53B);color:#10241D;font:800 24px Inter;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.45);z-index:50}
.overlay{position:fixed;inset:0;background:rgba(6,20,15,.82);backdrop-filter:blur(3px);z-index:60;display:flex;justify-content:center;padding:20px 14px;overflow-y:auto}
.sheet{width:100%;max-width:440px;background:#0E3B2E;border:1px solid rgba(243,235,216,.2);border-radius:16px;padding:16px;height:fit-content;margin:auto 0}
.hand{display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid rgba(243,235,216,.1)}
.hand:last-child{border-bottom:none}
.hand .rank{font-family:'Bebas Neue';font-size:20px;color:#E4B04A;width:24px;text-align:center}
.hand .info{flex:1}
.hand .hn{font-weight:800;font-size:14px}
.hand .hd{font-size:11px;color:#9DBFAE}
.hand .cards{display:flex;gap:2px}
.mini{width:26px;height:36px;border-radius:4px;background:#F3EBD8;color:#10241D;display:flex;flex-direction:column;align-items:center;justify-content:center;font:800 11px Inter;line-height:1}
.mini.r{color:#C8332B}
.mini.dim{opacity:.35}
.undoRow{display:flex;justify-content:flex-end;margin-bottom:8px}
.announce{position:fixed;inset:0;z-index:55;background:rgba(6,20,15,.92);backdrop-filter:blur(3px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:20px;text-align:center}
.announce h1{font-family:'Bebas Neue';font-size:72px;line-height:1;color:#E4B04A;letter-spacing:.04em;text-shadow:0 4px 0 rgba(0,0,0,.4)}
.announce p{font-size:17px;font-weight:800;color:#F3EBD8;max-width:320px}
.announce .tapHint{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9DBFAE;animation:pulse 1.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
.confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:45}
.cf{position:absolute;top:-16px;width:10px;height:14px;border-radius:2px;animation:fall linear forwards}
@keyframes fall{to{transform:translateY(112vh) rotate(680deg)}}
`;

const { PHASES } = engine;

/* Hand-Rankings: [Wert, Farbe, dim?] — Farbe r = rot */
const HANDS = [
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

const Mini = ({ c }) => (
  <div className={`mini ${c[2] === "r" ? "r" : ""} ${c[3] === "dim" ? "dim" : ""}`}>
    <span>{c[0]}</span><span>{c[1]}</span>
  </div>
);

export default function PokerKasten() {
  const [screen, setScreen] = useState("start"); // start | lobby | setup | play | showdown | handEnd | over
  const [saved, setSaved] = useState(null);       // gespeicherte Session (falls vorhanden)
  const [checked, setChecked] = useState(false);  // Storage-Check abgeschlossen
  const histRef = useRef([]);                     // Undo-Stack (Snapshots)
  const [histLen, setHistLen] = useState(0);
  const [names, setNames] = useState(["", ""]);
  const [noobs, setNoobs] = useState([false, false]);
  const [startChips, setStartChips] = useState(1000);
  const [sb, setSb] = useState(10);
  const [beerEvery, setBeerEvery] = useState(3);
  const [blindUp, setBlindUp] = useState(8); // Blinds verdoppeln alle X Hände (0 = aus)

  const [players, setPlayers] = useState([]);
  const [dealer, setDealer] = useState(0);
  const [phase, setPhase] = useState(0);
  const [cur, setCur] = useState(0);
  const [curBet, setCurBet] = useState(0);
  const [minRaise, setMinRaise] = useState(0);
  const [handNum, setHandNum] = useState(0);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [notice, setNotice] = useState("");
  const [runout, setRunout] = useState(false);
  const [pots, setPots] = useState([]);
  const [potIdx, setPotIdx] = useState(0);
  const [winnersSel, setWinnersSel] = useState([]);
  const [handResult, setHandResult] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [announce, setAnnounce] = useState(null); // {title, hint}
  const [armAllIn, setArmAllIn] = useState(false);
  const [confirmPot, setConfirmPot] = useState(false);
  const lastTap = useRef(0);
  const [newName, setNewName] = useState("");
  const [newBuyIn, setNewBuyIn] = useState(1000);

  const bb = sb * 2;
  const settings = { sb, blindUp, startChips };
  const blindsFor = (h) => engine.blindsFor(h, settings);
  const { s: sbNow, b: bbNow } = blindsFor(handNum);
  const { alive, active } = engine;
  const pot = engine.potTotal(players);

  /* ── Session speichern / laden / Undo ── */
  const KEY = "pokerkasten:session";

  const snapshot = () => ({
    screen, players, dealer, phase, cur, curBet, minRaise, handNum,
    notice, runout, pots, potIdx, winnersSel, handResult,
    names, startChips, sb, beerEvery, blindUp,
  });

  const restore = (s) => {
    setNames(s.names); setStartChips(s.startChips); setSb(s.sb); setBeerEvery(s.beerEvery); setBlindUp(s.blindUp ?? 0);
    setPlayers(s.players); setDealer(s.dealer); setPhase(s.phase); setCur(s.cur);
    setCurBet(s.curBet); setMinRaise(s.minRaise); setHandNum(s.handNum);
    setNotice(s.notice); setRunout(s.runout); setPots(s.pots); setPotIdx(s.potIdx);
    setWinnersSel(s.winnersSel); setHandResult(s.handResult);
    setRaiseOpen(false); setAnnounce(null); setArmAllIn(false); setConfirmPot(false); setScreen(s.screen);
  };

  const pushHist = () => {
    histRef.current = [...histRef.current.slice(-19), snapshot()];
    setHistLen(histRef.current.length);
  };

  const undo = () => {
    const h = histRef.current;
    if (!h.length) return;
    const s = h[h.length - 1];
    histRef.current = h.slice(0, -1);
    setHistLen(histRef.current.length);
    restore(s);
  };

  // Beim Start: gespeicherte Session suchen
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.snap && !["start", "setup"].includes(s.snap.screen)) setSaved(s);
      }
    } catch (e) { /* nichts gespeichert */ }
    setChecked(true);
  }, []);

  // Automatisch speichern, sobald gespielt wird
  useEffect(() => {
    if (["start", "lobby", "setup"].includes(screen)) return;
    const data = JSON.stringify({ snap: snapshot(), hist: histRef.current.slice(-8) });
    try { window.localStorage.setItem(KEY, data); } catch (e) { /* Storage voll oder deaktiviert */ }
  }, [players, screen, cur, phase, curBet, potIdx, winnersSel, handResult]);

  const resumeSaved = () => {
    if (!saved) return;
    histRef.current = saved.hist || [];
    setHistLen(histRef.current.length);
    restore(saved.snap);
  };

  /* ── Spielzüge: rechnet alles engine.js, hier nur Undo und Oberfläche ── */
  const game = () => ({
    screen, players, dealer, phase, cur, curBet, minRaise, handNum,
    notice, runout, pots, potIdx, winnersSel, handResult, announce: null,
  });

  // Ergebnis des Rechenkerns in den Bildschirm-Zustand übernehmen
  function apply(next) {
    setScreen(next.screen); setPlayers(next.players); setDealer(next.dealer); setPhase(next.phase);
    setCur(next.cur); setCurBet(next.curBet); setMinRaise(next.minRaise); setHandNum(next.handNum);
    setNotice(next.notice); setRunout(next.runout); setPots(next.pots); setPotIdx(next.potIdx);
    setWinnersSel(next.winnersSel); setHandResult(next.handResult);
    if (next.announce) setAnnounce(next.announce);
    setConfirmPot(false);
  }

  /* ── Setup ── */
  const startGame = () => {
    const g = game();
    const next = engine.startGame(g, names.map((name, i) => ({ name, noob: noobs[i] })), settings, Math.random());
    if (next === g) return;
    histRef.current = []; setHistLen(0);
    setSaved(null);
    apply(next);
  };

  /* ── Actions ── */
  function applyAction(kind, amount) {
    pushHist();
    setArmAllIn(false);
    setRaiseOpen(false);
    apply(engine.applyAction(game(), kind, amount, settings));
  }

  function awardPot() {
    if (winnersSel.length === 0) return;
    pushHist();
    apply(engine.awardPot(game()));
  }

  function nextHand() {
    pushHist();
    apply(engine.nextHand(game(), settings));
  }

  function addPlayer() {
    const next = engine.addPlayer(game(), newName, newBuyIn);
    if (!next) return;
    pushHist();
    apply(next);
    setNewName("");
  }

  function removePlayer(id) {
    pushHist();
    setRaiseOpen(false);
    apply(engine.removePlayer(game(), id, settings));
  }

  const movePlayer = (id, dir) => apply(engine.movePlayer(game(), id, dir));
  const toggleNoob = (id) => apply(engine.toggleNoob(game(), id));
  const togglePause = (id) => apply(engine.togglePause(game(), id));

  function rebuy(id) {
    pushHist();
    apply(engine.rebuy(game(), id, settings));
  }

  /* ── Derived ── */
  const me = players[cur];
  const toCall = me ? curBet - me.bet : 0;
  const raiseAllowed = engine.canRaise(game());
  const allInAllowed = me ? raiseAllowed || me.chips + me.bet <= curBet : false; // Z1: All-In nur als Call
  const potBet = (f) => engine.potBet(game(), f, settings);
  const beerNow = handNum > 0 && beerEvery > 0 && handNum % beerEvery === 0;
  const beerPayer = alive(players).slice().sort((a, b) => b.chips - a.chips)[0];

  // Doppel-Tipp auf den Filz = Check (nur wenn Check erlaubt ist)
  function feltTap(e) {
    if (screen !== "play" || raiseOpen || announce || mgmtOpen || helpOpen) return;
    if (e.target.closest("button,input,.sheet,.overlay")) return;
    const now = Date.now();
    if (now - lastTap.current < 350) {
      lastTap.current = 0;
      if (toCall === 0 && me && !me.folded && !me.allIn) {
        applyAction("check");
        setNotice(`✓ ${me.name} checkt (Doppel-Tipp)`);
      }
    } else {
      lastTap.current = now;
    }
  }

  const Confetti = ({ seed }) => (
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

  /* ── Screens ── */
  return (
    <div className="app" onClick={feltTap}>
      <style>{css}</style>
      <div className="wrap">
        <div className="marquee">POKERKASTEN</div>
        <div className="sub">Chips · Blinds · Pot — Karten seid ihr</div>

        {screen === "start" && (
          <>
            <div className="card" style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🃏</div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Bereit für den Abend?</div>
              <div className="small">
                {checked
                  ? saved
                    ? `Gespeicherte Session gefunden – Hand #${saved.snap.handNum}, ${saved.snap.players.filter((p) => !p.out).length} Spieler.`
                    : "Keine alte Session vorhanden."
                  : "Suche gespeicherte Session …"}
              </div>
            </div>
            <button className="btn gold" style={{ marginBottom: 8 }} disabled={!saved} onClick={resumeSaved}>
              Alte Session fortsetzen
            </button>
            <button className="btn ghost" style={{ marginBottom: 8 }} onClick={() => setScreen("setup")}>Neue Session</button>
            <button className="btn ghost" onClick={() => setScreen("lobby")}>Online-Tisch (jeder am eigenen Handy)</button>
          </>
        )}

        {screen === "lobby" && <Lobby onBack={() => setScreen("start")} />}

        {screen === "setup" && (
          <>
            <div className="card">
              <h3 className="sec">Spieler</h3>
              {names.map((n, i) => (
                <div className="setupPl" key={i}>
                  <input type="text" placeholder={`Spieler ${i + 1}`} value={n}
                    onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button className="x" style={noobs[i] ? { background: "#E4B04A", color: "#10241D", borderColor: "#E4B04A" } : {}}
                    title="Dumpfbacken-Modus: einfache Knöpfe für Poker-Neulinge"
                    onClick={() => setNoobs(noobs.map((x, j) => (j === i ? !x : x)))}>🐣</button>
                  {names.length > 2 && (
                    <button className="x" onClick={() => {
                      setNames(names.filter((_, j) => j !== i));
                      setNoobs(noobs.filter((_, j) => j !== i));
                    }}>✕</button>
                  )}
                </div>
              ))}
              {names.length < 9 && (
                <button className="btn ghost sm" onClick={() => { setNames([...names, ""]); setNoobs([...noobs, false]); }}>+ Spieler</button>
              )}
              <div className="small">🐣 = Dumpfbacken-Modus – erklärt die Knöpfe in einfacher Sprache, nur wenn diese Person dran ist.</div>
            </div>
            <div className="card">
              <h3 className="sec">Regeln</h3>
              <div className="row" style={{ marginBottom: 10 }}>
                <div><span className="lbl">Start-Chips</span>
                  <input type="number" value={startChips} onChange={(e) => setStartChips(Math.max(1, +e.target.value || 0))} /></div>
                <div><span className="lbl">Small Blind</span>
                  <input type="number" value={sb} onChange={(e) => setSb(Math.max(1, +e.target.value || 0))} /></div>
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                <div><span className="lbl">🍺 Bierrunde alle … Hände (0 = aus)</span>
                  <input type="number" value={beerEvery} onChange={(e) => setBeerEvery(Math.max(0, +e.target.value || 0))} /></div>
                <div><span className="lbl">📈 Blinds ×2 alle … Hände (0 = aus)</span>
                  <input type="number" value={blindUp} onChange={(e) => setBlindUp(Math.max(0, +e.target.value || 0))} /></div>
              </div>
              <div className="small">Big Blind = {bb}. Wer die meisten Chips hat, holt die Bierrunde.</div>
            </div>
            <button className="btn gold" onClick={startGame}
              disabled={names.filter((n) => n.trim()).length < 2}>Runde starten</button>
          </>
        )}

        {screen === "play" && me && (
          <>
            <div className="undoRow" style={{ gap: 8 }}>
              <button className="btn ghost sm" onClick={() => { setNewBuyIn(startChips); setMgmtOpen(true); }}>👥 Spieler</button>
              <button className="btn ghost sm" disabled={histLen === 0} onClick={undo}>↩︎ Rückgängig</button>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="potChip"><div className="amt">{pot}</div><div className="cap">POT</div></div>
              <div className="phaseTrack">
                {PHASES.map((ph, i) => <span key={ph} className={i === phase ? "on" : ""}>{ph}</span>)}
              </div>
              <div className="small">
                Hand #{handNum} · Blinds {sbNow}/{bbNow} · Dealer: {players[dealer].name}
                {blindUp > 0 && <> · steigen in {blindUp - ((handNum - 1) % blindUp)} Hand{blindUp - ((handNum - 1) % blindUp) !== 1 ? "en" : ""}</>}
              </div>
            </div>

            {notice && <div className="notice">{notice}</div>}

            <div className="turnBanner">
              <div className="todo">📱 Handy geht an</div>
              <div className="who">{me.name}</div>
              <div className="todo">{toCall > 0 ? `${toCall} zum Mitgehen` : "Kein Einsatz offen"}</div>
            </div>

            {me.noob && !raiseOpen && (
              <div className="notice">
                {toCall > 0
                  ? `🐣 Jemand hat gesetzt. Willst du dabei bleiben, musst du ${Math.min(toCall, me.chips)} zahlen. Sonst: Karten weglegen (kostet nichts mehr) – oder selbst erhöhen.`
                  : "🐣 Niemand hat gesetzt. Du kannst gratis schieben und die nächste Karte sehen – oder selbst Chips setzen."}
              </div>
            )}
            {!raiseOpen ? (
              <>
                <div className="row" style={{ marginBottom: 8 }}>
                  <button className="btn red xl" onClick={() => applyAction("fold")}>
                    {me.noob ? "🙅 Aufgeben" : "Fold"}
                  </button>
                  {toCall === 0 ? (
                    <button className="btn xl" onClick={() => applyAction("check")}>
                      {me.noob ? "👊 Schieben (gratis)" : "Check"}
                    </button>
                  ) : (
                    <button className="btn xl" onClick={() => applyAction("call")}>
                      {me.noob
                        ? `✅ Mitgehen – zahle ${Math.min(toCall, me.chips)}${toCall >= me.chips ? " (alles!)" : ""}`
                        : `Call ${Math.min(toCall, me.chips)}${toCall >= me.chips ? " (All-In)" : ""}`}
                    </button>
                  )}
                </div>
                <div className="row">
                  <button className="btn gold xl" disabled={!raiseAllowed}
                    onClick={() => { setRaiseTo(Math.min(curBet + minRaise, me.bet + me.chips)); setRaiseOpen(true); }}>
                    {me.noob ? "📈 Mehr setzen" : "Raise"}
                  </button>
                  <button className={`btn xl ${armAllIn ? "red" : "ghost"}`} disabled={!allInAllowed}
                    onClick={() => (armAllIn ? applyAction("raise", me.bet + me.chips) : setArmAllIn(true))}>
                    {armAllIn
                      ? `🔥 Wirklich ALLES (${me.chips + me.bet})? Nochmal tippen!`
                      : me.noob ? `Alles rein! (${me.chips + me.bet})` : `All-In ${me.chips + me.bet}`}
                  </button>
                </div>
                {toCall === 0 && <div className="small">Tipp: Doppel-Tipp auf den Filz = Check</div>}
                {!raiseAllowed && me.acted && toCall > 0 && <div className="small">Kurzes All-In vor dir: nur Call oder Fold.</div>}
              </>
            ) : (
              <div className="card">
                <span className="lbl">{me.noob ? "🐣 Auf wie viel willst du insgesamt erhöhen?" : "Erhöhen auf (gesamt diese Runde)"}</span>
                {me.noob && (
                  <div className="small" style={{ textAlign: "left", marginBottom: 4 }}>
                    Die Zahl ist dein Gesamteinsatz in dieser Setzrunde – nicht was du zusätzlich drauflegst.
                  </div>
                )}
                <div className="stepper">
                  <button onClick={() => setRaiseTo(Math.max(curBet + minRaise, raiseTo - bbNow))}>−</button>
                  <div className="val">{raiseTo}</div>
                  <button onClick={() => setRaiseTo(Math.min(me.bet + me.chips, raiseTo + bbNow))}>+</button>
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  <button className="btn ghost sm" onClick={() => setRaiseTo(Math.min(curBet + minRaise, me.bet + me.chips))}>Min</button>
                  <button className="btn ghost sm" onClick={() => setRaiseTo(potBet(0.5))}>½ Pot</button>
                  <button className="btn ghost sm" onClick={() => setRaiseTo(potBet(2 / 3))}>⅔ Pot</button>
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  <button className="btn ghost sm" onClick={() => setRaiseTo(potBet(1))}>Pot</button>
                  <button className="btn ghost sm" onClick={() => setRaiseTo(me.bet + me.chips)}>Max</button>
                </div>
                <div className="row">
                  <button className="btn ghost" onClick={() => setRaiseOpen(false)}>Zurück</button>
                  <button className="btn gold" onClick={() => applyAction("raise", raiseTo)}>
                    {me.noob ? `Setzen: ${raiseTo}` : "Erhöhen"}
                  </button>
                </div>
              </div>
            )}

            <div className="card" style={{ marginTop: 12 }}>
              {players.filter((p) => !p.out && !p.gone).map((p) => {
                const idx = players.indexOf(p);
                return (
                  <div key={p.id} className={`pl ${idx === cur ? "turn" : ""} ${p.folded ? "folded" : ""}`}>
                    <div className="nm">{p.name}
                      {p.noob && <span title="Dumpfbacken-Modus">🐣</span>}
                      {idx === dealer && <span className="tag d">D</span>}
                      {p.allIn && <span className="tag">ALL-IN</span>}
                      {p.away
                        ? <span className="tag mint">{p.folded ? "PAUSE" : "PAUSE AB NÄCHSTER HAND"}</span>
                        : p.folded && <span className="tag gray">FOLD</span>}
                    </div>
                    <div className="bet">{p.bet > 0 ? `▲ ${p.bet}` : ""}</div>
                    <div className="chips">{p.chips}</div>
                    <button className="pauseBtn" title="Aussetzen ab nächster Hand"
                      onClick={() => togglePause(p.id)}>{p.away ? "▶" : "⏸"}</button>
                  </div>
                );
              })}
              <div className="small">⏸ = setzt ab der nächsten Hand aus (Klo, Bier holen)</div>
            </div>
          </>
        )}

        {screen === "showdown" && (
          <>
            <div className="undoRow">
              <button className="btn ghost sm" disabled={histLen === 0} onClick={undo}>↩︎ Rückgängig</button>
            </div>
            {runout && <div className="notice">Alle All-In / nur einer kann noch setzen → Dealer deckt die restlichen Karten auf.</div>}
            <div className="card" style={{ textAlign: "center" }}>
              <div className="potChip"><div className="amt">{pots[potIdx]?.amt}</div>
                <div className="cap">{pots.length > 1 ? (potIdx === 0 ? "MAIN POT" : `SIDE POT ${potIdx}`) : "POT"}</div></div>
              <div className="small">Karten vergleichen – wer gewinnt diesen Pot? (Split: mehrere antippen)</div>
            </div>
            {pots[potIdx]?.elig.map((id) => {
              const p = players.find((x) => x.id === id);
              const sel = winnersSel.includes(id);
              return (
                <button key={id} className={`winnerBtn ${sel ? "sel" : ""}`}
                  onClick={() => { setConfirmPot(false); setWinnersSel(sel ? winnersSel.filter((x) => x !== id) : [...winnersSel, id]); }}>
                  <span>{p.name}</span><span>{sel ? "🏆" : ""}</span>
                </button>
              );
            })}
            {!confirmPot ? (
              <button className="btn gold xl" onClick={() => setConfirmPot(true)} disabled={winnersSel.length === 0}>
                Pot vergeben ({winnersSel.length || 0} Gewinner)
              </button>
            ) : (
              <>
                <div className="notice">
                  {winnersSel.map((id) => players.find((x) => x.id === id).name).join(" & ")} bekommt
                  {winnersSel.length > 1 ? ` je ${Math.floor(pots[potIdx].amt / winnersSel.length)}` : ` ${pots[potIdx].amt}`} Chips – sicher?
                </div>
                <div className="row">
                  <button className="btn ghost" onClick={() => setConfirmPot(false)}>Zurück</button>
                  <button className="btn gold xl" onClick={awardPot}>✓ Karten auf den Tisch!</button>
                </div>
              </>
            )}
          </>
        )}

        {screen === "handEnd" && (
          <>
            <Confetti seed={handNum} />
            <div className="undoRow" style={{ gap: 8 }}>
              <button className="btn ghost sm" onClick={() => { setNewBuyIn(startChips); setMgmtOpen(true); }}>👥 Spieler</button>
              <button className="btn ghost sm" disabled={histLen === 0} onClick={undo}>↩︎ Rückgängig</button>
            </div>
            {beerNow && beerPayer && (
              <div className="beer">
                <h2>🍺 Bierrunde!</h2>
                <div style={{ fontWeight: 800 }}>{beerPayer.name} führt mit {beerPayer.chips} Chips – und holt die Runde.</div>
              </div>
            )}
            <div className="card">
              <h3 className="sec">Hand #{handNum} beendet</h3>
              <div style={{ fontSize: 14, marginBottom: 10 }}>{handResult}</div>
              {players.filter((p) => !p.gone).map((p) => (
                <div key={p.id} className={`pl ${p.out ? "folded" : ""}`}>
                  <div className="nm">{p.name}
                    {p.out && <span className="tag gray">RAUS</span>}
                    {!p.out && p.away && <span className="tag mint">PAUSE</span>}
                  </div>
                  {p.out
                    ? <button className="btn ghost sm" onClick={() => rebuy(p.id)}>Rebuy</button>
                    : <button className="pauseBtn" onClick={() => togglePause(p.id)}>{p.away ? "▶" : "⏸"}</button>}
                  <div className="chips">{p.chips}</div>
                </div>
              ))}
            </div>
            {blindUp > 0 && blindsFor(handNum + 1).b > bbNow && (
              <div className="notice">📈 Nächste Hand steigen die Blinds auf {blindsFor(handNum + 1).s}/{blindsFor(handNum + 1).b}.</div>
            )}
            {active(players).length < 2 && (
              <div className="notice">Mindestens 2 Spieler müssen aktiv sein – Pause aufheben (▶).</div>
            )}
            <button className="btn gold" onClick={nextHand} disabled={active(players).length < 2}>
              Nächste Hand – Dealer wandert
            </button>
          </>
        )}

        {screen === "over" && (
          <>
            <Confetti seed={handNum + 99} />
            <div className="beer">
              <h2>🏆 {alive(players)[0]?.name} räumt ab!</h2>
              <div style={{ fontWeight: 800 }}>{alive(players)[0]?.chips} Chips</div>
            </div>
            <div className="card">
              <h3 className="sec">Rangliste</h3>
              {players.filter((p) => !p.gone).slice().sort((a, b) => b.chips - a.chips).map((p, i) => (
                <div key={p.id} className="pl">
                  <div className="nm">{["🥇", "🥈", "🥉"][i] || `${i + 1}.`} {p.name}</div>
                  <div className="chips">{p.chips}</div>
                </div>
              ))}
            </div>
            <button className="btn gold" onClick={() => setScreen("setup")}>Neues Spiel</button>
          </>
        )}
      </div>

      <button className="helpFab" onClick={() => setHelpOpen(true)} aria-label="Hand-Rangfolge anzeigen">?</button>

      {announce && (
        <div className="announce" onClick={() => setAnnounce(null)}>
          <h1>{announce.title}</h1>
          {announce.hint && <p>{announce.hint}</p>}
          <div className="tapHint">Tippen zum Weiterspielen</div>
        </div>
      )}

      {mgmtOpen && (
        <div className="overlay" onClick={() => setMgmtOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="sec">Spielerverwaltung</h3>
            <div className="small" style={{ textAlign: "left", marginBottom: 8 }}>
              Reihenfolge = Sitzreihenfolge am Tisch (im Uhrzeigersinn). Danach laufen Dealer, Blinds und Züge.
            </div>
            {players.filter((p) => !p.gone).map((p, vi, visible) => (
              <div key={p.id} className={`pl ${p.out ? "folded" : ""}`}>
                <div className="nm">{p.name}
                  {p.out && <span className="tag gray">RAUS</span>}
                  {!p.out && p.away && <span className="tag mint">PAUSE</span>}
                  {screen === "play" && !p.out && !p.folded && <span className="tag">IN DER HAND</span>}
                </div>
                <div className="chips">{p.chips}</div>
                <button className="pauseBtn" disabled={vi === 0} style={vi === 0 ? { opacity: .3 } : {}}
                  title="Nach oben" onClick={() => movePlayer(p.id, -1)}>↑</button>
                <button className="pauseBtn" disabled={vi === visible.length - 1} style={vi === visible.length - 1 ? { opacity: .3 } : {}}
                  title="Nach unten" onClick={() => movePlayer(p.id, 1)}>↓</button>
                <button className="pauseBtn" style={p.noob ? { background: "#E4B04A", color: "#10241D", borderColor: "#E4B04A" } : {}}
                  title="Dumpfbacken-Modus umschalten" onClick={() => toggleNoob(p.id)}>🐣</button>
                <button className="pauseBtn" title="Spieler entfernen"
                  onClick={() => removePlayer(p.id)}>✕</button>
              </div>
            ))}
            <div className="small" style={{ textAlign: "left", margin: "4px 0 12px" }}>
              Entfernen mitten in der Hand wirkt wie ein Fold – bereits gesetzte Chips bleiben im Pot.
            </div>
            <h3 className="sec">Spieler hinzufügen</h3>
            <div className="row" style={{ marginBottom: 8 }}>
              <div style={{ flex: 2 }}>
                <span className="lbl">Name</span>
                <input type="text" value={newName} placeholder="Wer kommt dazu?"
                  onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <span className="lbl">Buy-in (Chips)</span>
                <input type="number" value={newBuyIn}
                  onChange={(e) => setNewBuyIn(Math.max(1, +e.target.value || 0))} />
              </div>
            </div>
            <button className="btn gold" disabled={!newName.trim() || alive(players).length >= 9}
              onClick={addPlayer}>
              Hinzufügen – spielt ab nächster Hand
            </button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setMgmtOpen(false)}>Schließen</button>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="overlay" onClick={() => setHelpOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="sec">Rangfolge der Hände</h3>
            <div className="small" style={{ textAlign: "left", marginBottom: 8 }}>
              1 schlägt alles. Ausgegraute Karten sind nur Beiwerk (Kicker).
            </div>
            {HANDS.map((h, i) => (
              <div className="hand" key={h.n}>
                <div className="rank">{i + 1}</div>
                <div className="info">
                  <div className="hn">{h.n}</div>
                  <div className="hd">{h.d}</div>
                </div>
                <div className="cards">{h.c.map((c, j) => <Mini c={c} key={j} />)}</div>
              </div>
            ))}
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setHelpOpen(false)}>Schließen</button>
          </div>
        </div>
      )}
    </div>
  );
}
