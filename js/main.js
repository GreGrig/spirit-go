window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  class SpiritGoApp {
    constructor() {
      this.state = null;
      this.lastMatchConfig = { size: 9, gameMode: 'ai', komi: 6.5 };
      this.perspectiveColor = 'black';
      this.myOnlineColor = 'black';
      this.isTutorial = false;
      this.aiTimer = null;

      this.sound = new ns.SoundManager();
      this.net = new ns.NetworkManager(
        (msg) => this._handleNetworkMessage(msg),
        (statusText) => {
          const el = document.getElementById('online-status-text');
          if (el) el.textContent = statusText;
        }
      );

      this.handController = new ns.HandController((targeting) => {
        this.sound.playCardSelect();
        if (this.isTutorial && this.tutorial) {
          this.tutorial.onCardSelectionChanged(targeting);
        }
        this._refreshUI();
      });
      this.renderer = new ns.BoardRenderer(document.getElementById('go-board'), (x, y) => this._handleBoardClick(x, y));
      this.votingScreen = new ns.VotingScreen((cfg) => this.startMatch(cfg), this.net);
      this.tutorial = new ns.TutorialManager(this);

      this._bindEvents();
      this._populateRulesModal();
    }

    _showScreen(screenId) {
      document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
      document.getElementById(screenId).classList.add('active');
    }

    _bindEvents() {
      document.querySelectorAll('.size-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.size-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.lastMatchConfig.size = Number(btn.dataset.size);
        });
      });

      document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.lastMatchConfig.gameMode = btn.dataset.mode;

          const onlineBox = document.getElementById('online-setup-box');
          const startBtn = document.getElementById('btn-start-match');
          if (btn.dataset.mode === 'online') {
            onlineBox.classList.remove('hidden');
            startBtn.classList.add('hidden');
          } else {
            onlineBox.classList.add('hidden');
            startBtn.classList.remove('hidden');
            this.net.disconnect();
          }
        });
      });

      document.getElementById('btn-create-room').addEventListener('click', () => {
        const komiVal = parseFloat(document.getElementById('input-komi').value);
        this.lastMatchConfig.komi = Number.isNaN(komiVal) ? 6.5 : komiVal;
        this.myOnlineColor = 'black';
        this.net.createRoom((code) => {
          document.getElementById('host-code-display').textContent = code;
        });
      });

      document.getElementById('btn-join-room').addEventListener('click', () => {
        const code = document.getElementById('input-join-code').value;
        this.myOnlineColor = 'white';
        this.net.joinRoom(code);
      });

      document.getElementById('btn-start-match').addEventListener('click', () => {
        this.isTutorial = false;
        this.tutorial.stop();
        const komiVal = parseFloat(document.getElementById('input-komi').value);
        this.lastMatchConfig.komi = Number.isNaN(komiVal) ? 6.5 : komiVal;
        this._showScreen('screen-voting');
        this.votingScreen.start({ ...this.lastMatchConfig }, 'black');
      });

      document.getElementById('btn-start-tutorial').addEventListener('click', () => {
        this.net.disconnect();
        this.isTutorial = true;
        this.tutorial.start();
      });

      document.getElementById('btn-normal-stone').addEventListener('click', () => this.handController.resetToNormal());
      document.getElementById('btn-cancel-card').addEventListener('click', () => this.handController.resetToNormal());

      document.getElementById('btn-pass').addEventListener('click', () => {
        if (!this.state || this.state.isGameOver) return;
        if (this.isTutorial && !this.tutorial.canPass()) return;
        if (this.state.gameMode === 'ai' && this.state.currentTurn === 'white') return;
        if (this.state.gameMode === 'online' && this.state.currentTurn !== this.myOnlineColor) return;
        this._submitMove({ type: 'pass' }, true);
      });

      document.getElementById('btn-undo').addEventListener('click', () => {
        if (!this.state || this.state.history.length === 0) return;
        this.state = this.state.history.pop();
        this.handController.resetToNormal();
        this._refreshUI();
      });

      document.getElementById('btn-sound').addEventListener('click', (e) => {
        e.target.textContent = this.sound.toggleMute() ? '🔇' : '🔊';
      });

      document.getElementById('btn-rules').addEventListener('click', () => document.getElementById('modal-rules').classList.remove('hidden'));
      document.getElementById('btn-close-rules').addEventListener('click', () => document.getElementById('modal-rules').classList.add('hidden'));

      document.getElementById('btn-surrender').addEventListener('click', () => {
        if (!this.state || this.state.isGameOver) return;
        if (this.isTutorial) {
          this.tutorial.exitToMenu();
          return;
        }
        const loser = this.state.gameMode === 'online' ? this.myOnlineColor : this.state.currentTurn;
        const winner = this.state.opponentOf(loser);
        if (this.state.gameMode === 'online') {
          this.net.send({ type: 'SURRENDER', loser });
        }
        this._finishBySurrender(winner);
      });

      document.getElementById('btn-to-menu').addEventListener('click', () => {
        clearTimeout(this.aiTimer);
        this.net.disconnect();
        this.isTutorial = false;
        this.tutorial.stop();
        this._showScreen('screen-lobby');
      });

      document.getElementById('btn-curtain-ready').addEventListener('click', () => {
        document.getElementById('hotseat-curtain').classList.add('hidden');
        this.perspectiveColor = this.state.currentTurn;
        this._refreshUI();
      });

      document.getElementById('btn-rematch').addEventListener('click', () => {
        document.getElementById('modal-scoring').classList.add('hidden');
        if (this.isTutorial) {
          this.tutorial.loadLesson(0);
          return;
        }
        if (this.lastMatchConfig.gameMode === 'online') {
          if (!this.net.isConnected()) {
            this._showScreen('screen-lobby');
            return;
          }
          this.net.send({ type: 'REMATCH' });
        }
        this._showScreen('screen-voting');
        this.votingScreen.start({ ...this.lastMatchConfig }, this.myOnlineColor);
      });

      document.getElementById('btn-scoring-menu').addEventListener('click', () => {
        document.getElementById('modal-scoring').classList.add('hidden');
        this.net.disconnect();
        this.isTutorial = false;
        this.tutorial.stop();
        this._showScreen('screen-lobby');
      });
    }

    _handleNetworkMessage(msg) {
      if (msg.type === 'CONNECTED') {
        if (msg.role === 'host') {
          this.net.send({
            type: 'HELLO',
            size: this.lastMatchConfig.size,
            komi: this.lastMatchConfig.komi
          });
          this._showScreen('screen-voting');
          this.votingScreen.start({ ...this.lastMatchConfig, gameMode: 'online' }, 'black');
        }
        return;
      }

      if (msg.type === 'HELLO') {
        this.lastMatchConfig = { size: msg.size, gameMode: 'online', komi: msg.komi };
        this._showScreen('screen-voting');
        this.votingScreen.start({ ...this.lastMatchConfig }, 'white');
        return;
      }

      if (msg.type === 'VOTE') {
        this.votingScreen.receiveRemoteVote(msg.color, msg.choice);
        return;
      }

      if (msg.type === 'RANDOM_POOL') {
        this.votingScreen.applyRandomPool(msg.pool);
        return;
      }

      if (msg.type === 'DRAFT_READY') {
        this.votingScreen.receiveRemoteDraft(msg.color, msg.hand);
        return;
      }

      if (msg.type === 'MOVE') {
        this._submitMove(msg.move, false);
        return;
      }

      if (msg.type === 'SURRENDER') {
        const winner = this.state.opponentOf(msg.loser);
        this._finishBySurrender(winner);
        return;
      }

      if (msg.type === 'REMATCH') {
        document.getElementById('modal-scoring').classList.add('hidden');
        this._showScreen('screen-voting');
        this.votingScreen.start({ ...this.lastMatchConfig }, this.myOnlineColor);
        return;
      }

      if (msg.type === 'DISCONNECTED') {
        if (this.state && !this.state.isGameOver) {
          this.state.addLog('🔌 Соперник отключился от сети.');
          this._flashBanner('🔌 Соперник отключился от игры.');
        }
      }
    }

    _finishBySurrender(winner) {
      this.state.isGameOver = true;
      this.state.winner = winner;
      this.state.winReason = 'Сдача партии';
      const scoring = ns.ScoringEngine.calculateFinalScore(this.state);
      scoring.winner = winner;
      this._showScoringModal(scoring, true);
    }

    _populateRulesModal() {
      document.getElementById('rules-catalog-list').innerHTML = ns.CardCatalog.ALL.map((meta) => `
        <div class="ability-card" style="cursor:default;">
          <div class="card-top">
            <div class="card-title-wrap"><span class="card-icon">${meta.icon}</span><span class="card-name">${meta.name}</span></div>
            <span class="card-limit">Лимит: ${meta.limit}</span>
          </div>
          <span class="trigger-tag trigger-${meta.trigger}">${meta.triggerLabel}</span>
          <div class="card-desc">${meta.description}</div>
        </div>
      `).join('');
    }

    startMatch(config) {
      clearTimeout(this.aiTimer);
      this.isTutorial = false;
      this.tutorial.stop();
      this.state = new ns.GameState(config);
      this.perspectiveColor = config.gameMode === 'online' ? this.myOnlineColor : 'black';
      this.handController.resetToNormal();

      const formatNames = { open: 'Открытый выбор', closed: 'Закрытый выбор', random: 'Режим Рандом' };
      document.getElementById('game-mode-label').textContent =
        `${config.size}×${config.size} • ${formatNames[config.cardFormat] || 'Открытый'}`;

      const roleBadge = document.getElementById('online-role-badge');
      if (config.gameMode === 'online') {
        roleBadge.classList.remove('hidden');
        roleBadge.textContent = this.myOnlineColor === 'black' ? '🌐 Вы: Чёрные' : '🌐 Вы: Белые';
      } else {
        roleBadge.classList.add('hidden');
      }

      const undoBtn = document.getElementById('btn-undo');
      if (config.gameMode === 'sandbox') undoBtn.classList.remove('hidden');
      else undoBtn.classList.add('hidden');

      document.getElementById('modal-scoring').classList.add('hidden');
      document.getElementById('hotseat-curtain').classList.add('hidden');
      this._showScreen('screen-game');
      this.state.addLog('Партия началась! Первыми ходят Чёрные.');
      this._refreshUI();
    }

    _handleBoardClick(x, y) {
      if (!this.state || this.state.isGameOver) return;
      if (this.state.gameMode === 'ai' && this.state.currentTurn === 'white') return;
      if (this.state.gameMode === 'online' && this.state.currentTurn !== this.myOnlineColor) return;

      const targeting = this.handController.getTargetingState();

      if (this.isTutorial) {
        if (!this.tutorial.validateBoardClick(x, y, targeting)) return;
      }

      const color = this.state.currentTurn;
      const clickedStone = this.state.getStone(x, y);

      if (targeting.cardId === 'normal' && clickedStone && clickedStone.color === color && clickedStone.ability === 'detonator') {
        this.handController.selectDetonatorOnBoard(x, y);
        return;
      }

      if (targeting.mode === 'detonate_confirm') {
        if (targeting.selectedFrom && targeting.selectedFrom.x === x && targeting.selectedFrom.y === y) {
          this._submitMove({ type: 'action', cardId: 'detonator', x, y }, true);
        } else {
          this.handController.resetToNormal();
        }
        return;
      }

      if (targeting.mode === 'shadow_step_from') {
        if (clickedStone && clickedStone.color === color) this.handController.setShadowStepOrigin(x, y);
        else { this.sound.playError(); this._flashBanner('Выберите свой одиночный камень на доске.'); }
        return;
      }

      if (targeting.mode === 'shadow_step_to') {
        this._submitMove({ type: 'action', cardId: 'shadow_step', fromX: targeting.selectedFrom.x, fromY: targeting.selectedFrom.y, x, y }, true);
        return;
      }

      if (targeting.mode === 'ko_seal') {
        this._submitMove({ type: 'action', cardId: 'ko_seal', x, y }, true);
        return;
      }

      this._submitMove({ type: 'place', x, y, cardId: targeting.cardId }, true);
    }

    _submitMove(move, isLocalOrigin = true) {
      const prevTurn = this.state.currentTurn;
      const res = ns.TurnPipeline.executeMove(this.state, move);

      if (!res.ok) {
        if (isLocalOrigin) {
          this.sound.playError();
          this._flashBanner(`⚠️ ${res.reason}`);
        }
        return;
      }

      if (this.state.gameMode === 'online' && isLocalOrigin) {
        this.net.send({ type: 'MOVE', move });
      }

      if (move.cardId === 'detonator' && move.type === 'action') this.sound.playExplosion();
      else if (res.events.some((e) => e.includes('Ловушка') || e.includes('Мираж') || e.includes('Катализатор'))) this.sound.playTrapOrCapture();
      else if (move.type === 'place' || move.type === 'action') this.sound.playStone();

      this.handController.resetToNormal();

      if (this.isTutorial && isLocalOrigin) {
        this.tutorial.onMoveExecuted(move);
      }

      if (this.state.isGameOver) {
        this.sound.playWin();
        this._refreshUI(res.scoring);
        this._showScoringModal(res.scoring, false);
        return;
      }

      if (this.state.gameMode === 'hotseat' && this.state.currentTurn !== prevTurn &&
        (this.state.cardFormat === 'closed' || this.state.cardFormat === 'random')) {
        const nextName = this.state.currentTurn === 'black' ? 'Чёрных (Игрок 1)' : 'Белых (Игрок 2)';
        document.getElementById('curtain-title').textContent = `Ход переходит к ${nextName}`;
        document.getElementById('hotseat-curtain').classList.remove('hidden');
        return;
      }

      if (this.state.gameMode === 'sandbox' || this.state.gameMode === 'hotseat') {
        this.perspectiveColor = this.state.currentTurn;
      }

      this._refreshUI();

      if (this.state.gameMode === 'ai' && this.state.currentTurn === 'white' && !this.state.isGameOver) {
        this.aiTimer = setTimeout(() => {
          this._submitMove(ns.BotPlayer.chooseMove(this.state), true);
        }, 420);
      }
    }

    _flashBanner(text) {
      const banner = document.getElementById('targeting-hint');
      banner.textContent = text;
      banner.classList.remove('hidden');
      clearTimeout(this._bannerTimeout);
      this._bannerTimeout = setTimeout(() => this.handController._updateTargetingBanner(), 2400);
    }

    _refreshUI(scoringResult = null) {
      if (!this.state) return;
      const isBlack = this.state.currentTurn === 'black';
      document.getElementById('turn-indicator').className = `turn-pill ${isBlack ? 'black-turn' : 'white-turn'}`;

      let turnLabel = isBlack ? 'Ход Чёрных' : 'Ход Белых';
      if (this.isTutorial) {
        turnLabel = isBlack ? 'Ваш ход (Чёрные)' : 'Ход Игниса (Белые)';
      } else if (this.state.gameMode === 'online') {
        turnLabel += this.state.currentTurn === this.myOnlineColor ? ' (Ваш ход)' : ' (Ход соперника)';
      }
      document.getElementById('turn-text').textContent = turnLabel;

      const extraBadge = document.getElementById('extra-turn-badge');
      if (this.state.extraTurns[this.state.currentTurn] > 0) extraBadge.classList.remove('hidden');
      else extraBadge.classList.add('hidden');

      document.getElementById('panel-black').classList.toggle('active-turn', isBlack);
      document.getElementById('panel-white').classList.toggle('active-turn', !isBlack);
      document.getElementById('black-captures').textContent = String(this.state.captures.black);
      document.getElementById('white-captures').textContent = String(this.state.captures.white);

      const logBox = document.getElementById('move-log');
      logBox.innerHTML = this.state.logs.slice(-25).map((line) => `<div class="log-entry">${line}</div>`).join('');
      logBox.scrollTop = logBox.scrollHeight;

      const myColor = this.state.gameMode === 'online' ? this.myOnlineColor : null;
      const tutCard = this.isTutorial ? this.tutorial.getHighlightedCardId() : null;
      const tutBoard = this.isTutorial ? this.tutorial.getBoardHighlight() : null;

      this.handController.renderHands(this.state, this.perspectiveColor, myColor, tutCard);
      this.renderer.render(this.state, this.perspectiveColor, this.handController.getTargetingState(), scoringResult, tutBoard);
    }

    _showScoringModal(scoring, bySurrender) {
      const winName = scoring.winner === 'black' ? 'Победа Чёрных!' : 'Победа Белых!';
      document.getElementById('scoring-winner').textContent = bySurrender ? `${winName} (Соперник сдался)` : winName;
      document.getElementById('scoring-breakdown').innerHTML = `
        <table class="scoring-table">
          <thead><tr><th>Категория</th><th>⚫ Чёрные</th><th>⚪ Белые</th></tr></thead>
          <tbody>
            <tr><td>Живые камни на доске</td><td>${scoring.black.stones}</td><td>${scoring.white.stones}</td></tr>
            <tr><td>Территория (пустые пункты)</td><td>${scoring.black.territory}</td><td>${scoring.white.territory}</td></tr>
            <tr><td>Бонус Алтарей (+2 за клетку)</td><td>+${scoring.black.altarBonus}</td><td>+${scoring.white.altarBonus}</td></tr>
            <tr><td>Коми (компенсация)</td><td>0</td><td>+${scoring.white.komi}</td></tr>
            <tr style="font-weight:800;color:var(--accent);font-size:1.05rem;">
              <td>ИТОГО ОЧКОВ</td><td>${scoring.black.total}</td><td>${scoring.white.total}</td>
            </tr>
          </tbody>
        </table>
      `;
      document.getElementById('modal-scoring').classList.remove('hidden');
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    ns.app = new SpiritGoApp();
  });
})(window.SpiritGo);