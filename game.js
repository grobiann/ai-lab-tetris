'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const CELL = 30; // px
const COLORS = {
  I: '#00f5ff',
  O: '#ffd700',
  T: '#bf5fff',
  S: '#39ff14',
  Z: '#ff3131',
  J: '#1e90ff',
  L: '#ff8c00',
};

// Tetromino shapes (each rotation state as a 2D array)
const TETROMINOES = {
  I: [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
  O: [
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
  ],
  T: [
    [[0,1,0],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,0],[0,1,0]],
  ],
  S: [
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[0,1,1],[0,0,1]],
    [[0,0,0],[0,1,1],[1,1,0]],
    [[1,0,0],[1,1,0],[0,1,0]],
  ],
  Z: [
    [[1,1,0],[0,1,1],[0,0,0]],
    [[0,0,1],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,0],[0,1,1]],
    [[0,1,0],[1,1,0],[1,0,0]],
  ],
  J: [
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,1,1],[0,1,0],[0,1,0]],
    [[0,0,0],[1,1,1],[0,0,1]],
    [[0,1,0],[0,1,0],[1,1,0]],
  ],
  L: [
    [[0,0,1],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,0],[0,1,1]],
    [[0,0,0],[1,1,1],[1,0,0]],
    [[1,1,0],[0,1,0],[0,1,0]],
  ],
};

const PIECE_TYPES = Object.keys(TETROMINOES);

// Scoring: points for clearing n lines at once
const LINE_SCORES = [0, 100, 300, 500, 800];

// Drop interval per level (ms)
function dropInterval(level) {
  return Math.max(80, 1000 - (level - 1) * 90);
}

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
const boardCanvas = document.getElementById('board');
const ctx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nctx = nextCanvas.getContext('2d');

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const scoreEl     = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const levelEl     = document.getElementById('level');
const linesEl     = document.getElementById('lines');
const overlay     = document.getElementById('overlay');
const overlayTitle    = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const overlayBtn      = document.getElementById('overlay-btn');

// ─── Game State ───────────────────────────────────────────────────────────────
let board, current, next, score, highScore, level, lines;
let gameRunning, gamePaused, gameOver;
let lastTime, dropCounter, animId;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomPiece() {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  return { type, rotation: 0, x: Math.floor(COLS / 2) - 2, y: 0 };
}

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

// Wall-kick offsets for rotation (SRS simplified)
const KICKS = [0, -1, 1, -2, 2];

function tryRotate(piece) {
  const newRot = (piece.rotation + 1) % TETROMINOES[piece.type].length;
  for (const kick of KICKS) {
    if (!collides(piece, kick, 0, newRot)) {
      piece.x += kick;
      piece.rotation = newRot;
      return;
    }
  }
}

function lockPiece() {
  const matrix = getMatrix(current);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const ny = current.y + r;
      const nx = current.x + c;
      if (ny < 0) {
        triggerGameOver();
        return;
      }
      board[ny][nx] = current.type;
    }
  }
  clearLines();
  spawnNext();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++; // recheck same row index
    }
  }
  if (cleared > 0) {
    score += LINE_SCORES[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    updateUI();
    flashBoard();
  }
}

function flashBoard() {
  // Quick white flash on the canvas
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
}

function spawnNext() {
  current = { ...next, x: Math.floor(COLS / 2) - 2, y: 0 };
  next = randomPiece();
  if (collides(current)) {
    triggerGameOver();
  }
}

function ghostY() {
  let dy = 0;
  while (!collides(current, 0, dy + 1)) dy++;
  return current.y + dy;
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawCell(context, x, y, type, alpha = 1) {
  const color = COLORS[type];
  const px = x * CELL;
  const py = y * CELL;
  const s = CELL;

  context.globalAlpha = alpha;

  // Fill
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, s - 2, s - 2);

  // Inner highlight (top-left)
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.fillRect(px + 2, py + 2, s - 4, 4);
  context.fillRect(px + 2, py + 2, 4, s - 4);

  // Inner shadow (bottom-right)
  context.fillStyle = 'rgba(0,0,0,0.35)';
  context.fillRect(px + 2, py + s - 5, s - 4, 3);
  context.fillRect(px + s - 5, py + 2, 3, s - 4);

  // Glow border
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
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, ROWS * CELL);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(COLS * CELL, r * CELL);
    ctx.stroke();
  }
}

function drawBoard() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid();

  // Locked cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawCell(ctx, c, r, board[r][c]);
    }
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
      ctx.globalAlpha = 0.25;
      ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
      ctx.globalAlpha = 1;
    }
  }
}

function drawCurrent() {
  if (!current) return;
  const matrix = getMatrix(current);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      drawCell(ctx, current.x + c, current.y + r, current.type);
    }
  }
}

function drawNext() {
  nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;
  const matrix = getMatrix(next);
  const cellSize = 24;
  const offsetX = Math.floor((nextCanvas.width  - matrix[0].length * cellSize) / 2);
  const offsetY = Math.floor((nextCanvas.height - matrix.length    * cellSize) / 2);

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const px = offsetX + c * cellSize;
      const py = offsetY + r * cellSize;
      const color = COLORS[next.type];

      nctx.fillStyle = color;
      nctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      nctx.fillStyle = 'rgba(255,255,255,0.22)';
      nctx.fillRect(px + 2, py + 2, cellSize - 4, 3);
      nctx.fillRect(px + 2, py + 2, 3, cellSize - 4);
      nctx.strokeStyle = color;
      nctx.lineWidth = 0.5;
      nctx.globalAlpha = 0.5;
      nctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      nctx.globalAlpha = 1;
    }
  }
}

function render() {
  drawBoard();
  drawGhost();
  drawCurrent();
  drawNext();
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateUI() {
  scoreEl.textContent     = score.toLocaleString();
  highScoreEl.textContent = highScore.toLocaleString();
  levelEl.textContent     = level;
  linesEl.textContent     = lines;
}

function showOverlay(title, subtitle, btnText) {
  overlayTitle.textContent    = title;
  overlaySubtitle.textContent = subtitle;
  overlayBtn.textContent      = btnText;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ─── Game Flow ────────────────────────────────────────────────────────────────
function initGame() {
  board       = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  score       = 0;
  level       = 1;
  lines       = 0;
  highScore   = parseInt(localStorage.getItem('tetris-high-score') || '0', 10);
  gameRunning = true;
  gamePaused  = false;
  gameOver    = false;
  dropCounter = 0;
  lastTime    = 0;

  next    = randomPiece();
  current = randomPiece();
  current.x = Math.floor(COLS / 2) - 2;
  current.y = 0;
  next    = randomPiece();

  updateUI();
  hideOverlay();
}

function triggerGameOver() {
  gameRunning = false;
  gameOver    = true;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('tetris-high-score', highScore);
    updateUI();
  }
  cancelAnimationFrame(animId);
  render();
  showOverlay('GAME OVER', `SCORE: ${score.toLocaleString()}`, 'RESTART');
}

function togglePause() {
  if (!gameRunning && !gamePaused) return;
  if (gameOver) return;
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
  score += dy * 2; // bonus points
  updateUI();
  lockPiece();
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function loop(time = 0) {
  if (!gameRunning || gamePaused) return;

  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;

  if (dropCounter >= dropInterval(level)) {
    dropCounter = 0;
    if (!collides(current, 0, 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }

  render();
  animId = requestAnimationFrame(loop);
}

// ─── Input ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!gameRunning && !gamePaused && !gameOver) return;

  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      if (!gamePaused && !collides(current, -1, 0)) current.x--;
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (!gamePaused && !collides(current, 1, 0)) current.x++;
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (!gamePaused) {
        if (!collides(current, 0, 1)) {
          current.y++;
          score += 1;
          updateUI();
          dropCounter = 0;
        } else {
          lockPiece();
        }
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (!gamePaused) tryRotate(current);
      break;
    case 'Space':
      e.preventDefault();
      if (!gamePaused) hardDrop();
      break;
    case 'KeyP':
      togglePause();
      break;
    case 'KeyR':
      cancelAnimationFrame(animId);
      startGame();
      break;
  }
});

// ─── Button ───────────────────────────────────────────────────────────────────
overlayBtn.addEventListener('click', () => {
  if (gamePaused) {
    togglePause();
  } else {
    startGame();
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
function startGame() {
  cancelAnimationFrame(animId);
  initGame();
  animId = requestAnimationFrame(loop);
}

// Initial screen
(function init() {
  highScore = parseInt(localStorage.getItem('tetris-high-score') || '0', 10);
  highScoreEl.textContent = highScore.toLocaleString();
  board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  render();
  showOverlay('TETRIS', 'PRESS START TO PLAY', 'START');
  gameRunning = false;
})();
