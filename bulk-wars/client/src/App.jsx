import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const MAX_VISIBLE_CANDLES = 30;
const TWITTER_URL = "https://x.com/YujiiroHamna";

// ── SOCKET ────────────────────────────────────────────────────────────────────
const socket = io(SERVER_URL, { autoConnect: true, reconnectionDelay: 1000 });

// ── LOCAL LEADERBOARD ─────────────────────────────────────────────────────────
function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem("bw_leaderboard") || "[]"); } catch { return []; }
}
function saveLeaderboard(lb) {
  try { localStorage.setItem("bw_leaderboard", JSON.stringify(lb)); } catch {}
}
function updateLeaderboard(pseudo, team, clicks) {
  if (!pseudo || clicks === 0) return;
  const lb = getLeaderboard();
  const existing = lb.find(e => e.pseudo === pseudo);
  if (existing) {
    existing.totalClicks = (existing.totalClicks || 0) + clicks;
    existing.greenClicks = (existing.greenClicks || 0) + (team === "green" ? clicks : 0);
    existing.redClicks   = (existing.redClicks   || 0) + (team === "red"   ? clicks : 0);
    existing.rounds      = (existing.rounds      || 0) + 1;
  } else {
    lb.push({ pseudo, totalClicks: clicks, greenClicks: team === "green" ? clicks : 0, redClicks: team === "red" ? clicks : 0, rounds: 1 });
  }
  lb.sort((a, b) => b.totalClicks - a.totalClicks);
  saveLeaderboard(lb.slice(0, 20));
}

// ── STARS ─────────────────────────────────────────────────────────────────────
function Stars() {
  const [stars, setStars] = useState([]);
  useEffect(() => {
    const spawn = () => {
      const id = Date.now() + Math.random();
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const size = Math.random() * 10 + 8;
      const duration = Math.random() * 1500 + 800;
      setStars(prev => [...prev.slice(-30), { id, x, y, size, duration }]);
      setTimeout(() => setStars(prev => prev.filter(s => s.id !== id)), duration);
    };
    const iv = setInterval(spawn, 300);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, overflow: "hidden" }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
          fontSize: s.size, color: "rgba(255,255,255,0.6)",
          animation: `starPop ${s.duration}ms ease-in-out forwards`,
          transform: "translate(-50%, -50%)", lineHeight: 1,
        }}>✦</div>
      ))}
    </div>
  );
}

// ── VICTORY POPUP ─────────────────────────────────────────────────────────────
function VictoryPopup({ winner }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (winner && winner !== "draw") {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [winner]);
  if (!visible || !winner || winner === "draw") return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", animation: "fadeInOut 5s ease forwards" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url(https://i.imgur.com/w5eI4uC.jpeg)", backgroundSize: "cover", backgroundPosition: "center", filter: winner === "red" ? "hue-rotate(130deg) saturate(1.5)" : "none", opacity: 0.55 }} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
      <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: 13, letterSpacing: 8, color: winner === "green" ? "#00ff78" : "#ff1744", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", animation: "slideUp 0.5s ease forwards" }}>ROUND OVER</div>
        <div style={{ fontSize: 72, letterSpacing: 6, lineHeight: 1, color: winner === "green" ? "#00c853" : "#ff1744", textShadow: winner === "green" ? "0 0 40px rgba(0,200,83,0.8)" : "0 0 40px rgba(255,23,68,0.8)", animation: "slideUp 0.5s 0.1s ease forwards", opacity: 0 }}>
          {winner === "green" ? "🟢 GREEN WINS" : "🔴 RED WINS"}
        </div>
        <div style={{ marginTop: 20, fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", animation: "slideUp 0.5s 0.2s ease forwards", opacity: 0 }}>NEXT ROUND STARTING SOON...</div>
      </div>
    </div>
  );
}

// ── LEADERBOARD PANEL ─────────────────────────────────────────────────────────
function LeaderboardPanel({ onClose }) {
  const [lb, setLb] = useState([]);
  useEffect(() => { setLb(getLeaderboard()); }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: "#060e0a", border: "1px solid #00c85344", borderRadius: 4, padding: "28px 32px", minWidth: 340, maxWidth: 420, fontFamily: "'JetBrains Mono', monospace" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, letterSpacing: 5, color: "#00c853", fontWeight: 800 }}>✦ LEADERBOARD</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#445", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        {lb.length === 0 ? (
          <div style={{ fontSize: 10, color: "#334", letterSpacing: 3, textAlign: "center", padding: "20px 0" }}>NO DATA YET — PLAY TO APPEAR!</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lb.map((e, i) => (
              <div key={e.pseudo} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 2, background: i === 0 ? "rgba(0,200,83,0.08)" : "rgba(255,255,255,0.02)", border: i === 0 ? "1px solid #00c85333" : "1px solid transparent" }}>
                <div style={{ fontSize: 12, color: i === 0 ? "#00c853" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#334", minWidth: 24, fontWeight: 800 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </div>
                <div style={{ flex: 1, fontSize: 11, color: "#e0e8f0", letterSpacing: 1 }}>{e.pseudo}</div>
                <div style={{ fontSize: 10, color: "#00c853" }}>▲{e.greenClicks || 0}</div>
                <div style={{ fontSize: 10, color: "#ff1744" }}>▼{e.redClicks || 0}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#e0e8f0", minWidth: 50, textAlign: "right" }}>{e.totalClicks} <span style={{ fontSize: 8, color: "#445" }}>CLICKS</span></div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, fontSize: 9, color: "#223", letterSpacing: 2, textAlign: "center" }}>CLICK OUTSIDE TO CLOSE · LOCAL STORAGE</div>
      </div>
    </div>
  );
}

// ── PSEUDO MODAL ──────────────────────────────────────────────────────────────
function PseudoModal({ onConfirm }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "#060e0a", border: "1px solid #00c85366", borderRadius: 4, padding: "36px 40px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", maxWidth: 360, width: "90%" }}>
        <div style={{ fontSize: 9, letterSpacing: 6, color: "#445", marginBottom: 8 }}>WELCOME TO</div>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 4, color: "#00c853", marginBottom: 4 }}>BULK WARS</div>
        <div style={{ fontSize: 9, color: "#334", letterSpacing: 3, marginBottom: 28 }}>ENTER YOUR PSEUDO</div>
        <input
          autoFocus maxLength={16} value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && val.trim() && onConfirm(val.trim())}
          placeholder="YourPseudo"
          style={{ background: "#0a140a", border: "1px solid #00c85344", borderRadius: 2, color: "#00c853", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 3, padding: "10px 16px", width: "100%", textAlign: "center", outline: "none", boxSizing: "border-box" }}
        />
        <button
          onClick={() => val.trim() && onConfirm(val.trim())}
          style={{ marginTop: 16, width: "100%", padding: "12px", background: val.trim() ? "rgba(0,200,83,0.15)" : "rgba(0,200,83,0.04)", border: "1px solid #00c85344", borderRadius: 2, color: val.trim() ? "#00c853" : "#334", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 4, cursor: val.trim() ? "pointer" : "default", transition: "all 0.2s" }}
        >
          JOIN THE BATTLE
        </button>
        <div style={{ marginTop: 12, fontSize: 9, color: "#223", letterSpacing: 2 }}>MAX 16 CHARACTERS</div>
      </div>
    </div>
  );
}



// ── COUNTDOWN INLINE ─────────────────────────────────────────────────────────
function CountdownInline({ endsAt }) {
  const [ms, setMs] = useState(Math.max(0, (endsAt || 0) - Date.now()));
  useEffect(() => {
    const iv = setInterval(() => setMs(Math.max(0, (endsAt || 0) - Date.now())), 100);
    return () => clearInterval(iv);
  }, [endsAt]);
  const s = Math.ceil(ms / 1000);
  return (
    <div style={{ marginBottom: 20, fontSize: 11, letterSpacing: 3, color: s <= 3 ? "#ff1744" : "#f59e0b", fontWeight: 800, animation: s <= 3 ? "blink 0.5s infinite" : "none" }}>
      ⏱ NEXT ROUND IN {s}s
    </div>
  );
}

// ── TEAM SELECT MODAL ─────────────────────────────────────────────────────────
function TeamSelectModal({ pseudo, lobbyEndsAt, onConfirm }) {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "#060e0a", border: "1px solid #00c85366", borderRadius: 4, padding: "36px 40px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", maxWidth: 420, width: "90%" }}>
        <div style={{ fontSize: 9, letterSpacing: 6, color: "#445", marginBottom: 4 }}>WELCOME, {pseudo}</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 4, color: "#e0e8f0", marginBottom: 6 }}>CHOOSE YOUR TEAM</div>
        <div style={{ fontSize: 9, color: "#334", letterSpacing: 3, marginBottom: 12 }}>YOUR SIDE FOR THIS ROUND</div>
        {lobbyEndsAt && <CountdownInline endsAt={lobbyEndsAt} />}
        <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
          <button onClick={() => setSelected("green")} style={{ padding: "20px 28px", border: selected === "green" ? "2px solid #00c853" : "1px solid #00c85333", borderRadius: 2, background: selected === "green" ? "rgba(0,200,83,0.15)" : "transparent", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", transform: selected === "green" ? "scale(1.05)" : "scale(1)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>▲</div>
            <div style={{ fontSize: 11, color: "#00c853", letterSpacing: 3, fontWeight: 800 }}>TEAM GREEN</div>
            <div style={{ fontSize: 9, color: "#334", marginTop: 4 }}>PUSH PRICE UP</div>
            {selected === "green" && <div style={{ fontSize: 9, color: "#00c853", marginTop: 6, letterSpacing: 2 }}>✓ SELECTED</div>}
          </button>
          <button onClick={() => setSelected("red")} style={{ padding: "20px 28px", border: selected === "red" ? "2px solid #ff1744" : "1px solid #ff174433", borderRadius: 2, background: selected === "red" ? "rgba(255,23,68,0.15)" : "transparent", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", transform: selected === "red" ? "scale(1.05)" : "scale(1)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>▼</div>
            <div style={{ fontSize: 11, color: "#ff1744", letterSpacing: 3, fontWeight: 800 }}>TEAM RED</div>
            <div style={{ fontSize: 9, color: "#334", marginTop: 4 }}>PUSH PRICE DOWN</div>
            {selected === "red" && <div style={{ fontSize: 9, color: "#ff1744", marginTop: 6, letterSpacing: 2 }}>✓ SELECTED</div>}
          </button>
        </div>
        <button
          onClick={() => selected && onConfirm(selected)}
          style={{ marginTop: 24, width: "100%", padding: "12px", background: selected ? (selected === "green" ? "rgba(0,200,83,0.15)" : "rgba(255,23,68,0.15)") : "rgba(255,255,255,0.04)", border: selected ? `1px solid ${selected === "green" ? "#00c853" : "#ff1744"}44` : "1px solid #111", borderRadius: 2, color: selected ? (selected === "green" ? "#00c853" : "#ff1744") : "#334", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 4, cursor: selected ? "pointer" : "default", transition: "all 0.2s" }}
        >
          {selected ? "JOIN THE BATTLE →" : "SELECT A TEAM FIRST"}
        </button>
      </div>
    </div>
  );
}

// ── CHART ─────────────────────────────────────────────────────────────────────
function CandleChart({ candles, liveCandle }) {
  const all = liveCandle ? [...candles, { ...liveCandle, isCurrent: true }] : candles;
  const visible = all.slice(-MAX_VISIBLE_CANDLES);
  const prices = visible.flatMap(c => [c.high, c.low]).filter(Boolean);
  const chartMin = prices.length ? Math.min(...prices) - 0.05 : 177;
  const chartMax = prices.length ? Math.max(...prices) + 0.05 : 180;
  const range = chartMax - chartMin || 1;
  const slotW = 100 / MAX_VISIBLE_CANDLES;
  const bodyW = slotW * 0.55;
  const toY = v => ((chartMax - v) / range) * 100;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: "block" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1="0" y1={`${(i / 4) * 100}`} x2="100" y2={`${(i / 4) * 100}`} stroke="#0d1a0d" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
      ))}
      {visible.map((c, i) => {
        const xCenter = (i / MAX_VISIBLE_CANDLES) * 100 + slotW / 2;
        const openY   = toY(c.open);
        const closeY  = toY(c.close ?? c.open);
        const highY   = toY(c.high ?? Math.max(c.open, c.close ?? c.open));
        const lowY    = toY(c.low  ?? Math.min(c.open, c.close ?? c.open));
        const bodyTop = Math.min(openY, closeY);
        const bodyH   = Math.max(Math.abs(closeY - openY), 0.4);
        const isFlat  = Math.abs((c.close ?? c.open) - c.open) < 0.001;
        const color   = isFlat ? "#555" : (c.isGreen ? "#00c853" : "#ff1744");
        return (
          <g key={i}>
            <line x1={xCenter} y1={highY} x2={xCenter} y2={lowY} stroke={color} strokeWidth="0.4" vectorEffect="non-scaling-stroke" opacity="0.9" />
            <rect x={xCenter - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={c.isCurrent ? "none" : color} stroke={color} strokeWidth={c.isCurrent ? "0.5" : "0"} vectorEffect="non-scaling-stroke" opacity={c.isCurrent ? 1 : 0.92} />
            {c.isCurrent && <rect x={xCenter - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={isFlat ? "rgba(100,100,100,0.2)" : (c.isGreen ? "rgba(0,200,83,0.2)" : "rgba(255,23,68,0.2)")} />}
          </g>
        );
      })}
      {liveCandle && (() => {
        const y = toY(liveCandle.close ?? liveCandle.open);
        return <line x1="0" y1={y} x2="100" y2={y} stroke={liveCandle.isGreen ? "#00c853" : "#ff1744"} strokeWidth="0.3" strokeDasharray="1.5 1" vectorEffect="non-scaling-stroke" opacity="0.6" />;
      })()}
    </svg>
  );
}

// ── PRICE LABELS ──────────────────────────────────────────────────────────────
function PriceLabels({ candles, liveCandle }) {
  const all = liveCandle ? [...candles, liveCandle] : candles;
  const prices = all.flatMap(c => [c.high, c.low]).filter(Boolean);
  const chartMin = prices.length ? Math.min(...prices) - 0.05 : 177;
  const chartMax = prices.length ? Math.max(...prices) + 0.05 : 180;
  const range = chartMax - chartMin || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", paddingRight: 8 }}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <span key={t} style={{ fontSize: 9, color: "#334", fontFamily: "monospace", lineHeight: 1 }}>${(chartMax - t * range).toFixed(2)}</span>
      ))}
    </div>
  );
}

// ── TIMER BAR ─────────────────────────────────────────────────────────────────
function TimerBar({ endsAt, duration, color }) {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    const iv = setInterval(() => { if (!endsAt) return; setPct((Math.max(0, endsAt - Date.now()) / duration) * 100); }, 100);
    return () => clearInterval(iv);
  }, [endsAt, duration]);
  return (
    <div style={{ height: 3, background: "#0a100a", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.1s linear" }} />
    </div>
  );
}

// ── COUNTDOWN ─────────────────────────────────────────────────────────────────
function Countdown({ endsAt, label }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setMs(Math.max(0, (endsAt || 0) - Date.now())), 100);
    return () => clearInterval(iv);
  }, [endsAt]);
  const s = Math.floor(ms / 1000);
  return (
    <div style={{ textAlign: "center" }}>
      {label && <div style={{ fontSize: 9, color: "#445", letterSpacing: 3, marginBottom: 2 }}>{label}</div>}
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: ms < 10000 ? "#ff1744" : "#e0e8f0" }}>
        {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [connected, setConnected]           = useState(false);
  const [game, setGame]                     = useState(null);
  const [liveCandle, setLiveCandle]         = useState(null);
  const [ripples, setRipples]               = useState([]);
  const [lastTeam, setLastTeam]             = useState(null);
  const [myClicks, setMyClicks]             = useState({ green: 0, red: 0 });
  const [notification, setNotification]     = useState(null);
  const [myTeam, setMyTeam]                 = useState(null);
  const [pseudo, setPseudo]                 = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [needTeamSelect, setNeedTeamSelect] = useState(false);

  useEffect(() => {
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("init", (data) => {
      setGame(data);
      setLiveCandle(data.phase === "battle" ? { open: data.candleOpen, close: data.price, high: data.candleHigh, low: data.candleLow, isGreen: data.price >= data.candleOpen } : null);
    });
    socket.on("phase_change", (data) => {
      if (data.phase === "lobby") {
        setMyTeam(null);
        setMyClicks({ green: 0, red: 0 });
        setNeedTeamSelect(true);
      }
      setGame(prev => ({ ...prev, phase: data.phase, winner: data.winner, score: data.score, candles: data.candles || prev?.candles || [] }));
      setLiveCandle(null);
    });
    socket.on("tick", (data) => {
      setLiveCandle({ open: data.candleOpen, close: data.price, high: data.candleHigh, low: data.candleLow, isGreen: data.price >= data.candleOpen });
      setGame(prev => prev ? { ...prev, price: data.price, roundEndsAt: data.roundEndsAt, candleEndsAt: data.candleEndsAt, candleGreen: data.candleGreen, candleRed: data.candleRed } : prev);
    });
    socket.on("click_update", (data) => {
      setGame(prev => prev ? { ...prev, price: data.price, totalGreen: data.totalGreen, totalRed: data.totalRed, candleGreen: data.candleGreen, candleRed: data.candleRed } : prev);
      setLiveCandle(prev => prev ? { ...prev, close: data.price, high: Math.max(prev.high, data.price), low: Math.min(prev.low, data.price), isGreen: data.price >= prev.open } : prev);
    });
    socket.on("candle_sealed", (data) => {
      setGame(prev => prev ? { ...prev, candles: data.candles, candleGreen: 0, candleRed: 0 } : prev);
      setLiveCandle({ open: data.newOpen, close: data.newOpen, high: data.newOpen, low: data.newOpen, isGreen: true });
    });
    socket.on("player_count", (data) => setGame(prev => prev ? { ...prev, players: data.count } : prev));
    return () => socket.removeAllListeners();
  }, []);

  // Save leaderboard on results
  useEffect(() => {
    if (game?.phase === "results" && pseudo && myTeam) {
      const clicks = myTeam === "green" ? myClicks.green : myClicks.red;
      updateLeaderboard(pseudo, myTeam, clicks);
    }
  }, [game?.phase]);

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  }, []);

  const handleClick = useCallback((team) => {
    if (!game || game.phase !== "battle") return;
    if (!myTeam) { notify("⚠ CHOOSE A TEAM FIRST!"); return; }
    if (myTeam !== team) return;
    socket.emit("click", { team });
    setLastTeam(team);
    setMyClicks(prev => ({ ...prev, [team]: prev[team] + 1 }));
    setTimeout(() => setLastTeam(null), 120);
    const id = Date.now() + Math.random();
    setRipples(r => [...r, { id, team }]);
    setTimeout(() => setRipples(r => r.filter(x => x.id !== id)), 700);
  }, [game, myTeam, notify]);

  // ── PSEUDO SCREEN ─────────────────────────────────────────────────────────
  if (!pseudo) return (
    <>
      <div style={{ height: "100vh", background: "#060a0f", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "fixed", inset: 0, backgroundImage: "url(https://i.imgur.com/IFdJQzc.jpeg)", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.18 }} />
        <Stars />
      </div>
      <PseudoModal onConfirm={p => { setPseudo(p); setNeedTeamSelect(true); }} />
    </>
  );

  // ── CONNECTING ────────────────────────────────────────────────────────────
  if (!connected || !game) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060a0f", color: "#334", fontFamily: "JetBrains Mono, monospace", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 32, height: 32, border: "2px solid #00ff78", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 11, letterSpacing: 4 }}>CONNECTING TO SERVER...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const { phase, score, candles = [], players, winner, roundEndsAt, candleEndsAt, lobbyEndsAt,
    price = 178.5, totalGreen = 0, totalRed = 0, candleGreen = 0, candleRed = 0 } = game;
  const candlePct  = candleGreen + candleRed > 0 ? (candleGreen / (candleGreen + candleRed)) * 100 : 50;
  const totalScore = score.green + score.red;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#060a0f", fontFamily: "'JetBrains Mono', monospace", color: "#e0e8f0", overflow: "hidden", position: "relative", userSelect: "none" }}>

      {/* Backgrounds */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "url(https://i.imgur.com/IFdJQzc.jpeg)", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.18 }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "linear-gradient(to bottom, rgba(6,10,15,0.7) 0%, rgba(6,10,15,0.85) 100%)" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(0,255,120,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,120,0.02) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />

      <Stars />
      <VictoryPopup winner={winner} />
      {needTeamSelect && <TeamSelectModal pseudo={pseudo} lobbyEndsAt={game?.lobbyEndsAt} onConfirm={t => { setMyTeam(t); setNeedTeamSelect(false); }} />}
      {showLeaderboard && <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />}

      {notification && (
        <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", background: "#0d0808", border: "1px solid #ff1744", color: "#ff1744", padding: "10px 24px", fontSize: 13, letterSpacing: 3, zIndex: 100, fontWeight: 700, borderRadius: 2, animation: "fadeInDown 0.3s ease", whiteSpace: "nowrap" }}>
          {notification}
        </div>
      )}

      {/* BULK CONTRIBUTOR */}
      <div style={{ position: "fixed", bottom: 110, right: 16, zIndex: 50, display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: 4, fontWeight: 700, pointerEvents: "none" }}>
        <span style={{ fontSize: 14 }}>✦</span><span>BULK CONTRIBUTOR</span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 2, minHeight: 0 }}>

        {/* ── HEADER ── */}
        <div style={{ padding: "10px 16px", background: "rgba(4,8,10,0.85)", borderBottom: "1px solid #0a140a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, backdropFilter: "blur(4px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 4, color: "#e0e8f0" }}>BULK WARS</span>
            <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", border: "1px solid #f59e0b", borderRadius: 2, textDecoration: "none", background: "rgba(245,158,11,0.08)" }}>
              <span style={{ fontSize: 9, color: "#f59e0b", letterSpacing: 2, fontWeight: 700 }}>✦ By @YujiiroHamna</span>
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setShowLeaderboard(true)} style={{ background: "rgba(0,200,83,0.08)", border: "1px solid #00c85333", borderRadius: 2, color: "#00c853", cursor: "pointer", fontFamily: "inherit", fontSize: 9, letterSpacing: 3, padding: "4px 10px" }}>🏆 LEADERBOARD</button>
            <span style={{ fontSize: 9, color: myTeam === "green" ? "#00c853" : myTeam === "red" ? "#ff1744" : "#445", letterSpacing: 1 }}>{pseudo}</span>
            {phase === "battle" && <Countdown endsAt={roundEndsAt} label="ROUND" />}
            {phase === "lobby"  && <Countdown endsAt={lobbyEndsAt} label="STARTS IN" />}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00c853", animation: "blink 2s infinite" }} />
              <span style={{ fontSize: 9, color: "#445", letterSpacing: 2 }}>{players} ONLINE</span>
            </div>
          </div>
        </div>

        {/* ── SCORE BAR ── */}
        <div style={{ padding: "6px 20px", background: "rgba(4,8,10,0.7)", flexShrink: 0, borderBottom: "1px solid #0a140a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#00c853", minWidth: 48 }}>{score.green} <span style={{ fontSize: 8, fontWeight: 400 }}>GRN</span></span>
            <div style={{ flex: 1, height: 5, background: "#0a100a", borderRadius: 3, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${totalScore ? (score.green / totalScore) * 100 : 50}%`, background: "linear-gradient(90deg,#00c853,#69f0ae)", transition: "width 0.4s ease" }} />
              <div style={{ flex: 1, background: "linear-gradient(90deg,#b71c1c,#ff1744)" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#ff1744", minWidth: 48, textAlign: "right" }}><span style={{ fontSize: 8, fontWeight: 400 }}>RED </span>{score.red}</span>
          </div>
        </div>

        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, letterSpacing: 6, color: "#445", marginBottom: 12 }}>NEXT ROUND IN</div>
              <Countdown endsAt={lobbyEndsAt} />
              <div style={{ marginTop: 16, fontSize: 11, color: "#00c85388", letterSpacing: 2 }}>👋 {pseudo}</div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#334", letterSpacing: 3 }}>CHOOSE YOUR SIDE BEFORE THE ROUND STARTS</div>
            </div>
            <div style={{ display: "flex", gap: 40 }}>
              <button onClick={() => setMyTeam(myTeam === "green" ? null : "green")} style={{ textAlign: "center", padding: "20px 32px", border: myTeam === "green" ? "2px solid #00c853" : "1px solid #00c85333", borderRadius: 2, background: myTeam === "green" ? "rgba(0,200,83,0.15)" : "transparent", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", transform: myTeam === "green" ? "scale(1.05)" : "scale(1)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>▲</div>
                <div style={{ fontSize: 11, color: "#00c853", letterSpacing: 3, fontWeight: 800 }}>TEAM GREEN</div>
                <div style={{ fontSize: 9, color: "#334", marginTop: 4 }}>PUSH PRICE UP</div>
                {myTeam === "green" && <div style={{ fontSize: 9, color: "#00c853", marginTop: 6, letterSpacing: 2 }}>✓ SELECTED</div>}
              </button>
              <button onClick={() => setMyTeam(myTeam === "red" ? null : "red")} style={{ textAlign: "center", padding: "20px 32px", border: myTeam === "red" ? "2px solid #ff1744" : "1px solid #ff174433", borderRadius: 2, background: myTeam === "red" ? "rgba(255,23,68,0.15)" : "transparent", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", transform: myTeam === "red" ? "scale(1.05)" : "scale(1)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>▼</div>
                <div style={{ fontSize: 11, color: "#ff1744", letterSpacing: 3, fontWeight: 800 }}>TEAM RED</div>
                <div style={{ fontSize: 9, color: "#334", marginTop: 4 }}>PUSH PRICE DOWN</div>
                {myTeam === "red" && <div style={{ fontSize: 9, color: "#ff1744", marginTop: 6, letterSpacing: 2 }}>✓ SELECTED</div>}
              </button>
            </div>
            {!myTeam && <div style={{ fontSize: 9, color: "#ff174488", letterSpacing: 3 }}>⚠ YOU MUST CHOOSE A TEAM TO PLAY</div>}
            <div style={{ fontSize: 9, color: "#222", letterSpacing: 3 }}>{players} PLAYERS WAITING · 2 MIN ROUNDS · 10s CANDLES</div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <div style={{ fontSize: 9, letterSpacing: 6, color: "#334" }}>ROUND OVER</div>
            <div style={{ fontSize: 52, letterSpacing: 4 }}>
              {winner === "green" && <span style={{ color: "#00c853" }}>🟢 GREEN WINS</span>}
              {winner === "red"   && <span style={{ color: "#ff1744" }}>🔴 RED WINS</span>}
              {winner === "draw"  && <span style={{ color: "#666" }}>DRAW</span>}
            </div>
            <div style={{ display: "flex", gap: 48 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 44, fontWeight: 900, color: "#00c853", lineHeight: 1 }}>{score.green}</div>
                <div style={{ fontSize: 9, color: "#334", letterSpacing: 3, marginTop: 4 }}>GREEN CANDLES</div>
                <div style={{ fontSize: 10, color: "#226622", marginTop: 2 }}>{totalGreen} total clicks</div>
              </div>
              <div style={{ width: 1, background: "#0d1a0d", alignSelf: "stretch" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 44, fontWeight: 900, color: "#ff1744", lineHeight: 1 }}>{score.red}</div>
                <div style={{ fontSize: 9, color: "#334", letterSpacing: 3, marginTop: 4 }}>RED CANDLES</div>
                <div style={{ fontSize: 10, color: "#662222", marginTop: 2 }}>{totalRed} total clicks</div>
              </div>
            </div>
            {myTeam && (
              <div style={{ fontSize: 10, color: myTeam === "green" ? "#00c853" : "#ff1744", letterSpacing: 2 }}>
                {pseudo} · YOUR CLICKS: {myTeam === "green" ? myClicks.green : myClicks.red}
              </div>
            )}
            <div style={{ fontSize: 9, color: "#225", letterSpacing: 3, marginTop: 8 }}>NEXT ROUND STARTING SOON...</div>
          </div>
        )}

        {/* ── BATTLE ── */}
        {phase === "battle" && (
          <>
            <div style={{ flex: 1, display: "flex", minHeight: 0, padding: "8px 0 4px" }}>
              <div style={{ width: 52, display: "flex", alignItems: "stretch", paddingLeft: 8 }}>
                <PriceLabels candles={candles} liveCandle={liveCandle} />
              </div>
              <div style={{ flex: 1, position: "relative", paddingRight: 8 }}>
                <CandleChart candles={candles} liveCandle={liveCandle} />
              </div>
            </div>

            <div style={{ padding: "2px 20px 4px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 8, color: "#00c853", letterSpacing: 1, minWidth: 40 }}>+{candleGreen}</span>
                <div style={{ flex: 1, height: 4, background: "#0a100a", borderRadius: 2, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${candlePct}%`, background: "#00c853", transition: "width 0.1s ease" }} />
                  <div style={{ flex: 1, background: "#ff1744" }} />
                </div>
                <span style={{ fontSize: 8, color: "#ff1744", letterSpacing: 1, minWidth: 40, textAlign: "right" }}>{candleRed}-</span>
              </div>
              <TimerBar endsAt={candleEndsAt} duration={10000} color="#00ff7844" />
            </div>

            <div style={{ display: "flex", justifyContent: "center", padding: "2px 20px", flexShrink: 0 }}>
              {myTeam ? (
                <span style={{ fontSize: 9, color: myTeam === "green" ? "#00c853" : "#ff1744", letterSpacing: 2, fontWeight: 800 }}>
                  {myTeam === "green" ? "▲ TEAM GREEN" : "▼ TEAM RED"} · {myTeam === "green" ? myClicks.green : myClicks.red} CLICKS
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "#f59e0b", letterSpacing: 3, fontWeight: 800, background: "rgba(245,158,11,0.12)", border: "1px solid #f59e0baa", padding: "6px 18px", borderRadius: 2, animation: "blink 2s infinite" }}>⚠ SPECTATING — SELECT YOUR TEAM NEXT ROUND</span>
              )}
            </div>

            <div style={{ display: "flex", height: 100, flexShrink: 0 }}>
              <button onClick={() => handleClick("green")} style={{ flex: 1, background: lastTeam === "green" ? "rgba(0,200,83,0.22)" : "rgba(0,200,83,0.07)", border: "none", borderTop: "2px solid #00c853", color: "#00c853", cursor: (!myTeam || myTeam === "red") ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.08s", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, opacity: myTeam === "red" ? 0.15 : myTeam === null ? 0.35 : 1 }}>
                <span style={{ fontSize: 26, lineHeight: 1, pointerEvents: "none" }}>▲</span>
                <span style={{ fontSize: 10, letterSpacing: 5, fontWeight: 800, pointerEvents: "none" }}>TEAM GREEN</span>
                <span style={{ fontSize: 8, color: "#336633", letterSpacing: 2, pointerEvents: "none" }}>{totalGreen} clicks</span>
                {!myTeam && <span style={{ fontSize: 7, color: "#ff174466", letterSpacing: 1, pointerEvents: "none" }}>CHOOSE NEXT ROUND</span>}
                {ripples.filter(r => r.team === "green").map(r => (
                  <span key={r.id} style={{ position: "absolute", top: "50%", left: "50%", width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: "50%", background: "rgba(0,200,83,0.5)", animation: "rippleOut 0.7s ease-out forwards", pointerEvents: "none" }} />
                ))}
              </button>
              <div style={{ width: 1, background: "#0d1a0d", flexShrink: 0 }} />
              <button onClick={() => handleClick("red")} style={{ flex: 1, background: lastTeam === "red" ? "rgba(255,23,68,0.22)" : "rgba(255,23,68,0.07)", border: "none", borderTop: "2px solid #ff1744", color: "#ff1744", cursor: (!myTeam || myTeam === "green") ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.08s", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, opacity: myTeam === "green" ? 0.15 : myTeam === null ? 0.35 : 1 }}>
                <span style={{ fontSize: 26, lineHeight: 1, pointerEvents: "none" }}>▼</span>
                <span style={{ fontSize: 10, letterSpacing: 5, fontWeight: 800, pointerEvents: "none" }}>TEAM RED</span>
                <span style={{ fontSize: 8, color: "#663333", letterSpacing: 2, pointerEvents: "none" }}>{totalRed} clicks</span>
                {!myTeam && <span style={{ fontSize: 7, color: "#ff174466", letterSpacing: 1, pointerEvents: "none" }}>CHOOSE NEXT ROUND</span>}
                {ripples.filter(r => r.team === "red").map(r => (
                  <span key={r.id} style={{ position: "absolute", top: "50%", left: "50%", width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: "50%", background: "rgba(255,23,68,0.5)", animation: "rippleOut 0.7s ease-out forwards", pointerEvents: "none" }} />
                ))}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes rippleOut { 0%{width:8px;height:8px;margin-left:-4px;margin-top:-4px;opacity:1} 100%{width:220px;height:220px;margin-left:-110px;margin-top:-110px;opacity:0} }
        @keyframes fadeInDown { from{opacity:0;transform:translateX(-50%) translateY(-10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes fadeInOut { 0%{opacity:0} 10%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes starPop { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.3)} 30%{opacity:0.9;transform:translate(-50%,-50%) scale(1.1)} 70%{opacity:0.7;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(0.5)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        button:active { transform: scale(0.98); }
        input::placeholder { color: #223; }
      `}</style>
    </div>
  );
}
