async function load() {
  const res = await fetch("/api/state");
  const data = await res.json();

  document.getElementById("timer").innerText =
    `00:${String(59 - data.seconds).padStart(2, "0")}`;

  if (!data.round) return;

  if (data.seconds >= 35) {
    document.getElementById("num").innerText = data.round.final;
    document.getElementById("status").innerText =
      data.seconds === 59 ? "FINAL LOCKED" : "PREVIOUS";
  } else {
    document.getElementById("status").innerText = "RNG CALCULATING";
  }
}

setInterval(load, 1000);
load();