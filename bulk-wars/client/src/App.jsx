import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const MAX_VISIBLE_CANDLES = 30;

// ── SOCKET ────────────────────────────────────────────────────────────────────
const socket = io(SERVER_URL, { autoConnect: true, reconnectionDelay: 1000 });

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
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          fontSize: s.size,
          color: "rgba(255,255,255,0.6)",
          animation: `starPop ${s.duration}ms ease-in-out forwards`,
          transform: "translate(-50%, -50%)",
          lineHeight: 1,
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
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
      animation: "fadeInOut 5s ease forwards",
    }}>
      {/* Background image with color filter */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url(https://i.imgur.com/w5eI4uC.jpeg)",
        backgroundSize: "cover", backgroundPosition: "center",
        filter: winner === "red" ? "hue-rotate(130deg) saturate(1.5)" : "none",
        opacity: 0.55,
      }} />
      {/* Dark overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.45)",
      }} />
      {/* Text */}
      <div style={{
        position: "relative", textAlign: "center", zIndex: 1,
      }}>
        <div style={{
          fontSize: 13, letterSpacing: 8,
          color: winner === "green" ? "#00ff78" : "#ff1744",
          marginBottom: 16, fontFamily: "'JetBrains Mono', monospace",
          animation: "slideUp 0.5s ease forwards",
        }}>
          ROUND OVER
        </div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 72, letterSpacing: 6, lineHeight: 1,
          color: winner === "green" ? "#00c853" : "#ff1744",
          textShadow: winner === "green"
            ? "0 0 40px rgba(0,200,83,0.8), 0 0 80px rgba(0,200,83,0.4)"
            : "0 0 40px rgba(255,23,68,0.8), 0 0 80px rgba(255,23,68,0.4)",
          animation: "slideUp 0.5s 0.1s ease forwards", opacity: 0,
        }}>
          {winner === "green" ? "🟢 GREEN WINS" : "🔴 RED WINS"}
        </div>
        <div style={{
          marginTop: 20, fontSize: 11, letterSpacing: 4,
          color: "rgba(255,255,255,0.4)",
          fontFamily: "'JetBrains Mono', monospace",
          animation: "slideUp 0.5s 0.2s ease forwards", opacity: 0,
        }}>
          NEXT ROUND STARTING SOON...
        </div>
      </div>
    </div>
  );
}

// ── CHART ─────────────────────────────────────────────────────────────────────
function CandleChart({ candles, liveCandle, width = 800, height = 280 }) {
  const all = liveCandle ? [...candles, { ...liveCandle, isCurrent: true }] : candles;
  const visible = all.slice(-MAX_VISIBLE_CANDLES);

  const prices = visible.flatMap(c => [c.high, c.low]).filter(Boolean);
  const chartMin = prices.length ? Math.min(...prices) - 0.05 : 177;
  const chartMax = prices.length ? Math.max(...prices) + 0.05 : 180;
  const range = chartMax - chartMin || 1;

  const slotW = 100 / MAX_VISIBLE_CANDLES;
  const bodyW = slotW * 0.55;

  const toY = v => ((chartMax - v) / range) * 100;

  const priceLevels = 5;

  return (
    <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" width="100%" height="100%"
      style={{ display: "block" }}>

      {/* Grid */}
      {Array.from({ length: priceLevels }).map((_, i) => {
        const t = i / (priceLevels - 1);
        const price = chartMax - t * range;
        return (
          <g key={i}>
            <line x1="0" y1={`${t * 100}`} x2="100" y2={`${t * 100}`}
              stroke="#0d1a0d" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}

      {/* Candles */}
      {visible.map((c, i) => {
        const xCenter = (i / MAX_VISIBLE_CANDLES) * 100 + slotW / 2;
        const openY  = toY(c.open);
        const closeY = toY(c.close ?? c.open);
        const highY  = toY(c.high ?? Math.max(c.open, c.close ?? c.open));
        const lowY   = toY(c.low  ?? Math.min(c.open, c.close ?? c.open));
        const bodyTop = Math.min(openY, closeY);
        const bodyH   = Math.max(Math.abs(closeY - openY), 0.4);
        const color   = c.isGreen ? "#00c853" : "#ff1744";

        return (
          <g key={i}>
            {/* Wick */}
            <line x1={xCenter} y1={highY} x2={xCenter} y2={lowY}
              stroke={color} strokeWidth="0.4" vectorEffect="non-scaling-stroke" opacity="0.9" />
            {/* Body */}
            <rect x={xCenter - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH}
              fill={c.isCurrent ? "none" : color}
              stroke={color}
              strokeWidth={c.isCurrent ? "0.5" : "0"}
              vectorEffect="non-scaling-stroke"
              opacity={c.isCurrent ? 1 : 0.92}
            />
            {/* Live glow fill */}
            {c.isCurrent && (
              <rect x={xCenter - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH}
                fill={c.isGreen ? "rgba(0,200,83,0.2)" : "rgba(255,23,68,0.2)"}
              />
            )}
          </g>
        );
      })}

      {/* Live price line */}
      {liveCandle && (() => {
        const y = toY(liveCandle.close ?? liveCandle.open);
        const color = liveCandle.isGreen ? "#00c853" : "#ff1744";
        return (
          <line x1="0" y1={y} x2="100" y2={y}
            stroke={color} strokeWidth="0.3" strokeDasharray="1.5 1"
            vectorEffect="non-scaling-stroke" opacity="0.6" />
        );
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
        <span key={t} style={{ fontSize: 9, color: "#334", fontFamily: "monospace", lineHeight: 1 }}>
          ${(chartMax - t * range).toFixed(2)}
        </span>
      ))}
    </div>
  );
}

// ── TIMER BAR ─────────────────────────────────────────────────────────────────
function TimerBar({ endsAt, duration, color }) {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    const iv = setInterval(() => {
      if (!endsAt) return;
      const remaining = Math.max(0, endsAt - Date.now());
      setPct((remaining / duration) * 100);
    }, 100);
    return () => clearInterval(iv);
  }, [endsAt, duration]);

  return (
    <div style={{ height: 3, background: "#0a100a", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: color,
        transition: "width 0.1s linear",
      }} />
    </div>
  );
}

// ── COUNTDOWN ─────────────────────────────────────────────────────────────────
function Countdown({ endsAt, label }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setMs(Math.max(0, (endsAt || 0) - Date.now()));
    }, 100);
    return () => clearInterval(iv);
  }, [endsAt]);

  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const display = `${m}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#445", letterSpacing: 3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: ms < 10000 ? "#ff1744" : "#e0e8f0" }}>
        {display}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [connected, setConnected] = useState(false);
  const [game, setGame] = useState(null);
  const [liveCandle, setLiveCandle] = useState(null);
  const [ripples, setRipples] = useState([]);
  const [lastTeam, setLastTeam] = useState(null);
  const [myClicks, setMyClicks] = useState({ green: 0, red: 0 });
  const [notification, setNotification] = useState(null);
  const [myTeam, setMyTeam] = useState(null); // null | "green" | "red"

  // ── SOCKET LISTENERS ──────────────────────────────────────────────────────
  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("init", (data) => {
      setGame(data);
      setLiveCandle(data.phase === "battle" ? {
        open: data.candleOpen,
        close: data.price,
        high: data.candleHigh,
        low: data.candleLow,
        isGreen: data.price >= data.candleOpen,
      } : null);
    });

    socket.on("lobby", (data) => {
      setMyTeam(null);
      setGame(prev => ({ ...prev, phase: "lobby", ...data, candles: [], score: { green: 0, red: 0 }, winner: null }));
      setLiveCandle(null);
      setMyClicks({ green: 0, red: 0 });
    });

    socket.on("battle_start", (data) => {
      setGame(data);
      setLiveCandle({ open: data.price, close: data.price, high: data.price, low: data.price, isGreen: true });
      notify("⚔️ BATTLE START !");
    });

    socket.on("tick", (data) => {
      setLiveCandle({
        open:    data.candleOpen,
        close:   data.price,
        high:    data.candleHigh,
        low:     data.candleLow,
        isGreen: data.price >= data.candleOpen,
      });
      setGame(prev => prev ? {
        ...prev,
        price:       data.price,
        roundEndsAt: data.roundEndsAt,
        candleEndsAt: data.candleEndsAt,
        candleGreen: data.candleGreen,
        candleRed:   data.candleRed,
      } : prev);
    });

    socket.on("click_update", (data) => {
      setGame(prev => prev ? {
        ...prev,
        price:       data.price,
        totalGreen:  data.totalGreen,
        totalRed:    data.totalRed,
        candleGreen: data.candleGreen,
        candleRed:   data.candleRed,
      } : prev);
      setLiveCandle(prev => prev ? {
        ...prev,
        close: data.price,
        high:  Math.max(prev.high, data.price),
        low:   Math.min(prev.low, data.price),
        isGreen: data.price >= prev.open,
      } : prev);
    });

    socket.on("candle_sealed", ({ candle, score }) => {
      setGame(prev => prev ? { ...prev, candles: [...(prev.candles || []), candle], score } : prev);
      setLiveCandle(prev => prev ? { open: candle.close, close: candle.close, high: candle.close, low: candle.close, isGreen: true } : prev);
    });

    socket.on("round_end", ({ score, winner, candles }) => {
      setGame(prev => prev ? { ...prev, phase: "results", score, winner, candles } : prev);
      setLiveCandle(null);
      notify(winner === "green" ? "🟢 TEAM GREEN WINS!" : winner === "red" ? "🔴 TEAM RED WINS!" : "🤝 DRAW!");
    });

    socket.on("players_update", ({ players }) => {
      setGame(prev => prev ? { ...prev, players } : prev);
    });

    socket.on("state_update", (data) => {
      setGame(prev => prev ? { ...prev, ...data } : data);
    });

    return () => socket.removeAllListeners();
  }, []);

  // ── NOTIFICATION ──────────────────────────────────────────────────────────
  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ── CLICK HANDLER ─────────────────────────────────────────────────────────
  const handleClick = useCallback((team) => {
    if (!game || game.phase !== "battle") return;
    if (myTeam && myTeam !== team) return;
    socket.emit("click", { team });
    setLastTeam(team);
    setMyClicks(prev => ({ ...prev, [team]: prev[team] + 1 }));
    setTimeout(() => setLastTeam(null), 120);

    // Ripple
    const id = Date.now() + Math.random();
    setRipples(r => [...r, { id, team }]);
    setTimeout(() => setRipples(r => r.filter(x => x.id !== id)), 700);
  }, [game]);

  if (!connected || !game) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#060a0f", color: "#334", fontFamily: "JetBrains Mono, monospace",
        flexDirection: "column", gap: 16,
      }}>
        <div style={{ width: 32, height: 32, border: "2px solid #00ff78", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: 11, letterSpacing: 4 }}>CONNECTING TO SERVER...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const { phase, score, candles = [], players, winner, roundEndsAt, candleEndsAt, lobbyEndsAt,
    price = 178.5, totalGreen = 0, totalRed = 0, candleGreen = 0, candleRed = 0 } = game;

  const totalClicks = totalGreen + totalRed;
  const greenPct = totalClicks ? (totalGreen / totalClicks) * 100 : 50;
  const candlePct = candleGreen + candleRed > 0 ? (candleGreen / (candleGreen + candleRed)) * 100 : 50;
  const totalScore = score.green + score.red;

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#060a0f", fontFamily: "'JetBrains Mono', monospace",
      color: "#e0e8f0", overflow: "hidden", position: "relative",
      userSelect: "none",
    }}>
      {/* Background image */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "url(https://i.imgur.com/IFdJQzc.jpeg)",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: 0.18,
      }} />
      {/* Dark overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "linear-gradient(to bottom, rgba(6,10,15,0.7) 0%, rgba(6,10,15,0.85) 100%)",
      }} />
      {/* Grid bg */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(0,255,120,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,120,0.02) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.02) 2px,rgba(0,0,0,0.02) 4px)" }} />
      {/* Stars */}
      <Stars />
      {/* Victory Popup */}
      <VictoryPopup winner={winner} />
      {/* BULK CONTRIBUTOR badge */}
      <div style={{
        position: "fixed", bottom: 110, right: 16, zIndex: 50,
        display: "flex", alignItems: "center", gap: 6,
        color: "rgba(255,255,255,0.25)", fontSize: 10, letterSpacing: 4,
        fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
        pointerEvents: "none",
      }}>
        <span style={{ fontSize: 14 }}>✦</span>
        <span>BULK CONTRIBUTOR</span>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)",
          background: "#0d1a0d", border: "1px solid #00c853", color: "#00ff78",
          padding: "10px 24px", fontSize: 13, letterSpacing: 3, zIndex: 100,
          fontWeight: 700, borderRadius: 2,
          animation: "fadeInDown 0.3s ease",
        }}>
          {notification}
        </div>
      )}

      <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column" }}>

        {/* ── HEADER ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", borderBottom: "1px solid #0d1a0d",
          background: "rgba(6,10,15,0.95)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: phase === "battle" ? "#00ff78" : phase === "lobby" ? "#ffaa00" : "#ff1744",
              boxShadow: phase === "battle" ? "0 0 10px #00ff78" : "none",
              animation: phase === "battle" ? "blink 1.2s infinite" : "none",
            }} />
            <span style={{ fontSize: 16, letterSpacing: 4, color: "#00ff78", fontFamily: "'Bebas Neue', sans-serif" }}>BULK WARS</span>
            <span style={{ fontSize: 9, color: "#334", letterSpacing: 2, marginLeft: 4 }}>
              {phase === "battle" ? "● LIVE" : phase === "lobby" ? "LOBBY" : "RESULTS"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {phase === "battle" && (
              <>
                <Countdown endsAt={roundEndsAt} label="ROUND" />
                <div style={{ width: 1, height: 28, background: "#0d1a0d" }} />
                <Countdown endsAt={candleEndsAt} label="CANDLE" />
                <div style={{ width: 1, height: 28, background: "#0d1a0d" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#445", letterSpacing: 2, marginBottom: 2 }}>PRICE</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: liveCandle?.isGreen ? "#00c853" : "#ff1744" }}>
                    ${price.toFixed(2)}
                  </div>
                </div>
              </>
            )}
            {phase === "lobby" && <Countdown endsAt={lobbyEndsAt} label="STARTS IN" />}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#334" }} />
            <span style={{ fontSize: 9, color: "#445", letterSpacing: 2 }}>{players} ONLINE</span>
          </div>
        </div>

        {/* ── SCORE BAR ── */}
        <div style={{ padding: "6px 20px", background: "#04080a", flexShrink: 0, borderBottom: "1px solid #0a140a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#00c853", minWidth: 48 }}>
              {score.green} <span style={{ fontSize: 8, fontWeight: 400 }}>GRÜN</span>
            </span>
            <div style={{ flex: 1, height: 5, background: "#0a100a", borderRadius: 3, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${totalScore ? (score.green / totalScore) * 100 : 50}%`, background: "linear-gradient(90deg,#00c853,#69f0ae)", transition: "width 0.4s ease" }} />
              <div style={{ flex: 1, background: "linear-gradient(90deg,#b71c1c,#ff1744)" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#ff1744", minWidth: 48, textAlign: "right" }}>
              <span style={{ fontSize: 8, fontWeight: 400 }}>ROT </span>{score.red}
            </span>
          </div>
        </div>

        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, letterSpacing: 6, color: "#445", marginBottom: 12 }}>NEXT ROUND IN</div>
              <Countdown endsAt={lobbyEndsAt} label="" />
              <div style={{ marginTop: 24, fontSize: 11, color: "#334", letterSpacing: 3 }}>
                CHOOSE YOUR SIDE & CLICK TO MOVE THE PRICE
              </div>
            </div>
            <div style={{ display: "flex", gap: 40 }}>
              <button
                onClick={() => setMyTeam(myTeam === "green" ? null : "green")}
                style={{
                  textAlign: "center", padding: "20px 32px",
                  border: myTeam === "green" ? "2px solid #00c853" : "1px solid #00c85333",
                  borderRadius: 2, background: myTeam === "green" ? "rgba(0,200,83,0.15)" : "transparent",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                  transform: myTeam === "green" ? "scale(1.05)" : "scale(1)",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>▲</div>
                <div style={{ fontSize: 11, color: "#00c853", letterSpacing: 3, fontWeight: 800 }}>TEAM GREEN</div>
                <div style={{ fontSize: 9, color: "#334", marginTop: 4 }}>PUSH PRICE UP</div>
                {myTeam === "green" && <div style={{ fontSize: 9, color: "#00c853", marginTop: 6, letterSpacing: 2 }}>✓ SELECTED</div>}
              </button>
              <button
                onClick={() => setMyTeam(myTeam === "red" ? null : "red")}
                style={{
                  textAlign: "center", padding: "20px 32px",
                  border: myTeam === "red" ? "2px solid #ff1744" : "1px solid #ff174433",
                  borderRadius: 2, background: myTeam === "red" ? "rgba(255,23,68,0.15)" : "transparent",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                  transform: myTeam === "red" ? "scale(1.05)" : "scale(1)",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>▼</div>
                <div style={{ fontSize: 11, color: "#ff1744", letterSpacing: 3, fontWeight: 800 }}>TEAM RED</div>
                <div style={{ fontSize: 9, color: "#334", marginTop: 4 }}>PUSH PRICE DOWN</div>
                {myTeam === "red" && <div style={{ fontSize: 9, color: "#ff1744", marginTop: 6, letterSpacing: 2 }}>✓ SELECTED</div>}
              </button>
            </div>
            <div style={{ fontSize: 9, color: "#222", letterSpacing: 3 }}>
              {players} PLAYERS WAITING · 2 MIN ROUNDS · 10s CANDLES
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <div style={{ fontSize: 9, letterSpacing: 6, color: "#334" }}>ROUND OVER</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: 4 }}>
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
            <div style={{ fontSize: 9, color: "#225", letterSpacing: 3, marginTop: 8 }}>
              NEXT ROUND STARTING SOON...
            </div>
          </div>
        )}

        {/* ── BATTLE ── */}
        {phase === "battle" && (
          <>
            {/* Chart area */}
            <div style={{ flex: 1, display: "flex", minHeight: 0, padding: "8px 0 4px" }}>
              {/* Price labels */}
              <div style={{ width: 52, display: "flex", alignItems: "stretch", paddingLeft: 8 }}>
                <PriceLabels candles={candles} liveCandle={liveCandle} />
              </div>
              {/* Chart */}
              <div style={{ flex: 1, position: "relative", paddingRight: 8 }}>
                <CandleChart candles={candles} liveCandle={liveCandle} />
              </div>
            </div>

            {/* Candle pressure bar */}
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

            {/* My team info */}
            <div style={{ display: "flex", justifyContent: "center", gap: 24, padding: "2px 20px", flexShrink: 0 }}>
              {myTeam ? (
                <span style={{ fontSize: 9, color: myTeam === "green" ? "#00c853" : "#ff1744", letterSpacing: 2, fontWeight: 800 }}>
                  {myTeam === "green" ? "▲ TEAM GREEN" : "▼ TEAM RED"} · {myTeam === "green" ? myClicks.green : myClicks.red} CLICKS
                </span>
              ) : (
                <span style={{ fontSize: 9, color: "#445", letterSpacing: 2 }}>NO TEAM — CLICK A BUTTON TO JOIN</span>
              )}
            </div>

            {/* Battle buttons */}
            <div style={{ display: "flex", height: 100, flexShrink: 0 }}>
              {/* GREEN */}
              <button
                onClick={() => handleClick("green")}
                style={{
                  flex: 1,
                  background: lastTeam === "green" ? "rgba(0,200,83,0.22)" : "rgba(0,200,83,0.07)",
                  border: "none", borderTop: "2px solid #00c853",
                  color: "#00c853", cursor: myTeam === "red" ? "not-allowed" : "pointer", fontFamily: "inherit",
                  transition: "background 0.08s", position: "relative", overflow: "hidden",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                  opacity: myTeam === "red" ? 0.25 : 1,
                }}
              >
                <span style={{ fontSize: 26, lineHeight: 1, pointerEvents: "none" }}>▲</span>
                <span style={{ fontSize: 10, letterSpacing: 5, fontWeight: 800, pointerEvents: "none" }}>TEAM GREEN</span>
                <span style={{ fontSize: 8, color: "#336633", letterSpacing: 2, pointerEvents: "none" }}>{totalGreen} clicks</span>
                {ripples.filter(r => r.team === "green").map(r => (
                  <span key={r.id} style={{
                    position: "absolute", top: "50%", left: "50%",
                    width: 8, height: 8, marginLeft: -4, marginTop: -4,
                    borderRadius: "50%", background: "rgba(0,200,83,0.5)",
                    animation: "rippleOut 0.7s ease-out forwards", pointerEvents: "none",
                  }} />
                ))}
              </button>

              {/* Divider */}
              <div style={{ width: 1, background: "#0d1a0d", flexShrink: 0 }} />

              {/* RED */}
              <button
                onClick={() => handleClick("red")}
                style={{
                  flex: 1,
                  background: lastTeam === "red" ? "rgba(255,23,68,0.22)" : "rgba(255,23,68,0.07)",
                  border: "none", borderTop: "2px solid #ff1744",
                  color: "#ff1744", cursor: myTeam === "green" ? "not-allowed" : "pointer", fontFamily: "inherit",
                  transition: "background 0.08s", position: "relative", overflow: "hidden",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                  opacity: myTeam === "green" ? 0.25 : 1,
                }}
              >
                <span style={{ fontSize: 26, lineHeight: 1, pointerEvents: "none" }}>▼</span>
                <span style={{ fontSize: 10, letterSpacing: 5, fontWeight: 800, pointerEvents: "none" }}>TEAM RED</span>
                <span style={{ fontSize: 8, color: "#663333", letterSpacing: 2, pointerEvents: "none" }}>{totalRed} clicks</span>
                {ripples.filter(r => r.team === "red").map(r => (
                  <span key={r.id} style={{
                    position: "absolute", top: "50%", left: "50%",
                    width: 8, height: 8, marginLeft: -4, marginTop: -4,
                    borderRadius: "50%", background: "rgba(255,23,68,0.5)",
                    animation: "rippleOut 0.7s ease-out forwards", pointerEvents: "none",
                  }} />
                ))}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes fadeInOut { 0%{opacity:0} 10%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes starPop { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.3)} 30%{opacity:0.9;transform:translate(-50%,-50%) scale(1.1)} 70%{opacity:0.7;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(0.5)} }
        @keyframes rippleOut { 0%{width:8px;height:8px;margin-left:-4px;margin-top:-4px;opacity:1} 100%{width:220px;height:220px;margin-left:-110px;margin-top:-110px;opacity:0} }
        @keyframes fadeInDown { from{opacity:0;transform:translateX(-50%) translateY(-10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        button:active { transform: scale(0.98); }
      `}</style>
    </div>
  );
}
