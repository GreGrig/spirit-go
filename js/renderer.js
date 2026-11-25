window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  class BoardRenderer {
    constructor(canvas, onCellClick) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onCellClick = onCellClick;
      this.hoverCell = null;
      this.pixelSize = 620;
      this.padding = 34;
      this.cellStep = 40;
      this._bindMouse();
    }

    _bindMouse() {
      this.canvas.addEventListener('mousemove', (e) => {
        if (!this.lastState) return;
        const cell = this._eventToCell(e);
        const prev = this.hoverCell;
        if ((!prev && !cell) || (prev && cell && prev.x === cell.x && prev.y === cell.y)) return;
        this.hoverCell = cell;
        this.render(this.lastState, this.lastPerspective, this.lastTargeting, this.lastScoring, this.lastTutHighlight);
      });
      this.canvas.addEventListener('mouseleave', () => {
        this.hoverCell = null;
        if (this.lastState) this.render(this.lastState, this.lastPerspective, this.lastTargeting, this.lastScoring, this.lastTutHighlight);
      });
      this.canvas.addEventListener('click', (e) => {
        if (!this.lastState) return;
        const cell = this._eventToCell(e);
        if (cell && this.onCellClick) this.onCellClick(cell.x, cell.y);
      });
    }

    _eventToCell(e) {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const gx = Math.round((mx - this.padding) / this.cellStep);
      const gy = Math.round((my - this.padding) / this.cellStep);
      if (!this.lastState || !this.lastState.inBounds(gx, gy)) return null;
      const cx = this.padding + gx * this.cellStep, cy = this.padding + gy * this.cellStep;
      return Math.hypot(mx - cx, my - cy) <= this.cellStep * 0.48 ? { x: gx, y: gy } : null;
    }

    _computeMetrics(boardSize) {
      const maxAvail = Math.min(window.innerWidth - 40, window.innerHeight - 185, 680);
      const size = Math.max(340, maxAvail);
      this.pixelSize = size;
      this.padding = boardSize === 19 ? 28 : 36;
      this.cellStep = (size - this.padding * 2) / (boardSize - 1);
      const dpr = window.devicePixelRatio || 1;
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
      this.canvas.width = Math.round(size * dpr);
      this.canvas.height = Math.round(size * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _toPx(gx, gy) { return { px: this.padding + gx * this.cellStep, py: this.padding + gy * this.cellStep }; }

    render(state, perspectiveColor = 'black', targeting = null, scoringResult = null, tutorialHighlight = null) {
      this.lastState = state;
      this.lastPerspective = perspectiveColor;
      this.lastTargeting = targeting;
      this.lastScoring = scoringResult;
      this.lastTutHighlight = tutorialHighlight;

      this._computeMetrics(state.size);
      const ctx = this.ctx, size = state.size;

      const grad = ctx.createLinearGradient(0, 0, this.pixelSize, this.pixelSize);
      grad.addColorStop(0, '#2a1d28');
      grad.addColorStop(1, '#1b121b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.pixelSize, this.pixelSize);

      ctx.fillStyle = 'rgba(255, 110, 130, 0.02)';
      for (let y = 0; y < this.pixelSize; y += 4) {
        ctx.fillRect(0, y, this.pixelSize, 2);
      }

      ctx.strokeStyle = '#4e3341';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, this.pixelSize - 6, this.pixelSize - 6);

      ctx.strokeStyle = '#6b4958';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < size; i++) {
        const pos = this.padding + i * this.cellStep;
        ctx.beginPath(); ctx.moveTo(this.padding, pos); ctx.lineTo(this.pixelSize - this.padding, pos); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pos, this.padding); ctx.lineTo(pos, this.pixelSize - this.padding); ctx.stroke();
      }

      ctx.fillStyle = '#9e7c8a';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < size; i++) {
        const pos = this.padding + i * this.cellStep;
        ctx.fillText(String(i + 1), pos, 13);
        ctx.fillText(String(i + 1), 13, pos);
      }

      const hoshi = size === 9 ? [[2,2],[6,2],[4,4],[2,6],[6,6]]
        : size === 13 ? [[3,3],[9,3],[6,6],[3,9],[9,9]]
        : size === 19 ? [[3,3],[9,3],[15,3],[3,9],[9,9],[15,9],[3,15],[9,15],[15,15]] : [];
      ctx.fillStyle = '#e0485c';
      for (const [hx, hy] of hoshi) {
        const { px, py } = this._toPx(hx, hy);
        ctx.fillRect(Math.round(px - 3), Math.round(py - 3), 6, 6);
      }

      this._drawSpecialLinks(state);
      this._drawBoardMarkers(state);
      if (scoringResult && scoringResult.territoryOwnerMap) this._drawTerritoryOverlay(scoringResult.territoryOwnerMap);
      this._drawStones(state, perspectiveColor, targeting);
      if (!state.isGameOver && targeting) this._drawTargetingPreview(state, targeting);
      if (tutorialHighlight) this._drawTutorialTarget(tutorialHighlight);
    }

    _drawTutorialTarget(target) {
      const ctx = this.ctx;
      const { px, py } = this._toPx(target.x, target.y);
      const r = this.cellStep * 0.48;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 209, 102, 0.22)';
      ctx.fillRect(px - r, py - r, r * 2, r * 2);

      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(px - r, py - r, r * 2, r * 2);

      const c = 6;
      ctx.strokeStyle = '#ff5a70';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - r - 3, py - r + c); ctx.lineTo(px - r - 3, py - r - 3); ctx.lineTo(px - r + c, py - r - 3);
      ctx.moveTo(px + r - c, py - r - 3); ctx.lineTo(px + r + 3, py - r - 3); ctx.lineTo(px + r + 3, py - r + c);
      ctx.moveTo(px - r - 3, py + r - c); ctx.lineTo(px - r - 3, py + r + 3); ctx.lineTo(px - r + c, py + r + 3);
      ctx.moveTo(px + r - c, py + r + 3); ctx.lineTo(px + r + 3, py + r + 3); ctx.lineTo(px + r + 3, py + r - c);
      ctx.stroke();

      if (target.label) {
        ctx.font = '700 11px "JetBrains Mono", monospace';
        const textW = ctx.measureText(target.label).width + 12;
        const boxY = py - r - 24 < 6 ? py + r + 8 : py - r - 24;
        ctx.fillStyle = '#160d1c';
        ctx.fillRect(px - textW / 2, boxY, textW, 18);
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px - textW / 2, boxY, textW, 18);
        ctx.fillStyle = '#ffd166';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(target.label, px, boxY + 9);
      }
      ctx.restore();
    }

    _drawSpecialLinks(state) {
      const ctx = this.ctx;
      for (let y = 0; y < state.size; y++) {
        for (let x = 0; x < state.size; x++) {
          const s = state.getStone(x, y);
          if (!s || ns.BoardGraph.isChameleonGhost(state, s)) continue;

          if (s.ability === 'diagonal_node') {
            for (const { dx, dy } of ns.DIAG_DIRS) {
              const nb = state.getStone(x + dx, y + dy);
              if (nb && nb.color === s.color && !ns.BoardGraph.isChameleonGhost(state, nb)) {
                const p1 = this._toPx(x, y), p2 = this._toPx(x + dx, y + dy);
                ctx.save(); ctx.strokeStyle = 'rgba(186, 156, 255, 0.8)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py); ctx.stroke(); ctx.restore();
              }
            }
          }

          if (s.ability === 'phantom_node') {
            for (const { dx, dy } of ns.ORTHO_DIRS) {
              const nb = state.getStone(x + dx * 2, y + dy * 2);
              if (nb && nb.color === s.color && !ns.BoardGraph.isChameleonGhost(state, nb)) {
                const p1 = this._toPx(x, y), p2 = this._toPx(x + dx * 2, y + dy * 2);
                ctx.save(); ctx.strokeStyle = 'rgba(255, 107, 124, 0.85)'; ctx.lineWidth = 2.6; ctx.setLineDash([5, 4]);
                ctx.beginPath(); ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py); ctx.stroke(); ctx.restore();
              }
            }
          }
        }
      }
    }

    _drawBoardMarkers(state) {
      const ctx = this.ctx;
      for (const [key, info] of Object.entries(state.blockedCells)) {
        const [x, y] = key.split(',').map(Number);
        if (!state.isBlocked(x, y)) continue;
        const { px, py } = this._toPx(x, y), r = this.cellStep * 0.36;
        ctx.save();
        ctx.fillStyle = info.type === 'permanent' ? 'rgba(120, 28, 68, 0.82)' : 'rgba(224, 72, 92, 0.72)';
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
        ctx.font = `${Math.round(r * 1.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(info.type === 'permanent' ? '☠️' : '🚫', px, py + 1);
        ctx.restore();
      }

      if (state.koPoint) {
        const { px, py } = this._toPx(state.koPoint.x, state.koPoint.y), s = this.cellStep * 0.24;
        ctx.save(); ctx.strokeStyle = '#ff5a70'; ctx.lineWidth = 2.2;
        ctx.strokeRect(px - s, py - s, s * 2, s * 2); ctx.restore();
      }
    }

    _drawTerritoryOverlay(map) {
      const ctx = this.ctx, sq = this.cellStep * 0.26;
      for (const [key, owner] of Object.entries(map)) {
        if (owner === 'neutral') continue;
        const [x, y] = key.split(',').map(Number), { px, py } = this._toPx(x, y);
        ctx.save();
        ctx.fillStyle = owner === 'black' ? 'rgba(12, 8, 15, 0.85)' : 'rgba(255, 240, 244, 0.9)';
        ctx.strokeStyle = '#e0485c'; ctx.lineWidth = 1.2;
        ctx.fillRect(px - sq, py - sq, sq * 2, sq * 2);
        ctx.strokeRect(px - sq, py - sq, sq * 2, sq * 2);
        ctx.restore();
      }
    }

    _drawStones(state, perspectiveColor, targeting) {
      const ctx = this.ctx, radius = this.cellStep * 0.44;
      for (let y = 0; y < state.size; y++) {
        for (let x = 0; x < state.size; x++) {
          const stone = state.getStone(x, y);
          if (!stone) continue;
          const { px, py } = this._toPx(x, y);
          const isGhost = ns.BoardGraph.isChameleonGhost(state, stone);

          if (stone.ability === 'chrono_stone' && stone.chronoExpiresTurn && state.turnNumber <= stone.chronoExpiresTurn) {
            ctx.save(); ctx.strokeStyle = 'rgba(242, 166, 156, 0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.arc(px, py, radius + 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          }

          if (targeting && targeting.selectedFrom && targeting.selectedFrom.x === x && targeting.selectedFrom.y === y) {
            ctx.save(); ctx.strokeStyle = '#ff6b7c'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(px, py, radius + 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          }

          ctx.save();
          if (isGhost) ctx.globalAlpha = 0.45;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 1.5; ctx.shadowOffsetY = 2.5;

          const g = ctx.createRadialGradient(px - radius * 0.3, py - radius * 0.3, radius * 0.1, px, py, radius);
          if (stone.color === 'black') {
            g.addColorStop(0, '#4f3f54'); g.addColorStop(0.55, '#19131d'); g.addColorStop(1, '#09060c');
          } else {
            g.addColorStop(0, '#fff9fa'); g.addColorStop(0.75, '#e6d6dc'); g.addColorStop(1, '#b8a0aa');
          }
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();

          ctx.lineWidth = 1.5;
          ctx.strokeStyle = stone.color === 'black' ? '#6d5368' : '#8f7480';
          ctx.stroke();
          ctx.restore();

          const isHiddenTrap = stone.disguised && stone.color !== perspectiveColor && state.gameMode !== 'sandbox' &&
            !state.isGameOver && (state.cardFormat === 'closed' || state.cardFormat === 'random');

          if (stone.ability && stone.ability !== 'normal' && !isHiddenTrap) {
            const cardMeta = ns.CardCatalog.getById(stone.ability);
            if (cardMeta) {
              ctx.save();
              ctx.strokeStyle = '#e0485c'; ctx.lineWidth = 1.8;
              ctx.beginPath(); ctx.arc(px, py, radius - 2, 0, Math.PI * 2); ctx.stroke();
              ctx.font = `${Math.max(11, Math.round(radius * 0.95))}px sans-serif`;
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(cardMeta.icon, px, py + 0.5);
              ctx.restore();
            }
          }

          if (state.lastMove && state.lastMove.x === x && state.lastMove.y === y && (state.lastMove.type === 'place' || state.lastMove.cardId === 'shadow_step')) {
            ctx.save();
            ctx.strokeStyle = '#ff5a70';
            ctx.lineWidth = 2.2;
            const m = radius * 0.34;
            ctx.strokeRect(px - m, py - m, m * 2, m * 2);
            ctx.restore();
          }
        }
      }
    }

    _drawTargetingPreview(state, targeting) {
      const ctx = this.ctx, radius = this.cellStep * 0.42;

      if (targeting.mode === 'detonate_confirm' && targeting.selectedFrom) {
        const { x: cx, y: cy } = targeting.selectedFrom;
        for (const { dx, dy } of ns.ORTHO_DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (!state.inBounds(nx, ny)) continue;
          const { px, py } = this._toPx(nx, ny);
          ctx.save(); ctx.fillStyle = 'rgba(224, 72, 92, 0.5)';
          ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }

      if (!this.hoverCell) return;
      const { x, y } = this.hoverCell, { px, py } = this._toPx(x, y);

      if (targeting.cardId === 'anchor' && !state.getStone(x, y)) {
        for (const { dx, dy } of ns.ALL_8_DIRS) {
          const nx = x + dx, ny = y + dy;
          if (!state.inBounds(nx, ny)) continue;
          const p = this._toPx(nx, ny);
          ctx.save(); ctx.fillStyle = 'rgba(224, 72, 92, 0.28)';
          ctx.beginPath(); ctx.arc(p.px, p.py, radius * 0.65, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }

      if (targeting.cardId === 'normal' && !state.getStone(x, y)) {
        for (const { dx, dy } of ns.ORTHO_DIRS) {
          const resX = x + dx * 2, resY = y + dy * 2, midX = x + dx, midY = y + dy;
          const res = state.getStone(resX, resY);
          if (res && res.color === state.currentTurn && res.ability === 'resonator' && !state.getStone(midX, midY)) {
            const oppX = resX + dx * 2, oppY = resY + dy * 2;
            if (state.inBounds(oppX, oppY) && !state.getStone(oppX, oppY) && !state.isBlocked(oppX, oppY)) {
              const p = this._toPx(oppX, oppY);
              ctx.save(); ctx.strokeStyle = '#ff6b7c'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
              ctx.beginPath(); ctx.arc(p.px, p.py, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            }
          }
        }
      }

      if (!state.getStone(x, y) && !state.isBlocked(x, y)) {
        ctx.save(); ctx.globalAlpha = 0.5;
        ctx.fillStyle = state.currentTurn === 'black' ? '#17111c' : '#fff5f7';
        ctx.strokeStyle = '#e0485c';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
  }

  ns.BoardRenderer = BoardRenderer;
})(window.SpiritGo);