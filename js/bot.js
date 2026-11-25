window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  const BotPlayer = {
    chooseMove(state) {
      const color = state.currentTurn;
      const enemyColor = state.opponentOf(color);
      const size = state.size;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const s = state.getStone(x, y);
          if (s && s.color === color && s.ability === 'detonator') {
            let enemyAdj = 0, friendlyAdj = 0;
            for (const { dx, dy } of ns.ORTHO_DIRS) {
              const nb = state.getStone(x + dx, y + dy);
              if (nb) { if (nb.color === enemyColor) enemyAdj++; else friendlyAdj++; }
            }
            if (enemyAdj >= 2 && friendlyAdj <= 1) return { type: 'action', cardId: 'detonator', x, y };
          }
        }
      }

      const { groups, infoMap } = ns.LibertyEngine.evaluateAllGroups(state);
      const candidates = [];

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (state.getStone(x, y) || state.isBlocked(x, y)) continue;
          if (!ns.MoveValidator.validate(state, { type: 'place', x, y, cardId: 'normal' }).valid) continue;

          let score = Math.random() * 4;
          if (this._isOwnSimpleEye(state, x, y, color)) score -= 50;

          const distEdgeX = Math.min(x, size - 1 - x), distEdgeY = Math.min(y, size - 1 - y);
          if ((distEdgeX === 2 || distEdgeX === 3) && (distEdgeY === 2 || distEdgeY === 3)) score += 9;
          else if (distEdgeX === 0 || distEdgeY === 0) score -= 4;

          let touchesEnemy = false, touchesFriendly = false;
          for (const { dx, dy } of ns.ORTHO_DIRS) {
            const nx = x + dx, ny = y + dy;
            const nb = state.getStone(nx, ny);
            if (!nb) continue;
            const g = groups.find((grp) => grp.coordsSet.has(`${nx},${ny}`));
            const info = g ? infoMap.get(g.id) : null;

            if (nb.color === enemyColor) {
              touchesEnemy = true;
              if (info && info.effectiveLiberties === 1) score += 45 + g.stones.length * 10;
              else if (info && info.effectiveLiberties === 2) score += 14;
            } else {
              touchesFriendly = true;
              if (info && info.effectiveLiberties === 1) score += 38 + g.stones.length * 8;
              else if (info && info.effectiveLiberties === 2) score += 10;
            }
          }

          for (const { dx, dy } of ns.DIAG_DIRS) {
            const nb = state.getStone(x + dx, y + dy);
            if (nb && nb.color === color) score += 3.5;
          }

          candidates.push({ x, y, score, touchesEnemy, touchesFriendly });
        }
      }

      if (candidates.length === 0) return { type: 'pass' };
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      if (best.score < -20 && state.turnNumber > size * size * 0.5) return { type: 'pass' };

      const hand = state.hands[color];
      if (hand.length > 0 && Math.random() < 0.34) {
        const placeable = hand.filter((id) => !['shadow_step', 'ko_seal', 'ko_mirror'].includes(id));
        if (placeable.length > 0) {
          let pool = placeable;
          if (best.touchesEnemy) {
            const c = placeable.filter((id) => ['leech', 'anchor', 'spore', 'catalyst', 'chrono_stone', 'detonator'].includes(id));
            if (c.length) pool = c;
          } else if (best.touchesFriendly) {
            const s = placeable.filter((id) => ['monolith', 'symbiont', 'diagonal_node', 'phantom_node', 'altar'].includes(id));
            if (s.length) pool = s;
          }
          const chosenCard = pool[Math.floor(Math.random() * pool.length)];
          const cardMove = { type: 'place', x: best.x, y: best.y, cardId: chosenCard };
          if (ns.MoveValidator.validate(state, cardMove).valid) return cardMove;
        }
      }

      return { type: 'place', x: best.x, y: best.y, cardId: 'normal' };
    },

    _isOwnSimpleEye(state, x, y, color) {
      for (const { dx, dy } of ns.ORTHO_DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!state.inBounds(nx, ny)) continue;
        const nb = state.getStone(nx, ny);
        if (!nb || nb.color !== color) return false;
      }
      return true;
    }
  };

  ns.BotPlayer = BotPlayer;
})(window.SpiritGo);