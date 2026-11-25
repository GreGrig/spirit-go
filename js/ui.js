window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  class HandController {
    constructor(onSelectionChange) {
      this.onSelectionChange = onSelectionChange;
      this.selectedCardId = 'normal';
      this.targetingMode = 'place';
      this.selectedFrom = null;
    }

    resetToNormal() {
      this.selectedCardId = 'normal';
      this.targetingMode = 'place';
      this.selectedFrom = null;
      if (this.onSelectionChange) this.onSelectionChange(this.getTargetingState());
    }

    selectCard(cardId) {
      if (cardId === 'normal') { this.resetToNormal(); return; }
      if (!ns.CardCatalog.getById(cardId)) return;
      this.selectedCardId = cardId;
      this.selectedFrom = null;
      this.targetingMode = cardId === 'shadow_step' ? 'shadow_step_from' : cardId === 'ko_seal' ? 'ko_seal' : 'place';
      if (this.onSelectionChange) this.onSelectionChange(this.getTargetingState());
    }

    setShadowStepOrigin(x, y) {
      this.selectedFrom = { x, y };
      this.targetingMode = 'shadow_step_to';
      if (this.onSelectionChange) this.onSelectionChange(this.getTargetingState());
    }

    selectDetonatorOnBoard(x, y) {
      this.selectedCardId = 'detonator';
      this.selectedFrom = { x, y };
      this.targetingMode = 'detonate_confirm';
      if (this.onSelectionChange) this.onSelectionChange(this.getTargetingState());
    }

    getTargetingState() {
      return { cardId: this.selectedCardId, mode: this.targetingMode, selectedFrom: this.selectedFrom };
    }

    renderHands(state, perspectiveColor, myOnlineColor = null, highlightedCardId = null) {
      this._renderSingleHand(state, 'black', perspectiveColor, myOnlineColor, highlightedCardId);
      this._renderSingleHand(state, 'white', perspectiveColor, myOnlineColor, null);
      this._updateTargetingBanner();
    }

    _renderSingleHand(state, ownerColor, perspectiveColor, myOnlineColor, highlightedCardId) {
      const container = document.getElementById(`hand-${ownerColor}`);
      if (!container) return;
      container.innerHTML = '';

      const canInteract = state.currentTurn === ownerColor && !state.isGameOver &&
        (state.gameMode !== 'online' || myOnlineColor === ownerColor);

      const isSandbox = state.gameMode === 'sandbox';
      const cardIds = isSandbox ? ns.CardCatalog.ALL.map((c) => c.id) : state.hands[ownerColor];
      const hideOpponent = !isSandbox && !state.isGameOver && ownerColor !== perspectiveColor &&
        (state.cardFormat === 'closed' || state.cardFormat === 'random');

      if (cardIds.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'muted-text';
        empty.textContent = 'Карты закончились';
        container.appendChild(empty);
        return;
      }

      cardIds.forEach((id) => {
        if (hideOpponent) {
          const back = document.createElement('div');
          back.className = 'ability-card card-back';
          back.innerHTML = `<span class="card-back-label">🎴 Скрытая карта</span>`;
          container.appendChild(back);
          return;
        }
        const meta = ns.CardCatalog.getById(id);
        if (!meta) return;

        const el = document.createElement('div');
        const isSelected = canInteract && this.selectedCardId === id && this.targetingMode !== 'detonate_confirm';
        const isTutGlow = canInteract && highlightedCardId === id && !isSelected;
        el.className = `ability-card ${isSelected ? 'selected' : ''} ${isTutGlow ? 'tutorial-highlight' : ''} ${!canInteract ? 'disabled' : ''}`;
        el.innerHTML = `
          <div class="card-top">
            <div class="card-title-wrap"><span class="card-icon">${meta.icon}</span><span class="card-name">${meta.name}</span></div>
            <span class="trigger-tag trigger-${meta.trigger}">${meta.triggerLabel}</span>
          </div>
          <div class="card-desc">${meta.description}</div>
        `;
        if (canInteract) {
          el.addEventListener('click', () => {
            if (this.selectedCardId === id) this.resetToNormal();
            else this.selectCard(id);
          });
        }
        container.appendChild(el);
      });
    }

    _updateTargetingBanner() {
      const banner = document.getElementById('targeting-hint');
      const btnNormal = document.getElementById('btn-normal-stone');
      const btnCancel = document.getElementById('btn-cancel-card');
      if (!banner) return;

      if (this.selectedCardId === 'normal') {
        banner.classList.add('hidden');
        if (btnNormal) btnNormal.classList.add('active');
        if (btnCancel) btnCancel.classList.add('hidden');
        return;
      }

      if (btnNormal) btnNormal.classList.remove('active');
      if (btnCancel) btnCancel.classList.remove('hidden');
      banner.classList.remove('hidden');

      const meta = ns.CardCatalog.getById(this.selectedCardId);
      if (this.targetingMode === 'shadow_step_from') {
        banner.textContent = '👣 Теневой шаг (1/2): нажмите на свой одиночный камень на доске.';
      } else if (this.targetingMode === 'shadow_step_to') {
        banner.textContent = '👣 Теневой шаг (2/2): выберите свободную соседнюю клетку по прямой.';
      } else if (this.targetingMode === 'ko_seal') {
        banner.textContent = '🚫 Печать Ко: выберите любую свободную клетку для блокировки на 2 хода.';
      } else if (this.targetingMode === 'detonate_confirm') {
        banner.textContent = '💣 Подрыв Детонатора: нажмите на него ещё раз для взрыва (уничтожит 4 соседние клетки)!';
      } else if (meta) {
        banner.textContent = `${meta.icon} Выбрана карта «${meta.name}» — нажмите на свободную клетку доски.`;
      }
    }
  }

  class VotingScreen {
    constructor(onMatchReady, netManager) {
      this.onMatchReady = onMatchReady;
      this.net = netManager;
      this.timerInterval = null;
      this.timeLeft = 10;
      this.config = { size: 9, gameMode: 'ai', komi: 6.5 };
      this.myOnlineColor = 'black';
      this.votes = { black: null, white: null };
      this.activeVoter = 'black';
      this.resolvedFormat = 'open';
      this.draftPhase = 'black';
      this.draftHands = { black: [], white: [] };
      this.draftSubmitted = { black: false, white: false };

      document.getElementById('vote-open-btn').addEventListener('click', () => this._castVote('open'));
      document.getElementById('vote-closed-btn').addEventListener('click', () => this._castVote('closed'));
      document.getElementById('btn-random-fill').addEventListener('click', () => this._autoFillCurrentDraft());
      document.getElementById('btn-confirm-draft').addEventListener('click', () => this._confirmCurrentDraft());
    }

    start(config, myOnlineColor = 'black') {
      this.config = config;
      this.myOnlineColor = myOnlineColor;
      this.votes = { black: null, white: null };
      this.activeVoter = 'black';
      this.draftHands = { black: [], white: [] };
      this.draftSubmitted = { black: false, white: false };

      if (config.gameMode === 'sandbox') {
        this.onMatchReady({ ...config, cardFormat: 'open', blackHand: [], whiteHand: [] });
        return;
      }

      const openBtn = document.getElementById('vote-open-btn');
      const closedBtn = document.getElementById('vote-closed-btn');
      openBtn.classList.remove('selected');
      closedBtn.classList.remove('selected');
      openBtn.disabled = false;
      closedBtn.disabled = false;
      document.getElementById('voting-result-banner').classList.add('hidden');
      document.getElementById('voting-status-text').textContent = config.gameMode === 'hotseat'
        ? 'Голосует Игрок 1 (Чёрные). Соперник не смотрит!'
        : 'Сделайте ваш выбор (у вас 10 секунд)...';
      this._startTimer();
    }

    _startTimer() {
      clearInterval(this.timerInterval);
      this.timeLeft = 10;
      const timerEl = document.getElementById('voting-timer');
      timerEl.textContent = '10';
      this.timerInterval = setInterval(() => {
        this.timeLeft -= 1;
        timerEl.textContent = String(Math.max(0, this.timeLeft));
        if (this.timeLeft <= 0) {
          clearInterval(this.timerInterval);
          if (!this.votes.black) this.votes.black = 'timeout_a';
          if (!this.votes.white) this.votes.white = 'timeout_b';
          this._resolveVotes();
        }
      }, 1000);
    }

    _castVote(choice) {
      if (this.config.gameMode === 'online') {
        if (this.votes[this.myOnlineColor]) return;
        this.votes[this.myOnlineColor] = choice;
        document.getElementById(`vote-${choice}-btn`).classList.add('selected');
        document.getElementById('vote-open-btn').disabled = true;
        document.getElementById('vote-closed-btn').disabled = true;
        document.getElementById('voting-status-text').textContent = 'Ваш голос принят! Ожидаем выбор соперника...';
        this.net.send({ type: 'VOTE', color: this.myOnlineColor, choice });
        if (this.votes.black && this.votes.white) {
          clearInterval(this.timerInterval);
          this._resolveVotes();
        }
        return;
      }

      if (this.config.gameMode === 'ai') {
        this.votes.black = choice;
        document.getElementById(`vote-${choice}-btn`).classList.add('selected');
        document.getElementById('voting-status-text').textContent = 'Ожидание выбора ИИ...';
        clearInterval(this.timerInterval);
        setTimeout(() => {
          this.votes.white = Math.random() < 0.5 ? 'open' : 'closed';
          this._resolveVotes();
        }, 500);
        return;
      }

      if (this.activeVoter === 'black') {
        this.votes.black = choice;
        this.activeVoter = 'white';
        document.getElementById('voting-status-text').textContent = 'Голос Чёрных принят! Теперь голосует Игрок 2 (Белые)...';
        this._startTimer();
      } else {
        this.votes.white = choice;
        clearInterval(this.timerInterval);
        this._resolveVotes();
      }
    }

    receiveRemoteVote(color, choice) {
      this.votes[color] = choice;
      if (this.votes.black && this.votes.white) {
        clearInterval(this.timerInterval);
        this._resolveVotes();
      }
    }

    _resolveVotes() {
      document.getElementById('vote-open-btn').disabled = true;
      document.getElementById('vote-closed-btn').disabled = true;
      const banner = document.getElementById('voting-result-banner');
      banner.classList.remove('hidden');

      if (this.votes.black === this.votes.white && (this.votes.black === 'open' || this.votes.black === 'closed')) {
        this.resolvedFormat = this.votes.black;
        const label = this.resolvedFormat === 'open' ? '👁️ Открытый выбор' : '🎭 Закрытый выбор';
        banner.innerHTML = `Мнения совпали! Включён режим: <strong>${label}</strong>`;
        const nextDraftColor = this.config.gameMode === 'online' ? this.myOnlineColor : 'black';
        setTimeout(() => this._startDraftPhase(nextDraftColor), 1100);
      } else {
        this.resolvedFormat = 'random';
        if (this.config.gameMode === 'online' && this.myOnlineColor === 'white') {
          banner.innerHTML = `🎲 Мнения разошлись — активирован <strong>Режим Рандом</strong>! Получаем общий набор карт...`;
          return;
        }
        const sharedPool = ns.CardCatalog.generateRandomPool(5);
        if (this.config.gameMode === 'online' && this.myOnlineColor === 'black') {
          this.net.send({ type: 'RANDOM_POOL', pool: sharedPool });
        }
        this.applyRandomPool(sharedPool);
      }
    }

    applyRandomPool(sharedPool) {
      this.resolvedFormat = 'random';
      this.draftHands.black = [...sharedPool];
      this.draftHands.white = [...sharedPool];

      const banner = document.getElementById('voting-result-banner');
      banner.classList.remove('hidden');
      const names = sharedPool.map((id) => {
        const c = ns.CardCatalog.getById(id);
        return c ? `${c.icon} ${c.name}` : id;
      }).join(' • ');

      if (this.config.gameMode === 'online') {
        banner.innerHTML = `
          <div>🎲 Мнения разошлись — активирован <strong>Режим Рандом</strong>!</div>
          <div style="margin-top:8px;font-size:0.88rem;color:#eef2f8;">
            Оба игрока получают одинаковый набор карт:<br/><strong>${names}</strong>
          </div>
          <div style="margin-top:10px;color:var(--accent);">Матч начнётся через 2 секунды...</div>
        `;
        setTimeout(() => {
          this.onMatchReady({
            ...this.config,
            cardFormat: 'random',
            blackHand: [...this.draftHands.black],
            whiteHand: [...this.draftHands.white]
          });
        }, 2200);
      } else {
        banner.innerHTML = `
          <div>🎲 Мнения разошлись — активирован <strong>Режим Рандом</strong>!</div>
          <div style="margin-top:8px;font-size:0.88rem;color:#eef2f8;">
            Оба игрока получают одинаковый набор карт:<br/><strong>${names}</strong>
          </div>
          <button id="btn-random-go" class="primary-btn" style="margin-top:12px;">Начать партию</button>
        `;
        document.getElementById('btn-random-go').addEventListener('click', () => {
          this.onMatchReady({
            ...this.config,
            cardFormat: 'random',
            blackHand: [...this.draftHands.black],
            whiteHand: [...this.draftHands.white]
          });
        });
      }
    }

    _startDraftPhase(playerColor) {
      this.draftPhase = playerColor;
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
      document.getElementById('screen-draft').classList.add('active');
      document.getElementById('draft-mode-badge').textContent =
        this.resolvedFormat === 'open' ? '👁️ Открытый режим' : '🎭 Закрытый режим';

      const oppBar = document.getElementById('draft-opponent-preview');
      const oppList = document.getElementById('draft-opponent-list');
      if (playerColor === 'white' && this.resolvedFormat === 'open' && this.config.gameMode === 'hotseat') {
        oppBar.classList.remove('hidden');
        oppList.innerHTML = this.draftHands.black.map((id) => {
          const c = ns.CardCatalog.getById(id);
          return `<span class="slot-pill">${c.icon} ${c.name}</span>`;
        }).join('');
      } else {
        oppBar.classList.add('hidden');
      }
      this._renderDraftUI();
    }

    _renderDraftUI() {
      const hand = this.draftHands[this.draftPhase];
      const colorName = this.draftPhase === 'black' ? 'Чёрные' : 'Белые';
      const isLocked = this.config.gameMode === 'online' && this.draftSubmitted[this.draftPhase];

      document.getElementById('draft-header-title').textContent = isLocked
        ? `Рука подтверждена! Ожидаем соперника...`
        : `Сборка руки: ${colorName} (${hand.length} / 5)`;

      const confirmBtn = document.getElementById('btn-confirm-draft');
      confirmBtn.disabled = hand.length !== 5 || isLocked;

      const slotsWrap = document.getElementById('draft-selected-list');
      slotsWrap.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const cardId = hand[i];
        const pill = document.createElement('div');
        if (cardId) {
          const meta = ns.CardCatalog.getById(cardId);
          pill.className = 'slot-pill';
          pill.innerHTML = `${meta.icon} ${meta.name} ${isLocked ? '' : '<strong>✕</strong>'}`;
          if (!isLocked) {
            pill.addEventListener('click', () => { hand.splice(i, 1); this._renderDraftUI(); });
          }
        } else {
          pill.className = 'slot-pill empty';
          pill.textContent = `Слот ${i + 1}`;
        }
        slotsWrap.appendChild(pill);
      }

      const poolWrap = document.getElementById('draft-pool');
      poolWrap.innerHTML = '';
      ns.CardCatalog.ALL.forEach((meta) => {
        const countInHand = hand.filter((id) => id === meta.id).length;
        const maxedOut = countInHand >= meta.limit || hand.length >= 5 || isLocked;
        const cardEl = document.createElement('div');
        cardEl.className = `ability-card ${countInHand > 0 ? 'selected' : ''} ${maxedOut ? 'disabled' : ''}`;
        cardEl.innerHTML = `
          <div class="card-top">
            <div class="card-title-wrap"><span class="card-icon">${meta.icon}</span><span class="card-name">${meta.name}</span></div>
            <span class="card-limit">В руке: ${countInHand}/${meta.limit}</span>
          </div>
          <span class="trigger-tag trigger-${meta.trigger}">${meta.triggerLabel}</span>
          <div class="card-desc">${meta.description}</div>
        `;
        if (!maxedOut) {
          cardEl.addEventListener('click', () => { hand.push(meta.id); this._renderDraftUI(); });
        }
        poolWrap.appendChild(cardEl);
      });
    }

    _autoFillCurrentDraft() {
      if (this.config.gameMode === 'online' && this.draftSubmitted[this.draftPhase]) return;
      const hand = this.draftHands[this.draftPhase];
      while (hand.length < 5) {
        const candidate = ns.CardCatalog.ALL[Math.floor(Math.random() * ns.CardCatalog.ALL.length)];
        if (hand.filter((id) => id === candidate.id).length < candidate.limit) hand.push(candidate.id);
      }
      this._renderDraftUI();
    }

    _confirmCurrentDraft() {
      if (this.draftHands[this.draftPhase].length !== 5) return;

      if (this.config.gameMode === 'online') {
        this.draftSubmitted[this.draftPhase] = true;
        this._renderDraftUI();
        this.net.send({
          type: 'DRAFT_READY',
          color: this.draftPhase,
          hand: [...this.draftHands[this.draftPhase]]
        });
        if (this.draftSubmitted.black && this.draftSubmitted.white) {
          this.onMatchReady({
            ...this.config,
            cardFormat: this.resolvedFormat,
            blackHand: [...this.draftHands.black],
            whiteHand: [...this.draftHands.white]
          });
        }
        return;
      }

      if (this.config.gameMode === 'ai') {
        this.draftHands.white = ns.CardCatalog.generateRandomPool(5);
        this.onMatchReady({
          ...this.config,
          cardFormat: this.resolvedFormat,
          blackHand: [...this.draftHands.black],
          whiteHand: [...this.draftHands.white]
        });
        return;
      }

      if (this.draftPhase === 'black') this._startDraftPhase('white');
      else {
        this.onMatchReady({
          ...this.config,
          cardFormat: this.resolvedFormat,
          blackHand: [...this.draftHands.black],
          whiteHand: [...this.draftHands.white]
        });
      }
    }

    receiveRemoteDraft(color, hand) {
      this.draftHands[color] = [...hand];
      this.draftSubmitted[color] = true;
      if (this.draftSubmitted.black && this.draftSubmitted.white) {
        this.onMatchReady({
          ...this.config,
          cardFormat: this.resolvedFormat,
          blackHand: [...this.draftHands.black],
          whiteHand: [...this.draftHands.white]
        });
      }
    }
  }

  ns.HandController = HandController;
  ns.VotingScreen = VotingScreen;
})(window.SpiritGo);