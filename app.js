const PLAYERS = ["Almodo", "Mechabara", "Sanchi", "Wulf"];
const PLAYER_LOGOS = {
  Almodo: "Almodo2.webp",
  Mechabara: "Mechabara.webp",
  Sanchi: "sanchi.webp",
  Wulf: "Wulf.webp"
};
const PLAYER_THEMES = {
  Almodo: { start: "#ff4444", end: "#8b0000" },
  Mechabara: { start: "#4facfe", end: "#00f2fe" },
  Sanchi: { start: "#ff69b4", end: "#c71585" },
  Wulf: { start: "#ffffff", end: "#a0a0a0" }
};

// Default is now 5 minutes (300 seconds)
const DEFAULT_COUNTDOWN_MS = 300_000;
const MAX_COUNTDOWN_MS = 5_940_000;
const COUNTDOWN_SOUND_TRIGGER_MS = 6000; // 6 seconds before end

// Sound files - all sounds starting with "gol-"
const GOL_SOUNDS = [
  "sound/gol-nice.mp3",
  "sound/gol-okeh.mp3",
  "sound/gol-score-mario-coin.mp3",
  "sound/gol-uiiiiiiii.mp3",
  "sound/gol-wow.mp3",
  "sound/gol-yey.mp3"
];
const COUNTDOWN_SOUND = "sound/5s-countdown.mp3";
const MBAPPE_SOUND = "sound/mbappe-mbappe-mbappe.mp3";
const RONALDO_SOUND = "sound/ronalda-pushka.mp3";

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

// New game settings
let newGameSettings = {
  teamA: PLAYERS[0],
  teamB: PLAYERS[1],
  durationMinutes: 5
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

  teamPickerModal: document.getElementById("teamPickerModal"),
  pickerBackdrop: document.getElementById("pickerBackdrop"),
  pickerOptions: document.getElementById("pickerOptions"),
  closePickerBtn: document.getElementById("closePickerBtn"),
  // Winner overlay elements
  winnerOverlay: document.getElementById("winnerOverlay"),
  winnerLogoBig: document.getElementById("winnerLogoBig"),
  winnerLogoA: document.getElementById("winnerLogoA"),
  winnerLogoB: document.getElementById("winnerLogoB"),
  winnerScoreA: document.getElementById("winnerScoreA"),
  winnerScoreB: document.getElementById("winnerScoreB"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  confettiCanvas: document.getElementById("confettiCanvas"),
  // New Game modal elements
  newGameModal: document.getElementById("newGameModal"),
  newGameBackdrop: document.getElementById("newGameBackdrop"),
  newGameTeamAOptions: document.getElementById("newGameTeamAOptions"),
  newGameTeamBOptions: document.getElementById("newGameTeamBOptions"),
  startNewGameBtn: document.getElementById("startNewGameBtn"),
  cancelNewGameBtn: document.getElementById("cancelNewGameBtn"),
  debug15sBtn: document.getElementById("debug15sBtn")
};

let audioCtx;
let timerInterval;
let timerEndedNotified = false;
let countdownSoundPlayed = false;
let lastSecondCue = -1;
let pickerTarget = null;
const swipeStarts = new Map();

// Audio elements for MP3 playback
let countdownAudio = null;

// Minute announcement tracking
let announcedMinutes = new Set();

// Text-to-speech for minute announcements
function announceMinutesRemaining(minutes) {
  if (!state.soundOn || minutes <= 0) return;
  
  // Play notification tone first
  beep(880, 0.2, "sine", 0.2);
  setTimeout(() => beep(1100, 0.25, "sine", 0.25), 250);
  
  // Use Web Speech API for announcement
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(`${minutes} menit lagi`);
    utterance.lang = 'id-ID';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 0.95;
    
    // Delay speech slightly after notification tone
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 600);
  }
}

// Confetti variables
let confettiAnimation = null;
let confettiParticles = [];

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

// Play random gol sound for score
function playRandomGolSound() {
  if (!state.soundOn) return;
  const randomSound = GOL_SOUNDS[Math.floor(Math.random() * GOL_SOUNDS.length)];
  const audio = new Audio(randomSound);
  audio.volume = 0.7;
  audio.play().catch(() => {});
}

// Play countdown sound (6 seconds before end)
function playCountdownSound() {
  if (!state.soundOn || countdownSoundPlayed) return;
  countdownSoundPlayed = true;
  countdownAudio = new Audio(COUNTDOWN_SOUND);
  countdownAudio.volume = 0.8;
  countdownAudio.play().catch(() => {});
}

// Play winner-specific sound (2 times without delay)
function playWinnerSound(winnerName) {
  if (!state.soundOn) return;
  
  let soundFile = null;
  if (winnerName === "Almodo") {
    soundFile = MBAPPE_SOUND;
  } else if (winnerName === "Mechabara") {
    soundFile = RONALDO_SOUND;
  }
  
  if (soundFile) {
    // Play first time
    const audio1 = new Audio(soundFile);
    audio1.volume = 0.8;
    audio1.play().catch(() => {});
    
    // Play second time immediately after first ends
    audio1.onended = () => {
      const audio2 = new Audio(soundFile);
      audio2.volume = 0.8;
      audio2.play().catch(() => {});
    };
  }
}

function runCountdownCues(liveMs) {
  // Play countdown sound when 6 seconds remaining
  if (liveMs <= COUNTDOWN_SOUND_TRIGGER_MS && liveMs > 0 && !countdownSoundPlayed) {
    playCountdownSound();
  }
  
  // Reset countdown sound flag when timer is reset
  if (liveMs > COUNTDOWN_SOUND_TRIGGER_MS) {
    countdownSoundPlayed = false;
    if (countdownAudio) {
      countdownAudio.pause();
      countdownAudio = null;
    }
  }
  
  // Minute announcements - only announce at exact minute marks
  const minutesLeft = Math.floor(liveMs / 60000);
  const secondsInMinute = Math.floor((liveMs % 60000) / 1000);
  
  // Announce at the start of each minute (when seconds are 59-0 range)
  // and only if we haven't announced this minute yet
  if (secondsInMinute <= 1 && minutesLeft > 0 && !announcedMinutes.has(minutesLeft)) {
    announcedMinutes.add(minutesLeft);
    announceMinutesRemaining(minutesLeft);
  }
  
  // Reset announced minutes if timer goes back up
  if (liveMs > 0) {
    // Clear any announced minutes that are now higher than current
    for (const min of announcedMinutes) {
      if (min > minutesLeft) {
        announcedMinutes.delete(min);
      }
    }
  }
  
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

// Confetti Functions
function createConfettiParticle() {
  const colors = ['#ffd166', '#ff6a8c', '#5fa6ff', '#2fd89a', '#d29bff', '#ffffff'];
  return {
    x: Math.random() * window.innerWidth,
    y: -20,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedY: Math.random() * 3 + 2,
    speedX: (Math.random() - 0.5) * 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    opacity: 1
  };
}

function initConfetti() {
  confettiParticles = [];
  for (let i = 0; i < 150; i++) {
    confettiParticles.push(createConfettiParticle());
  }
}

function drawConfetti() {
  const ctx = el.confettiCanvas.getContext('2d');
  ctx.clearRect(0, 0, el.confettiCanvas.width, el.confettiCanvas.height);
  
  confettiParticles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });
}

function updateConfetti() {
  confettiParticles.forEach(p => {
    p.y += p.speedY;
    p.x += p.speedX;
    p.rotation += p.rotationSpeed;
    
    if (p.y > window.innerHeight) {
      p.y = -20;
      p.x = Math.random() * window.innerWidth;
    }
  });
}

function animateConfetti() {
  if (!el.confettiCanvas.hidden) {
    drawConfetti();
    updateConfetti();
    confettiAnimation = requestAnimationFrame(animateConfetti);
  }
}

function startConfetti() {
  el.confettiCanvas.hidden = false;
  el.confettiCanvas.width = window.innerWidth;
  el.confettiCanvas.height = window.innerHeight;
  initConfetti();
  animateConfetti();
}

function stopConfetti() {
  el.confettiCanvas.hidden = true;
  if (confettiAnimation) {
    cancelAnimationFrame(confettiAnimation);
    confettiAnimation = null;
  }
  // Stop countdown sound if playing
  if (countdownAudio) {
    countdownAudio.pause();
    countdownAudio = null;
  }
}

// Winner Functions
function getWinner() {
  if (state.scoreA > state.scoreB) {
    return { team: 'A', name: state.playerA, score: state.scoreA, opponentScore: state.scoreB };
  } else if (state.scoreB > state.scoreA) {
    return { team: 'B', name: state.playerB, score: state.scoreB, opponentScore: state.scoreA };
  } else {
    return { team: 'DRAW', name: null, score: state.scoreA, opponentScore: state.scoreB };
  }
}

function showWinnerOverlay() {
  const winner = getWinner();
  
  // Set big logo for winner
  if (winner.team === 'A') {
    el.winnerLogoBig.src = PLAYER_LOGOS[state.playerA];
    el.winnerLogoBig.alt = `Logo ${state.playerA}`;
    el.winnerLogoBig.style.borderColor = PLAYER_THEMES[state.playerA].start;
  } else if (winner.team === 'B') {
    el.winnerLogoBig.src = PLAYER_LOGOS[state.playerB];
    el.winnerLogoBig.alt = `Logo ${state.playerB}`;
    el.winnerLogoBig.style.borderColor = PLAYER_THEMES[state.playerB].start;
  } else {
    // Draw - show both logos
    el.winnerLogoBig.src = PLAYER_LOGOS[state.playerA];
    el.winnerLogoBig.alt = "Draw";
    el.winnerLogoBig.style.borderColor = '#ffd166';
  }
  
  el.winnerScoreA.textContent = state.scoreA;
  el.winnerScoreB.textContent = state.scoreB;
  el.winnerLogoA.src = PLAYER_LOGOS[state.playerA];
  el.winnerLogoB.src = PLAYER_LOGOS[state.playerB];
  
  el.winnerOverlay.hidden = false;
  startConfetti();
  
  // Re-attach listener after overlay is shown - use setTimeout to ensure DOM is ready
  setTimeout(() => {
    attachPlayAgainListener();
  }, 100);
  
  // Play winner-specific sound (2 times)
  if (winner.name) {
    playWinnerSound(winner.name);
  }
}

function hideWinnerOverlay() {
  el.winnerOverlay.hidden = true;
  stopConfetti();
}

// New Game Modal Functions
function showNewGameModal() {
  console.log("showNewGameModal called");
  
  // Initialize settings with current values
  newGameSettings.teamA = state.playerA;
  newGameSettings.teamB = state.playerB;
  newGameSettings.durationMinutes = Math.round(state.countdownMs / 60000);
  if (![5, 10, 15].includes(newGameSettings.durationMinutes)) {
    newGameSettings.durationMinutes = 5;
  }
  
  renderNewGameModal();
  
  const modal = document.getElementById("newGameModal");
  if (modal) {
    modal.hidden = false;
    console.log("Modal shown");
  } else {
    console.error("newGameModal not found!");
  }
}

function hideNewGameModal() {
  const modal = document.getElementById("newGameModal");
  if (modal) {
    modal.hidden = true;
  }
}

function renderNewGameModal() {
  const teamAOptions = document.getElementById("newGameTeamAOptions");
  const teamBOptions = document.getElementById("newGameTeamBOptions");
  
  if (!teamAOptions || !teamBOptions) {
    console.error("Team options elements not found!");
    return;
  }
  
  // Render Team A options
  teamAOptions.innerHTML = PLAYERS.map((name) => {
    const logo = PLAYER_LOGOS[name];
    const isSelected = newGameSettings.teamA === name;
    return `
      <button class="newgame-team-option ${isSelected ? 'selected' : ''}" data-team="A" data-player="${name}" type="button">
        <img src="${logo}" alt="Logo ${name}">
        <span>${name}</span>
      </button>
    `;
  }).join("");
  
  // Render Team B options
  teamBOptions.innerHTML = PLAYERS.map((name) => {
    const logo = PLAYER_LOGOS[name];
    const isSelected = newGameSettings.teamB === name;
    return `
      <button class="newgame-team-option ${isSelected ? 'selected' : ''}" data-team="B" data-player="${name}" type="button">
        <img src="${logo}" alt="Logo ${name}">
        <span>${name}</span>
      </button>
    `;
  }).join("");
  
  // Render duration buttons
  const modal = document.getElementById("newGameModal");
  if (modal) {
    modal.querySelectorAll('.duration-btn').forEach(btn => {
      const minutes = parseInt(btn.dataset.minutes);
      btn.classList.toggle('selected', newGameSettings.durationMinutes === minutes);
    });
  }
}

function selectNewGameTeam(teamSide, playerName) {
  if (teamSide === 'A') {
    newGameSettings.teamA = playerName;
    // If same team selected for both, switch the other
    if (newGameSettings.teamB === playerName) {
      newGameSettings.teamB = PLAYERS.find(p => p !== playerName) || PLAYERS[1];
    }
  } else {
    newGameSettings.teamB = playerName;
    // If same team selected for both, switch the other
    if (newGameSettings.teamA === playerName) {
      newGameSettings.teamA = PLAYERS.find(p => p !== playerName) || PLAYERS[0];
    }
  }
  renderNewGameModal();
  beep(450, 0.05, "triangle", 0.08);
}

function selectNewGameDuration(minutes) {
  newGameSettings.durationMinutes = minutes;
  renderNewGameModal();
  beep(520, 0.05, "triangle", 0.08);
}

function startNewGame() {
  // Apply settings
  state.playerA = newGameSettings.teamA;
  state.playerB = newGameSettings.teamB;
  state.countdownMs = newGameSettings.durationMinutes * 60 * 1000;
  
  // Reset game state
  state.scoreA = 0;
  state.scoreB = 0;
  state.actions = [];
  state.timerRunning = false;
  state.timerTargetEpoch = 0;
  timerEndedNotified = false;
  countdownSoundPlayed = false;
  lastSecondCue = -1;
  announcedMinutes.clear();
  clearInterval(timerInterval);
  
  hideNewGameModal();
  hideWinnerOverlay();
  beep(520, 0.08, "square");
  render();
}

function onTimerEnded() {
  state.countdownMs = 0;
  state.timerRunning = false;
  clearInterval(timerInterval);
  if (!timerEndedNotified) {
    timerEndedNotified = true;
    // Show winner overlay
    setTimeout(() => {
      showWinnerOverlay();
    }, 500);
  }
  lastSecondCue = -1;
}

function startTimerTicker() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const live = getLiveCountdown();
    runCountdownCues(live);
    if (live <= 0 && state.timerRunning) {
      onTimerEnded();
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
    countdownSoundPlayed = false;
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
  countdownSoundPlayed = false;
  lastSecondCue = -1;
  announcedMinutes.clear();
  clearInterval(timerInterval);
  beep(310, 0.08, "triangle");
  render();
}

function adjustTimer(deltaMs) {
  if (state.timerRunning) {
    state.timerTargetEpoch += deltaMs;
    const live = getLiveCountdown();
    if (live <= 0) {
      onTimerEnded();
    }
  } else {
    state.countdownMs = Math.min(MAX_COUNTDOWN_MS, Math.max(0, state.countdownMs + deltaMs));
    if (state.countdownMs > COUNTDOWN_SOUND_TRIGGER_MS) {
      countdownSoundPlayed = false;
    }
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

  if (delta > 0) {
    playRandomGolSound();
  } else {
    beep(330, 0.07, "sine");
  }

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
  countdownSoundPlayed = false;
  lastSecondCue = -1;
  announcedMinutes.clear();
  clearInterval(timerInterval);
  hideWinnerOverlay();
  hideNewGameModal();
  beep(180, 0.14, "sawtooth", 0.14);
  render();
}

function setupGesture(teamEl, team) {
  // Click on team logo also adds score
  const logo = teamEl.querySelector('.team-logo');
  if (logo) {
    logo.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      setScore(team, +1);
    });
  }
  
  teamEl.addEventListener("pointerdown", (ev) => {
    // Only respond to clicks on the team panel itself, not buttons
    if (ev.target.closest("button")) return;
    swipeStarts.set(ev.pointerId, { y: ev.clientY });
  });

  teamEl.addEventListener("pointerup", (ev) => {
    // Skip if clicked on button
    if (ev.target.closest("button")) return;
    // If clicked on logo, it's handled separately above
    if (ev.target.closest(".team-logo")) return;
    
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

  el.timerBtn.textContent = formatMs(liveCountdown);
  el.timerBtn.classList.toggle("timer-warning", liveCountdown <= 15_000 && liveCountdown > 0);
  el.appShell.classList.toggle("timer-running", state.timerRunning);

  saveState();
}

// Event Listeners
el.undoBtn.addEventListener("click", undo);
el.resetBtn.addEventListener("click", resetAll);
el.timerBtn.addEventListener("click", toggleTimer);
el.timerResetBtn.addEventListener("click", () => adjustTimer(60_000));
el.minus10Btn.addEventListener("click", () => adjustTimer(-10_000));
el.plus10Btn.addEventListener("click", () => adjustTimer(10_000));



el.pickTeamA.addEventListener("click", () => openTeamPicker("A"));
el.pickTeamB.addEventListener("click", () => openTeamPicker("B"));
el.closePickerBtn.addEventListener("click", closeTeamPicker);
el.pickerBackdrop.addEventListener("click", closeTeamPicker);
el.pickerOptions.addEventListener("click", (ev) => {
  const option = ev.target.closest("[data-player]");
  if (!option) return;
  applyPlayerChoice(option.getAttribute("data-player"));
});

// Play Again button - now shows new game settings modal
function attachPlayAgainListener() {
  const btn = document.getElementById("playAgainBtn");
  if (btn) {
    // Remove any existing listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Add fresh click listener
    newBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log("Main Lagi clicked!");
      showNewGameModal();
      return false;
    });
    
    // Also add touchend for mobile
    newBtn.addEventListener("touchend", function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Main Lagi touched!");
      showNewGameModal();
      return false;
    });
  }
}

// New Game Modal event listeners - attach immediately since script is at end of body
(function setupNewGameListeners() {
  const backdrop = document.getElementById("newGameBackdrop");
  const cancelBtn = document.getElementById("cancelNewGameBtn");
  const startBtn = document.getElementById("startNewGameBtn");
  const debugBtn = document.getElementById("debug15sBtn");
  const modal = document.getElementById("newGameModal");
  
  if (backdrop) {
    backdrop.addEventListener("click", hideNewGameModal);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", hideNewGameModal);
  }
  if (startBtn) {
    startBtn.addEventListener("click", startNewGame);
  }
  if (debugBtn) {
    debugBtn.addEventListener('click', () => {
      newGameSettings.durationMinutes = 0.25; // 15 seconds
      startNewGame();
    });
  }
  
  // Event delegation for team selection and duration
  if (modal) {
    modal.addEventListener('click', (ev) => {
      // Team selection
      const teamOption = ev.target.closest('.newgame-team-option');
      if (teamOption) {
        const teamSide = teamOption.dataset.team;
        const playerName = teamOption.dataset.player;
        if (teamSide && playerName) {
          selectNewGameTeam(teamSide, playerName);
        }
      }
      
      // Duration selection
      const durationBtn = ev.target.closest('.duration-btn');
      if (durationBtn) {
        const minutes = parseInt(durationBtn.dataset.minutes);
        selectNewGameDuration(minutes);
      }
    });
  }
})();

// Close overlay on backdrop click (optional)
el.winnerOverlay.addEventListener("click", (ev) => {
  if (ev.target === el.winnerOverlay) {
    hideWinnerOverlay();
  }
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !el.teamPickerModal.hidden) closeTeamPicker();
  if (ev.key === "Escape" && !el.winnerOverlay.hidden) hideWinnerOverlay();
  if (ev.key === "Escape" && el.newGameModal && !el.newGameModal.hidden) hideNewGameModal();
});

// Handle window resize for confetti
window.addEventListener("resize", () => {
  if (!el.confettiCanvas.hidden) {
    el.confettiCanvas.width = window.innerWidth;
    el.confettiCanvas.height = window.innerHeight;
  }
});

setupGesture(el.teamA, "A");
setupGesture(el.teamB, "B");

loadState();
render();
attachPlayAgainListener(); // Initial attachment

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
