const express = require("express");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let currentRound = null;
let history = [];

/* ================= TIME ================= */

function getIST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 19800000);
}

/* ================= PERIOD ================= */

function getPeriod(now) {
  const reset = new Date(now);
  reset.setHours(5, 30, 0, 0);
  if (now < reset) reset.setDate(reset.getDate() - 1);

  const y = reset.getFullYear();
  const m = String(reset.getMonth() + 1).padStart(2, "0");
  const d = String(reset.getDate()).padStart(2, "0");

  const minutesPassed = Math.floor((now - reset) / 60000);
  const roundIndex = minutesPassed + 1;

  return `${y}${m}${d}10001${roundIndex}`;
}

/* ================= PRNG ================= */

// Xorshift32
function xorshift32(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

// SplitMix64
function splitmix64(seed) {
  let x = BigInt(seed);
  return () => {
    x += 0x9E3779B97F4A7C15n;
    let z = x;
    z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n;
    z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn;
    z = z ^ (z >> 31n);
    return Number(z & 0xffffffffn) / 4294967296;
  };
}

/* ================= 51 HYBRID RNG ================= */

function run51HybridRNG() {
  const freq = {};
  const baseSeed = Date.now();

  // 1–30 : Modern PRNG (Xorshift)
  for (let i = 0; i < 30; i++) {
    const rng = xorshift32(baseSeed + i * 97);
    const n = Math.floor(rng() * 10);
    freq[n] = (freq[n] || 0) + 1;
  }

  // 31–45 : SplitMix64 (strong statistical)
  for (let i = 30; i < 45; i++) {
    const rng = splitmix64(baseSeed + i * 131);
    const n = Math.floor(rng() * 10);
    freq[n] = (freq[n] || 0) + 1;
  }

  // 46–51 : Cryptographic RNG
  for (let i = 45; i < 51; i++) {
    const n = crypto.randomInt(0, 10);
    freq[n] = (freq[n] || 0) + 1;
  }

  // Big / Small (logic SAME)
  let small = 0, big = 0;
  for (let i = 0; i <= 4; i++) small += freq[i] || 0;
  for (let i = 5; i <= 9; i++) big += freq[i] || 0;

  const group = small > big ? "SMALL" : "BIG";
  const range = group === "SMALL" ? [0, 4] : [5, 9];

  // Final number = max frequency in winning group
  let final = range[0];
  let max = -1;
  for (let i = range[0]; i <= range[1]; i++) {
    if ((freq[i] || 0) > max) {
      max = freq[i] || 0;
      final = i;
    }
  }

  return { final, group };
}

/* ================= ROUND FLOW ================= */

setInterval(() => {
  const now = getIST();
  const sec = now.getSeconds();

  if (sec === 0) {
    currentRound = {
      period: getPeriod(now),
      ...run51HybridRNG(), // 🔥 51 HYBRID RNG
      locked: false
    };
  }

  if (sec === 59 && currentRound && !currentRound.locked) {
    currentRound.locked = true;
    history.unshift({
      period: currentRound.period,
      result: currentRound.final,
      group: currentRound.group,
      time: now.toLocaleTimeString()
    });
    history = history.slice(0, 50);
  }
}, 1000);

/* ================= API ================= */

app.get("/api/state", (req, res) => {
  const now = getIST();
  res.json({
    seconds: now.getSeconds(),
    round: currentRound,
    history
  });
});

app.listen(PORT, () => {
  console.log("RNG Server running on", PORT);
});
