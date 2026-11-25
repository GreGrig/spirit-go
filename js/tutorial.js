window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  const LESSONS = [
            {
      title: '1. Несокрушимый Монолит 🗿',
      setup(state) {
        state.hands.black = ['monolith'];
        state.hands.white = [];
        state.setStone(4, 4, { color: 'black', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(4, 3, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(3, 4, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(5, 4, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(3, 5, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(5, 5, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.addLog('🎓 Урок 1: Выживание Монолита при полном окружении.');
      },
      steps: [
        {
          type: 'dialogue',
          text: 'Привет! Я дракончик Игнис. В обычном Го, если враг закроет все пустые клетки вокруг связки камней — погибнет вся группа разом. Посмотрим, как это меняет «Монолит».',
          btnText: 'Попробовать ➔'
        },
        {
          type: 'player_place',
          cardId: 'monolith',
          x: 4,
          y: 5,
          label: 'Монолит сюда',
          text: 'Твой верхний камень зажат Белыми. Выбери «🗿 Монолит» в руке слева и прикрепи его снизу на клетку (5, 6).'
        },
        {
          type: 'bot_move',
          delay: 700,
          move: { type: 'place', x: 4, y: 6, cardId: 'normal' },
          text: 'Теперь мой ход! Я ставлю белый камень на (5, 7) и полностью замуровываю оба твоих камня в 0 дыханий!'
        },
        {
          type: 'dialogue',
          text: 'Смотри: обычный верхний камень погиб, но Монолит ВЫЖИЛ, потому что в момент удара касался союзника! Теперь клетка сверху пуста, и врагу придётся тратить ещё один ход, чтобы добить Монолит.',
          btnText: 'Следующий урок ➔',
          advanceLesson: true
        }
      ]
    },
    {
      title: '2. Призрачный узел 👻',
      setup(state) {
        state.hands.black = ['phantom_node'];
        state.hands.white = [];
        state.setStone(2, 4, { color: 'black', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(2, 3, { color: 'black', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(1, 4, { color: 'black', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(4, 3, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(5, 4, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(4, 5, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.addLog('🎓 Урок 2: Связь сквозь пустоту.');
      },
      steps: [
        {
          type: 'dialogue',
          text: 'Обычно камни соединяются только вплотную. Если оставить пустую клетку между ними, враг легко разрежет группу пополам.',
          btnText: 'Показать приём ➔'
        },
        {
          type: 'player_place',
          cardId: 'phantom_node',
          x: 4,
          y: 4,
          label: 'Призрачный узел',
          text: 'Выбери «👻 Призрачный узел» и поставь на клетку (5, 5) — через 1 пустой пункт от твоей группы слева.'
        },
        {
          type: 'bot_move',
          delay: 700,
          move: { type: 'place', x: 3, y: 4, cardId: 'normal' },
          text: 'Появился пунктирный канал связи! Теперь я вклинюсь прямо в пустую клетку между вашими камнями, чтобы попытаться съесть твой правый камень...'
        },
        {
          type: 'dialogue',
          text: 'Не вышло! Призрачный узел держит связь даже сквозь вражеский камень, поэтому он питается дыханиями твоей большой группы слева.',
          btnText: 'Следующий урок ➔',
          advanceLesson: true
        }
      ]
    },
    {
      title: '3. Ловушка: Споровый камень 🍄',
      setup(state) {
        state.hands.black = ['spore'];
        state.hands.white = [];
        state.setStone(4, 3, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(3, 4, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(5, 4, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(1, 1, { color: 'black', ability: 'normal', disguised: false, placedTurn: 0 });
        state.addLog('🎓 Урок 3: Скрытые ловушки.');
      },
      steps: [
        {
          type: 'dialogue',
          text: 'Карты с тегом [Ловушка] маскируются под обычные камни — соперник не видит их значок, пока не захватит!',
          btnText: 'Поставить ловушку ➔'
        },
        {
          type: 'player_place',
          cardId: 'spore',
          x: 4,
          y: 4,
          label: 'Споры сюда',
          text: 'Выбери «🍄 Споровый камень» и поставь в центр белого кольца на (5, 5) как приманку.'
        },
        {
          type: 'bot_move',
          delay: 700,
          move: { type: 'place', x: 4, y: 5, cardId: 'normal' },
          text: 'Хм, лёгкая добыча! Для меня он выглядит как обычный камень с 1 дыханием. Забираю его!'
        },
        {
          type: 'dialogue',
          text: 'БАБАХ! Споровый камень сработал при захвате и мгновенно уничтожил мой атакующий камень! Отличный способ сорвать атаку врага.',
          btnText: 'Следующий урок ➔',
          advanceLesson: true
        }
      ]
    },
    {
      title: '4. Теневой шаг 👣 и Детонатор 💣',
      setup(state) {
        state.hands.black = ['shadow_step'];
        state.hands.white = [];
        state.setStone(4, 4, { color: 'black', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(4, 3, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(3, 4, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(5, 4, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });

        state.setStone(2, 2, { color: 'black', ability: 'detonator', disguised: false, placedTurn: 0 });
        state.setStone(2, 1, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(1, 2, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.setStone(3, 2, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        state.addLog('🎓 Урок 4: Активные способности.');
      },
      steps: [
        {
          type: 'dialogue',
          text: 'Карты [Вместо хода] позволяют управлять уже стоящими камнями. Твой камень в центре (5, 5) в опасности — у него осталось 1 дыхание!',
          btnText: 'Спасти камень ➔'
        },
        {
          type: 'player_select_card',
          cardId: 'shadow_step',
          text: 'Сначала нажми на карту «👣 Теневой шаг» в своей руке слева.'
        },
        {
          type: 'player_board_click',
          x: 4,
          y: 4,
          expectMode: 'shadow_step_to',
          label: '1. Выбери камень',
          text: 'Теперь нажми на свой одиночный камень в центре доски на клетке (5, 5).'
        },
        {
          type: 'player_board_click',
          x: 4,
          y: 5,
          label: '2. Шагни сюда',
          text: 'Отлично! Нажми на свободную клетку снизу (5, 6), чтобы выскользнуть из окружения.'
        },
        {
          type: 'bot_move',
          delay: 650,
          move: { type: 'place', x: 2, y: 3, cardId: 'normal' },
          text: 'Ушёл! Тогда я окружу твой «💣 Детонатор» сверху на (3, 3)!'
        },
        {
          type: 'player_board_click',
          x: 2,
          y: 2,
          expectMode: 'detonate_confirm',
          label: 'Нажми Детонатор',
          text: 'Самое время для подрыва! Нажми на свой «💣 Детонатор» на клетке (3, 3), чтобы взвести его.'
        },
        {
          type: 'player_board_click',
          x: 2,
          y: 2,
          label: 'Подтверди взрыв!',
          text: 'Нажми на Детонатор ещё раз — он взорвётся и снесёт все 4 белых камня вокруг!'
        },
        {
          type: 'dialogue',
          text: 'Чистая работа! Детонатор очистил целый сектор от вражеских камней.',
          btnText: 'Следующий урок ➔',
          advanceLesson: true
        }
      ]
    },
    {
      title: '5. Резонатор 🔔 и Хроно-камень ⏳',
      setup(state) {
        state.hands.black = ['chrono_stone'];
        state.hands.white = [];
        state.setStone(4, 4, { color: 'black', ability: 'resonator', disguised: false, placedTurn: 0 });
        state.addLog('🎓 Урок 5: Резонанс и контроль времени.');
      },
      steps: [
        {
          type: 'dialogue',
          text: 'В центре стоит твой «🔔 Резонатор». Если поставить обычный камень ровно через 1 пустую клетку от него, с другой стороны появится бесплатный союзник!',
          btnText: 'Попробовать ➔'
        },
        {
          type: 'player_place',
          cardId: 'normal',
          x: 4,
          y: 2,
          label: 'Обычный камень',
          text: 'Оставь выбранным «Обычный камень» и поставь его на (5, 3) — через 1 пустую клетку над Резонатором.'
        },
        {
          type: 'bot_move',
          delay: 750,
          move: { type: 'place', x: 6, y: 4, cardId: 'normal' },
          text: 'Смотри, снизу на (5, 7) сам появился бесплатный камень! Теперь я поставлю белый камень справа на (7, 5).'
        },
        {
          type: 'player_place',
          cardId: 'chrono_stone',
          x: 5,
          y: 4,
          label: 'Хроно-камень',
          text: 'Выбери «⏳ Хроно-камень» и поставь на (6, 5) — на 1 ход он запретит мне ходить вплотную к себе по прямой.'
        },
        {
          type: 'bot_move',
          delay: 750,
          move: { type: 'place', x: 7, y: 4, cardId: 'normal' },
          text: 'Хотел закрыть тебе дыхание сверху от Хроно-камня, но время там застыло! Приходится отступать назад.'
        },
        {
          type: 'dialogue',
          text: 'Так Хроно-камень выигрывает тебе драгоценный темп в борьбе!',
          btnText: 'Финальный урок ➔',
          advanceLesson: true
        }
      ]
    },
    {
      title: '6. Алтарь 🏛️ и подсчёт очков',
      setup(state) {
        state.hands.black = ['altar'];
        state.hands.white = [];
        [[0,2],[1,2],[2,2],[2,1],[2,0]].forEach(([x, y]) => {
          state.setStone(x, y, { color: 'black', ability: 'normal', disguised: false, placedTurn: 0 });
        });
        [[6,6],[7,6],[6,7],[7,7]].forEach(([x, y]) => {
          state.setStone(x, y, { color: 'white', ability: 'normal', disguised: false, placedTurn: 0 });
        });
        state.addLog('🎓 Урок 6: Территория и Алтарь.');
      },
      steps: [
        {
          type: 'dialogue',
          text: 'В конце партии очки даются за живые камни и окружённые пустые клетки территории. Карта «🏛️ Алтарь» приносит +2 бонусных очка за каждую соседнюю пустую клетку вашей территории!',
          btnText: 'Поставить Алтарь ➔'
        },
        {
          type: 'player_place',
          cardId: 'altar',
          x: 1,
          y: 1,
          label: 'Алтарь в угол',
          text: 'Выбери «🏛️ Алтарь» и поставь на (2, 2) внутри своего угла — он будет касаться сразу двух пустых клеток территории (+4 очка!).'
        },
        {
          type: 'bot_move',
          delay: 650,
          move: { type: 'pass' },
          text: 'Отлично! Когда выгодных ходов больше нет, игроки нажимают «Пас». Я пасую первым.'
        },
        {
          type: 'player_pass',
          text: 'Теперь нажми кнопку «Пас» под доской, чтобы завершить партию и увидеть таблицу подсчёта очков с бонусом Алтаря!'
        }
      ]
    }
  ];

  class TutorialManager {
    constructor(app) {
      this.app = app;
      this.active = false;
      this.lessonIdx = 0;
      this.stepIdx = 0;
      this.botTimer = null;

      document.getElementById('btn-tut-action').addEventListener('click', () => this._onActionBtn());
      document.getElementById('btn-tut-exit').addEventListener('click', () => this.exitToMenu());
      document.getElementById('btn-tut-prev').addEventListener('click', () => {
        if (this.lessonIdx > 0) this.loadLesson(this.lessonIdx - 1);
      });
      document.getElementById('btn-tut-next-lesson').addEventListener('click', () => {
        if (this.lessonIdx < LESSONS.length - 1) this.loadLesson(this.lessonIdx + 1);
      });
    }

    start() {
      this.active = true;
      document.getElementById('tutorial-assistant').classList.remove('hidden');
      this.loadLesson(0);
    }

    stop() {
      this.active = false;
      clearTimeout(this.botTimer);
      document.getElementById('tutorial-assistant').classList.add('hidden');
    }

    exitToMenu() {
      this.stop();
      this.app.isTutorial = false;
      this.app._showScreen('screen-lobby');
    }

    loadLesson(index) {
      clearTimeout(this.botTimer);
      this.lessonIdx = index;
      this.stepIdx = 0;
      const lesson = LESSONS[index];

      this.app.state = new ns.GameState({
        size: 9,
        gameMode: 'tutorial',
        cardFormat: 'open',
        komi: 0.5,
        blackHand: [],
        whiteHand: []
      });
      lesson.setup(this.app.state);

      this.app.perspectiveColor = 'black';
      this.app.handController.resetToNormal();
      document.getElementById('game-mode-label').textContent = `Обучение • Урок ${index + 1}/${LESSONS.length}`;
      document.getElementById('online-role-badge').classList.add('hidden');
      document.getElementById('btn-undo').classList.add('hidden');
      document.getElementById('modal-scoring').classList.add('hidden');
      document.getElementById('hotseat-curtain').classList.add('hidden');

      this.app._showScreen('screen-game');
      this._enterStep(0);
    }

    _currentStep() {
      const lesson = LESSONS[this.lessonIdx];
      return lesson ? lesson.steps[this.stepIdx] || null : null;
    }

    _enterStep(idx) {
      this.stepIdx = idx;
      const lesson = LESSONS[this.lessonIdx];
      const step = this._currentStep();
      if (!step) return;

      document.getElementById('tutorial-lesson-badge').textContent = `Урок ${this.lessonIdx + 1} / ${LESSONS.length}`;
      document.getElementById('tutorial-lesson-title').textContent = lesson.title;
      document.getElementById('tutorial-speech-text').textContent = step.text;

      const avatar = document.getElementById('dragon-sprite');
      avatar.classList.remove('hop');
      void avatar.offsetWidth;
      avatar.classList.add('hop');

      const actionBtn = document.getElementById('btn-tut-action');
      if (step.type === 'dialogue') {
        actionBtn.classList.remove('hidden');
        actionBtn.textContent = step.btnText || 'Далее ➔';
      } else {
        actionBtn.classList.add('hidden');
      }

      this.app._refreshUI();

      if (step.type === 'bot_move') {
        this.botTimer = setTimeout(() => {
          if (!this.active) return;
          this.app._submitMove(step.move, false);
          this._enterStep(this.stepIdx + 1);
        }, step.delay || 700);
      }
    }

    _onActionBtn() {
      const step = this._currentStep();
      if (!step || step.type !== 'dialogue') return;

      if (step.advanceLesson) {
        if (this.lessonIdx < LESSONS.length - 1) {
          this.loadLesson(this.lessonIdx + 1);
        } else {
          this.exitToMenu();
        }
      } else {
        this._enterStep(this.stepIdx + 1);
      }
    }

    onCardSelectionChanged(targeting) {
      if (!this.active) return;
      const step = this._currentStep();
      if (!step) return;

      if (step.type === 'player_select_card' && targeting.cardId === step.cardId) {
        this._enterStep(this.stepIdx + 1);
        return;
      }

      if (step.type === 'player_board_click' && step.expectMode && targeting.mode === step.expectMode) {
        this._enterStep(this.stepIdx + 1);
        return;
      }

      if (targeting.cardId === 'normal' && targeting.mode === 'place') {
        const prevStep = LESSONS[this.lessonIdx] && LESSONS[this.lessonIdx].steps[this.stepIdx - 1];
        if (prevStep && prevStep.expectMode) {
          this._enterStep(this.stepIdx - 1);
        } else if (prevStep && prevStep.type === 'player_select_card') {
          this._enterStep(this.stepIdx - 1);
        }
      }
    }

    validateBoardClick(x, y, targeting) {
      const step = this._currentStep();
      if (!step) return false;

      if (step.type === 'player_place') {
        if (targeting.cardId !== step.cardId) {
          this._nudge(`Сначала выбери нужную карту в руке слева!`);
          return false;
        }
        if (x !== step.x || y !== step.y) {
          this._nudge(`Поставь камень на подсвеченную клетку (${step.x + 1}, ${step.y + 1}).`);
          return false;
        }
        return true;
      }

      if (step.type === 'player_board_click') {
        if (x !== step.x || y !== step.y) {
          this._nudge(`Нажми на подсвеченную клетку (${step.x + 1}, ${step.y + 1}).`);
          return false;
        }
        return true;
      }

      this._nudge('Сначала нажми кнопку в облачке дракончика или дождись его хода.');
      return false;
    }

    canPass() {
      const step = this._currentStep();
      if (step && step.type === 'player_pass') return true;
      this._nudge('Сейчас пасовать не нужно — следуй подсказке Игниса!');
      return false;
    }

    onMoveExecuted(move) {
      if (!this.active) return;
      const step = this._currentStep();
      if (!step) return;

      if (step.type === 'player_place' || step.type === 'player_board_click') {
        this._enterStep(this.stepIdx + 1);
      } else if (step.type === 'player_pass' && move.type === 'pass') {
        document.getElementById('tutorial-speech-text').textContent =
          'Поздравляю! Ты прошёл все уроки Spirit Go. Теперь ты готов к настоящим партиям!';
      }
    }

    getBoardHighlight() {
      if (!this.active) return null;
      const step = this._currentStep();
      if (!step) return null;
      if (step.type === 'player_place' || step.type === 'player_board_click') {
        return { x: step.x, y: step.y, label: step.label || '' };
      }
      return null;
    }

    getHighlightedCardId() {
      if (!this.active) return null;
      const step = this._currentStep();
      if (!step) return null;
      if (step.type === 'player_place' || step.type === 'player_select_card') {
        return step.cardId !== 'normal' ? step.cardId : null;
      }
      return null;
    }

    _nudge(msg) {
      this.app.sound.playError();
      document.getElementById('tutorial-speech-text').textContent = msg;
      const avatar = document.getElementById('dragon-sprite');
      avatar.classList.remove('hop');
      void avatar.offsetWidth;
      avatar.classList.add('hop');
    }
  }

  ns.TutorialManager = TutorialManager;
})(window.SpiritGo);