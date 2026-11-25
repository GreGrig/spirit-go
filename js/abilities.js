window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  const AbilityHandlers = {
    onStonePlaced(state, x, y, stone) {
      const events = [];

      if (stone.ability === 'chrono_stone') {
        stone.chronoExpiresTurn = state.turnNumber + 1;
        events.push('⏳ Хроно-камень исказил время вокруг себя на 1 ход.');
      }

      if (stone.ability === 'ko_mirror') {
        stone.ability = 'normal';
        events.push('🪞 Зеркало Ко сработало и стало обычным камнем.');
      }

      if (stone.ability === 'normal' && !stone.isSummoned) {
        for (const { dx, dy } of ns.ORTHO_DIRS) {
          const midX = x + dx, midY = y + dy, resX = x + dx * 2, resY = y + dy * 2;
          if (!state.inBounds(midX, midY) || !state.inBounds(resX, resY)) continue;
          if (state.getStone(midX, midY) || state.isBlocked(midX, midY)) continue;

          const resStone = state.getStone(resX, resY);
          if (resStone && resStone.color === stone.color && resStone.ability === 'resonator') {
            const oppX = resX + dx * 2, oppY = resY + dy * 2;
            if (state.inBounds(oppX, oppY) && !state.getStone(oppX, oppY) && !state.isBlocked(oppX, oppY)) {
              state.setStone(oppX, oppY, {
                color: stone.color,
                ability: 'normal',
                disguised: false,
                isSummoned: true,
                placedTurn: state.turnNumber
              });
              events.push(`🔔 Резонатор призвал союзный камень на (${oppX + 1}, ${oppY + 1})!`);
            }
          }
        }
      }

      return events;
    },

    isProtectedByMonolith(state, x, y, stone) {
      if (!stone || stone.ability !== 'monolith') return false;
      for (const { dx, dy } of ns.ORTHO_DIRS) {
        const nb = state.getStone(x + dx, y + dy);
        if (nb && nb.color === stone.color && !ns.BoardGraph.isChameleonGhost(state, nb)) return true;
      }
      return false;
    },

    onStoneCaptured(state, x, y, capturedStone, killerPos) {
      const events = [];
      const owner = capturedStone.color;
      const capturer = state.opponentOf(owner);

      if (capturedStone.ability === 'spore') {
        events.push(`🍄 Ловушка! Споровый камень на (${x + 1}, ${y + 1}) выпустил токсин!`);
        if (killerPos && state.inBounds(killerPos.x, killerPos.y)) {
          const killerStone = state.getStone(killerPos.x, killerPos.y);
          if (killerStone && killerStone.color === capturer) {
            state.setStone(killerPos.x, killerPos.y, null);
            state.captures[owner] += 1;
            events.push(`💥 Атакующий камень на (${killerPos.x + 1}, ${killerPos.y + 1}) уничтожен спорами!`);
          }
        }
      }

      if (capturedStone.ability === 'defiler') {
        state.blockedCells[`${x},${y}`] = { type: 'permanent', expiresAfterTurn: null };
        events.push(`☠️ Осквернитель проклял клетку (${x + 1}, ${y + 1}) до конца игры!`);
      }

      if (capturedStone.ability === 'catalyst') {
        state.extraTurns[owner] += 1;
        const ownerName = owner === 'black' ? 'Чёрные' : 'Белые';
        events.push(`⚡ Катализатор сработал! ${ownerName} получают двойной ход!`);
      }

      return events;
    },

    checkMirageTriggers(state) {
      const events = [];
      const { groupByCoord, infoMap } = ns.LibertyEngine.evaluateAllGroups(state);

      for (let y = 0; y < state.size; y++) {
        for (let x = 0; x < state.size; x++) {
          const stone = state.getStone(x, y);
          if (!stone || stone.ability !== 'mirage') continue;

          const group = groupByCoord.get(`${x},${y}`);
          const info = group ? infoMap.get(group.id) : null;
          if (info && info.effectiveLiberties === 1) {
            state.setStone(x, y, null);
            state.hands[stone.color].push('mirage');
            events.push(`🌫️ Мираж на (${x + 1}, ${y + 1}) попал в атари, растворился и вернулся в руку!`);
          }
        }
      }

      return events;
    },

    executeActionAbility(state, move) {
      const events = [];
      const color = state.currentTurn;

      if (move.cardId === 'ko_seal') {
        state.blockedCells[`${move.x},${move.y}`] = { type: 'seal', expiresAfterTurn: state.turnNumber + 2 };
        events.push(`🚫 Печать Ко заблокировала клетку (${move.x + 1}, ${move.y + 1}) на 2 хода.`);
      }

      if (move.cardId === 'shadow_step') {
        const stone = state.getStone(move.fromX, move.fromY);
        state.setStone(move.fromX, move.fromY, null);
        state.setStone(move.x, move.y, stone);
        events.push(`👣 Теневой шаг: камень перемещён с (${move.fromX + 1}, ${move.fromY + 1}) на (${move.x + 1}, ${move.y + 1}).`);
      }

      if (move.cardId === 'detonator') {
        const cx = move.x, cy = move.y;
        state.setStone(cx, cy, null);
        let destroyedCount = 0;
        for (const { dx, dy } of ns.ORTHO_DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (!state.inBounds(nx, ny)) continue;
          const victim = state.getStone(nx, ny);
          if (victim) {
            state.setStone(nx, ny, null);
            destroyedCount++;
            if (victim.color !== color) state.captures[color] += 1;
          }
        }
        events.push(`💣 Детонатор на (${cx + 1}, ${cy + 1}) взорвался! Уничтожено соседних камней: ${destroyedCount}.`);
      }

      return events;
    }
  };

  ns.AbilityHandlers = AbilityHandlers;
})(window.SpiritGo);