import { Chess } from "./chess.js";

const toast = document.getElementById("toast");
const mascot = document.getElementById("sidebarMascot");
const board = document.getElementById("chessboard");
const mascotBubble = document.getElementById("mascotBubble");
const engineStatus = document.getElementById("engineStatus");
const playerStatus = document.getElementById("playerStatus");
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

let selectedSquare = null;
let legalTargets = [];
let flipped = false;
let hintSquare = null;
let pendingBotMove = null;
let greatMoves = 4;
let gamesPlayed = 12;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function setMascotMood(mood = "happy") {
  mascot.classList.remove("mascot--happy", "mascot--cheer", "mascot--blink");
  if (mood) mascot.classList.add(`mascot--${mood}`);
  clearTimeout(setMascotMood.timer);
  setMascotMood.timer = setTimeout(() => {
    mascot.classList.remove("mascot--happy", "mascot--cheer", "mascot--blink");
  }, 700);
}

function speak(message, mood = "happy") {
  mascotBubble.querySelector("p").textContent = message;
  showToast(message);
  setMascotMood(mood);
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

function squareName(row, col) {
  const file = "abcdefgh"[col];
  const rank = 8 - row;
  return `${file}${rank}`;
}

function legalMovesFrom(square) {
  return game.moves({ square, verbose: true });
}

function clearSelection() {
  selectedSquare = null;
  legalTargets = [];
  hintSquare = null;
}

function describeMove(move) {
  if (move.san.includes("#")) return "Checkmate. That was the whole story.";
  if (move.captured === "q") return "You took the queen. Milo is absolutely delighted.";
  if (move.san.includes("+")) return "Check. Nice pressure on the king.";
  if (move.flags.includes("k") || move.flags.includes("q")) return "Castling is a very grown-up cozy move.";
  if (move.piece === "p" && ["e4", "d4", "e5", "d5"].includes(move.to)) return "Strong center move. Clean and confident.";
  if (move.piece === "n" || move.piece === "b") return "Nice development. Your pieces are waking up.";
  if (move.captured) return "Good capture. You picked up material neatly.";
  return "Good move. Calm, tidy, and purposeful.";
}

function updateInsight(lastMove = null) {
  turnStat.textContent = game.turn() === "w" ? "White" : "Black";

  if (game.in_checkmate()) {
    stateStat.textContent = "Mate";
    scorePill.textContent = "Mate";
    insightTitle.textContent = "Game over";
    insightBody.textContent = game.turn() === "w" ? "Black delivered mate." : "You delivered mate.";
    tempoStat.textContent = "Final";
    focusStat.textContent = "King safety";
    return;
  }

  if (game.in_check()) {
    stateStat.textContent = "Check";
    scorePill.textContent = "Sharp";
    insightTitle.textContent = "King under pressure";
    insightBody.textContent = "A checking move changes the whole temperature of the board.";
    tempoStat.textContent = "Active";
    focusStat.textContent = "King";
    return;
  }

  if (lastMove?.captured) {
    stateStat.textContent = "Tactical";
    scorePill.textContent = "Material";
    insightTitle.textContent = "Material swing";
    insightBody.textContent = lastMove.captured === "q" ? "Queen captures are huge emotional moments." : "A clean capture shifted the balance.";
    tempoStat.textContent = "Direct";
    focusStat.textContent = "Material";
    return;
  }

  if (game.history().length < 8) {
    stateStat.textContent = "Opening";
    scorePill.textContent = "Warm";
    insightTitle.textContent = "Comfort opening";
    insightBody.textContent = "Develop gently, touch the center, and keep the king safe.";
    tempoStat.textContent = "Gentle";
    focusStat.textContent = "Center";
    return;
  }

  stateStat.textContent = "Middlegame";
  scorePill.textContent = "Balanced";
  insightTitle.textContent = "Friendly read";
  insightBody.textContent = "Look for the next useful move before the flashy one.";
  tempoStat.textContent = "Steady";
  focusStat.textContent = "Coordination";
}

function setActionAvailability() {
  const disabled = Boolean(pendingBotMove) || game.turn() !== "w" || game.game_over();
  makeMoveBtn.disabled = disabled;
  if (pendingBotMove) makeMoveBtn.textContent = "Weak is thinking...";
  else if (game.game_over()) makeMoveBtn.textContent = "Game finished";
  else makeMoveBtn.textContent = "Play suggested move";
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
      square.setAttribute("aria-label", `Square ${name}`);

      if (game.turn() !== "w" || pendingBotMove) square.disabled = true;

      const history = game.history({ verbose: true });
      const lastMove = history[history.length - 1];
      if (lastMove && [lastMove.from, lastMove.to].includes(name)) square.classList.add("square--last");
      if (name === selectedSquare) square.classList.add("square--selected");
      if (legalTargets.includes(name)) square.classList.add("square--legal");
      if (name === hintSquare) square.classList.add("square--hint");

      const pieceAtSquare = game.get(name);
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
        if (pendingBotMove || game.turn() !== "w") return;
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

function chooseBotMove() {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const scored = moves.map((move) => {
    let score = 0;
    if (move.san.includes("#")) score += 1000;
    if (move.san.includes("+")) score += 100;
    if (move.captured) score += (pieceValues[move.captured] || 0) * 20;
    if (move.flags.includes("k") || move.flags.includes("q")) score += 14;
    if (["e5", "d5", "e4", "d4", "c5", "f5"].includes(move.to)) score += 5;
    if (move.piece === "n" || move.piece === "b") score += 4;
    score += Math.random() * 2;
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].move;
}

function afterMove(move, byBot = false) {
  updateInsight(move);

  if (game.in_checkmate()) {
    if (!byBot) greatMoves += 1;
    gamesPlayed += 1;
    updateDashboardStats();
    engineStatus.textContent = byBot ? "Weak found mate" : "You found mate";
    playerStatus.textContent = byBot ? "Take a breath and try again" : "That was beautiful";
    speak(byBot ? "Checkmate. I know, that one stings a little. Want another go?" : "Checkmate. That was lovely. I am doing a tiny king dance.", "cheer");
    clearSelection();
    buildBoard();
    setActionAvailability();
    return;
  }

  if (game.in_draw()) {
    gamesPlayed += 1;
    updateDashboardStats();
    engineStatus.textContent = "Balanced ending";
    playerStatus.textContent = "Drawn game";
    speak("Draw. A calm finish is still a finish worth taking.", "blink");
    clearSelection();
    buildBoard();
    setActionAvailability();
    return;
  }

  if (!byBot) {
    if (move.captured || move.san.includes("+") || ["e4", "d4", "Nf3", "Nc3", "Bb5", "Bc4"].includes(move.san)) {
      greatMoves += 1;
      updateDashboardStats();
    }
    playerStatus.textContent = move.san.includes("+") ? "You gave check" : "Nice move";
    engineStatus.textContent = "Weak is thinking";
    speak(describeMove(move), move.captured === "q" || move.san.includes("#") ? "cheer" : "happy");
  } else {
    playerStatus.textContent = "Your move";
    engineStatus.textContent = move.san.includes("+") ? "Weak gave check" : "Weak has moved";
    if (move.san.includes("+")) speak("Weak gave check. Let's answer carefully.", "blink");
    else if (move.captured === "q") speak("Weak grabbed the queen. We should recover calmly from here.", "blink");
    else mascotBubble.querySelector("p").textContent = "Your turn. Look for the next clean move.";
  }

  buildBoard();
  setActionAvailability();
}

function attemptMove(from, to) {
  const move = game.move({ from, to, promotion: "q" });
  if (!move) {
    speak("That move doesn't work from here. Try one of the glowing squares.", "blink");
    return;
  }
  clearSelection();
  afterMove(move, false);
  maybeBotMove();
}

function maybeBotMove() {
  if (game.turn() !== "b" || game.game_over()) return;
  pendingBotMove = setTimeout(() => {
    const move = chooseBotMove();
    if (move) {
      game.move(move);
      afterMove(move, true);
    }
    pendingBotMove = null;
    buildBoard();
    setActionAvailability();
  }, 650);
  setActionAvailability();
}

function suggestedPlayerMove() {
  if (pendingBotMove || game.turn() !== "w" || game.game_over()) return null;
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  return chooseBotMove();
}

function resetGame() {
  if (pendingBotMove) {
    clearTimeout(pendingBotMove);
    pendingBotMove = null;
  }
  game.reset();
  clearSelection();
  updateInsight();
  engineStatus.textContent = "Ready for a calm game";
  playerStatus.textContent = "Your move";
  mascotBubble.querySelector("p").textContent = "Tap a piece, then tap where you want it to go. I'll cheer when you find something nice.";
  buildBoard();
  setActionAvailability();
}

document.getElementById("flipBoardBtn")?.addEventListener("click", () => {
  flipped = !flipped;
  buildBoard();
  speak(flipped ? "Board flipped for a fresh angle." : "Board returned to your side.", "blink");
});

document.getElementById("hintBtn")?.addEventListener("click", () => {
  const move = suggestedPlayerMove();
  if (!move) {
    speak(game.game_over() ? "That game is finished. Start a new one and I'll help again." : "Hold on a beat. Let the current turn settle first.", "blink");
    return;
  }
  selectedSquare = move.from;
  legalTargets = [move.to];
  hintSquare = move.to;
  buildBoard();
  speak(`Try ${move.san}. It looks like the tidiest move here.`, "cheer");
});

document.getElementById("makeMoveBtn")?.addEventListener("click", () => {
  const move = suggestedPlayerMove();
  if (!move) {
    speak(game.game_over() ? "That game is already over. We can start fresh." : "Not your move right now. Weak is still thinking.", "blink");
    return;
  }
  attemptMove(move.from, move.to);
});

document.getElementById("newGameBtn")?.addEventListener("click", () => {
  gamesPlayed += 1;
  updateDashboardStats();
  resetGame();
  speak("Fresh board. No pressure, just a clean start.", "blink");
});

document.getElementById("undoBtn")?.addEventListener("click", () => {
  if (!game.history().length) {
    speak("Nothing to undo yet. We're still at the beginning.", "blink");
    return;
  }
  if (pendingBotMove) {
    clearTimeout(pendingBotMove);
    pendingBotMove = null;
  }
  game.undo();
  if (game.turn() === "b" && game.history().length) game.undo();
  clearSelection();
  updateInsight();
  buildBoard();
  setActionAvailability();
  speak("Took that back. You can try the position again.", "blink");
});

document.getElementById("analyzeBtn")?.addEventListener("click", () => {
  const move = suggestedPlayerMove();
  if (!move) {
    speak(game.game_over() ? "The board is settled. Start a new game if you want another read." : "I'll give analysis once it's your move again.", "blink");
    return;
  }
  speak(`A calm idea here is ${move.san}. It either improves pressure or keeps your king comfortable.`, "happy");
});

updateDashboardStats();
resetGame();
