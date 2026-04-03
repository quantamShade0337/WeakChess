import { Chess } from "./chess.js";


const toast = document.getElementById("toast");
const board = document.getElementById("chessboard");
const boardViewport = document.getElementById("boardViewport");
const gameResultOverlay = document.getElementById("gameResultOverlay");
const gameResultText = document.getElementById("gameResultText");
const mascotBubble = document.getElementById("mascotBubble");
const engineStatus = document.getElementById("engineStatus");
const engineClock = document.getElementById("engineClock");
const playerStatus = document.getElementById("playerStatus");
const playerClock = document.getElementById("playerClock");
const scorePill = document.getElementById("scorePill");
const insightTitle = document.getElementById("insightTitle");
const insightBody = document.getElementById("insightBody");
const turnStat = document.getElementById("turnStat");
const stateStat = document.getElementById("stateStat");
const tempoStat = document.getElementById("tempoStat");
const focusStat = document.getElementById("focusStat");
const greatMovesStat = document.getElementById("greatMovesStat");
const gamesPlayedStat = document.getElementById("gamesPlayedStat");
const makeMoveBtn = document.getElementById("makeMoveBtn");

const game = new Chess();
const pieceMap = {
  wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
};
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const INITIAL_TIME_MS = 3 * 60 * 1000;

let selectedSquare = null;
let legalTargets = [];
let flipped = false;
let hintSquare = null;
let pendingBotMove = null;
let greatMoves = 4;
let gamesPlayed = 12;
let whiteTimeMs = INITIAL_TIME_MS;
let blackTimeMs = INITIAL_TIME_MS;
let whiteIncrement = 2000;
let blackIncrement = 2000;
let clockInterval = null;
let lastClockTick = 0;
let timeoutWinner = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function speak(message) {
  mascotBubble.querySelector("p").textContent = message;
  showToast(message);
}

function updateDashboardStats() {
  greatMovesStat.textContent = String(greatMoves);
  gamesPlayedStat.textContent = String(gamesPlayed);
}

function currentBoardMatrix() {
  const matrix = Array.from({ length: 8 }, () => Array(8).fill(""));
  game.board().forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      if (!piece) return;
      matrix[rowIndex][colIndex] = pieceMap[`${piece.color}${piece.type}`];
    });
  });
  return matrix;
}

function formatClock(ms) {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderClocks() {
  playerClock.textContent = formatClock(whiteTimeMs);
  engineClock.textContent = formatClock(blackTimeMs);
}

function isFinished() {
  return Boolean(timeoutWinner) || game.game_over();
}

function stopClockLoop() {
  if (clockInterval) {
    window.clearInterval(clockInterval);
    clockInterval = null;
  }
}

function handleTimeout(winner) {
  if (timeoutWinner || game.game_over()) return;
  timeoutWinner = winner;
  pendingBotMove = null;
  stopClockLoop();
  clearSelection();
  buildBoard();
  if (winner === "w") {
    gamesPlayed += 1;
    greatMoves += 1;
    updateDashboardStats();
    engineStatus.textContent = "Flagged";
    playerStatus.textContent = "Won";
    speak("Black flagged.");
    showGameResult("win");
  } else {
    gamesPlayed += 1;
    updateDashboardStats();
    engineStatus.textContent = "Won";
    playerStatus.textContent = "Flagged";
    speak("White flagged.");
    showGameResult("loss");
  }
  setActionAvailability();
}

function tickClock() {
  if (isFinished()) {
    stopClockLoop();
    return;
  }

  const now = Date.now();
  if (!lastClockTick) {
    lastClockTick = now;
    return;
  }

  const elapsed = now - lastClockTick;
  lastClockTick = now;

  if (game.turn() === "w") {
    whiteTimeMs = Math.max(0, whiteTimeMs - elapsed);
    if (whiteTimeMs === 0) {
      renderClocks();
      handleTimeout("b");
      return;
    }
  } else {
    blackTimeMs = Math.max(0, blackTimeMs - elapsed);
    if (blackTimeMs === 0) {
      renderClocks();
      handleTimeout("w");
      return;
    }
  }

  renderClocks();
}

function startClockLoop() {
  stopClockLoop();
  lastClockTick = Date.now();
  renderClocks();
  if (isFinished()) return;
  clockInterval = window.setInterval(tickClock, 250);
}

function squareName(row, col) {
  const file = "abcdefgh"[col];
  const rank = 8 - row;
  return `${file}${rank}`;
}

function legalMovesFrom(square) {
  return game.moves({ square, verbose: true });
}

function pieceSymbolFor(square) {
  const piece = game.get(square);
  return piece ? pieceMap[`${piece.color}${piece.type}`] : "";
}

function squareElement(square) {
  return board.querySelector(`[data-square="${square}"]`);
}

function waitForTransition(node, fallback = 260) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      node.removeEventListener("transitionend", finish);
      resolve();
    };
    node.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, fallback);
  });
}

async function animateMove({ from, to, symbol }) {
  if (!symbol || prefersReducedMotion.matches) return;

  const fromSquare = squareElement(from);
  const toSquare = squareElement(to);
  if (!fromSquare || !toSquare) return;

  const fromRect = fromSquare.getBoundingClientRect();
  const toRect = toSquare.getBoundingClientRect();
  const destinationPiece = toSquare.querySelector(".piece");

  if (destinationPiece) destinationPiece.classList.add("piece--hidden");

  const ghost = document.createElement("span");
  ghost.className = "piece piece--moving";
  ghost.textContent = symbol;
  ghost.style.left = `${fromRect.left}px`;
  ghost.style.top = `${fromRect.top}px`;
  ghost.style.width = `${fromRect.width}px`;
  ghost.style.height = `${fromRect.height}px`;
  ghost.style.transform = "translate3d(0, 0, 0)";
  document.body.appendChild(ghost);

  requestAnimationFrame(() => {
    ghost.style.transform = `translate3d(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px, 0)`;
  });

  await waitForTransition(ghost, 320);
  ghost.remove();
  if (destinationPiece) destinationPiece.classList.remove("piece--hidden");
}

function clearSelection() {
  selectedSquare = null;
  legalTargets = [];
  hintSquare = null;
}

function hideGameResult() {
  boardViewport.classList.remove("is-finished");
  gameResultOverlay.hidden = true;
  gameResultOverlay.classList.remove("game-result-overlay--win", "game-result-overlay--loss", "game-result-overlay--draw");
}

function showGameResult(type) {
  hideGameResult();
  const config = {
    win: { text: "CHECKMATE", className: "game-result-overlay--win" },
    loss: { text: "GAME OVER", className: "game-result-overlay--loss" },
    draw: { text: "DRAW", className: "game-result-overlay--draw" },
  }[type];

  if (!config) return;
  gameResultText.textContent = config.text;
  gameResultOverlay.hidden = false;
  gameResultOverlay.classList.add(config.className);
  boardViewport.classList.add("is-finished");
}

function describeMove(move) {
  if (move.san.includes("#")) return "Checkmate.";
  if (move.captured === "q") return "Queen won.";
  if (move.san.includes("+")) return "Check.";
  if (move.flags.includes("k") || move.flags.includes("q")) return "Castle.";
  if (move.piece === "p" && ["e4", "d4", "e5", "d5"].includes(move.to)) return "Strong center.";
  if (move.piece === "n" || move.piece === "b") return "Good development.";
  if (move.captured) return "Good capture.";
  return "Good move.";
}

function updateInsight(lastMove = null) {
  turnStat.textContent = game.turn() === "w" ? "White" : "Black";

  if (game.in_checkmate()) {
    stateStat.textContent = "Mate";
    scorePill.textContent = "Mate";
    insightTitle.textContent = "Over";
    insightBody.textContent = game.turn() === "w" ? "Black mate." : "You mate.";
    tempoStat.textContent = "Final";
    focusStat.textContent = "King safety";
    return;
  }

  if (game.in_check()) {
    stateStat.textContent = "Check";
    scorePill.textContent = "Sharp";
    insightTitle.textContent = "Check";
    insightBody.textContent = "King under pressure.";
    tempoStat.textContent = "Active";
    focusStat.textContent = "King";
    return;
  }

  if (lastMove?.captured) {
    stateStat.textContent = "Tactical";
    scorePill.textContent = "Material";
    insightTitle.textContent = "Material";
    insightBody.textContent = lastMove.captured === "q" ? "Queen taken." : "Piece won.";
    tempoStat.textContent = "Direct";
    focusStat.textContent = "Material";
    return;
  }

  if (game.history().length < 8) {
    stateStat.textContent = "Opening";
    scorePill.textContent = "Warm";
    insightTitle.textContent = "Opening";
    insightBody.textContent = "Center. Develop. Castle.";
    tempoStat.textContent = "Steady";
    focusStat.textContent = "Center";
    return;
  }

  stateStat.textContent = "Middlegame";
  scorePill.textContent = "Balanced";
  insightTitle.textContent = "Read";
  insightBody.textContent = "Improve the next piece.";
  tempoStat.textContent = "Steady";
  focusStat.textContent = "Coordination";
}

function setActionAvailability() {
  const disabled = Boolean(pendingBotMove) || game.turn() !== "w" || isFinished();
  makeMoveBtn.disabled = disabled;
  if (pendingBotMove) makeMoveBtn.textContent = "Thinking...";
  else if (isFinished()) makeMoveBtn.textContent = "Game finished";
  else makeMoveBtn.textContent = "Best move";
}

function buildBoard() {
  board.innerHTML = "";
  const matrix = currentBoardMatrix();
  const rows = flipped ? [...matrix].reverse() : matrix;

  rows.forEach((row, rowIndex) => {
    const cols = flipped ? [...row].reverse() : row;
    cols.forEach((piece, colIndex) => {
      const originalRow = flipped ? 7 - rowIndex : rowIndex;
      const originalCol = flipped ? 7 - colIndex : colIndex;
      const name = squareName(originalRow, originalCol);
      const isLight = (rowIndex + colIndex) % 2 === 0;
      const square = document.createElement("button");
      square.className = `square ${isLight ? "square--light" : "square--dark"}`;
      square.type = "button";
      square.dataset.square = name;
      square.setAttribute("aria-label", `Square ${name}`);
      const pieceAtSquare = game.get(name);

      if (game.turn() !== "w" || pendingBotMove || isFinished()) square.disabled = true;

      const history = game.history({ verbose: true });
      const lastMove = history[history.length - 1];
      if (lastMove && [lastMove.from, lastMove.to].includes(name)) square.classList.add("square--last");
      if (name === selectedSquare) square.classList.add("square--selected");
      if (legalTargets.includes(name)) {
        square.classList.add("square--legal");
        if (pieceAtSquare) square.classList.add("square--legal-capture");
      }
      if (name === hintSquare) square.classList.add("square--hint");
      if (piece) {
        if (pieceAtSquare?.color === "w" && game.turn() === "w" && !pendingBotMove) {
          square.classList.add("square--piece");
        }
        const span = document.createElement("span");
        span.className = "piece";
        span.textContent = piece;
        square.appendChild(span);
      }

      square.addEventListener("click", () => {
        if (pendingBotMove || game.turn() !== "w" || isFinished()) return;
        if (selectedSquare && legalTargets.includes(name)) {
          attemptMove(selectedSquare, name);
          return;
        }
        if (pieceAtSquare?.color === "w") {
          selectedSquare = name;
          legalTargets = legalMovesFrom(name).map((move) => move.to);
          buildBoard();
          return;
        }
        clearSelection();
        buildBoard();
      });

      board.appendChild(square);
    });
  });
}

const API_URL = "https://weakserver-production.up.railway.app"; 

function fallbackBotMove() {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;

  const scored = moves
    .map((move) => {
      let score = 0;
      if (move.san.includes("#")) score += 1000;
      if (move.san.includes("+")) score += 120;
      if (move.captured === "q") score += 90;
      else if (move.captured) score += 45;
      if (move.flags.includes("k") || move.flags.includes("q")) score += 35;
      if (["e4", "d4", "e5", "d5", "c4", "c5", "f4", "f5"].includes(move.to)) score += 18;
      if (["n", "b"].includes(move.piece)) score += 10;
      score += Math.random() * 4;
      return { move, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0]?.move;
  return best
    ? { from: best.from, to: best.to, promotion: best.promotion || "q" }
    : null;
}

async function chooseBotMove() {
  if (isFinished()) return null;

  // Map moves to UCI strings (e.g., "e2e4")
  const moves = game.history({ verbose: true })
    .map(m => m.from + m.to + (m.promotion || ""));

  try {
    const res = await fetch(`${API_URL}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        startfen: "startpos",
        ucimoves: moves,
        wtime: whiteTimeMs,
        btime: blackTimeMs,
        winc: whiteIncrement,
        binc: blackIncrement
      })
    });

    if (!res.ok) throw new Error("Network response was not ok");
    
    const data = await res.json();

    if (!data.bestmove) return fallbackBotMove();

    const candidate = {
      from: data.bestmove.slice(0, 2),
      to: data.bestmove.slice(2, 4),
      promotion: data.bestmove[4] || "q"
    };

    const isLegal = game.moves({ verbose: true }).some((move) =>
      move.from === candidate.from &&
      move.to === candidate.to &&
      (candidate.promotion ? (move.promotion || "q") === candidate.promotion : true)
    );

    return isLegal ? candidate : fallbackBotMove();

  } catch (err) {
    console.error("Fetch error:", err);
    showToast("Engine offline. Local move.");
    return fallbackBotMove();
  }
}

async function maybeBotMove() {
  if (game.turn() !== "b" || isFinished()) return;

  pendingBotMove = true;
  engineStatus.textContent = "Thinking...";
  setActionAvailability();

  const botMoveData = await chooseBotMove();
  if (isFinished()) {
    pendingBotMove = null;
    buildBoard();
    setActionAvailability();
    return;
  }

  if (botMoveData) {
    const movingSymbol = pieceSymbolFor(botMoveData.from);
    const move = game.move(botMoveData);
    if (move) await afterMove(move, true, movingSymbol);
  }

  pendingBotMove = null;
  buildBoard();
  setActionAvailability();
}

async function afterMove(move, byBot = false, movingSymbol = pieceSymbolFor(move.to)) {

  // Prev move was black
  if (game.turn() === 'w')  blackTimeMs += blackIncrement;
  if (game.turn() === 'b')  whiteTimeMs += whiteIncrement;

  updateInsight(move);

  if (game.in_checkmate()) {
    if (!byBot) greatMoves += 1;
    gamesPlayed += 1;
    updateDashboardStats();
    engineStatus.textContent = byBot ? "Mate" : "Mate";
    playerStatus.textContent = byBot ? "Lost" : "Won";
    speak(byBot ? "Checkmate. Again?" : "Checkmate.");
    clearSelection();
    buildBoard();
    await animateMove({ from: move.from, to: move.to, symbol: movingSymbol });
    showGameResult(byBot ? "loss" : "win");
    stopClockLoop();
    setActionAvailability();
    return;
  }

  if (game.in_draw()) {
    gamesPlayed += 1;
    updateDashboardStats();
    engineStatus.textContent = "Draw";
    playerStatus.textContent = "Draw";
    speak("Draw.");
    clearSelection();
    buildBoard();
    await animateMove({ from: move.from, to: move.to, symbol: movingSymbol });
    showGameResult("draw");
    stopClockLoop();
    setActionAvailability();
    return;
  }

  if (!byBot) {
    if (move.captured || move.san.includes("+") || ["e4", "d4", "Nf3", "Nc3", "Bb5", "Bc4"].includes(move.san)) {
      greatMoves += 1;
      updateDashboardStats();
    }
    playerStatus.textContent = move.san.includes("+") ? "Check" : "Played";
    engineStatus.textContent = "Thinking";
    speak(describeMove(move));
  } else {
    playerStatus.textContent = "Move";
    engineStatus.textContent = move.san.includes("+") ? "Check" : "Played";
    if (move.san.includes("+")) speak("Check.");
    else if (move.captured === "q") speak("Queen lost.");
    else mascotBubble.querySelector("p").textContent = "Your move.";
  }

  buildBoard();
  await animateMove({ from: move.from, to: move.to, symbol: movingSymbol });
  setActionAvailability();
  startClockLoop();
}

async function attemptMove(from, to) {
  const movingSymbol = pieceSymbolFor(from);
  const move = game.move({ from, to, promotion: "q" });
  if (!move) {
    speak("That move doesn't work from here. Try one of the glowing squares.");
    return;
  }
  clearSelection();
  await afterMove(move, false, movingSymbol);
  await maybeBotMove();
}

async function suggestedPlayerMove() {
  if (pendingBotMove || game.turn() !== "w" || isFinished()) return null;
  return await chooseBotMove();
}

function resetGame() {
  pendingBotMove = null;
  timeoutWinner = null;
  whiteTimeMs = INITIAL_TIME_MS;
  blackTimeMs = INITIAL_TIME_MS;
  game.reset();
  clearSelection();
  hideGameResult();
  updateInsight();
  engineStatus.textContent = "Ready";
  playerStatus.textContent = "Move";
  mascotBubble.querySelector("p").textContent = "Tap. Move.";
  buildBoard();
  setActionAvailability();
  startClockLoop();
}

document.getElementById("flipBoardBtn")?.addEventListener("click", () => {
  flipped = !flipped;
  buildBoard();
  speak(flipped ? "Flipped." : "Reset view.");
});

document.getElementById("hintBtn")?.addEventListener("click", async () => {
  const move = await suggestedPlayerMove();
  if (!move) {
    speak(isFinished() ? "Game over." : "Wait.");
    return;
  }
  selectedSquare = move.from;
  legalTargets = [move.to];
  hintSquare = move.to;
  buildBoard();
  speak(`Try ${move.from}${move.to}.`);
});

document.getElementById("makeMoveBtn")?.addEventListener("click", async () => {
  const move = await suggestedPlayerMove();
  if (!move) {
    speak(isFinished() ? "Game over." : "Wait.");
    return;
  }
  attemptMove(move.from, move.to);
});

document.getElementById("newGameBtn")?.addEventListener("click", () => {
  gamesPlayed += 1;
  updateDashboardStats();
  resetGame();
  speak("New game.");
});

document.getElementById("undoBtn")?.addEventListener("click", () => {
  if (!game.history().length) {
    speak("Nothing to undo.");
    return;
  }
  pendingBotMove = null;
  timeoutWinner = null;
  game.undo();
  if (game.turn() === "b" && game.history().length) game.undo();
  clearSelection();
  hideGameResult();
  updateInsight();
  buildBoard();
  setActionAvailability();
  startClockLoop();
  speak("Undone.");
});

document.getElementById("analyzeBtn")?.addEventListener("click", async () => {
  const move = await suggestedPlayerMove();
  if (!move) {
    speak(isFinished() ? "Game over." : "Wait.");
    return;
  }
  speak(`${move.from}${move.to}.`);
});

updateDashboardStats();
resetGame();
