const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ROUND_DURATION   = 120_000; // 2 min
const CANDLE_DURATION  =  10_000; // 10s per candle
const LOBBY_DURATION   =  15_000; // 15s lobby between rounds
const CLICK_IMPACT     = 0.02;    // $ per click
const MAX_CLICKS_PER_SECOND = 8;  // rate limit per socket
const STARTING_PRICE   = 178.50;

// ── RATE LIMITER (per socket) ─────────────────────────────────────────────────
const clickCounts = new Map(); // socketId → { count, resetAt }

function isRateLimited(socketId) {
  const now = Date.now();
  const entry = clickCounts.get(socketId);
  if (!entry || now > entry.resetAt) {
    clickCounts.set(socketId, { count: 1, resetAt: now + 1000 });
    return false;
  }
  if (entry.count >= MAX_CLICKS_PER_SECOND) return true;
  entry.count++;
  return false;
}

// ── GAME STATE ────────────────────────────────────────────────────────────────
let state = {
  phase: "lobby",        // lobby | battle | results
  roundStartAt: null,
  candleStartAt: null,
  lobbyEndsAt: null,

  price: STARTING_PRICE,
  candleOpen: STARTING_PRICE,
  candleHigh: STARTING_PRICE,
  candleLow: STARTING_PRICE,

  candles: [],
  score: { green: 0, red: 0 },

  totalGreen: 0,
  totalRed: 0,
  candleGreen: 0,
  candleRed: 0,

  players: 0,
  winner: null,
};

let roundTimer   = null;
let candleTimer  = null;
let lobbyTimer   = null;
let tickInterval = null;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getPublicState() {
  return {
    phase:        state.phase,
    price:        state.price,
    candleOpen:   state.candleOpen,
    candleHigh:   state.candleHigh,
    candleLow:    state.candleLow,
    candles:      state.candles,
    score:        state.score,
    totalGreen:   state.totalGreen,
    totalRed:     state.totalRed,
    candleGreen:  state.candleGreen,
    candleRed:    state.candleRed,
    players:      state.players,
    winner:       state.winner,
    roundEndsAt:  state.roundStartAt ? state.roundStartAt + ROUND_DURATION : null,
    candleEndsAt: state.candleStartAt ? state.candleStartAt + CANDLE_DURATION : null,
    lobbyEndsAt:  state.lobbyEndsAt,
  };
}

function sealCandle() {
  const candle = {
    open:       state.candleOpen,
    close:      state.price,
    high:       state.candleHigh,
    low:        state.candleLow,
    isGreen:    state.price >= state.candleOpen,
    greenClicks: state.candleGreen,
    redClicks:   state.candleRed,
    ts:         Date.now(),
  };
  state.candles.push(candle);

  // Score point for this candle
  if (candle.isGreen) state.score.green++;
  else                state.score.red++;

  io.emit("candle_sealed", { candle, score: state.score });

  // Reset candle state
  state.candleOpen  = state.price;
  state.candleHigh  = state.price;
  state.candleLow   = state.price;
  state.candleGreen = 0;
  state.candleRed   = 0;
  state.candleStartAt = Date.now();
}

function endRound() {
  clearInterval(candleTimer);
  clearInterval(tickInterval);
  clearTimeout(roundTimer);

  // Seal last partial candle
  sealCandle();

  const { green, red } = state.score;
  state.winner = green > red ? "green" : red > green ? "red" : "draw";
  state.phase  = "results";

  io.emit("round_end", { score: state.score, winner: state.winner, candles: state.candles });

  // Schedule next lobby
  setTimeout(startLobby, 8000);
}

function startLobby() {
  clearInterval(candleTimer);
  clearInterval(tickInterval);
  clearTimeout(roundTimer);
  clearTimeout(lobbyTimer);

  state = {
    ...state,
    phase:       "lobby",
    lobbyEndsAt: Date.now() + LOBBY_DURATION,
    price:       STARTING_PRICE,
    candleOpen:  STARTING_PRICE,
    candleHigh:  STARTING_PRICE,
    candleLow:   STARTING_PRICE,
    candles:     [],
    score:       { green: 0, red: 0 },
    totalGreen:  0,
    totalRed:    0,
    candleGreen: 0,
    candleRed:   0,
    winner:      null,
    roundStartAt: null,
    candleStartAt: null,
  };

  io.emit("lobby", { lobbyEndsAt: state.lobbyEndsAt });

  lobbyTimer = setTimeout(startBattle, LOBBY_DURATION);
}

function startBattle() {
  state.phase        = "battle";
  state.roundStartAt = Date.now();
  state.candleStartAt = Date.now();

  io.emit("battle_start", getPublicState());

  // Candle sealing every 10s
  candleTimer = setInterval(() => {
    sealCandle();
    io.emit("state_update", getPublicState());
  }, CANDLE_DURATION);

  // Broadcast live tick every 200ms
  tickInterval = setInterval(() => {
    io.emit("tick", {
      price:       state.price,
      candleOpen:  state.candleOpen,
      candleHigh:  state.candleHigh,
      candleLow:   state.candleLow,
      candleGreen: state.candleGreen,
      candleRed:   state.candleRed,
      roundEndsAt: state.roundStartAt + ROUND_DURATION,
      candleEndsAt: state.candleStartAt + CANDLE_DURATION,
    });
  }, 200);

  // Round end
  roundTimer = setTimeout(endRound, ROUND_DURATION);
}

// ── SOCKET EVENTS ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  state.players++;
  io.emit("players_update", { players: state.players });

  // Send current state to newcomer
  socket.emit("init", getPublicState());

  socket.on("click", ({ team }) => {
    if (state.phase !== "battle") return;
    if (team !== "green" && team !== "red") return;
    if (isRateLimited(socket.id)) return;

    // Apply price impact (server is source of truth)
    const impact = team === "green" ? CLICK_IMPACT : -CLICK_IMPACT;
    state.price = Math.max(0.01, parseFloat((state.price + impact).toFixed(4)));

    if (state.price > state.candleHigh) state.candleHigh = state.price;
    if (state.price < state.candleLow)  state.candleLow  = state.price;

    if (team === "green") { state.totalGreen++; state.candleGreen++; }
    else                  { state.totalRed++;   state.candleRed++;   }

    // Broadcast click to all (lightweight)
    io.emit("click_update", {
      team,
      price:      state.price,
      totalGreen: state.totalGreen,
      totalRed:   state.totalRed,
      candleGreen: state.candleGreen,
      candleRed:   state.candleRed,
    });
  });

  socket.on("disconnect", () => {
    state.players = Math.max(0, state.players - 1);
    clickCounts.delete(socket.id);
    io.emit("players_update", { players: state.players });
  });
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ ok: true, players: state.players, phase: state.phase }));

// ── BOOT ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Bulk Wars server running on port ${PORT}`);
  startLobby();
});
