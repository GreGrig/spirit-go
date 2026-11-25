(function () {
  window.SpiritGo = window.SpiritGo || {};

  const STORAGE_PROFILE = 'spirit_go_player_profile_v1';
  const STORAGE_PEERS   = 'spirit_go_known_peers_v1';
  const STORAGE_FB_URL  = 'spirit_go_firebase_url_v1';

  const LADDER_BOTS = [
    { id: 'bot_25k', name: 'Ученик Додзё',      levelHint: 'Новичок',       gor: -400, wins: 12, losses: 18, type: 'Бот' },
    { id: 'bot_20k', name: 'Страж Врат',        levelHint: 'Базовый',       gor:  100, wins: 24, losses: 22, type: 'Бот' },
    { id: 'bot_15k', name: 'Следопыт Руин',     levelHint: 'Любитель',      gor:  600, wins: 41, losses: 35, type: 'Бот' },
    { id: 'bot_10k', name: 'Рыцарь Замка',      levelHint: 'Уверенный',     gor: 1100, wins: 68, losses: 54, type: 'Бот' },
    { id: 'bot_5k',  name: 'Мастер Рун',        levelHint: 'Продвинутый',   gor: 1600, wins: 95, losses: 71, type: 'Бот' },
    { id: 'bot_1k',  name: 'Хранитель Пламени', levelHint: 'Эксперт',       gor: 2000, wins: 132, losses: 89, type: 'Бот' },
    { id: 'bot_1d',  name: 'Алый Дракон',       levelHint: 'Мастер 1 дана', gor: 2100, wins: 178, losses: 102, type: 'Бот' },
    { id: 'bot_3d',  name: 'Древний Игнис',     levelHint: 'Грандмастер',   gor: 2300, wins: 245, losses: 110, type: 'Бот' }
  ];

  const BOT_IDS = new Set(LADDER_BOTS.map(b => b.id));

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function generateId() {
    return 'plr_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  class RatingManager {
    constructor() {
      this.profile = this._loadProfile();
      this.knownPeers = this._loadPeers();
      this.firebaseUrl = (localStorage.getItem(STORAGE_FB_URL) || '').trim().replace(/\/+$/, '');
      this.cloudPlayers = {};
      this.eventSource = null;
      this.isLiveConnected = false;
      this.selectedBotId = 'bot_20k';
      this.currentOpponent = null;
      this.lastUpdatedIds = new Set();
      this.lastP2pSyncNotice = '';

      this._mountUI();
      if (this.firebaseUrl) {
        this.connectFirebase(this.firebaseUrl, true);
      }
    }

    _loadProfile() {
      try {
        const raw = localStorage.getItem(STORAGE_PROFILE);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.gor === 'number') {
            if (!parsed.updatedAt) parsed.updatedAt = Date.now();
            return parsed;
          }
        }
      } catch (e) {}
      const fresh = {
        id: generateId(),
        nickname: 'Игрок_' + Math.floor(100 + Math.random() * 900),
        gor: 100,
        wins: 0,
        losses: 0,
        updatedAt: Date.now()
      };
      this._saveProfile(fresh);
      return fresh;
    }

    _saveProfile(prof) {
      if (prof) this.profile = prof;
      this.profile.updatedAt = Date.now();
      try {
        localStorage.setItem(STORAGE_PROFILE, JSON.stringify(this.profile));
      } catch (e) {}
    }

    _loadPeers() {
      try {
        const raw = localStorage.getItem(STORAGE_PEERS);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    _savePeers() {
      try {
        localStorage.setItem(STORAGE_PEERS, JSON.stringify(this.knownPeers));
      } catch (e) {}
    }

    gorToRank(gor) {
      const clamped = clamp(Math.round(gor), -900, 2900);
      if (clamped < 2050) {
        const kyu = clamp(Math.round((2100 - clamped) / 100), 1, 30);
        return {
          code: kyu + ' кю',
          label: kyu + ' кю',
          tier: kyu >= 20 ? 'novice' : (kyu >= 10 ? 'sdk' : 'high')
        };
      } else {
        const dan = clamp(Math.round((clamped - 2000) / 100), 1, 9);
        return {
          code: dan + ' дан',
          label: dan + ' дан',
          tier: 'dan'
        };
      }
    }

    calculateEgfDelta(myGor, oppGor, score) {
      const norm = clamp((myGor + 900) / 3800, 0, 1);
      const a = 200 - norm * 130;
      const K = 96 - norm * 80;
      const epsilon = 2;

      const expected = 1 / (Math.exp((oppGor - myGor) / a) + 1);
      let delta = Math.round(K * (score - expected) + epsilon);

      if (score === 1 && delta < 1) delta = 1;
      if (score === 0 && delta > -1) delta = -1;

      return {
        delta,
        expectedPct: Math.round(expected * 100)
      };
    }

    recordMatch({ mode, opponentName, opponentGor, score }) {
      const oldGor = this.profile.gor;
      const oldRank = this.gorToRank(oldGor);

      const calc = this.calculateEgfDelta(oldGor, opponentGor, score);
      const newGor = clamp(oldGor + calc.delta, -900, 2900);
      const newRank = this.gorToRank(newGor);

      this.profile.gor = newGor;
      if (score === 1) this.profile.wins += 1;
      else if (score === 0) this.profile.losses += 1;
      this._saveProfile();

      this.lastUpdatedIds.add(this.profile.id);
      this._refreshLobbyAndTopbar();
      this.renderLeaderboard();

      if (this.firebaseUrl) {
        this._pushProfileToFirebase();
      }

      return {
        opponentName,
        opponentGor,
        opponentRank: this.gorToRank(opponentGor),
        oldGor,
        newGor,
        delta: calc.delta,
        expectedPct: calc.expectedPct,
        oldRank,
        newRank,
        rankChanged: oldRank.code !== newRank.code,
        promoted: newGor > oldGor && oldRank.code !== newRank.code
      };
    }

    // === P2P GOSSIP-СИНХРОНИЗАЦИЯ ТАБЛИЦЫ ЛИДЕРОВ ===
    buildSyncPacket(ack = false) {
      const peersList = Object.values(this.knownPeers)
        .filter(p => p && p.id && !BOT_IDS.has(p.id) && p.id !== this.profile.id)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 120);

      return {
        type: 'RATING_SYNC',
        ack,
        sender: {
          id: this.profile.id,
          name: this.profile.nickname,
          gor: this.profile.gor,
          wins: this.profile.wins,
          losses: this.profile.losses,
          updatedAt: this.profile.updatedAt || Date.now()
        },
        peers: peersList
      };
    }

    mergeSyncPacket(msg) {
      if (!msg) return 0;
      const senderRaw = msg.sender || (msg.id ? msg : null);
      if (!senderRaw || !senderRaw.id) return 0;

      let updatedCount = 0;

      const upsertPeer = (raw, isDirectSender) => {
        if (!raw || !raw.id || raw.id === this.profile.id || BOT_IDS.has(raw.id)) return;

        const incomingTs = Number(raw.updatedAt) || 0;
        const existing = this.knownPeers[raw.id];
        const existingTs = existing ? (Number(existing.updatedAt) || 0) : -1;

        const cleanEntry = {
          id: String(raw.id).slice(0, 40),
          name: String(raw.name || raw.nickname || 'Игрок').slice(0, 22),
          gor: clamp(Math.round(Number(raw.gor) || 100), -900, 2900),
          wins: Math.max(0, Math.round(Number(raw.wins) || 0)),
          losses: Math.max(0, Math.round(Number(raw.losses) || 0)),
          type: isDirectSender ? 'Соперник' : 'Сеть P2P',
          updatedAt: incomingTs || Date.now()
        };

        if (isDirectSender) {
          this.currentOpponent = cleanEntry;
        }

        const isFresher = !existing || incomingTs > existingTs;
        const directChanged = isDirectSender && existing &&
          (existing.gor !== cleanEntry.gor || existing.name !== cleanEntry.name || existing.wins !== cleanEntry.wins || existing.losses !== cleanEntry.losses);

        if (isFresher || directChanged) {
          this.knownPeers[raw.id] = cleanEntry;
          this.lastUpdatedIds.add(raw.id);
          updatedCount++;
        }
      };

      upsertPeer(senderRaw, true);

      if (Array.isArray(msg.peers)) {
        for (const p of msg.peers) {
          upsertPeer(p, false);
        }
      }

      if (updatedCount > 0) {
        this._savePeers();
        this.lastP2pSyncNotice = `P2P-синхронизация: обновлено записей (${updatedCount})`;
      }

      this._refreshLobbyAndTopbar();
      this.renderLeaderboard();
      return updatedCount;
    }

    getSelectedBot() {
      return LADDER_BOTS.find(b => b.id === this.selectedBotId) || LADDER_BOTS[1];
    }

    connectFirebase(url, silent) {
      const clean = (url || '').trim().replace(/\/+$/, '');
      if (!clean || !/^https:\/\/.+\.(firebaseio\.com|firebasedatabase\.app)$/i.test(clean)) {
        if (!silent) {
          alert('Укажите корректную ссылку на базу Firebase (например: https://my-game-default-rtdb.firebaseio.com)');
        }
        return;
      }

      this.disconnectFirebase();
      this.firebaseUrl = clean;
      localStorage.setItem(STORAGE_FB_URL, clean);
      this._pushProfileToFirebase();

      try {
        const es = new EventSource(`${this.firebaseUrl}/players.json`);
        this.eventSource = es;

        const handleSnapshot = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (!payload || payload.data === null) return;
            if (payload.path === '/' && typeof payload.data === 'object') {
              this.cloudPlayers = payload.data;
            } else if (payload.path && payload.path.startsWith('/')) {
              const key = payload.path.slice(1).split('/')[0];
              if (payload.data === null) delete this.cloudPlayers[key];
              else {
                this.cloudPlayers[key] = Object.assign({}, this.cloudPlayers[key], payload.data);
                this.lastUpdatedIds.add(key);
              }
            }
            this.isLiveConnected = true;
            this._refreshLobbyAndTopbar();
            this.renderLeaderboard();
          } catch (err) {}
        };

        es.onopen = () => {
          this.isLiveConnected = true;
          this._refreshLobbyAndTopbar();
          this.renderLeaderboard();
        };

        es.addEventListener('put', handleSnapshot);
        es.addEventListener('patch', handleSnapshot);

        es.onerror = () => {
          this.isLiveConnected = false;
          this._refreshLobbyAndTopbar();
          this.renderLeaderboard();
        };
      } catch (err) {}
    }

    disconnectFirebase() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.isLiveConnected = false;
      this.firebaseUrl = '';
      localStorage.removeItem(STORAGE_FB_URL);
      this._refreshLobbyAndTopbar();
      this.renderLeaderboard();
    }

    _pushProfileToFirebase() {
      if (!this.firebaseUrl) return;
      fetch(`${this.firebaseUrl}/players/${encodeURIComponent(this.profile.id)}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.profile.id,
          name: this.profile.nickname,
          gor: this.profile.gor,
          wins: this.profile.wins,
          losses: this.profile.losses,
          type: 'Онлайн',
          updatedAt: Date.now()
        })
      }).catch(() => {});
    }

    getAllLeaderboardEntries() {
      const map = new Map();
      for (const bot of LADDER_BOTS) map.set(bot.id, { ...bot });
      for (const id of Object.keys(this.knownPeers)) {
        if (!BOT_IDS.has(id)) map.set(id, { ...this.knownPeers[id] });
      }
      for (const id of Object.keys(this.cloudPlayers)) {
        const p = this.cloudPlayers[id];
        if (p && typeof p.gor === 'number' && !BOT_IDS.has(id)) {
          map.set(id, {
            id,
            name: p.name || 'Игрок',
            gor: p.gor,
            wins: p.wins || 0,
            losses: p.losses || 0,
            type: 'Онлайн'
          });
        }
      }
      map.set(this.profile.id, {
        id: this.profile.id,
        name: this.profile.nickname,
        gor: this.profile.gor,
        wins: this.profile.wins,
        losses: this.profile.losses,
        type: 'Вы',
        isMe: true
      });
      return Array.from(map.values()).sort((a, b) => b.gor - a.gor);
    }

    _mountUI() {
      const lobbyCard = document.querySelector('#screen-lobby .lobby-card');
      if (!lobbyCard) return;

      const oldBar = document.getElementById('sg-profile-bar');
      if (oldBar) oldBar.remove();

      const logoBlock = lobbyCard.querySelector('.logo-block');
      if (logoBlock && !document.getElementById('sg-profile-card')) {
        const card = document.createElement('div');
        card.id = 'sg-profile-card';
        card.className = 'sg-profile-card';
        card.innerHTML = `
          <div class="sg-profile-top">
            <div class="sg-identity">
              <span id="sg-lobby-rank" class="sg-rank-badge sg-rank-novice">20 кю</span>
              <div class="sg-nick-wrap">
                <input id="sg-nick-input" class="sg-nick-input" type="text" maxlength="20" placeholder="Ваш никнейм" title="Нажмите, чтобы изменить никнейм" />
                <span class="sg-nick-edit-icon">✎</span>
              </div>
            </div>
            <button id="sg-btn-open-lb" type="button" class="sg-btn-leaderboard">
              <span>🏆 Таблица лидеров</span>
            </button>
          </div>
          <div class="sg-profile-stats">
            <div id="sg-lobby-meta">Рейтинг: <strong>100</strong> • Побед: <strong>0</strong> / Поражений: <strong>0</strong></div>
            <div class="sg-live-pill">
              <span id="sg-lobby-live-dot" class="sg-live-dot local"></span>
              <span id="sg-lobby-sync-label">P2P-обмен активен</span>
            </div>
          </div>
        `;
        logoBlock.insertAdjacentElement('afterend', card);

        const nickInput = document.getElementById('sg-nick-input');
        nickInput.value = this.profile.nickname;
        nickInput.addEventListener('change', () => {
          const val = nickInput.value.trim();
          if (val) {
            this.profile.nickname = val;
            this._saveProfile();
            this._refreshLobbyAndTopbar();
            this.renderLeaderboard();
            if (this.firebaseUrl) this._pushProfileToFirebase();
            const app = window.SpiritGo && window.SpiritGo.app;
            if (app && app.net && typeof app.net.isConnected === 'function' && app.net.isConnected()) {
              try { app.net.send(this.buildSyncPacket(false)); } catch (e) {}
            }
          }
        });

        document.getElementById('sg-btn-open-lb').addEventListener('click', () => this.openLeaderboard());
      }

      const onlineBox = document.getElementById('online-setup-box');
      if (onlineBox && !document.getElementById('sg-ai-setup-box')) {
        const aiBox = document.createElement('div');
        aiBox.id = 'sg-ai-setup-box';
        aiBox.className = 'sg-ai-box';
        aiBox.innerHTML = `
          <div class="sg-ai-header">
            <span>Соперник для рейтинговой игры (ИИ)</span>
            <span id="sg-ai-opp-rank">20 кю • 100 очков</span>
          </div>
          <select id="sg-ai-rank-select" class="sg-ai-select">
            ${LADDER_BOTS.map(b => {
              const r = this.gorToRank(b.gor);
              return `<option value="${b.id}" ${b.id === this.selectedBotId ? 'selected' : ''}>${b.name} — ${r.label} (${b.levelHint})</option>`;
            }).join('')}
          </select>
          <div id="sg-ai-stakes" class="sg-ai-stakes"></div>
        `;
        onlineBox.insertAdjacentElement('beforebegin', aiBox);

        const botSelect = document.getElementById('sg-ai-rank-select');
        botSelect.addEventListener('change', () => {
          this.selectedBotId = botSelect.value;
          this._refreshLobbyAndTopbar();
        });

        document.querySelectorAll('#group-game-mode .mode-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            aiBox.classList.toggle('hidden', btn.dataset.mode !== 'ai');
          });
        });
      }

      const topbarRight = document.querySelector('#screen-game .topbar-right');
      const topbar = document.querySelector('#screen-game .game-topbar');
      if (topbar && !document.getElementById('sg-topbar-rank')) {
        const pill = document.createElement('div');
        pill.id = 'sg-topbar-rank';
        pill.className = 'sg-topbar-rank';
        if (topbarRight) topbar.insertBefore(pill, topbarRight);
        else topbar.appendChild(pill);
      }

      const scoringBreakdown = document.getElementById('scoring-breakdown');
      if (scoringBreakdown && !document.getElementById('sg-scoring-rating')) {
        const box = document.createElement('div');
        box.id = 'sg-scoring-rating';
        box.className = 'sg-scoring-rating';
        box.style.display = 'none';
        scoringBreakdown.insertAdjacentElement('afterend', box);
      }

      if (!document.getElementById('modal-leaderboard')) {
        const modal = document.createElement('div');
        modal.id = 'modal-leaderboard';
        modal.innerHTML = `
          <div class="sg-lb-dialog">
            <div class="sg-lb-header">
              <div class="sg-lb-title">
                <span>🏆 Таблица лидеров Spirit Go</span>
              </div>
              <button id="sg-lb-close" type="button" class="sg-lb-close">Закрыть ✕</button>
            </div>
            <div class="sg-lb-info">
              <span id="sg-lb-network-summary">Таблица автоматически пополняется при игре с друзьями по коду (P2P).</span>
              <button id="sg-lb-toggle-cfg" type="button" class="sg-lb-close">🌐 Общий онлайн-топ</button>
            </div>
            <div id="sg-lb-config-panel" class="sg-lb-config-panel">
              <div>При игре по коду друзья автоматически обмениваются всей таблицей лидеров напрямую. Чтобы также объединить незнакомых игроков через облако, вставьте ссылку на базу <strong>Firebase</strong>:</div>
              <div class="sg-lb-config-row">
                <input id="sg-fb-url-input" type="text" placeholder="https://ваш-проект-default-rtdb.firebaseio.com" value="${this.firebaseUrl}" />
                <button id="sg-fb-connect-btn" type="button" class="sg-btn-leaderboard">Подключить</button>
                <button id="sg-fb-disconnect-btn" type="button" class="sg-lb-close">Отключить</button>
              </div>
            </div>
            <div class="sg-lb-body">
              <table class="sg-lb-table">
                <thead>
                  <tr>
                    <th>Место</th>
                    <th>Ранг</th>
                    <th>Игрок</th>
                    <th>Очки</th>
                    <th>Статистика</th>
                  </tr>
                </thead>
                <tbody id="sg-lb-tbody"></tbody>
              </table>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('sg-lb-close').addEventListener('click', () => this.closeLeaderboard());
        modal.addEventListener('click', (e) => {
          if (e.target === modal) this.closeLeaderboard();
        });
        document.getElementById('sg-lb-toggle-cfg').addEventListener('click', () => {
          document.getElementById('sg-lb-config-panel').classList.toggle('open');
        });
        document.getElementById('sg-fb-connect-btn').addEventListener('click', () => {
          this.connectFirebase(document.getElementById('sg-fb-url-input').value, false);
        });
        document.getElementById('sg-fb-disconnect-btn').addEventListener('click', () => {
          this.disconnectFirebase();
          document.getElementById('sg-fb-url-input').value = '';
        });
      }

      this._refreshLobbyAndTopbar();
      this.renderLeaderboard();
    }

    _refreshLobbyAndTopbar() {
      const rank = this.gorToRank(this.profile.gor);

      const lobbyRankEl = document.getElementById('sg-lobby-rank');
      if (lobbyRankEl) {
        lobbyRankEl.textContent = rank.label;
        lobbyRankEl.className = `sg-rank-badge sg-rank-${rank.tier}`;
      }

      const lobbyMetaEl = document.getElementById('sg-lobby-meta');
      if (lobbyMetaEl) {
        lobbyMetaEl.innerHTML = `Рейтинг: <strong>${this.profile.gor}</strong> • Побед: <strong>${this.profile.wins}</strong> / Поражений: <strong>${this.profile.losses}</strong>`;
      }

      const peerCount = Object.keys(this.knownPeers).filter(id => !BOT_IDS.has(id)).length;
      const dot = document.getElementById('sg-lobby-live-dot');
      const syncLabel = document.getElementById('sg-lobby-sync-label');
      if (dot) dot.className = (this.isLiveConnected || peerCount > 0) ? 'sg-live-dot' : 'sg-live-dot local';
      if (syncLabel) {
        if (this.isLiveConnected) syncLabel.textContent = 'Облако + P2P';
        else if (peerCount > 0) syncLabel.textContent = `P2P-сеть: ${peerCount} игр.`;
        else syncLabel.textContent = 'P2P-обмен готов';
      }

      const lbSummary = document.getElementById('sg-lb-network-summary');
      if (lbSummary) {
        if (this.lastP2pSyncNotice) {
          lbSummary.innerHTML = `<strong style="color:#6edea6;">✓ ${this.lastP2pSyncNotice}</strong>`;
        } else {
          lbSummary.innerHTML = `В вашей P2P-сети игроков: <strong>${peerCount + 1}</strong>. Таблица обновляется при игре по коду.`;
        }
      }

      const bot = this.getSelectedBot();
      const botRank = this.gorToRank(bot.gor);
      const aiRankEl = document.getElementById('sg-ai-opp-rank');
      if (aiRankEl) aiRankEl.textContent = `${botRank.label} • ${bot.gor} очков`;

      const aiStakesEl = document.getElementById('sg-ai-stakes');
      if (aiStakesEl) {
        const winCalc = this.calculateEgfDelta(this.profile.gor, bot.gor, 1);
        const lossCalc = this.calculateEgfDelta(this.profile.gor, bot.gor, 0);
        aiStakesEl.innerHTML = `
          <span>За победу: <span class="sg-stake-win">+${winCalc.delta} очков</span></span>
          <span>За поражение: <span class="sg-stake-loss">${lossCalc.delta} очков</span></span>
        `;
      }

      const topbarPill = document.getElementById('sg-topbar-rank');
      if (topbarPill) {
        if (this.currentOpponent) {
          const oppR = this.gorToRank(this.currentOpponent.gor);
          topbarPill.innerHTML = `Вы (${rank.label}) vs ${this._escapeHtml(this.currentOpponent.name)} (${oppR.label})`;
        } else {
          topbarPill.innerHTML = `Ваш ранг: <strong>${rank.label}</strong> (${this.profile.gor})`;
        }
      }
    }

    openLeaderboard() {
      this.renderLeaderboard();
      const modal = document.getElementById('modal-leaderboard');
      if (modal) modal.classList.add('active');
    }

    closeLeaderboard() {
      const modal = document.getElementById('modal-leaderboard');
      if (modal) modal.classList.remove('active');
    }

    renderLeaderboard() {
      const tbody = document.getElementById('sg-lb-tbody');
      if (!tbody) return;

      const entries = this.getAllLeaderboardEntries();
      tbody.innerHTML = entries.map((item, idx) => {
        const r = this.gorToRank(item.gor);
        const isFlashing = this.lastUpdatedIds.has(item.id);
        const rowClass = [
          item.isMe ? 'sg-lb-row-me' : '',
          isFlashing ? 'sg-lb-row-flash' : ''
        ].filter(Boolean).join(' ');

        return `
          <tr class="${rowClass}">
            <td><strong>#${idx + 1}</strong></td>
            <td><span class="sg-rank-badge sg-rank-${r.tier}" style="font-size:0.75rem;padding:3px 7px;">${r.label}</span></td>
            <td>${this._escapeHtml(item.name)} <span class="sg-tag-type">${item.type}</span></td>
            <td><strong>${item.gor}</strong></td>
            <td>${item.wins} П / ${item.losses} Пр</td>
          </tr>
        `;
      }).join('');

      setTimeout(() => this.lastUpdatedIds.clear(), 1500);
    }

    showScoringSummary(res) {
      const box = document.getElementById('sg-scoring-rating');
      if (!box) return;
      if (!res) {
        box.style.display = 'none';
        return;
      }

      const sign = res.delta > 0 ? '+' : '';
      const cls = res.delta > 0 ? 'pos' : (res.delta < 0 ? 'neg' : 'neu');
      let bannerHtml = '';
      if (res.rankChanged) {
        bannerHtml = res.promoted
          ? `<div class="sg-rank-banner">▲ Новый ранг: ${res.oldRank.label} → ${res.newRank.label}!</div>`
          : `<div class="sg-rank-banner">▼ Изменение ранга: ${res.oldRank.label} → ${res.newRank.label}</div>`;
      }

      box.style.display = 'block';
      box.innerHTML = `
        <div class="sg-scoring-opp">
          Соперник: <strong>${this._escapeHtml(res.opponentName)}</strong> (${res.opponentRank.label}, ${res.opponentGor} очков)
        </div>
        <div class="sg-scoring-delta ${cls}">${sign}${res.delta} очков</div>
        <div style="font-size:0.86rem;">
          Ваш рейтинг: ${res.oldGor} → <strong>${res.newGor}</strong> (${res.newRank.label})
        </div>
        ${bannerHtml}
      `;
    }

    _escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  function attachToAppInstance(rm) {
    const app = window.SpiritGo && window.SpiritGo.app;
    if (!app || app._sgRatingHooked) return;
    app._sgRatingHooked = true;

    const sendGossip = (ack = false) => {
      if (app.net && typeof app.net.send === 'function') {
        try {
          app.net.send(rm.buildSyncPacket(ack));
        } catch (e) {}
      }
    };

    const origStartMatch = app.startMatch.bind(app);
    app.startMatch = function (config) {
      app._sgRatingRecorded = false;
      rm.showScoringSummary(null);

      if (config.gameMode === 'ai') {
        rm.currentOpponent = { ...rm.getSelectedBot() };
      } else if (config.gameMode === 'online') {
        if (!rm.currentOpponent || rm.currentOpponent.type === 'Бот') {
          rm.currentOpponent = {
            id: 'online_guest',
            name: 'Сетевой соперник',
            gor: rm.profile.gor,
            wins: 0,
            losses: 0,
            type: 'Соперник'
          };
        }
        setTimeout(() => sendGossip(false), 300);
      } else {
        rm.currentOpponent = null;
      }

      rm._refreshLobbyAndTopbar();
      return origStartMatch(config);
    };

    const origHandleNet = app._handleNetworkMessage.bind(app);
    app._handleNetworkMessage = function (msg) {
      if (msg && (msg.type === 'RATING_SYNC' || msg.type === 'RATING_PROFILE')) {
        rm.mergeSyncPacket(msg);
        if (!msg.ack) {
          sendGossip(true);
        }
        return;
      }

      const res = origHandleNet(msg);

      if (msg && (msg.type === 'CONNECTED' || msg.type === 'HELLO')) {
        setTimeout(() => sendGossip(false), 250);
      }

      return res;
    };

    const origShowScoring = app._showScoringModal.bind(app);
    app._showScoringModal = function (scoring, bySurrender) {
      const result = origShowScoring(scoring, bySurrender);
      const mode = app.state && app.state.gameMode;

      if (!app._sgRatingRecorded && (mode === 'ai' || mode === 'online')) {
        app._sgRatingRecorded = true;
        const myColor = mode === 'online' ? (app.myOnlineColor || 'black') : 'black';
        const score = scoring && scoring.winner === myColor ? 1 : 0;
        const opp = rm.currentOpponent || rm.getSelectedBot();

        const summary = rm.recordMatch({
          mode,
          opponentName: opp.name,
          opponentGor: opp.gor,
          score
        });
        rm.showScoringSummary(summary);

        if (mode === 'online') {
          setTimeout(() => sendGossip(false), 200);
        }
      } else if (mode !== 'ai' && mode !== 'online') {
        rm.showScoringSummary(null);
      }

      return result;
    };
  }

  function boot() {
    const rm = new RatingManager();
    window.SpiritGo.rating = rm;
    attachToAppInstance(rm);
    setTimeout(() => attachToAppInstance(rm), 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();