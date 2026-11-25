window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  class GameState {
    constructor(options = {}) {
      this.size = options.size || 9;
      this.gameMode = options.gameMode || 'ai';
      this.cardFormat = options.cardFormat || 'open';
      this.komi = options.komi !== undefined ? Number(options.komi) : 6.5;

      this.board = Array.from({ length: this.size }, () => Array(this.size).fill(null));
      this.blockedCells = {};
      this.currentTurn = 'black';
      this.turnNumber = 1;
      this.extraTurns = { black: 0, white: 0 };
      this.captures = { black: 0, white: 0 };
      this.hands = {
        black: options.blackHand ? [...options.blackHand] : [],
        white: options.whiteHand ? [...options.whiteHand] : []
      };

      this.koPoint = null;
      this.lastMove = null;
      this.consecutivePasses = 0;
      this.isGameOver = false;
      this.winner = null;
      this.winReason = null;
      this.logs = [];
      this.history = [];
    }

    inBounds(x, y) { return x >= 0 && x < this.size && y >= 0 && y < this.size; }
    getStone(x, y) { return this.inBounds(x, y) ? this.board[y][x] : null; }
    setStone(x, y, stone) { if (this.inBounds(x, y)) this.board[y][x] = stone; }

    isBlocked(x, y) {
      const entry = this.blockedCells[`${x},${y}`];
      if (!entry) return false;
      if (entry.type === 'permanent') return true;
      return entry.type === 'seal' && this.turnNumber <= entry.expiresAfterTurn;
    }

    cleanupExpiredEffects() {
      for (const key of Object.keys(this.blockedCells)) {
        const entry = this.blockedCells[key];
        if (entry.type === 'seal' && this.turnNumber > entry.expiresAfterTurn) delete this.blockedCells[key];
      }
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          const s = this.board[y][x];
          if (s && s.chronoExpiresTurn && this.turnNumber > s.chronoExpiresTurn) delete s.chronoExpiresTurn;
        }
      }
    }

    opponentOf(color) { return color === 'black' ? 'white' : 'black'; }

    addLog(text) {
      this.logs.push(text);
      if (this.logs.length > 80) this.logs.shift();
    }

    clone() {
      const copy = new GameState({
        size: this.size,
        gameMode: this.gameMode,
        cardFormat: this.cardFormat,
        komi: this.komi,
        blackHand: [...this.hands.black],
        whiteHand: [...this.hands.white]
      });
      copy.board = this.board.map((row) => row.map((c) => (c ? { ...c } : null)));
      for (const [k, v] of Object.entries(this.blockedCells)) copy.blockedCells[k] = { ...v };
      copy.currentTurn = this.currentTurn;
      copy.turnNumber = this.turnNumber;
      copy.extraTurns = { ...this.extraTurns };
      copy.captures = { ...this.captures };
      copy.koPoint = this.koPoint ? { ...this.koPoint } : null;
      copy.lastMove = this.lastMove ? { ...this.lastMove } : null;
      copy.consecutivePasses = this.consecutivePasses;
      copy.isGameOver = this.isGameOver;
      copy.winner = this.winner;
      copy.winReason = this.winReason;
      copy.logs = [...this.logs];
      return copy;
    }
  }

  ns.GameState = GameState;
})(window.SpiritGo);