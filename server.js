const express = require("express");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let currentRound = null;
let history = [];

/* ================ TIME ================ */

function getIST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 19800000);
}

/* ================ PERIOD ================ */

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

/* ================ PRNG ================ */

// Xorshift32 stream
function createXorShift(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/* ================ 51000 RNG CALCULATION (LOGIC SAME) ================ */

function run51000RNG() {
  const freq = {};
  const baseSeed = Date.now() ^ crypto.randomInt(0, 100000);

  const rng = createXorShift(baseSeed);

  // 🔥 MAIN CHANGE HERE
  for (let i = 0; i < 51000; i++) {
    const n = Math.floor(rng() * 10);   // 0–9
    freq[n] = (freq[n] || 0) + 1;
  }

  // Big / Small (exact wahi rule)
  let small = 0, big = 0;

  for (let i = 0; i <= 4; i++) {
    small += freq[i] || 0;
  }

  for (let i = 5; i <= 9; i++) {
    big += freq[i] || 0;
  }

  const group = small > big ? "SMALL" : "BIG";
  const range = group === "SMALL" ? [0, 4] : [5, 9];

  // Final = max frequency inside winning group
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

/* ================ ROUND FLOW ================ */

setInterval(() => {
  const now = getIST();
  const sec = now.getSeconds();

  // NEW ROUND START
  if (sec === 0) {
    currentRound = {
      period: getPeriod(now),
      ...run51000RNG(),   // 🔥 51000 RNG used
      locked: false
    };
  }

  // FINAL LOCK + HISTORY ADD
  if (sec === 59 && currentRound && !currentRound.locked) {
    currentRound.locked = true;

    history.unshift({
      period: currentRound.period,
      result: currentRound.final,
      group: currentRound.group,
      time: now.toLocaleTimeString()
    });

    history = history.slice(0, 50); // max 50 wahi
  }

}, 1000);

/* ================ API ================ */

app.get("/api/state", (req, res) => {
  res.json({
    seconds: getIST().getSeconds(),
    round: currentRound,
    history
  });
});

app.listen(PORT, () => {
  console.log("RNG Server running on", PORT);
});
