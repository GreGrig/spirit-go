window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  // Индивидуальные профили интеллекта для каждого ранга лестницы
  const BOT_PROFILES = {
    bot_25k: {
      name: 'Ученик Додзё',
      rankLabel: '25 кю',
      captureWeight: 18,
      saveWeight: 12,
      atariWeight: 8,
      territoryWeight: 1.5,
      shapeWeight: 2,
      centerBias: 2,
      eyeWeight: 4,
      selfAtariPenalty: 4,
      abilityChance: 0.25,
      abilitySkill: 0.15,
      lookaheadDepth: 0,
      topCandidates: 4,
      noise: 28,
      passMargin: -6
    },
    bot_20k: {
      name: 'Страж Врат',
      rankLabel: '20 кю',
      captureWeight: 38,
      saveWeight: 32,
      atariWeight: 20,
      territoryWeight: 3,
      shapeWeight: 6,
      centerBias: 5,
      eyeWeight: 10,
      selfAtariPenalty: 16,
      abilityChance: 0.42,
      abilitySkill: 0.35,
      lookaheadDepth: 0,
      topCandidates: 5,
      noise: 16,
      passMargin: -3
    },
    bot_15k: {
      name: 'Следопыт Руин',
      rankLabel: '15 кю',
      captureWeight: 52,
      saveWeight: 46,
      atariWeight: 30,
      territoryWeight: 5.5,
      shapeWeight: 10,
      centerBias: 8,
      eyeWeight: 18,
      selfAtariPenalty: 28,
      abilityChance: 0.58,
      abilitySkill: 0.55,
      lookaheadDepth: 0,
      topCandidates: 6,
      noise: 9,
      passMargin: -1
    },
    bot_10k: {
      name: 'Рыцарь Замка',
      rankLabel: '10 кю',
      captureWeight: 64,
      saveWeight: 58,
      atariWeight: 38,
      territoryWeight: 7.5,
      shapeWeight: 14,
      centerBias: 11,
      eyeWeight: 26,
      selfAtariPenalty: 42,
      abilityChance: 0.72,
      abilitySkill: 0.72,
      lookaheadDepth: 1,
      topCandidates: 6,
      noise: 5,
      passMargin: 0.5
    },
    bot_5k: {
      name: 'Мастер Рун',
      rankLabel: '5 кю',
      captureWeight: 72,
      saveWeight: 68,
      atariWeight: 45,
      territoryWeight: 9,
      shapeWeight: 17,
      centerBias: 12,
      eyeWeight: 32,
      selfAtariPenalty: 54,
      abilityChance: 0.92, // Любит комбинации карт
      abilitySkill: 0.88,
      lookaheadDepth: 1,
      topCandidates: 8,
      noise: 2.8,
      passMargin: 1.5
    },
    bot_1k: {
      name: 'Хранитель Пламени',
      rankLabel: '1 кю',
      captureWeight: 82,
      saveWeight: 78,
      atariWeight: 52,
      territoryWeight: 11,
      shapeWeight: 21,
      centerBias: 13,
      eyeWeight: 40,
      selfAtariPenalty: 68,
      abilityChance: 0.86,
      abilitySkill: 0.92,
      lookaheadDepth: 1,
      topCandidates: 10,
      noise: 1.4,
      passMargin: 2.0
    },
    bot_1d: {
      name: 'Алый Дракон',
      rankLabel: '1 дан',
      captureWeight: 92,
      saveWeight: 88,
      atariWeight: 60,
      territoryWeight: 13,
      shapeWeight: 25,
      centerBias: 14,
      eyeWeight: 48,
      selfAtariPenalty: 82,
      abilityChance: 0.90,
      abilitySkill: 0.97,
      lookaheadDepth: 2, // 2-ходовый минимакс (бот -> лучший ответ игрока)
      topCandidates: 11,
      noise: 0.45,
      passMargin: 2.5
    },
    bot_3d: {
      name: 'Древний Игнис',
      rankLabel: '3 дан',
      captureWeight: 105,
      saveWeight: 98,
      atariWeight: 68,
      territoryWeight: 15,
      shapeWeight: 29,
      centerBias: 15,
      eyeWeight: 56,
      selfAtariPenalty: 95,
      abilityChance: 0.95,
      abilitySkill: 1.0,
      lookaheadDepth: 2, // Глубокий 2-ходовый минимакс по 15 лучшим веткам
      topCandidates: 15,
      noise: 0.0,
      passMargin: 3.0
    }
  };

  class TacticalBot {
    _getProfile() {
      const rm = ns.rating;
      const oppId = rm && rm.currentOpponent && rm.currentOpponent.id;
      if (oppId && BOT_PROFILES[oppId]) return BOT_PROFILES[oppId];
      return BOT_PROFILES.bot_20k;
    }

    chooseMove(state) {
      const color = state.currentTurn;
      const enemy = state.opponentOf(color);
      const profile = this._getProfile();

      if (state.consecutivePasses >= 1) {
        const score = ns.ScoringEngine.calculateFinalScore(state);
        const myScore = score[color].total;
        const oppScore = score[enemy].total;
        if (myScore - oppScore > profile.passMargin && state.turnNumber > state.size * 1.4) {
          return { type: 'pass' };
        }
      }

      const candidates = [];
      const baseEval = ns.LibertyEngine.evaluateAllGroups(state);

      // 1. Активные карты способностей (Детонатор, Теневой шаг, Печать Ко)
      this._collectActionMoves(state, color, enemy, profile, baseEval, candidates);

      // 2. Ходы на доску (обычный камень + все тактические карты)
      const playableCards = ['normal'];
      if (Math.random() < profile.abilityChance) {
        const uniqueCards = [...new Set(state.hands[color])].filter(
          c => c !== 'detonator' && c !== 'shadow_step' && c !== 'ko_seal'
        );
        playableCards.push(...uniqueCards);
      }

      // На больших досках (13x13, 19x19) ограничиваем перебор пустых клеток вокруг активной зоны
      const cells = this._getRelevantCells(state, profile);

      for (const { x, y } of cells) {
        for (const cardId of playableCards) {
          const move = { type: 'place', x, y, cardId };
          const check = ns.MoveValidator.validate(state, move);
          if (!check.valid) continue;

          const score = this._evaluateHeuristic(state, move, color, enemy, profile, baseEval);
          candidates.push({ move, score });
        }
      }

      if (candidates.length === 0) return { type: 'pass' };

      candidates.sort((a, b) => b.score - a.score);

      // 3. Глубокий просчёт (1-ply / 2-ply Minimax для 10k — 3d)
      if (profile.lookaheadDepth >= 1) {
        const pool = candidates.slice(0, profile.topCandidates);
        for (const item of pool) {
          item.score = this._evaluateWithLookahead(state, item.move, item.score, color, enemy, profile);
        }
        pool.sort((a, b) => b.score - a.score);

        // Для слабых данов/кю добавляем контролируемую погрешность, для 3d (noise=0) берём строго лучший ход
        if (profile.noise > 0) {
          for (const item of pool) {
            item.finalScore = item.score + (Math.random() - 0.5) * profile.noise;
          }
          pool.sort((a, b) => b.finalScore - a.finalScore);
        }
        return pool[0].move;
      }

      // Для новичков (25k–15k) добавляем шум к топ-кандидатам
      const novicePool = candidates.slice(0, profile.topCandidates);
      for (const item of novicePool) {
        item.finalScore = item.score + (Math.random() - 0.5) * profile.noise;
      }
      novicePool.sort((a, b) => b.finalScore - a.finalScore);
      return novicePool[0].move;
    }

    _getRelevantCells(state, profile) {
      const size = state.size;
      const allEmpty = [];
      let stoneCount = 0;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (state.getStone(x, y)) stoneCount++;
          else if (!state.isBlocked(x, y)) allEmpty.push({ x, y });
        }
      }

      // На 9x9 или в начале партии смотрим всю доску
      if (size <= 9 || stoneCount < 6) return allEmpty;

      // На 13x13 и 19x19 берём все клетки в радиусе 3 от существующих камней + хоси-точки
      const radius = profile.lookaheadDepth >= 2 ? 3 : 2;
      const filtered = allEmpty.filter(({ x, y }) => {
        const isStar = (x === 3 || x === size - 4 || x === Math.floor(size / 2)) &&
                       (y === 3 || y === size - 4 || y === Math.floor(size / 2));
        if (isStar) return true;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (state.inBounds(x + dx, y + dy) && state.getStone(x + dx, y + dy)) return true;
          }
        }
        return false;
      });

      return filtered.length > 0 ? filtered : allEmpty;
    }

    _collectActionMoves(state, color, enemy, profile, baseEval, candidates) {
      // А) Взрыв уже стоящего на доске Детонатора
      for (let y = 0; y < state.size; y++) {
        for (let x = 0; x < state.size; x++) {
          const s = state.getStone(x, y);
          if (s && s.color === color && s.ability === 'detonator') {
            let enemyHit = 0, ownHit = 0;
            for (const { dx, dy } of ns.ORTHO_DIRS) {
              const nb = state.getStone(x + dx, y + dy);
              if (!nb) continue;
              if (nb.color === enemy) enemyHit++;
              else ownHit++;
            }
            // Умный бот взрывает, только если выгодно; новичок может взорвать даже если заденет себя
            if (enemyHit > ownHit || (profile.abilitySkill < 0.3 && enemyHit >= 1)) {
              const value = (enemyHit * 48 - ownHit * 42) * profile.abilitySkill;
              candidates.push({
                move: { type: 'action', cardId: 'detonator', x, y },
                score: value
              });
            }
          }
        }
      }

      // Б) Теневой шаг (побег из атари или резка врага)
      if (state.hands[color].includes('shadow_step') && Math.random() < profile.abilityChance) {
        for (let y = 0; y < state.size; y++) {
          for (let x = 0; x < state.size; x++) {
            const s = state.getStone(x, y);
            if (!s || s.color !== color) continue;
            const g = baseEval.groupByCoord.get(`${x},${y}`);
            const info = g ? baseEval.infoMap.get(g.id) : null;
            if (!info || info.group.stones.length > 1) continue;

            for (const { dx, dy } of ns.ORTHO_DIRS) {
              const nx = x + dx, ny = y + dy;
              const move = { type: 'action', cardId: 'shadow_step', fromX: x, fromY: y, x: nx, y: ny };
              if (!ns.MoveValidator.validate(state, move).valid) continue;

              let val = 10;
              if (info.effectiveLiberties === 1) val += profile.saveWeight * 1.15;
              const sim = state.clone();
              ns.TurnPipeline.executeMove(sim, move);
              const afterInfo = ns.LibertyEngine.getGroupInfoAt(sim, nx, ny);
              if (afterInfo) val += afterInfo.effectiveLiberties * 9;
              candidates.push({ move, score: val * profile.abilitySkill });
            }
          }
        }
      }

      // В) Печать Ко (блокировка ключевого пункта атари или глаза)
      if (state.hands[color].includes('ko_seal') && Math.random() < profile.abilityChance) {
        for (const g of baseEval.groups) {
          const info = baseEval.infoMap.get(g.id);
          if (!info || info.effectiveLiberties !== 1) continue;
          const [libKey] = info.rawLiberties;
          if (!libKey) continue;
          const [lx, ly] = libKey.split(',').map(Number);
          const move = { type: 'action', cardId: 'ko_seal', x: lx, y: ly };
          if (!ns.MoveValidator.validate(state, move).valid) continue;

          // Запечатываем либо спасительное дыхание своей группы в атари, либо ключевой пункт врага
          const bonus = g.color === color ? profile.saveWeight * 0.95 : profile.atariWeight * 0.85;
          candidates.push({ move, score: bonus * profile.abilitySkill });
        }
      }
    }

    _evaluateHeuristic(state, move, color, enemy, profile, baseEval) {
      const sim = state.clone();
      const beforeCaps = sim.captures[color];
      const beforeEnemyCaps = sim.captures[enemy];

      const res = ns.TurnPipeline.executeMove(sim, move);
      if (!res.ok) return -99999;

      const gainedCaps = sim.captures[color] - beforeCaps;
      const lostToTrap = sim.captures[enemy] - beforeEnemyCaps;
      let score = gainedCaps * profile.captureWeight - lostToTrap * (profile.saveWeight * 1.25);

      const postEval = ns.LibertyEngine.evaluateAllGroups(sim);
      const placedInfo = ns.LibertyEngine.getGroupInfoAt(sim, move.x, move.y);

      if (placedInfo) {
        // Дыхания собственной группы
        score += Math.min(placedInfo.effectiveLiberties, 6) * (profile.shapeWeight * 0.55);

        // Штраф за постановку камня в самоатари (1 дыхание без захвата)
        if (placedInfo.effectiveLiberties === 1 && gainedCaps === 0) {
          score -= profile.selfAtariPenalty;
        }
      }

      // Анализ спасения своих групп и атаки чужих
      for (const g of baseEval.groups) {
        const oldInfo = baseEval.infoMap.get(g.id);
        if (!oldInfo) continue;

        if (g.color === color && oldInfo.effectiveLiberties === 1) {
          const sample = g.stones[0];
          const newInfo = ns.LibertyEngine.getGroupInfoAt(sim, sample.x, sample.y);
          if (newInfo && newInfo.effectiveLiberties > 1) {
            score += profile.saveWeight + g.stones.length * 10;
          }
        }

        if (g.color === enemy && oldInfo.effectiveLiberties === 2) {
          const sample = g.stones[0];
          const newInfo = ns.LibertyEngine.getGroupInfoAt(sim, sample.x, sample.y);
          if (newInfo && newInfo.effectiveLiberties === 1) {
            score += profile.atariWeight + g.stones.length * 7;
          }
        }
      }

      // Оценка формы: соединение своих камней, разрезание врага, построение глаз
      score += this._evaluateLocalShape(state, sim, move.x, move.y, color, enemy, profile);

      // Позиционный приоритет (центр и точки 3-3 / 3-4 / 4-4)
      const mid = (state.size - 1) / 2;
      const distCenter = Math.abs(move.x - mid) + Math.abs(move.y - mid);
      score += Math.max(0, profile.centerBias - distCenter * 1.15);

      // Разница в контролируемой территории (особенно важно для высоких кю и данов)
      if (profile.territoryWeight >= 5) {
        const territoryDiff = this._estimateQuickTerritory(sim, color, enemy);
        score += territoryDiff * (profile.territoryWeight * 0.28);
      }

      // Оценка целесообразности применения конкретной карты способностей
      if (move.cardId && move.cardId !== 'normal') {
        score += this._evaluateCardUsage(state, sim, move, color, enemy, profile, baseEval, placedInfo);
      }

      return score;
    }

    _evaluateLocalShape(prevState, sim, x, y, color, enemy, profile) {
      let shape = 0;
      let friendlyOrtho = 0;
      let enemyOrtho = 0;
      let friendlyDiag = 0;
      let enemyDiag = 0;

      for (const { dx, dy } of ns.ORTHO_DIRS) {
        const nb = prevState.getStone(x + dx, y + dy);
        if (!nb) continue;
        if (nb.color === color) friendlyOrtho++;
        else enemyOrtho++;
      }

      for (const { dx, dy } of ns.DIAG_DIRS) {
        const nb = prevState.getStone(x + dx, y + dy);
        if (!nb) continue;
        if (nb.color === color) friendlyDiag++;
        else enemyDiag++;
      }

      // Не забиваем собственный истинный глаз (4 своих ортогональных соседа + диагонали)
      if (friendlyOrtho === 4 && friendlyDiag >= 3) {
        shape -= profile.eyeWeight * 1.4;
      }

      // Выбиваем глаз соперника (точка, окружённая 3-4 вражескими камнями)
      if (enemyOrtho >= 3 && enemyDiag >= 2) {
        shape += profile.eyeWeight * 0.95;
      }

      // Разрезание диагональных камней соперника (хане / перерезание)
      if (enemyDiag >= 2 && friendlyOrtho >= 1) {
        shape += profile.shapeWeight * 0.85;
      }

      // Бамбуковое соединение / крепкая форма
      if (friendlyOrtho >= 1 && friendlyDiag >= 1 && friendlyOrtho < 4) {
        shape += profile.shapeWeight * 0.45;
      }

      return shape;
    }

    _estimateQuickTerritory(state, color, enemy) {
      let diff = 0;
      const size = state.size;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const s = state.getStone(x, y);
          if (s) {
            diff += s.color === color ? 1.1 : -1.1;
            continue;
          }
          if (state.isBlocked(x, y)) continue;
          let myInf = 0, oppInf = 0;
          for (const { dx, dy } of ns.ORTHO_DIRS) {
            const nb = state.getStone(x + dx, y + dy);
            if (!nb) continue;
            if (nb.color === color) myInf++;
            else oppInf++;
          }
          if (myInf > 0 && oppInf === 0) diff += 0.65;
          else if (oppInf > 0 && myInf === 0) diff -= 0.65;
        }
      }
      return diff;
    }

    _evaluateCardUsage(state, sim, move, color, enemy, profile, baseEval, placedInfo) {
      const skill = profile.abilitySkill;
      // Базовый штраф за трату редкой карты, чтобы бот не кидал её просто так
      let cardBonus = -18 * skill;

      let adjEnemies = 0;
      let adjFriends = 0;
      for (const { dx, dy } of ns.ORTHO_DIRS) {
        const nb = state.getStone(move.x + dx, move.y + dy);
        if (!nb) continue;
        if (nb.color === enemy) adjEnemies++;
        else adjFriends++;
      }

      switch (move.cardId) {
        case 'monolith':
          // Монолит идеален в плотном контакте с врагом и союзником (перешеек / вторжение)
          if (adjFriends >= 1 && adjEnemies >= 1) cardBonus += 42 * skill;
          else if (adjFriends >= 1) cardBonus += 14 * skill;
          else cardBonus -= 25 * skill;
          break;

        case 'leech':
        case 'anchor':
          // Пиявка и Якорь сильны рядом с группами врага с малым числом дыханий
          if (adjEnemies >= 1) cardBonus += (26 + adjEnemies * 14) * skill;
          break;

        case 'symbiont':
          if (placedInfo && placedInfo.effectiveLiberties >= 3 && adjFriends >= 1) {
            cardBonus += 34 * skill;
          } else {
            cardBonus -= 30 * skill;
          }
          break;

        case 'altar':
          // Алтарь ставим в безопасной собственной территории с 2+ пустыми соседними клетками
          if (adjEnemies === 0 && placedInfo && placedInfo.effectiveLiberties >= 2) {
            cardBonus += 38 * skill;
          } else {
            cardBonus -= 25 * skill;
          }
          break;

        case 'spore':
        case 'defiler':
        case 'catalyst':
          // Ловушки лучше ставить на линии атаки врага
          if (adjEnemies >= 1 && placedInfo && placedInfo.effectiveLiberties <= 2) {
            cardBonus += 36 * skill;
          }
          break;

        case 'detonator':
          // Ставим Детонатор вплотную к 2+ камням соперника
          if (adjEnemies >= 2) cardBonus += (32 + adjEnemies * 15) * skill;
          else cardBonus -= 20 * skill;
          break;

        case 'diagonal_node':
        case 'phantom_node':
          // Узлы связи хороши для прыжков и диагональных соединений
          if (adjFriends === 0) cardBonus += 28 * skill;
          break;

        case 'chrono_stone':
          if (adjEnemies >= 1) cardBonus += 30 * skill;
          break;

        case 'mirage':
        case 'chameleon':
          if (adjEnemies >= 1) cardBonus += 26 * skill;
          break;

        case 'resonator':
          cardBonus += 24 * skill;
          break;

        case 'ko_mirror':
          cardBonus += 48 * skill;
          break;
      }

      return cardBonus;
    }

    // === 1-PLY И 2-PLY МИНИМАКС-ПРОСЧЁТ ОТВЕТОВ СОПЕРНИКА ===
    _evaluateWithLookahead(state, move, immediateScore, color, enemy, profile) {
      const sim = state.clone();
      const res = ns.TurnPipeline.executeMove(sim, move);
      if (!res.ok) return -99999;

      // Если ход дал нам двойной ход (Катализатор) — сразу считаем наш следующий удар
      if (sim.currentTurn === color) {
        const bonusReply = this._findBestGreedyReply(sim, color, enemy, profile, 6);
        return immediateScore + bonusReply * 0.65;
      }

      // Считаем лучший ответный ход соперника (Minimax)
      const oppWorstResponse = this._findBestGreedyReply(sim, enemy, color, profile, profile.lookaheadDepth >= 2 ? 10 : 5);
      return immediateScore - oppWorstResponse * 0.72;
    }

    _findBestGreedyReply(state, mover, defender, profile, sampleLimit) {
      const baseEval = ns.LibertyEngine.evaluateAllGroups(state);
      const replyProfile = {
        ...profile,
        abilityChance: 0.4,
        territoryWeight: 4,
        noise: 0
      };

      const quickMoves = [];
      const cells = this._getRelevantCells(state, profile);

      for (const { x, y } of cells) {
        const move = { type: 'place', x, y, cardId: 'normal' };
        if (!ns.MoveValidator.validate(state, move).valid) continue;

        // Быстрая предварительная сортировка без полного клонирования всей доски
        let urgency = 0;
        for (const { dx, dy } of ns.ORTHO_DIRS) {
          const nb = state.getStone(x + dx, y + dy);
          if (!nb) continue;
          const g = baseEval.groupByCoord.get(`${x + dx},${y + dy}`);
          const info = g ? baseEval.infoMap.get(g.id) : null;
          if (info && info.effectiveLiberties === 1) urgency += 60;
          else if (info && info.effectiveLiberties === 2) urgency += 25;
          else urgency += 8;
        }
        quickMoves.push({ move, urgency });
      }

      quickMoves.sort((a, b) => b.urgency - a.urgency);
      const top = quickMoves.slice(0, sampleLimit);

      let bestScore = 0;
      for (const item of top) {
        const sc = this._evaluateHeuristic(state, item.move, mover, defender, replyProfile, baseEval);
        if (sc > bestScore) bestScore = sc;
      }
      return bestScore;
    }
  }

  ns.TacticalBot = TacticalBot;
})(window.SpiritGo);