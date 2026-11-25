window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  const ScoringEngine = {
    calculateFinalScore(state) {
      const size = state.size;
      const visitedEmpty = new Set();
      let blackStones = 0, whiteStones = 0, blackTerritory = 0, whiteTerritory = 0, blackAltarBonus = 0, whiteAltarBonus = 0;
      const territoryOwnerMap = {};

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const stone = state.getStone(x, y);
          if (stone) {
            if (stone.color === 'black') blackStones++;
            else whiteStones++;
          }
        }
      }

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const key = `${x},${y}`;
          if (visitedEmpty.has(key) || state.getStone(x, y)) continue;
          if (state.isBlocked(x, y)) {
            territoryOwnerMap[key] = 'neutral';
            continue;
          }

          const region = [];
          const borders = new Set();
          const queue = [{ x, y }];
          visitedEmpty.add(key);

          while (queue.length > 0) {
            const curr = queue.shift();
            region.push(curr);

            for (const { dx, dy } of ns.ORTHO_DIRS) {
              const nx = curr.x + dx, ny = curr.y + dy;
              if (!state.inBounds(nx, ny) || state.isBlocked(nx, ny)) continue;

              const nb = state.getStone(nx, ny);
              if (nb) {
                borders.add(nb.color);
              } else {
                const nKey = `${nx},${ny}`;
                if (!visitedEmpty.has(nKey)) {
                  visitedEmpty.add(nKey);
                  queue.push({ x: nx, y: ny });
                }
              }
            }
          }

          let owner = 'neutral';
          if (borders.size === 1) owner = borders.has('black') ? 'black' : 'white';
          for (const cell of region) territoryOwnerMap[`${cell.x},${cell.y}`] = owner;
          if (owner === 'black') blackTerritory += region.length;
          if (owner === 'white') whiteTerritory += region.length;
        }
      }

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const stone = state.getStone(x, y);
          if (!stone || stone.ability !== 'altar') continue;
          for (const { dx, dy } of ns.ORTHO_DIRS) {
            const nx = x + dx, ny = y + dy;
            if (!state.inBounds(nx, ny) || state.getStone(nx, ny) || state.isBlocked(nx, ny)) continue;
            if (territoryOwnerMap[`${nx},${ny}`] === stone.color) {
              if (stone.color === 'black') blackAltarBonus += 2;
              else whiteAltarBonus += 2;
            }
          }
        }
      }

      const blackTotal = blackStones + blackTerritory + blackAltarBonus;
      const whiteTotal = whiteStones + whiteTerritory + whiteAltarBonus + state.komi;
      return {
        winner: blackTotal > whiteTotal ? 'black' : 'white',
        black: { stones: blackStones, territory: blackTerritory, altarBonus: blackAltarBonus, komi: 0, total: blackTotal },
        white: { stones: whiteStones, territory: whiteTerritory, altarBonus: whiteAltarBonus, komi: state.komi, total: whiteTotal },
        territoryOwnerMap
      };
    }
  };

  const TurnPipeline = {
    executeMove(state, move) {
      const check = ns.MoveValidator.validate(state, move);
      if (!check.valid) return { ok: false, reason: check.reason, events: [] };

      state.history.push(state.clone());
      if (state.history.length > 40) state.history.shift();

      const color = state.currentTurn;
      const colorName = color === 'black' ? 'Чёрные' : 'Белые';
      const events = [];

      if (move.type === 'pass') {
        state.consecutivePasses += 1;
        state.koPoint = null;
        state.lastMove = { type: 'pass', color };
        const msg = `${colorName} спасовали.`;
        state.addLog(msg);
        events.push(msg);

        if (state.consecutivePasses >= 2) {
          const result = ScoringEngine.calculateFinalScore(state);
          state.isGameOver = true;
          state.winner = result.winner;
          state.winReason = 'Два паса подряд';
          return { ok: true, events, scoring: result };
        }

        this._advanceTurn(state);
        return { ok: true, events };
      }

      state.consecutivePasses = 0;

      const isTriggeringExistingDetonator = move.type === 'action' && move.cardId === 'detonator';
      if (move.cardId && move.cardId !== 'normal' && !isTriggeringExistingDetonator && state.gameMode !== 'sandbox') {
        const idx = state.hands[color].indexOf(move.cardId);
        if (idx !== -1) state.hands[color].splice(idx, 1);
      }

      if (move.type === 'action') {
        state.koPoint = null;
        const actionEvents = ns.AbilityHandlers.executeActionAbility(state, move);
        events.push(...actionEvents);
        actionEvents.forEach((e) => state.addLog(e));

        const killerPos = move.cardId === 'shadow_step' ? { x: move.x, y: move.y } : null;
        const captureResult = this._resolveCaptures(state, color, killerPos);
        events.push(...captureResult.events);

        const mirageEvents = ns.AbilityHandlers.checkMirageTriggers(state);
        mirageEvents.forEach((e) => { events.push(e); state.addLog(e); });

        state.lastMove = { ...move, color };
        this._advanceTurn(state);
        return { ok: true, events };
      }

      if (move.type === 'place') {
        const ability = move.cardId || 'normal';
        const cardMeta = ns.CardCatalog.getById(ability);

        const stone = {
          color,
          ability,
          disguised: cardMeta ? cardMeta.disguised : false,
          isSummoned: false,
          placedTurn: state.turnNumber
        };

        state.setStone(move.x, move.y, stone);

        if (cardMeta && !cardMeta.disguised) {
          const playLog = `${colorName} сыграли карту «${cardMeta.name}» на (${move.x + 1}, ${move.y + 1}).`;
          state.addLog(playLog);
          events.push(playLog);
        } else {
          state.addLog(`${colorName}: ход на (${move.x + 1}, ${move.y + 1}).`);
        }

        const placeEvents = ns.AbilityHandlers.onStonePlaced(state, move.x, move.y, stone);
        placeEvents.forEach((e) => { events.push(e); state.addLog(e); });

        const captureResult = this._resolveCaptures(state, color, { x: move.x, y: move.y });
        events.push(...captureResult.events);

        if (captureResult.capturedCoords.length === 1 && captureResult.placedGroupSize === 1 && captureResult.placedGroupLiberties === 1) {
          state.koPoint = { x: captureResult.capturedCoords[0].x, y: captureResult.capturedCoords[0].y };
        } else {
          state.koPoint = null;
        }

        const mirageEvents = ns.AbilityHandlers.checkMirageTriggers(state);
        mirageEvents.forEach((e) => { events.push(e); state.addLog(e); });

        state.lastMove = { ...move, color };
        this._advanceTurn(state);
        return { ok: true, events };
      }

      return { ok: false, reason: 'Неизвестный тип хода.', events: [] };
    },

    _resolveCaptures(state, moverColor, killerPos) {
      const enemyColor = state.opponentOf(moverColor);
      const events = [];
      const capturedCoords = [];

      for (let y = 0; y < state.size; y++) {
        for (let x = 0; x < state.size; x++) {
          const s = state.getStone(x, y);
          if (s && s.color === enemyColor && s.ability === 'symbiont' && ns.LibertyEngine.getSingleStoneLiberties(state, x, y) === 0) {
            state.setStone(x, y, null);
            state.captures[moverColor] += 1;
            capturedCoords.push({ x, y });
            const msg = `🧬 Уязвимый Симбионт на (${x + 1}, ${y + 1}) захвачен отдельно от группы!`;
            events.push(msg);
            state.addLog(msg);
          }
        }
      }

      const { groups, infoMap } = ns.LibertyEngine.evaluateAllGroups(state);
      const toCapture = [];
      for (const g of groups) {
        if (g.color !== enemyColor) continue;
        const info = infoMap.get(g.id);
        if (!info || info.effectiveLiberties > 0) continue;

        for (const { x, y, stone } of g.stones) {
          if (ns.AbilityHandlers.isProtectedByMonolith(state, x, y, stone)) {
            const monoMsg = `🗿 Монолит на (${x + 1}, ${y + 1}) устоял, так как рядом есть союзник!`;
            events.push(monoMsg);
            state.addLog(monoMsg);
            continue;
          }
          toCapture.push({ x, y, stone });
        }
      }

      for (const { x, y, stone } of toCapture) {
        state.setStone(x, y, null);
        state.captures[moverColor] += 1;
        capturedCoords.push({ x, y });

        const trapEvents = ns.AbilityHandlers.onStoneCaptured(state, x, y, stone, killerPos);
        trapEvents.forEach((e) => { events.push(e); state.addLog(e); });
      }

      let placedGroupSize = 0, placedGroupLiberties = 0;
      if (killerPos && state.getStone(killerPos.x, killerPos.y)) {
        const ownInfo = ns.LibertyEngine.getGroupInfoAt(state, killerPos.x, killerPos.y);
        if (ownInfo) {
          placedGroupSize = ownInfo.group.stones.length;
          placedGroupLiberties = ownInfo.effectiveLiberties;
        }
      }

      return { events, capturedCoords, placedGroupSize, placedGroupLiberties };
    },

    _advanceTurn(state) {
      const current = state.currentTurn;
      state.turnNumber += 1;
      if (state.extraTurns[current] > 0) {
        state.extraTurns[current] -= 1;
        const name = current === 'black' ? 'Чёрные' : 'Белые';
        state.addLog(`⚡ ${name} используют бонусный второй ход!`);
      } else {
        state.currentTurn = state.opponentOf(current);
      }
      state.cleanupExpiredEffects();
    }
  };

  ns.ScoringEngine = ScoringEngine;
  ns.TurnPipeline = TurnPipeline;
})(window.SpiritGo);