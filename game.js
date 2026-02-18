'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const CELL = 30;

const COLORS = {
  I: '#00f5ff', O: '#ffd700', T: '#bf5fff',
  S: '#39ff14', Z: '#ff3131', J: '#1e90ff', L: '#ff8c00',
};

const TETROMINOES = {
  I: [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
    [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  ],
  O: [[[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]]],
  T: [
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 0], [0, 1, 0]],
  ],
  S: [
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
    [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
  ],
  Z: [
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
    [[0, 1, 0], [1, 1, 0], [1, 0, 0]],
  ],
  J: [
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
  ],
  L: [
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
    [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
    [[1, 1, 0], [0, 1, 0], [0, 1, 0]],
  ],
};

const PIECE_TYPES = Object.keys(TETROMINOES);
const LINE_SCORES = [0, 100, 300, 500, 800];
const LOCK_DELAY = 500;  // ms
const MAX_RESETS = 15;

function dropInterval(level) {
  return Math.max(80, 1000 - (level - 1) * 90);
}

// ─── Sound Engine ─────────────────────────────────────────────────────────────
const SoundEngine = (() => {
  let ctx = null;
  let muted = false;
  let volume = 0.5;

  function init() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function play(fn) {
    if (muted) return;
    try { init(); fn(ctx); } catch (_) { /* ignore audio errors */ }
  }

  return {
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); },
    getVolume() { return volume; },

    move() {
      play(c => {
        const o = c.createOscillator(), g = c.createGain();
        g.gain.setValueAtTime(0.12 * volume, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
        o.type = 'square';
        o.frequency.setValueAtTime(200, c.currentTime);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.05);
      });
    },

    rotate() {
      play(c => {
        const o = c.createOscillator(), g = c.createGain();
        g.gain.setValueAtTime(0.18 * volume, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
        o.type = 'sine';
        o.frequency.setValueAtTime(350, c.currentTime);
        o.frequency.linearRampToValueAtTime(500, c.currentTime + 0.08);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.08);
      });
    },

    lock() {
      play(c => {
        const bufLen = Math.floor(c.sampleRate * 0.05);
        const buf = c.createBuffer(1, bufLen, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const noise = c.createBufferSource();
        noise.buffer = buf;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, c.currentTime);
        const g = c.createGain();
        g.gain.setValueAtTime(0.25 * volume, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
        noise.connect(filter); filter.connect(g); g.connect(c.destination);
        noise.start(); noise.stop(c.currentTime + 0.05);
      });
    },

    hardDrop() {
      play(c => {
        const o = c.createOscillator(), g = c.createGain();
        g.gain.setValueAtTime(0.45 * volume, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
        o.type = 'sine';
        o.frequency.setValueAtTime(180, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.18);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.18);
      });
    },

    lineClear(count) {
      play(c => {
        const freqSets = [[], [440], [440, 554], [440, 554, 659], [440, 554, 659, 880]];
        (freqSets[count] || freqSets[1]).forEach((freq, i) => {
          const o = c.createOscillator(), g = c.createGain();
          const t = c.currentTime + i * 0.07;
          g.gain.setValueAtTime(0.3 * volume, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          o.type = count === 4 ? 'square' : 'sine';
          o.frequency.setValueAtTime(freq, t);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 0.2);
        });
      });
    },

    levelUp() {
      play(c => {
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = c.createOscillator(), g = c.createGain();
          const t = c.currentTime + i * 0.08;
          g.gain.setValueAtTime(0.22 * volume, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
          o.type = 'square';
          o.frequency.setValueAtTime(freq, t);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 0.16);
        });
      });
    },

    hold() {
      play(c => {
        const o = c.createOscillator(), g = c.createGain();
        g.gain.setValueAtTime(0.2 * volume, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
        o.type = 'sine';
        o.frequency.setValueAtTime(500, c.currentTime);
        o.frequency.linearRampToValueAtTime(250, c.currentTime + 0.12);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.12);
      });
    },

    gameOver() {
      play(c => {
        [330, 262, 220, 165].forEach((freq, i) => {
          const o = c.createOscillator(), g = c.createGain();
          const t = c.currentTime + i * 0.18;
          g.gain.setValueAtTime(0.3 * volume, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(freq, t);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 0.35);
        });
      });
    },
  };
})();

// ─── Canvas & DOM ─────────────────────────────────────────────────────────────
const boardCanvas = document.getElementById('board');
const ctx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nctx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const hctx = holdCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const overlayBtn = document.getElementById('overlay-btn');
const muteLabel = document.getElementById('mute-label');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');

// ─── Game State ───────────────────────────────────────────────────────────────
let board, current, next, hold;
let score, highScore, level, lines, combo;
let holdUsed;
let gameRunning, gamePaused, gameOver;
let lastTime, dropCounter, animId;
let lockTimer, lockResets;
let isLocking;
let bag = [];

// Line clear animation state
let clearingRows = [];
let clearAnimFrame = 0;
const CLEAR_ANIM_FRAMES = 8;

// Floating text notifications
let floatingTexts = [];

// ─── 7-Bag Random ─────────────────────────────────────────────────────────────
function refillBag() {
  bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}

function nextFromBag() {
  if (bag.length === 0) refillBag();
  const type = bag.pop();
  return { type, rotation: 0, x: Math.floor(COLS / 2) - 2, y: 0 };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMatrix(piece) {
  return TETROMINOES[piece.type][piece.rotation % TETROMINOES[piece.type].length];
}

function collides(piece, dx = 0, dy = 0, rot = null) {
  const matrix = rot !== null
    ? TETROMINOES[piece.type][rot % TETROMINOES[piece.type].length]
    : getMatrix(piece);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const nx = piece.x + c + dx;
      const ny = piece.y + r + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

// SRS wall kicks
const KICKS = [0, -1, 1, -2, 2];
const KICKS_CCW = [0, 1, -1, 2, -2];

function tryRotate(piece, ccw = false) {
  const rotCount = TETROMINOES[piece.type].length;
  const newRot = ccw
    ? (piece.rotation + rotCount - 1) % rotCount
    : (piece.rotation + 1) % rotCount;
  const kicks = ccw ? KICKS_CCW : KICKS;
  for (const kick of kicks) {
    if (!collides(piece, kick, 0, newRot)) {
      piece.x += kick;
      piece.rotation = newRot;
      SoundEngine.rotate();
      onMoveOrRotate();
      return true;
    }
  }
  return false;
}

function ghostY() {
  let dy = 0;
  while (!collides(current, 0, dy + 1)) dy++;
  return current.y + dy;
}

// ─── Lock Delay ───────────────────────────────────────────────────────────────
function startLockTimer() {
  isLocking = true;
  lockTimer = LOCK_DELAY;
}

function cancelLockTimer() {
  isLocking = false;
  lockTimer = 0;
}

function onMoveOrRotate() {
  // Reset lock delay on move/rotate (up to MAX_RESETS times)
  if (isLocking && lockResets < MAX_RESETS) {
    lockTimer = LOCK_DELAY;
    lockResets++;
  }
}

// ─── Lock & Clear ─────────────────────────────────────────────────────────────
function lockPiece() {
  cancelLockTimer();
  const matrix = getMatrix(current);
  let topOut = false;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const ny = current.y + r;
      const nx = current.x + c;
      if (ny < 0) { topOut = true; continue; }
      board[ny][nx] = current.type;
    }
  }
  if (topOut) { triggerGameOver(); return; }

  SoundEngine.lock();
  holdUsed = false;
  findAndClearLines();
}

function findAndClearLines() {
  const full = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(cell => cell !== 0)) full.push(r);
  }
  if (full.length === 0) {
    combo = 0;
    updateUI();
    spawnNext();
    return;
  }
  // Animate then remove
  clearingRows = full;
  clearAnimFrame = 0;
  gameRunning = false; // pause loop during animation
  animateClear();
}

function animateClear() {
  clearAnimFrame++;
  renderWithClearAnim();
  if (clearAnimFrame < CLEAR_ANIM_FRAMES) {
    requestAnimationFrame(animateClear);
  } else {
    // Actually remove rows
    const count = clearingRows.length;
    clearingRows.sort((a, b) => b - a);
    for (const r of clearingRows) {
      board.splice(r, 1);
    }
    for (let i = 0; i < count; i++) {
      board.unshift(new Array(COLS).fill(0));
    }
    clearingRows = [];

    // Scoring
    score += LINE_SCORES[count] * level;
    if (combo > 0) {
      const comboBonus = 50 * combo * level;
      score += comboBonus;
      addFloatingText(`COMBO ×${combo}  +${comboBonus}`, '#ffd700');
    }
    combo++;
    lines += count;
    const prevLevel = level;
    level = Math.floor(lines / 10) + 1;

    // Sounds
    SoundEngine.lineClear(count);
    if (level > prevLevel) SoundEngine.levelUp();

    // Notifications
    if (count === 4) addFloatingText('TETRIS!', '#00f5ff');
    else if (count === 3) addFloatingText('TRIPLE!', '#bf5fff');
    else if (count === 2) addFloatingText('DOUBLE!', '#39ff14');

    updateUI();
    gameRunning = true;
    spawnNext();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }
}

function spawnNext() {
  current = { ...next, x: Math.floor(COLS / 2) - 2, y: 0 };
  next = nextFromBag();
  lockResets = 0;
  cancelLockTimer();
  if (collides(current)) triggerGameOver();
}

// ─── Hold ─────────────────────────────────────────────────────────────────────
function doHold() {
  if (holdUsed) return;
  holdUsed = true;
  cancelLockTimer();
  if (!hold) {
    hold = { type: current.type, rotation: 0, x: 0, y: 0 };
    current = { ...next, x: Math.floor(COLS / 2) - 2, y: 0 };
    next = nextFromBag();
  } else {
    const tmp = hold.type;
    hold = { type: current.type, rotation: 0, x: 0, y: 0 };
    current = { type: tmp, rotation: 0, x: Math.floor(COLS / 2) - 2, y: 0 };
  }
  lockResets = 0;
  SoundEngine.hold();
  if (collides(current)) triggerGameOver();
  drawHold();
}

// ─── Floating Text ────────────────────────────────────────────────────────────
function addFloatingText(text, color) {
  floatingTexts.push({ text, color, x: boardCanvas.width / 2, y: boardCanvas.height / 2 - 40, life: 90, maxLife: 90 });
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawCell(context, x, y, type, alpha = 1, cellSize = CELL) {
  const color = COLORS[type];
  const px = x * cellSize;
  const py = y * cellSize;
  const s = cellSize;

  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, s - 2, s - 2);

  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.fillRect(px + 2, py + 2, s - 4, 4);
  context.fillRect(px + 2, py + 2, 4, s - 4);

  context.fillStyle = 'rgba(0,0,0,0.35)';
  context.fillRect(px + 2, py + s - 5, s - 4, 3);
  context.fillRect(px + s - 5, py + 2, 3, s - 4);

  context.strokeStyle = color;
  context.lineWidth = 0.5;
  context.globalAlpha = alpha * 0.6;
  context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, ROWS * CELL); ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(COLS * CELL, r * CELL); ctx.stroke();
  }
}

function drawBoard() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawCell(ctx, c, r, board[r][c]);
    }
  }
}

function renderWithClearAnim() {
  drawBoard();
  drawGhost();
  drawCurrent();

  // Flash clearing rows
  const t = clearAnimFrame / CLEAR_ANIM_FRAMES;
  const alpha = t < 0.5 ? t * 2 : (1 - t) * 2;
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.85})`;
  for (const r of clearingRows) {
    ctx.fillRect(0, r * CELL, boardCanvas.width, CELL);
  }
}

function drawGhost() {
  if (!current) return;
  const gy = ghostY();
  const matrix = getMatrix(current);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const px = (current.x + c) * CELL;
      const py = (gy + r) * CELL;
      ctx.strokeStyle = COLORS[current.type];
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.28;
      ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
      ctx.globalAlpha = 1;
    }
  }
}

function drawCurrent() {
  if (!current) return;
  const matrix = getMatrix(current);
  // Lock delay visual: pulse alpha when locking
  let alpha = 1;
  if (isLocking) {
    const ratio = lockTimer / LOCK_DELAY;
    alpha = 0.6 + 0.4 * ratio;
  }
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      drawCell(ctx, current.x + c, current.y + r, current.type, alpha);
    }
  }
}

function drawMiniPiece(context, canvasW, canvasH, piece) {
  context.clearRect(0, 0, canvasW, canvasH);
  if (!piece) return;
  const matrix = getMatrix(piece);
  const cellSize = 24;
  const offsetX = Math.floor((canvasW - matrix[0].length * cellSize) / 2);
  const offsetY = Math.floor((canvasH - matrix.length * cellSize) / 2);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const px = offsetX + c * cellSize;
      const py = offsetY + r * cellSize;
      const color = COLORS[piece.type];
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      context.fillStyle = 'rgba(255,255,255,0.22)';
      context.fillRect(px + 2, py + 2, cellSize - 4, 3);
      context.fillRect(px + 2, py + 2, 3, cellSize - 4);
      context.strokeStyle = color;
      context.lineWidth = 0.5;
      context.globalAlpha = 0.5;
      context.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      context.globalAlpha = 1;
    }
  }
}

function drawNext() { drawMiniPiece(nctx, nextCanvas.width, nextCanvas.height, next); }
function drawHold() {
  if (!hold) { hctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height); return; }
  const alpha = holdUsed ? 0.35 : 1;
  hctx.globalAlpha = alpha;
  drawMiniPiece(hctx, holdCanvas.width, holdCanvas.height, hold);
  hctx.globalAlpha = 1;
}

function drawFloatingTexts() {
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);
  for (const ft of floatingTexts) {
    const t = ft.life / ft.maxLife;
    const alpha = t > 0.3 ? 1 : t / 0.3;
    const y = ft.y - (1 - t) * 40;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 22px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 12;
    ctx.fillText(ft.text, ft.x, y);
    ctx.restore();
    ft.life--;
  }
}

function render() {
  drawBoard();
  drawGhost();
  drawCurrent();
  drawNext();
  drawHold();
  drawFloatingTexts();
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateUI() {
  scoreEl.textContent = score.toLocaleString();
  highScoreEl.textContent = highScore.toLocaleString();
  levelEl.textContent = level;
  linesEl.textContent = lines;
  comboEl.textContent = combo > 1 ? `×${combo}` : '';
}

function showOverlay(title, subtitle, btnText) {
  overlayTitle.textContent = title;
  overlaySubtitle.textContent = subtitle;
  overlayBtn.textContent = btnText;
  overlay.classList.remove('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); }

// ─── Game Flow ────────────────────────────────────────────────────────────────
function initGame() {
  board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  score = 0;
  level = 1;
  lines = 0;
  combo = 0;
  hold = null;
  holdUsed = false;
  highScore = parseInt(localStorage.getItem('tetris-high-score') || '0', 10);
  gameRunning = true;
  gamePaused = false;
  gameOver = false;
  dropCounter = 0;
  lastTime = 0;
  lockTimer = 0;
  lockResets = 0;
  isLocking = false;
  clearingRows = [];
  floatingTexts = [];
  bag = [];

  // FIX: correctly initialize current and next without wasting a bag piece
  refillBag();
  current = nextFromBag();
  next = nextFromBag();

  updateUI();
  hideOverlay();
}

function triggerGameOver() {
  gameRunning = false;
  gameOver = true;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('tetris-high-score', highScore);
    updateUI();
  }
  SoundEngine.gameOver();
  cancelAnimationFrame(animId);
  render();
  showOverlay('GAME OVER', `SCORE: ${score.toLocaleString()}`, 'RESTART');
}

function togglePause() {
  if (gameOver) return;
  if (!gameRunning && !gamePaused) return;
  gamePaused = !gamePaused;
  if (gamePaused) {
    cancelAnimationFrame(animId);
    showOverlay('PAUSED', 'PRESS P TO RESUME', 'RESUME');
  } else {
    hideOverlay();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }
}

function hardDrop() {
  const dy = ghostY() - current.y;
  current.y += dy;
  updateUI();
  SoundEngine.hardDrop();
  lockPiece();
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function loop(time = 0) {
  if (!gameRunning || gamePaused) return;

  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;

  const grounded = collides(current, 0, 1);

  if (grounded) {
    if (!isLocking) startLockTimer();
    lockTimer -= delta;
    if (lockTimer <= 0) {
      lockPiece();
      // animateClear sets gameRunning=false and restarts the loop itself.
      // For the no-line-clear path (spawnNext), we must restart the loop here.
      if (gameRunning && !gameOver) {
        lastTime = performance.now();
        animId = requestAnimationFrame(loop);
      }
      return;
    }
  } else {
    cancelLockTimer();
  }

  if (dropCounter >= dropInterval(level)) {
    dropCounter = 0;
    if (!grounded) current.y++;
  }

  render();
  animId = requestAnimationFrame(loop);
}

// ─── Input ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // R restarts at any time
  if (e.code === 'KeyR') {
    cancelAnimationFrame(animId);
    startGame();
    return;
  }

  // M toggles mute at any time
  if (e.code === 'KeyM') {
    const nowMuted = SoundEngine.toggleMute();
    if (muteLabel) {
      muteLabel.textContent = nowMuted ? 'MUTED' : 'ON';
      muteLabel.style.color = nowMuted ? 'var(--red)' : 'var(--cyan)';
    }
    return;
  }

  // FIX: block all other input when game is not active (initial state or game over)
  if (!gameRunning && !gamePaused) return;

  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      if (!gamePaused && !collides(current, -1, 0)) {
        current.x--;
        SoundEngine.move();
        onMoveOrRotate();
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (!gamePaused && !collides(current, 1, 0)) {
        current.x++;
        SoundEngine.move();
        onMoveOrRotate();
      }
      break;
    case 'ArrowDown':
      e.preventDefault();
      // FIX: when already grounded, ignore soft drop (let lock delay handle it)
      if (!gamePaused && !collides(current, 0, 1)) {
        current.y++;
        dropCounter = 0;
        cancelLockTimer();
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (!gamePaused) tryRotate(current, false);
      break;
    case 'KeyZ':
      e.preventDefault();
      if (!gamePaused) tryRotate(current, true);
      break;
    case 'Space':
      e.preventDefault();
      if (!gamePaused) hardDrop();
      break;
    case 'KeyC':
      e.preventDefault();
      if (!gamePaused) doHold();
      break;
    case 'KeyP':
      togglePause();
      break;
  }
});

// ─── Button ───────────────────────────────────────────────────────────────────
overlayBtn.addEventListener('click', () => {
  if (gamePaused) togglePause();
  else startGame();
});

volumeSlider.addEventListener('input', () => {
  SoundEngine.setVolume(volumeSlider.value / 100);
  if (volumeValue) volumeValue.textContent = volumeSlider.value;
});

// ─── Start ────────────────────────────────────────────────────────────────────
function startGame() {
  cancelAnimationFrame(animId);
  initGame();
  animId = requestAnimationFrame(loop);
}

(function init() {
  highScore = parseInt(localStorage.getItem('tetris-high-score') || '0', 10);
  highScoreEl.textContent = highScore.toLocaleString();
  board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  render();
  showOverlay('TETRIS', 'PRESS START TO PLAY', 'START');
  gameRunning = false;
})();
