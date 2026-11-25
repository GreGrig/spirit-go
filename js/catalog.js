window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  const CARD_CATALOG = [
    {
      id: 'monolith', name: 'Монолит', icon: '🗿', trigger: 'passive', triggerLabel: '[Постоянный]',
      limit: 2, disguised: false, color: '#64748b',
      description: 'Не может быть захвачен при 0 дыханий, пока вплотную к нему (по прямой) стоит хотя бы один живой союзный камень.'
    },
    {
      id: 'phantom_node', name: 'Призрачный узел', icon: '👻', trigger: 'passive', triggerLabel: '[Постоянный]',
      limit: 2, disguised: false, color: '#38bdf8',
      description: 'Считается соединённым с вашими камнями через 1 пустую клетку по прямой. (Если враг поставит камень в этот промежуток, ваша группа всё равно не разорвётся).'
    },
    {
      id: 'diagonal_node', name: 'Диагональный узел', icon: '💠', trigger: 'passive', triggerLabel: '[Постоянный]',
      limit: 2, disguised: false, color: '#818cf8',
      description: 'Соединяется с вашими камнями не только по прямой, но и по диагонали. (Превращает диагональную цепочку в единую неразрывную стену).'
    },
    {
      id: 'chameleon', name: 'Хамелеон', icon: '🦎', trigger: 'passive', triggerLabel: '[Постоянный]',
      limit: 2, disguised: false, color: '#34d399',
      description: 'В ваш ход работает как обычный камень. В ход соперника становится призрачным: его нельзя захватить, но он временно перестаёт соединять ваши группы.'
    },
    {
      id: 'resonator', name: 'Резонатор', icon: '🔔', trigger: 'passive', triggerLabel: '[Постоянный]',
      limit: 1, disguised: false, color: '#fbbf24',
      description: 'Когда вы ставите обычный камень ровно через 1 пустую клетку по прямой от Резонатора, с его противоположной стороны (тоже через 1 клетку) автоматически появляется ваш бесплатный обычный камень, если клетка свободна.'
    },
    {
      id: 'leech', name: 'Пиявка', icon: '🩸', trigger: 'passive', triggerLabel: '[Постоянный]',
      limit: 2, disguised: false, color: '#f43f5e',
      description: 'Пока стоит вплотную по прямой к вражеской группе, отнимает у неё 1 дыхание и прибавляет +1 дыхание вашей группе.'
    },
    {
      id: 'anchor', name: 'Якорь', icon: '⚓', trigger: 'passive', triggerLabel: '[Постоянный]',
      limit: 2, disguised: false, color: '#0ea5e9',
      description: 'Отнимает 1 дыхание у всех вражеских групп вокруг себя (включая диагонали). Ограничение: нельзя ставить в клетку, где у Якоря будет меньше 2 дыханий.'
    },
    {
      id: 'symbiont', name: 'Симбионт', icon: '🧬', trigger: 'passive', triggerLabel: '[Постоянный]',
      limit: 2, disguised: false, color: '#10b981',
      description: 'Даёт +3 дыхания группе, к которой присоединён. Уязвимость: враг может захватить этот камень отдельно от всей группы, если закроет только его собственные пустые клетки по прямой.'
    },
    {
      id: 'spore', name: 'Споровый камень', icon: '🍄', trigger: 'trap', triggerLabel: '[Ловушка]',
      limit: 2, disguised: true, color: '#a3e635',
      description: 'Выглядит как обычный камень. Срабатывает при захвате: если враг снимает этот камень с доски, вражеский камень, нанёсший последний удар, тоже уничтожается.'
    },
    {
      id: 'defiler', name: 'Осквернитель', icon: '☠️', trigger: 'trap', triggerLabel: '[Ловушка]',
      limit: 1, disguised: true, color: '#a855f7',
      description: 'Выглядит как обычный камень. Срабатывает при захвате: клетка под этим камнем навсегда блокируется — на неё больше нельзя ходить, и она не даёт очков территории в конце игры.'
    },
    {
      id: 'shadow_step', name: 'Теневой шаг', icon: '👣', trigger: 'action', triggerLabel: '[Вместо хода]',
      limit: 2, disguised: false, color: '#6366f1',
      description: 'Вместо выставления нового камня выберите свой одиночный камень, а затем любую свободную соседнюю клетку по прямой, чтобы передвинуть его.'
    },
    {
      id: 'detonator', name: 'Детонатор', icon: '💣', trigger: 'action', triggerLabel: '[При выставлении / Вместо хода]',
      limit: 1, disguised: false, color: '#ef4444',
      description: 'Выставляется на доску как камень-мина. В любой свой последующий ход нажмите на свой Детонатор на доске (вместо выставления камня): он взорвётся, убрав себя и все камни на 4 соседних клетках по прямой.'
    },
    {
      id: 'ko_seal', name: 'Печать Ко', icon: '🚫', trigger: 'action', triggerLabel: '[Вместо хода]',
      limit: 2, disguised: false, color: '#f97316',
      description: 'Выберите любую пустую клетку — на неё запрещено ставить камни следующие 2 хода (1 ход врага и 1 ваш ход).'
    },
    {
      id: 'chrono_stone', name: 'Хроно-камень', icon: '⏳', trigger: 'on_place', triggerLabel: '[При выставлении]',
      limit: 2, disguised: false, color: '#14b8a6',
      description: 'В свой следующий ход соперник не может ставить камни вплотную к этому камню по прямой.'
    },
    {
      id: 'catalyst', name: 'Катализатор', icon: '⚡', trigger: 'trap', triggerLabel: '[Ловушка]',
      limit: 1, disguised: true, color: '#eab308',
      description: 'Выглядит как обычный камень. Если соперник захватит его, в свой следующий раунд вы сделаете 2 хода подряд.'
    },
    {
      id: 'ko_mirror', name: 'Зеркало Ко', icon: '🪞', trigger: 'on_place', triggerLabel: '[При выставлении]',
      limit: 1, disguised: false, color: '#ec4899',
      description: 'Позволяет сразу походить в клетку, заблокированную правилом Ко, без поиска угрозы. После выставления становится обычным камнем.'
    },
    {
      id: 'mirage', name: 'Мираж', icon: '🌫️', trigger: 'trap', triggerLabel: '[Ловушка]',
      limit: 2, disguised: true, color: '#94a3b8',
      description: 'Для врага выглядит как обычный камень. Как только у него остаётся 1 дыхание (атари), Мираж исчезает с доски, а карта возвращается вам в руку.'
    },
    {
      id: 'altar', name: 'Алтарь', icon: '🏛️', trigger: 'endgame', triggerLabel: '[Конец игры]',
      limit: 2, disguised: false, color: '#d97706',
      description: 'В конце партии приносит +2 дополнительных очка за каждую пустую клетку вашей территории, примыкающую к Алтарю по прямой.'
    }
  ];

  const CARD_MAP = {};
  CARD_CATALOG.forEach((c) => { CARD_MAP[c.id] = c; });

  ns.CardCatalog = {
    ALL: CARD_CATALOG,
    getById(id) { return CARD_MAP[id] || null; },
    generateRandomPool(count = 5) {
      const pool = [];
      const counts = {};
      while (pool.length < count) {
        const candidate = CARD_CATALOG[Math.floor(Math.random() * CARD_CATALOG.length)];
        const used = counts[candidate.id] || 0;
        if (used < candidate.limit) {
          counts[candidate.id] = used + 1;
          pool.push(candidate.id);
        }
      }
      return pool;
    }
  };
})(window.SpiritGo);