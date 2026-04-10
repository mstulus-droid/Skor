const PLAYERS = ["Almodo", "Mechabara", "Sanchi", "Wulf"];
const PLAYER_LOGOS = {
  Almodo: "Almodo2.webp",
  Mechabara: "Mechabara.webp",
  Sanchi: "sanchi.webp",
  Wulf: "Wulf.webp"
};
const PLAYER_THEMES = {
  Almodo: { start: "#2fd89a", end: "#157f5e" },
  Mechabara: { start: "#ff6a8c", end: "#9a2644" },
  Sanchi: { start: "#5fa6ff", end: "#1f4c9a" },
  Wulf: { start: "#d29bff", end: "#5d2d88" }
};
const DEFAULT_COUNTDOWN_MS = 90_000;
const MAX_COUNTDOWN_MS = 5_940_000;

const state = {
  scoreA: 0,
  scoreB: 0,
  actions: [],
  playerA: PLAYERS[0],
  playerB: PLAYERS[1],
  soundOn: true,
  countdownMs: DEFAULT_COUNTDOWN_MS,
  timerRunning: false,
  timerTargetEpoch: 0
};

const el = {
  appShell: document.querySelector(".app-shell"),
  scoreA: document.getElementById("scoreA"),
  scoreB: document.getElementById("scoreB"),
  teamA: document.getElementById("teamA"),
  teamB: document.getElementById("teamB"),
  pickTeamA: document.getElementById("pickTeamA"),
  pickTeamB: document.getElementById("pickTeamB"),
  logoA: document.getElementById("logoA"),
  logoB: document.getElementById("logoB"),
  undoBtn: document.getElementById("undoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  timerBtn: document.getElementById("timerBtn"),
  timerResetBtn: document.getElementById("timerResetBtn"),
  minus10Btn: document.getElementById("minus10Btn"),
  plus10Btn: document.getElementById("plus10Btn"),
  soundToggle: document.getElementById("soundToggle"),
  teamPickerModal: document.getElementById("teamPickerModal"),
  pickerBackdrop: document.getElementById("pickerBackdrop"),
  pickerOptions: document.getElementById("pickerOptions"),
  closePickerBtn: document.getElementById("closePickerBtn")
};

let audioCtx;
let timerInterval;
let timerEndedNotified = false;
let lastSecondCue = -1;
let pickerTarget = null;
const swipeStarts = new Map();

function saveState() {
  localStorage.setItem("rhadzor-score", JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem("rhadzor-score");
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  } catch (_) {
    localStorage.removeItem("rhadzor-score");
  }

  if (!PLAYERS.includes(state.playerA)) state.playerA = PLAYERS[0];
  if (!PLAYERS.includes(state.playerB)) state.playerB = PLAYERS[1];
  state.scoreA = Math.max(0, Number(state.scoreA) || 0);
  state.scoreB = Math.max(0, Number(state.scoreB) || 0);
  state.actions = Array.isArray(state.actions) ? state.actions : [];
  state.countdownMs = Math.min(MAX_COUNTDOWN_MS, Math.max(0, Number(state.countdownMs) || DEFAULT_COUNTDOWN_MS));
  state.soundOn = Boolean(state.soundOn);
  state.timerRunning = false;
  state.timerTargetEpoch = 0;
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function beep(freq = 660, duration = 0.08, type = "triangle", gainValue = 0.11) {
  if (!state.soundOn) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.0001;
  const t = audioCtx.currentTime;
  gain.gain.exponentialRampToValueAtTime(gainValue, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start();
  osc.stop(t + duration);
}

function playTimerDoneTone() {
  if (!state.soundOn) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "square";

  const t = audioCtx.currentTime;
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.16);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

  osc.start(t);
  osc.stop(t + 0.24);
}

function runCountdownCues(liveMs) {
  const secondsLeft = Math.ceil(liveMs / 1000);
  if (secondsLeft <= 10 && secondsLeft >= 1 && secondsLeft !== lastSecondCue) {
    lastSecondCue = secondsLeft;
    beep(840, 0.05, "square", 0.1);
  } else if (secondsLeft > 10) {
    lastSecondCue = -1;
  }
}

function animateScore(team) {
  const scoreEl = team === "A" ? el.scoreA : el.scoreB;
  const teamEl = team === "A" ? el.teamA : el.teamB;
  scoreEl.classList.remove("score-pop");
  teamEl.classList.remove("panel-flash");
  requestAnimationFrame(() => {
    scoreEl.classList.add("score-pop");
    teamEl.classList.add("panel-flash");
  });
}

function getLiveCountdown() {
  if (!state.timerRunning) return state.countdownMs;
  return Math.max(0, state.timerTargetEpoch - Date.now());
}

function startTimerTicker() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const live = getLiveCountdown();
    runCountdownCues(live);
    if (live <= 0 && state.timerRunning) {
      state.countdownMs = 0;
      state.timerRunning = false;
      clearInterval(timerInterval);
      if (!timerEndedNotified) {
        timerEndedNotified = true;
        playTimerDoneTone();
      }
      lastSecondCue = -1;
    }
    render();
  }, 150);
}

function toggleTimer() {
  if (state.timerRunning) {
    state.countdownMs = getLiveCountdown();
    state.timerRunning = false;
    clearInterval(timerInterval);
    lastSecondCue = -1;
    beep(260, 0.07, "square");
  } else {
    if (state.countdownMs <= 0) state.countdownMs = DEFAULT_COUNTDOWN_MS;
    state.timerTargetEpoch = Date.now() + state.countdownMs;
    state.timerRunning = true;
    timerEndedNotified = false;
    lastSecondCue = -1;
    beep(520, 0.08, "square");
    startTimerTicker();
  }
  render();
}

function resetTimer() {
  state.timerRunning = false;
  state.countdownMs = DEFAULT_COUNTDOWN_MS;
  state.timerTargetEpoch = 0;
  timerEndedNotified = false;
  lastSecondCue = -1;
  clearInterval(timerInterval);
  beep(310, 0.08, "triangle");
  render();
}

function adjustTimer(deltaMs) {
  if (state.timerRunning) {
    state.timerTargetEpoch += deltaMs;
    const live = getLiveCountdown();
    if (live <= 0) {
      state.countdownMs = 0;
      state.timerRunning = false;
      clearInterval(timerInterval);
      if (!timerEndedNotified) {
        timerEndedNotified = true;
        playTimerDoneTone();
      }
      lastSecondCue = -1;
    }
  } else {
    state.countdownMs = Math.min(MAX_COUNTDOWN_MS, Math.max(0, state.countdownMs + deltaMs));
    if (state.countdownMs > 10_000) lastSecondCue = -1;
  }
  beep(deltaMs > 0 ? 560 : 290, 0.05, "triangle", 0.09);
  render();
}

function setScore(team, delta) {
  const key = team === "A" ? "scoreA" : "scoreB";
  const nextValue = Math.max(0, state[key] + delta);
  if (nextValue === state[key]) return;

  state[key] = nextValue;
  state.actions.unshift({ team, delta });
  state.actions = state.actions.slice(0, 60);

  if (delta > 0) beep(720, 0.08, "triangle");
  else beep(330, 0.07, "sine");

  animateScore(team);
  render();
}

function undo() {
  const recent = state.actions.shift();
  if (!recent) return;
  const key = recent.team === "A" ? "scoreA" : "scoreB";
  state[key] = Math.max(0, state[key] - recent.delta);
  beep(300, 0.08, "triangle");
  render();
}

function resetAll() {
  state.scoreA = 0;
  state.scoreB = 0;
  state.actions = [];
  state.timerRunning = false;
  state.countdownMs = DEFAULT_COUNTDOWN_MS;
  state.timerTargetEpoch = 0;
  timerEndedNotified = false;
  lastSecondCue = -1;
  clearInterval(timerInterval);
  beep(180, 0.14, "sawtooth", 0.14);
  render();
}

function setupGesture(teamEl, team) {
  teamEl.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("button,img")) return;
    swipeStarts.set(ev.pointerId, { y: ev.clientY });
  });

  teamEl.addEventListener("pointerup", (ev) => {
    if (ev.target.closest("button,img")) return;
    const start = swipeStarts.get(ev.pointerId);
    swipeStarts.delete(ev.pointerId);
    if (!start) {
      setScore(team, +1);
      return;
    }
    const diff = ev.clientY - start.y;
    if (diff > 40) setScore(team, -1);
    else setScore(team, +1);
  });
}

function openTeamPicker(targetTeam) {
  pickerTarget = targetTeam;
  el.pickerOptions.innerHTML = PLAYERS.map((name) => {
    const logo = PLAYER_LOGOS[name];
    return `<button class="picker-option" data-player="${name}" type="button"><img src="${logo}" alt="Logo ${name}"><span>${name}</span></button>`;
  }).join("");
  el.teamPickerModal.hidden = false;
}

function closeTeamPicker() {
  pickerTarget = null;
  el.teamPickerModal.hidden = true;
}

function applyPlayerChoice(playerName) {
  if (!pickerTarget || !PLAYERS.includes(playerName)) return;
  if (pickerTarget === "A") state.playerA = playerName;
  else state.playerB = playerName;
  beep(450, 0.05, "triangle", 0.08);
  closeTeamPicker();
  render();
}

function render() {
  const liveCountdown = getLiveCountdown();
  if (!state.timerRunning) state.countdownMs = liveCountdown;

  const themeA = PLAYER_THEMES[state.playerA] || PLAYER_THEMES.Almodo;
  const themeB = PLAYER_THEMES[state.playerB] || PLAYER_THEMES.Mechabara;
  el.scoreA.textContent = String(state.scoreA);
  el.scoreB.textContent = String(state.scoreB);
  el.logoA.src = PLAYER_LOGOS[state.playerA] || PLAYER_LOGOS.Almodo;
  el.logoB.src = PLAYER_LOGOS[state.playerB] || PLAYER_LOGOS.Mechabara;
  el.logoA.alt = `Logo ${state.playerA}`;
  el.logoB.alt = `Logo ${state.playerB}`;
  el.teamA.style.setProperty("--team-bg-1", themeA.start);
  el.teamA.style.setProperty("--team-bg-2", themeA.end);
  el.teamB.style.setProperty("--team-bg-1", themeB.start);
  el.teamB.style.setProperty("--team-bg-2", themeB.end);
  el.soundToggle.textContent = state.soundOn ? "Sound ON" : "Sound OFF";
  el.timerBtn.textContent = formatMs(liveCountdown);
  el.timerBtn.classList.toggle("timer-warning", liveCountdown <= 15_000 && liveCountdown > 0);
  el.appShell.classList.toggle("timer-running", state.timerRunning);

  saveState();
}

el.undoBtn.addEventListener("click", undo);
el.resetBtn.addEventListener("click", resetAll);
el.timerBtn.addEventListener("click", toggleTimer);
el.timerResetBtn.addEventListener("click", resetTimer);
el.minus10Btn.addEventListener("click", () => adjustTimer(-10_000));
el.plus10Btn.addEventListener("click", () => adjustTimer(10_000));

el.soundToggle.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  beep(500, 0.06, "triangle");
  render();
});

el.pickTeamA.addEventListener("click", () => openTeamPicker("A"));
el.pickTeamB.addEventListener("click", () => openTeamPicker("B"));
el.closePickerBtn.addEventListener("click", closeTeamPicker);
el.pickerBackdrop.addEventListener("click", closeTeamPicker);
el.pickerOptions.addEventListener("click", (ev) => {
  const option = ev.target.closest("[data-player]");
  if (!option) return;
  applyPlayerChoice(option.getAttribute("data-player"));
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !el.teamPickerModal.hidden) closeTeamPicker();
});

setupGesture(el.teamA, "A");
setupGesture(el.teamB, "B");

loadState();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
