// Example of the sandboxed `custom` brick: a 10-second tap game. Each phone submits its best score with
// window.minint.submit and the page draws a top-5 leaderboard from the shared `answers`. The host sees
// the same board (role "host": no button, just the board).
import type { AppSpecDraft } from "./app-spec-schema";

interface TapGameWords {
  heading: string;
  ready: string;
  go: string;
  tap: string;
  timeLeft: string;
  best: string;
  top: string;
}

/** Self-contained page: inline style + script only, no network, no forms (passes the custom-code scan). */
export function tapGameHtml(w: TapGameWords): string {
  const words = JSON.stringify(w);
  return `<div style="padding:16px;text-align:center">
<h2 style="margin:0 0 6px;font-size:20px">${w.heading}</h2>
<div id="status" style="font-size:14px;color:#555">${w.ready}</div>
<button id="tap" type="button" style="font-size:28px;padding:22px 40px;border-radius:16px;border:0;background:#2563eb;color:#fff;margin:12px 0">${w.tap}</button>
<div id="score" style="font-size:22px;font-weight:700">0</div>
<div style="margin-top:14px;font-weight:600">${w.top}</div>
<ol id="board" style="text-align:left;max-width:300px;margin:6px auto 0;padding-left:24px"></ol>
</div>
<script>
var W = ${words};
var tapBtn = document.getElementById("tap");
var statusEl = document.getElementById("status");
var scoreEl = document.getElementById("score");
var boardEl = document.getElementById("board");
var taps = 0, best = 0, endsAt = 0, timer = null;

function drawBoard(state) {
  var rows = ((state && state.answers) || [])
    .filter(function (a) { return a.value && typeof a.value.score === "number"; })
    .sort(function (a, b) { return b.value.score - a.value.score; })
    .slice(0, 5);
  boardEl.textContent = "";
  rows.forEach(function (a) {
    var li = document.createElement("li");
    li.textContent = a.name + " - " + a.value.score;
    boardEl.appendChild(li);
  });
}

function finish() {
  clearInterval(timer);
  timer = null;
  if (taps > best) {
    best = taps;
    window.minint.submit({ score: best });
  }
  statusEl.textContent = W.best + ": " + best;
  tapBtn.textContent = W.tap;
}

tapBtn.addEventListener("click", function () {
  if (!timer) {
    taps = 0;
    endsAt = Date.now() + 10000;
    timer = setInterval(function () {
      var left = Math.max(0, endsAt - Date.now());
      statusEl.textContent = W.timeLeft + ": " + (left / 1000).toFixed(1) + "s";
      if (left === 0) finish();
    }, 100);
    statusEl.textContent = W.go;
  }
  taps += 1;
  scoreEl.textContent = String(taps);
});

window.minint.onState(function (state) {
  if (state.role === "host") tapBtn.style.display = "none";
  drawBoard(state);
});
</script>`;
}

export const TAP_GAME_VI: TapGameWords = { heading: "Bấm nhanh trong 10 giây", ready: "Bấm để bắt đầu", go: "Bấm thật nhanh!", tap: "Bấm!", timeLeft: "Còn lại", best: "Điểm cao nhất của bạn", top: "Top 5" };
export const TAP_GAME_EN: TapGameWords = { heading: "Tap as fast as you can for 10 seconds", ready: "Tap to start", go: "Go go go!", tap: "Tap!", timeLeft: "Time left", best: "Your best score", top: "Top 5" };

export const exampleTapSpeedGame: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Thi bấm nhanh 10 giây",
  description: "Bấm càng nhiều càng tốt trong 10 giây. Điểm cao nhất của bạn lên bảng top 5.",
  theme: "sunset",
  requireName: true,
  blocks: [{ type: "custom", id: "tap-game", title: "Bấm nhanh", html: tapGameHtml(TAP_GAME_VI) }],
};
