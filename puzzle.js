let currentImageSrc = null;
let imgNaturalW     = 0;
let imgNaturalH     = 0;
let COLS            = 3;
let ROWS            = 3;
let TOTAL           = 9;

let boardState       = [];
let moves            = 0;
let peekTimeout      = null;

let draggedPieceIdx  = null;
let dragSourceType   = null;
let dragSourcePos    = null;

let selectedBoardPos = null;

function navigateToPuzzle(e) {
  if (e) e.preventDefault();
  const curtain = document.getElementById('curtain');
  curtain.classList.remove('opening');
  curtain.classList.add('closing');

  setTimeout(() => {
    document.getElementById('home').classList.remove('active');
    document.getElementById('puzzle').classList.add('active');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      curtain.classList.remove('closing');
      curtain.classList.add('opening');
    }));
  }, 580);
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => startPuzzle(null, e.target.result);
  reader.readAsDataURL(file);
  event.target.value = '';
}

function startPuzzle(el, srcOverride) {
  const src = srcOverride || (el && el.dataset.src);
  if (!src) return;
  currentImageSrc = src;
  moves = 0;
  document.getElementById('moves-count').textContent = '0';

  const img = new Image();
  img.onload = () => {
    imgNaturalW = img.naturalWidth;
    imgNaturalH = img.naturalHeight;
    computeGrid(imgNaturalW, imgNaturalH);
    document.getElementById('choose-step').style.display = 'none';
    document.getElementById('game-step').classList.add('active');
    buildPuzzle();
  };
  img.src = src;
}

function computeGrid(w, h) {
  const ratio = w / h;

  if (ratio >= 1.6) {
    COLS = 4; ROWS = 3;
  } else if (ratio >= 1.1) {
    COLS = 4; ROWS = 3;
  } else if (ratio >= 0.85) {
    COLS = 3; ROWS = 3;
  } else if (ratio >= 0.6) {
    COLS = 3; ROWS = 4;
  } else {
    COLS = 3; ROWS = 5;
  }
  TOTAL = COLS * ROWS;
}

function buildPuzzle() {
  boardState    = new Array(TOTAL).fill(null);
  selectedBoardPos = null;

  const board = document.getElementById('puzzle-board');
  board.innerHTML = '';
  board.style.setProperty('--board-cols', COLS);
  board.style.setProperty('--board-rows', ROWS);
  board.style.aspectRatio = `${COLS} / ${ROWS * (imgNaturalH / imgNaturalW) * COLS / ROWS}`;
  board.style.aspectRatio = `${imgNaturalW} / ${imgNaturalH}`;

  for (let i = 0; i < TOTAL; i++) {
    board.appendChild(createBoardCell(i));
  }

  const tray = document.getElementById('pieces-tray');
  tray.innerHTML = '';
  tray.style.setProperty('--tray-cols', COLS);

  const order = shuffle([...Array(TOTAL).keys()]);
  order.forEach(pieceIdx => tray.appendChild(createTrayPiece(pieceIdx)));
}

function applyPieceBg(el, pieceIdx) {
  const col = pieceIdx % COLS;
  const row = Math.floor(pieceIdx / COLS);
  const bsW = COLS * 100;
  const bsH = ROWS * 100;
  const bpX = COLS > 1 ? (col / (COLS - 1)) * 100 : 0;
  const bpY = ROWS > 1 ? (row / (ROWS - 1)) * 100 : 0;

  el.style.backgroundImage    = `url(${currentImageSrc})`;
  el.style.backgroundSize     = `${bsW}% ${bsH}%`;
  el.style.backgroundPosition = `${bpX}% ${bpY}%`;
  el.style.backgroundRepeat   = 'no-repeat';
}

function createBoardCell(pos) {
  const cell = document.createElement('div');
  cell.className = 'board-cell';
  cell.dataset.pos = pos;
  cell.innerHTML = '<div class="board-placeholder"><i class="ri-add-circle-line"></i></div>';
  cell.addEventListener('dragover',  onCellDragOver);
  cell.addEventListener('dragleave', onCellDragLeave);
  cell.addEventListener('drop',      onCellDrop);
  cell.addEventListener('click',     onCellClick);
  return cell;
}

function createTrayPiece(pieceIdx) {
  const el = document.createElement('div');
  el.className = 'puzzle-piece';
  el.dataset.pieceIdx = pieceIdx;
  el.draggable = true;
  el.style.aspectRatio = `${imgNaturalW / COLS} / ${imgNaturalH / ROWS}`;
  applyPieceBg(el, pieceIdx);
  el.addEventListener('dragstart', onTrayPieceDragStart);
  el.addEventListener('dragend',   onDragEndCleanup);
  el.addEventListener('touchstart', onTouchPieceStart, { passive: false });
  return el;
}

function createCellContent(pieceIdx) {
  const div = document.createElement('div');
  div.className = 'cell-content';
  applyPieceBg(div, pieceIdx);
  return div;
}

function onTrayPieceDragStart(e) {
  draggedPieceIdx = parseInt(e.currentTarget.dataset.pieceIdx);
  dragSourceType  = 'tray';
  dragSourcePos   = null;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => (e.currentTarget.style.opacity = '0.35'), 0);
}

function makeCellContentDraggable(cellPos) {
  const cell    = getCellEl(cellPos);
  const content = cell.querySelector('.cell-content');
  if (!content) return;
  content.draggable = true;
  content.addEventListener('dragstart', (e) => {
    draggedPieceIdx = boardState[cellPos];
    dragSourceType  = 'board';
    dragSourcePos   = cellPos;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => (content.style.opacity = '0.35'), 0);
    e.stopPropagation();
  });
  content.addEventListener('dragend', onDragEndCleanup);
}

function onDragEndCleanup(e) {
  e.currentTarget.style.opacity = '';
  draggedPieceIdx = null;
  dragSourceType  = null;
  dragSourcePos   = null;
}

function onCellDragOver(e)  { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onCellDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

function onCellDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (draggedPieceIdx === null) return;

  const targetPos = parseInt(e.currentTarget.dataset.pos);

  if (dragSourceType === 'tray') {
    if (boardState[targetPos] !== null) {
      returnPieceToTray(boardState[targetPos]);
    }
    placePiece(draggedPieceIdx, targetPos);
    markTrayPiecePlaced(draggedPieceIdx);

  } else if (dragSourceType === 'board') {
    if (dragSourcePos === targetPos) return;
    swapBoardCells(dragSourcePos, targetPos);
  }

  clearSelection();
  moves++;
  document.getElementById('moves-count').textContent = moves;
  checkWin();
}

function onCellClick(e) {
  const pos = parseInt(e.currentTarget.dataset.pos);

  if (selectedBoardPos === null) {
    if (boardState[pos] === null) return;
    selectedBoardPos = pos;
    e.currentTarget.classList.add('selected-source');
  } else {
    if (selectedBoardPos === pos) { clearSelection(); return; }

    if (boardState[pos] === null) {
      placePiece(boardState[selectedBoardPos], pos);
      removeFromCell(selectedBoardPos);
    } else {
      swapBoardCells(selectedBoardPos, pos);
    }

    clearSelection();
    moves++;
    document.getElementById('moves-count').textContent = moves;
    checkWin();
  }
}

function clearSelection() {
  if (selectedBoardPos !== null) {
    const el = getCellEl(selectedBoardPos);
    if (el) el.classList.remove('selected-source');
    selectedBoardPos = null;
  }
  document.querySelectorAll('.board-cell.selected-source').forEach(c => c.classList.remove('selected-source'));
}

function getCellEl(pos) {
  return document.querySelector(`.board-cell[data-pos="${pos}"]`);
}

function placePiece(pieceIdx, boardPos) {
  boardState[boardPos] = pieceIdx;
  const cell = getCellEl(boardPos);
  cell.innerHTML = '';
  const content = createCellContent(pieceIdx);
  cell.appendChild(content);
  makeCellContentDraggable(boardPos);
}

function removeFromCell(boardPos) {
  boardState[boardPos] = null;
  const cell = getCellEl(boardPos);
  cell.innerHTML = '<div class="board-placeholder"><i class="ri-add-circle-line"></i></div>';
}

function swapBoardCells(posA, posB) {
  const pieceA = boardState[posA];
  const pieceB = boardState[posB];
  if (pieceA !== null) placePiece(pieceA, posB); else removeFromCell(posB);
  if (pieceB !== null) placePiece(pieceB, posA); else removeFromCell(posA);
}

function returnPieceToTray(pieceIdx) {
  const tp = document.querySelector(`.puzzle-piece[data-piece-idx="${pieceIdx}"]`);
  if (tp) tp.classList.remove('placed');
}

function markTrayPiecePlaced(pieceIdx) {
  const tp = document.querySelector(`.puzzle-piece[data-piece-idx="${pieceIdx}"]`);
  if (tp) tp.classList.add('placed');
}

let touchPieceIdx = null;
let touchSrcType  = null;
let touchSrcPos   = null;
let touchClone    = null;

function onTouchPieceStart(e) {
  e.preventDefault();
  touchPieceIdx = parseInt(e.currentTarget.dataset.pieceIdx);
  touchSrcType  = 'tray';
  touchSrcPos   = null;
  spawnTouchClone(e.currentTarget, e.touches[0]);
  document.addEventListener('touchmove', onTouchDragMove, { passive: false });
  document.addEventListener('touchend',  onTouchDragEnd);
}

function spawnTouchClone(el, touch) {
  touchClone = el.cloneNode(true);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  touchClone.style.cssText = `
    position:fixed;width:${w}px;height:${h}px;
    z-index:9500;opacity:0.88;pointer-events:none;
    border-radius:10px;border:2px solid #ec4899;
    left:${touch.clientX - w/2}px;top:${touch.clientY - h/2}px;
    background-image:${el.style.backgroundImage};
    background-size:${el.style.backgroundSize};
    background-position:${el.style.backgroundPosition};
    background-repeat:no-repeat;
  `;
  document.body.appendChild(touchClone);
}

function onTouchDragMove(e) {
  e.preventDefault();
  const t = e.touches[0];
  if (touchClone) {
    touchClone.style.left = (t.clientX - parseInt(touchClone.style.width)/2) + 'px';
    touchClone.style.top  = (t.clientY - parseInt(touchClone.style.height)/2) + 'px';
  }
}

function onTouchDragEnd(e) {
  const t = e.changedTouches[0];
  if (touchClone) { document.body.removeChild(touchClone); touchClone = null; }
  document.removeEventListener('touchmove', onTouchDragMove);
  document.removeEventListener('touchend',  onTouchDragEnd);

  const el   = document.elementFromPoint(t.clientX, t.clientY);
  const cell = el && el.closest('.board-cell');
  if (cell && touchPieceIdx !== null) {
    const targetPos = parseInt(cell.dataset.pos);
    if (boardState[targetPos] !== null) returnPieceToTray(boardState[targetPos]);
    placePiece(touchPieceIdx, targetPos);
    markTrayPiecePlaced(touchPieceIdx);
    moves++;
    document.getElementById('moves-count').textContent = moves;
    checkWin();
  }
  touchPieceIdx = null;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shufflePieces() {
  /* 1. Shuffle tray pieces */
  const tray  = document.getElementById('pieces-tray');
  const loose = Array.from(tray.querySelectorAll('.puzzle-piece:not(.placed)'));
  shuffle(loose).forEach(p => tray.appendChild(p));
  loose.forEach((p, i) => {
    p.style.transition = 'transform 0.35s ease';
    p.style.transform  = 'scale(0.78) rotate(4deg)';
    setTimeout(() => { p.style.transform = ''; }, 300 + i * 45);
  });

  const occupiedPos    = [];
  const occupiedPieces = [];
  boardState.forEach((pieceIdx, pos) => {
    if (pieceIdx !== null) {
      occupiedPos.push(pos);
      occupiedPieces.push(pieceIdx);
    }
  });
  if (occupiedPos.length > 1) {
    shuffle(occupiedPieces);
    occupiedPos.forEach((pos, i) => placePiece(occupiedPieces[i], pos));
  }
}

function togglePeek() {
  const overlay = document.getElementById('peek-overlay');
  if (overlay.classList.contains('show')) { hidePeek(); return; }
  document.getElementById('peek-img').src = currentImageSrc;
  overlay.classList.add('show');
  document.getElementById('peek-btn').classList.add('peek-active');

  let secs = 5;
  document.getElementById('peek-timer').textContent = `Closing in ${secs}s`;
  peekTimeout = setInterval(() => {
    secs--;
    if (secs <= 0) hidePeek();
    else document.getElementById('peek-timer').textContent = `Closing in ${secs}s`;
  }, 1000);
}

function hidePeek() {
  document.getElementById('peek-overlay').classList.remove('show');
  document.getElementById('peek-btn').classList.remove('peek-active');
  if (peekTimeout) { clearInterval(peekTimeout); peekTimeout = null; }
}

function checkWin() {
  if (boardState.length !== TOTAL) return;
  const correct = boardState.every((v, i) => v === i);
  if (correct) setTimeout(showWin, 350);
}

function showWin() {
  document.getElementById('win-full-img').src = currentImageSrc;
  document.getElementById('win-screen').classList.add('show');
  spawnConfetti();
}

function spawnConfetti() {
  const wrap   = document.getElementById('confetti-wrap');
  wrap.innerHTML = '';
  const colors = ['#f9a8d4','#ec4899','#be185d','#e879f9','#fb7185','#fce7f3','#fff'];
  for (let i = 0; i < 100; i++) {
    const el = document.createElement('div');
    el.className           = 'confetti-piece';
    el.style.left          = Math.random() * 100 + 'vw';
    el.style.top           = '-12px';
    el.style.height        = (Math.random() * 12 + 5) + 'px';
    el.style.background    = colors[Math.floor(Math.random() * colors.length)];
    el.style.transform     = `rotate(${Math.random() * 360}deg)`;
    el.style.animationDuration = (Math.random() * 2.5 + 1.8) + 's';
    el.style.animationDelay    = (Math.random() * 2.5) + 's';
    wrap.appendChild(el);
  }
}

function resetGame() {
  document.getElementById('win-screen').classList.remove('show');
  boardState       = new Array(TOTAL).fill(null);
  selectedBoardPos = null;
  moves            = 0;
  document.getElementById('moves-count').textContent = '0';
  document.getElementById('game-step').classList.remove('active');
  document.getElementById('choose-step').style.display = 'block';
}

function backToChoose() {
  document.getElementById('game-step').classList.remove('active');
  document.getElementById('choose-step').style.display = 'block';
  boardState       = new Array(TOTAL).fill(null);
  selectedBoardPos = null;
}