const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let currentRound = null;
let history = [];

function getIST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 19800000);
}

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

function run11RNG() {
  const freq = {};
  for (let i = 0; i < 11; i++) {
    const n = Math.floor(Math.random() * 10);
    freq[n] = (freq[n] || 0) + 1;
  }

  let small = 0, big = 0;
  for (let i = 0; i <= 4; i++) small += freq[i] || 0;
  for (let i = 5; i <= 9; i++) big += freq[i] || 0;

  const group = small > big ? "SMALL" : "BIG";
  const range = group === "SMALL" ? [0, 4] : [5, 9];

  let final = range[0], max = -1;
  for (let i = range[0]; i <= range[1]; i++) {
    if ((freq[i] || 0) > max) {
      max = freq[i] || 0;
      final = i;
    }
  }

  return { final, group };
}

setInterval(() => {
  const now = getIST();
  const sec = now.getSeconds();

  if (sec === 0) {
    currentRound = {
      period: getPeriod(now),
      ...run11RNG(),
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