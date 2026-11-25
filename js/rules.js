window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  const ORTHO_DIRS = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  const DIAG_DIRS = [{ dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }];
  const ALL_8_DIRS = [...ORTHO_DIRS, ...DIAG_DIRS];

  const BoardGraph = {
    isChameleonGhost(state, stone) {
      return Boolean(stone && stone.ability === 'chameleon' && state.currentTurn !== stone.color);
    },

    getConnectedNeighbors(state, x, y) {
      const origin = state.getStone(x, y);
      if (!origin || this.isChameleonGhost(state, origin)) return [];

      const color = origin.color;
      const neighbors = [];
      const seen = new Set();

      const addIfValid = (nx, ny) => {
        const key = `${nx},${ny}`;
        if (seen.has(key)) return;
        const target = state.getStone(nx, ny);
        if (!target || target.color !== color || this.isChameleonGhost(state, target)) return;
        seen.add(key);
        neighbors.push({ x: nx, y: ny });
      };

      for (const { dx, dy } of ORTHO_DIRS) addIfValid(x + dx, y + dy);

      for (const { dx, dy } of DIAG_DIRS) {
        const nx = x + dx, ny = y + dy;
        const target = state.getStone(nx, ny);
        if (target && target.color === color && (origin.ability === 'diagonal_node' || target.ability === 'diagonal_node')) {
          addIfValid(nx, ny);
        }
      }

      for (const { dx, dy } of ORTHO_DIRS) {
        const midX = x + dx, midY = y + dy, jumpX = x + dx * 2, jumpY = y + dy * 2;
        if (!state.inBounds(midX, midY) || !state.inBounds(jumpX, jumpY)) continue;
        const target = state.getStone(jumpX, jumpY);
        if (target && target.color === color && (origin.ability === 'phantom_node' || target.ability === 'phantom_node')) {
          addIfValid(jumpX, jumpY);
        }
      }

      return neighbors;
    },

    getGroup(state, startX, startY) {
      const origin = state.getStone(startX, startY);
      if (!origin) return null;

      const visited = new Set([`${startX},${startY}`]);
      const queue = [{ x: startX, y: startY }];
      const stones = [];

      while (queue.length > 0) {
        const curr = queue.shift();
        stones.push({ x: curr.x, y: curr.y, stone: state.getStone(curr.x, curr.y) });
        for (const next of this.getConnectedNeighbors(state, curr.x, curr.y)) {
          const key = `${next.x},${next.y}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push(next);
          }
        }
      }

      return { id: [...visited].sort().join('|'), color: origin.color, stones, coordsSet: visited };
    },

    getAllGroups(state) {
      const visited = new Set();
      const groups = [];
      for (let y = 0; y < state.size; y++) {
        for (let x = 0; x < state.size; x++) {
          const key = `${x},${y}`;
          if (visited.has(key) || !state.getStone(x, y)) continue;
          const group = this.getGroup(state, x, y);
          for (const k of group.coordsSet) visited.add(k);
          groups.push(group);
        }
      }
      return groups;
    }
  };

  const LibertyEngine = {
    getRawLiberties(state, group) {
      const liberties = new Set();
      for (const { x, y } of group.stones) {
        for (const { dx, dy } of ORTHO_DIRS) {
          const nx = x + dx, ny = y + dy;
          if (state.inBounds(nx, ny) && !state.getStone(nx, ny) && !state.isBlocked(nx, ny)) {
            liberties.add(`${nx},${ny}`);
          }
        }
      }
      return liberties;
    },

    getSingleStoneLiberties(state, x, y) {
      let count = 0;
      for (const { dx, dy } of ORTHO_DIRS) {
        const nx = x + dx, ny = y + dy;
        if (state.inBounds(nx, ny) && !state.getStone(nx, ny) && !state.isBlocked(nx, ny)) count++;
      }
      return count;
    },

    evaluateAllGroups(state) {
      const groups = BoardGraph.getAllGroups(state);
      const groupByCoord = new Map();
      const infoMap = new Map();

      for (const g of groups) {
        const raw = this.getRawLiberties(state, g);
        infoMap.set(g.id, { group: g, rawLiberties: raw, effectiveLiberties: raw.size });
        for (const key of g.coordsSet) groupByCoord.set(key, g);
      }

      for (const g of groups) {
        const ownInfo = infoMap.get(g.id);
        for (const { x, y, stone } of g.stones) {
          if (BoardGraph.isChameleonGhost(state, stone)) continue;
          if (stone.ability === 'symbiont') ownInfo.effectiveLiberties += 3;

          if (stone.ability === 'leech') {
            const drained = new Set();
            for (const { dx, dy } of ORTHO_DIRS) {
              const enemyGroup = groupByCoord.get(`${x + dx},${y + dy}`);
              if (enemyGroup && enemyGroup.color !== g.color && !drained.has(enemyGroup.id)) {
                drained.add(enemyGroup.id);
                infoMap.get(enemyGroup.id).effectiveLiberties -= 1;
                ownInfo.effectiveLiberties += 1;
              }
            }
          }

          if (stone.ability === 'anchor') {
            const anchored = new Set();
            for (const { dx, dy } of ALL_8_DIRS) {
              const enemyGroup = groupByCoord.get(`${x + dx},${y + dy}`);
              if (enemyGroup && enemyGroup.color !== g.color && !anchored.has(enemyGroup.id)) {
                anchored.add(enemyGroup.id);
                infoMap.get(enemyGroup.id).effectiveLiberties -= 1;
              }
            }
          }
        }
      }

      for (const info of infoMap.values()) {
        info.effectiveLiberties = Math.max(0, info.effectiveLiberties);
      }

      return { groups, groupByCoord, infoMap };
    },

    getGroupInfoAt(state, x, y) {
      if (!state.getStone(x, y)) return null;
      const { groupByCoord, infoMap } = this.evaluateAllGroups(state);
      const group = groupByCoord.get(`${x},${y}`);
      return group ? infoMap.get(group.id) : null;
    }
  };

  const MoveValidator = {
    isBlockedByEnemyChrono(state, x, y, color) {
      for (const { dx, dy } of ORTHO_DIRS) {
        const nb = state.getStone(x + dx, y + dy);
        if (nb && nb.color !== color && nb.ability === 'chrono_stone' && nb.chronoExpiresTurn && state.turnNumber <= nb.chronoExpiresTurn) {
          return true;
        }
      }
      return false;
    },

    validate(state, move) {
      if (state.isGameOver) return { valid: false, reason: 'Партия уже завершена.' };
      const color = state.currentTurn;
      if (move.type === 'pass') return { valid: true };

      if (move.cardId && move.cardId !== 'normal') {
        const isDetonateExisting = move.cardId === 'detonator' && move.type === 'action';
        if (!isDetonateExisting && state.gameMode !== 'sandbox' && !state.hands[color].includes(move.cardId)) {
          return { valid: false, reason: 'Этой карты нет в вашей руке.' };
        }
      }

      if (move.type === 'action') {
        if (move.cardId === 'ko_seal') {
          if (!state.inBounds(move.x, move.y)) return { valid: false, reason: 'Клетка вне доски.' };
          if (state.getStone(move.x, move.y) || state.isBlocked(move.x, move.y)) {
            return { valid: false, reason: 'Печать Ко можно ставить только на свободную клетку.' };
          }
          return { valid: true };
        }

        if (move.cardId === 'detonator') {
          const target = state.getStone(move.x, move.y);
          if (!target || target.color !== color || target.ability !== 'detonator') {
            return { valid: false, reason: 'Выберите свой Детонатор на доске для подрыва.' };
          }
          return { valid: true };
        }

        if (move.cardId === 'shadow_step') {
          const stone = state.getStone(move.fromX, move.fromY);
          if (!stone || stone.color !== color) return { valid: false, reason: 'Выберите свой камень для перемещения.' };
          const group = BoardGraph.getGroup(state, move.fromX, move.fromY);
          if (!group || group.stones.length > 1) {
            return { valid: false, reason: 'Теневой шаг работает только на одиночный камень (не в группе).' };
          }
          const dist = Math.abs(move.x - move.fromX) + Math.abs(move.y - move.fromY);
          if (dist !== 1 || !state.inBounds(move.x, move.y)) {
            return { valid: false, reason: 'Можно шагнуть только на 1 клетку по прямой.' };
          }
          if (state.getStone(move.x, move.y) || state.isBlocked(move.x, move.y)) {
            return { valid: false, reason: 'Целевая клетка занята или заблокирована.' };
          }
          if (this.isBlockedByEnemyChrono(state, move.x, move.y, color)) {
            return { valid: false, reason: 'Клетка заблокирована Хроно-камнем соперника.' };
          }
          if (state.koPoint && state.koPoint.x === move.x && state.koPoint.y === move.y) {
            return { valid: false, reason: 'Запрещено правилом Ко.' };
          }

          const sim = state.clone();
          sim.setStone(move.fromX, move.fromY, null);
          sim.setStone(move.x, move.y, { ...stone });
          if (this._wouldBeSuicide(sim, move.x, move.y, color)) {
            return { valid: false, reason: 'Нельзя совершать самоубийственный шаг.' };
          }
          return { valid: true };
        }

        return { valid: false, reason: 'Неизвестное действие карты.' };
      }

      if (move.type === 'place') {
        const { x, y } = move;
        const ability = move.cardId || 'normal';

        if (!state.inBounds(x, y)) return { valid: false, reason: 'Координаты вне доски.' };
        if (state.getStone(x, y)) return { valid: false, reason: 'Эта клетка уже занята.' };
        if (state.isBlocked(x, y)) return { valid: false, reason: 'Эта клетка заблокирована эффектом карты.' };
        if (this.isBlockedByEnemyChrono(state, x, y, color)) {
          return { valid: false, reason: 'Соперник поставил Хроно-камень — сюда нельзя ходить в этот ход.' };
        }
        if (ability !== 'ko_mirror' && state.koPoint && state.koPoint.x === x && state.koPoint.y === y) {
          return { valid: false, reason: 'Запрещено правилом Ко! Сначала сделайте угрозу в другом месте.' };
        }

        const sim = state.clone();
        const cardMeta = ns.CardCatalog.getById(ability);
        sim.setStone(x, y, {
          color,
          ability,
          disguised: cardMeta ? cardMeta.disguised : false,
          isSummoned: false,
          placedTurn: sim.turnNumber
        });

        if (ability === 'anchor') {
          this._simulateEnemyCaptures(sim, color);
          const anchorInfo = LibertyEngine.getGroupInfoAt(sim, x, y);
          if (!anchorInfo || anchorInfo.effectiveLiberties < 2) {
            return { valid: false, reason: 'Якорь нельзя ставить в клетку, где у него будет меньше 2 дыханий.' };
          }
        }

        if (this._wouldBeSuicide(sim, x, y, color)) {
          return { valid: false, reason: 'Самоубийственный ход без захвата камней соперника запрещён.' };
        }

        return { valid: true };
      }

      return { valid: false, reason: 'Некорректный тип хода.' };
    },

    _simulateEnemyCaptures(simState, moverColor) {
      const enemyColor = simState.opponentOf(moverColor);

      for (let y = 0; y < simState.size; y++) {
        for (let x = 0; x < simState.size; x++) {
          const s = simState.getStone(x, y);
          if (s && s.color === enemyColor && s.ability === 'symbiont' && LibertyEngine.getSingleStoneLiberties(simState, x, y) === 0) {
            simState.setStone(x, y, null);
          }
        }
      }

      const { groups, infoMap } = LibertyEngine.evaluateAllGroups(simState);
      const toRemove = [];
      for (const g of groups) {
        if (g.color !== enemyColor) continue;
        const info = infoMap.get(g.id);
        if (info && info.effectiveLiberties === 0) {
          for (const { x, y, stone } of g.stones) {
            if (ns.AbilityHandlers.isProtectedByMonolith(simState, x, y, stone)) continue;
            toRemove.push({ x, y });
          }
        }
      }
      for (const { x, y } of toRemove) {
        simState.setStone(x, y, null);
      }
    },

    _wouldBeSuicide(simState, x, y, moverColor) {
      this._simulateEnemyCaptures(simState, moverColor);
      const placed = simState.getStone(x, y);
      if (placed && placed.ability === 'symbiont' && LibertyEngine.getSingleStoneLiberties(simState, x, y) === 0) {
        return true;
      }
      const ownInfo = LibertyEngine.getGroupInfoAt(simState, x, y);
      return !ownInfo || ownInfo.effectiveLiberties === 0;
    }
  };

  ns.ORTHO_DIRS = ORTHO_DIRS;
  ns.DIAG_DIRS = DIAG_DIRS;
  ns.ALL_8_DIRS = ALL_8_DIRS;
  ns.BoardGraph = BoardGraph;
  ns.LibertyEngine = LibertyEngine;
  ns.MoveValidator = MoveValidator;
})(window.SpiritGo);