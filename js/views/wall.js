// Адрес API и публичный site key Turnstile.
// После деплоя замените оба плейсхолдера на реальные значения.
const WALL_API_BASE = 'https://knyazev-wall.lev20112010.workers.dev';
const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

(function () {
  'use strict';

  const PAGE_SIZE = 50;
  const MAX_PAGES = 10;
  const POLL_INTERVAL = 20000;
  const MAX_TEXT = 1000;
  const MAX_AUTHOR = 50;
  const VISITED_KEY = 'kd-wall-visited';
  const TURNSTILE_ACTION = 'wall_post';
  const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

  const API_BASE = String(WALL_API_BASE).replace(/\/+$/, '');
  const API_CONFIGURED = /^https?:\/\//i.test(API_BASE) && !/REPLACE_WITH/i.test(API_BASE);
  const TURNSTILE_CONFIGURED = !/REPLACE_WITH/i.test(String(TURNSTILE_SITE_KEY));

  const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
  });
  const TIME_FMT = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  });
  const YEAR_FMT = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
  });

  const state = {
    active: false,
    started: false,
    refreshing: false,
    loadingMore: false,
    messages: [],
    pagesLoaded: 1,
    hasMore: false,
    pollTimer: null,
    turnstileWidgetId: null,
    turnstileToken: null,
    turnstileReady: false,
    turnstileFailed: false,
    submitBusy: false,
    visitedFallback: false,
  };

  const el = {
    section: document.getElementById('t6'),
    banner: document.getElementById('wallBanner'),
    form: document.getElementById('wallForm'),
    author: document.getElementById('wallAuthor'),
    authorHint: document.getElementById('wallAuthorHint'),
    text: document.getElementById('wallText'),
    counter: document.getElementById('wallCounter'),
    status: document.getElementById('wallFormStatus'),
    submit: document.getElementById('wallSubmit'),
    turnstile: document.getElementById('wallTurnstile'),
    feed: document.getElementById('wallFeed'),
    feedStatus: document.getElementById('wallFeedStatus'),
    more: document.getElementById('wallMore'),
  };

  function pluralRu(n, one, few, many) {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
    return many;
  }

  function codePoints(value) {
    return Array.from(value).length;
  }

  function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    const controller = new AbortController();
    window.setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }

  function formatDate(timestampSeconds) {
    const date = new Date(timestampSeconds * 1000);
    try {
      const datePart = DATE_FMT.format(date);
      const timePart = TIME_FMT.format(date);
      const year = YEAR_FMT.format(date);
      const currentYear = YEAR_FMT.format(new Date());
      return `${datePart}${year !== currentYear ? ` ${year}` : ''}, ${timePart}`;
    } catch {
      return date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    }
  }

  function wallVisited() {
    if (state.visitedFallback) return true;
    try {
      return window.localStorage.getItem(VISITED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function markWallVisited() {
    state.visitedFallback = true;
    try {
      window.localStorage.setItem(VISITED_KEY, '1');
    } catch {
      /* приватный режим: баннер скроется до перезагрузки */
    }
    updateBanner();
  }

  function updateBanner() {
    if (!el.banner) return;
    el.banner.hidden = wallVisited();
  }

  function setFormStatus(message, kind) {
    if (!el.status) return;
    el.status.textContent = message || '';
    el.status.className = 'wall-status' + (kind ? ` wall-status-${kind}` : '');
    el.status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  }

  function clearSuccessStatus() {
    if (el.status && el.status.classList.contains('wall-status-success')) {
      setFormStatus('', '');
    }
  }

  function setFeedStatus(message, kind) {
    if (!el.feedStatus) return;
    el.feedStatus.textContent = message || '';
    el.feedStatus.className = 'wall-feed-status' + (kind ? ` wall-feed-status-${kind}` : '');
  }

  function updateCounter() {
    if (!el.text || !el.counter) return;
    const remaining = MAX_TEXT - codePoints(el.text.value);
    el.counter.textContent = String(remaining);
    el.counter.classList.toggle('is-over', remaining < 0);
    el.counter.classList.toggle('is-low', remaining >= 0 && remaining <= 100);
  }

  function updateSubmitState() {
    if (!el.submit) return;
    const text = el.text ? el.text.value : '';
    const author = el.author ? el.author.value : '';
    const authorLength = codePoints(author);
    const canSubmit = API_CONFIGURED
      && TURNSTILE_CONFIGURED
      && !state.submitBusy
      && !state.turnstileFailed
      && Boolean(state.turnstileToken)
      && text.trim().length > 0
      && codePoints(text) <= MAX_TEXT
      && authorLength <= MAX_AUTHOR;
    el.submit.disabled = !canSubmit;

    if (el.authorHint) {
      const tooLong = authorLength > MAX_AUTHOR;
      el.authorHint.textContent = tooLong
        ? 'Имя длиннее 50 символов.'
        : 'До 50 символов. Если не указывать — будет «Аноним».';
      el.authorHint.classList.toggle('is-error', tooLong);
    }
  }

  function resetTurnstile() {
    state.turnstileToken = null;
    if (
      state.turnstileWidgetId !== null
      && window.turnstile
      && typeof window.turnstile.reset === 'function'
    ) {
      try {
        window.turnstile.reset(state.turnstileWidgetId);
      } catch {
        /* виджет мог быть удалён */
      }
    }
    updateSubmitState();
  }

  let turnstileScriptPromise = null;

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstileScriptPromise) return turnstileScriptPromise;

    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('turnstile_script_failed'));
      document.head.appendChild(script);
    }).catch(error => {
      state.turnstileFailed = true;
      throw error;
    });

    return turnstileScriptPromise;
  }

  async function renderTurnstile() {
    if (!TURNSTILE_CONFIGURED || state.turnstileWidgetId !== null || !el.turnstile) return;

    try {
      await loadTurnstile();
      if (!window.turnstile || typeof window.turnstile.render !== 'function') {
        throw new Error('turnstile_unavailable');
      }

      state.turnstileWidgetId = window.turnstile.render(el.turnstile, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        language: 'ru',
        size: 'flexible',
        action: TURNSTILE_ACTION,
        callback: token => {
          state.turnstileToken = token;
          // Не стираем успешное уведомление: reset() после отправки снова
          // вызывает callback. Убираем только старую ошибку капчи.
          if (el.status && el.status.classList.contains('wall-status-error')) {
            setFormStatus('', '');
          }
          updateSubmitState();
        },
        'expired-callback': () => {
          state.turnstileToken = null;
          updateSubmitState();
          setFormStatus('Проверка истекла. Пройдите её снова.', 'error');
        },
        'error-callback': () => {
          state.turnstileToken = null;
          updateSubmitState();
          setFormStatus('Не удалось пройти проверку. Обновите страницу и попробуйте снова.', 'error');
        },
      });
      state.turnstileReady = true;
      updateSubmitState();
    } catch {
      state.turnstileFailed = true;
      setFormStatus('Не удалось загрузить проверку Cloudflare. Обновите страницу.', 'error');
      updateSubmitState();
    }
  }

  function normalizeMessage(item) {
    if (!item || typeof item !== 'object') return null;
    const id = Number(item.id);
    const createdAt = Number(item.created_at);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(createdAt)) return null;

    const author = typeof item.author === 'string' && item.author.trim()
      ? item.author
      : 'Аноним';
    const text = typeof item.text === 'string' ? item.text : '';
    if (!text) return null;

    return { id, author, text, created_at: createdAt };
  }

  async function fetchPage(before, signal) {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    if (before !== null) params.set('before', String(before));

    const response = await fetch(`${API_BASE}/api/messages?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) throw new Error(`http_${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('bad_response');

    const messages = [];
    for (const item of data) {
      const message = normalizeMessage(item);
      if (message) messages.push(message);
    }
    return messages;
  }

  function createEmpty(text) {
    const empty = document.createElement('p');
    empty.className = 'wall-empty';
    empty.textContent = text;
    return empty;
  }

  function renderMessage(message) {
    const article = document.createElement('article');
    article.className = 'wall-post';

    const head = document.createElement('div');
    head.className = 'wall-post-head';

    const author = document.createElement('span');
    author.className = 'wall-author';
    author.textContent = message.author || 'Аноним';

    const time = document.createElement('time');
    time.className = 'wall-date';
    try {
      time.setAttribute('datetime', new Date(message.created_at * 1000).toISOString());
    } catch {
      time.setAttribute('datetime', '');
    }
    time.textContent = formatDate(message.created_at);

    head.append(author, time);

    const text = document.createElement('p');
    text.className = 'wall-text';
    text.textContent = message.text;

    article.append(head, text);
    return article;
  }

  function updateMoreButton() {
    if (!el.more) return;
    el.more.hidden = !state.hasMore || state.messages.length === 0 || state.pagesLoaded >= MAX_PAGES;
  }

  function renderFeed() {
    if (!el.feed) return;
    const scrollY = window.scrollY;
    const fragment = document.createDocumentFragment();

    if (state.messages.length === 0) {
      fragment.appendChild(createEmpty('Пока никто ничего не написал'));
    } else {
      for (const message of state.messages) {
        fragment.appendChild(renderMessage(message));
      }
    }

    el.feed.replaceChildren(fragment);
    el.feed.setAttribute('aria-busy', 'false');
    updateMoreButton();
    window.scrollTo(0, scrollY);
  }

  function renderFeedError(message, retry) {
    if (!el.feed) return;
    const box = document.createElement('div');
    box.className = 'wall-feed-error';

    const text = document.createElement('p');
    text.textContent = message;
    box.appendChild(text);

    if (retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'b g';
      button.textContent = 'Повторить';
      button.addEventListener('click', () => refreshFeed(true));
      box.appendChild(button);
    }

    el.feed.replaceChildren(box);
    el.feed.setAttribute('aria-busy', 'false');
    setFeedStatus('', '');
  }

  async function refreshFeed(showLoading) {
    if (!API_CONFIGURED) {
      renderFeedError('Стена ещё не настроена: укажите адрес API.', false);
      return;
    }
    if (state.refreshing || state.loadingMore) return;

    state.refreshing = true;
    if (showLoading && el.feed) {
      el.feed.setAttribute('aria-busy', 'true');
      el.feed.replaceChildren(createEmpty('Загружаем стену…'));
      setFeedStatus('', '');
    }

    const pagesToLoad = Math.max(1, Math.min(state.pagesLoaded, MAX_PAGES));

    try {
      let before = null;
      let collected = [];
      let hasMore = false;

      for (let page = 0; page < pagesToLoad; page += 1) {
        const batch = await fetchPage(before, timeoutSignal(15000));
        collected = collected.concat(batch);

        if (batch.length < PAGE_SIZE) {
          hasMore = false;
          break;
        }

        hasMore = true;
        const last = batch[batch.length - 1];
        if (!last) {
          hasMore = false;
          break;
        }
        before = last.id;
      }

      const seen = new Set();
      state.messages = collected.filter(message => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
      });
      state.pagesLoaded = Math.max(1, Math.ceil(state.messages.length / PAGE_SIZE));
      state.hasMore = hasMore && state.pagesLoaded < MAX_PAGES;

      renderFeed();
      setFeedStatus('', '');
    } catch {
      if (state.messages.length === 0) {
        renderFeedError('Не удалось загрузить стену. Проверьте соединение и попробуйте ещё раз.', true);
      } else {
        setFeedStatus('Не удалось обновить стену. Показываем последние загруженные сообщения.', 'error');
      }
    } finally {
      state.refreshing = false;
      if (el.feed) el.feed.setAttribute('aria-busy', 'false');
    }
  }

  async function loadMore() {
    if (state.loadingMore || state.refreshing || !state.hasMore || state.pagesLoaded >= MAX_PAGES) return;
    const last = state.messages[state.messages.length - 1];
    if (!last) return;

    state.loadingMore = true;
    if (el.more) {
      el.more.disabled = true;
      el.more.textContent = 'Загружаем…';
    }

    try {
      const batch = await fetchPage(last.id, timeoutSignal(15000));

      if (batch.length === 0) {
        state.hasMore = false;
      } else {
        const seen = new Set(state.messages.map(message => message.id));
        const added = batch.filter(message => !seen.has(message.id));
        state.messages = state.messages.concat(added);
        state.pagesLoaded = Math.max(1, Math.ceil(state.messages.length / PAGE_SIZE));
        state.hasMore = added.length > 0 && batch.length === PAGE_SIZE && state.pagesLoaded < MAX_PAGES;
      }

      renderFeed();
      setFeedStatus('', '');
    } catch {
      setFeedStatus('Не удалось загрузить ещё сообщения. Попробуйте позже.', 'error');
    } finally {
      state.loadingMore = false;
      if (el.more) {
        el.more.disabled = false;
        el.more.textContent = 'Показать ещё';
      }
      updateMoreButton();
    }
  }

  function messageForError(code, status) {
    switch (code) {
      case 'invalid_author':
        return 'Имя длиннее 50 символов.';
      case 'invalid_text':
        return 'Сообщение должно быть от 1 до 1000 символов.';
      case 'turnstile_failed':
        return 'Проверка «я не робот» не пройдена. Попробуйте ещё раз.';
      case 'turnstile_unavailable':
        return 'Проверка временно недоступна. Попробуйте через минуту.';
      case 'body_too_large':
        return 'Сообщение слишком длинное.';
      case 'unsupported_media_type':
        return 'Не удалось отправить сообщение. Обновите страницу.';
      case 'rate_limited':
        return 'Слишком часто. Попробуйте позже.';
      case 'server_error':
        return 'Не удалось отправить сообщение. Попробуйте позже.';
      default:
        return status >= 500
          ? 'Не удалось отправить сообщение. Попробуйте позже.'
          : 'Не удалось отправить сообщение. Проверьте данные и попробуйте ещё раз.';
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (state.submitBusy) return;

    if (!API_CONFIGURED || !TURNSTILE_CONFIGURED) {
      setFormStatus('Стена ещё не настроена: укажите адрес API и site key Turnstile.', 'error');
      return;
    }

    const author = el.author ? el.author.value.trim() : '';
    const text = el.text ? el.text.value : '';

    if (text.trim().length === 0) {
      setFormStatus('Напишите сообщение.', 'error');
      if (el.text) el.text.focus();
      return;
    }
    if (codePoints(text) > MAX_TEXT) {
      setFormStatus('Сообщение длиннее 1000 символов.', 'error');
      if (el.text) el.text.focus();
      return;
    }
    if (codePoints(author) > MAX_AUTHOR) {
      setFormStatus('Имя длиннее 50 символов.', 'error');
      if (el.author) el.author.focus();
      return;
    }
    if (!state.turnstileToken) {
      setFormStatus('Подтвердите, что вы не робот.', 'error');
      return;
    }

    const token = state.turnstileToken;
    state.submitBusy = true;
    if (el.submit) el.submit.textContent = 'Отправляем…';
    updateSubmitState();
    setFormStatus('', '');

    try {
      const response = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, text, turnstileToken: token }),
        signal: timeoutSignal(15000),
      });

      let body = null;
      try {
        body = await response.json();
      } catch {
        /* тело может быть пустым */
      }

      if (response.status === 201 && body && body.ok === true) {
        const success = 'Спасибо! Сообщение отправлено на проверку и появится на стене после одобрения';
        setFormStatus(success, 'success');
        if (typeof toast === 'function') toast(success);

        if (el.text) {
          el.text.value = '';
          el.text.focus();
        }
        updateCounter();
        resetTurnstile();
        updateSubmitState();
        return;
      }

      if (response.status === 429) {
        const retry = Number(
          response.headers.get('Retry-After') || (body && body.retry_after) || 0,
        );
        const seconds = Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : 0;
        setFormStatus(
          seconds
            ? `Слишком часто. Повторите через ${seconds} ${pluralRu(seconds, 'секунду', 'секунды', 'секунд')}.`
            : 'Слишком часто. Попробуйте позже.',
          'error',
        );
        resetTurnstile();
        return;
      }

      const code = body && typeof body.error === 'string' ? body.error : '';
      setFormStatus(messageForError(code, response.status), 'error');
      resetTurnstile();
    } catch {
      setFormStatus(
        'Не удалось отправить сообщение. Проверьте соединение и попробуйте ещё раз.',
        'error',
      );
      resetTurnstile();
    } finally {
      state.submitBusy = false;
      if (el.submit) el.submit.textContent = 'Отправить';
      updateSubmitState();
    }
  }

  function startPolling() {
    stopPolling();
    if (!state.active || document.hidden || !API_CONFIGURED) return;

    state.pollTimer = window.setInterval(() => {
      if (!state.active || document.hidden) return;
      refreshFeed(false);
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (state.pollTimer !== null) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function handleVisibility() {
    if (!state.active) return;
    if (document.hidden) {
      stopPolling();
      return;
    }
    startPolling();
    refreshFeed(false);
  }

  function setActive(active) {
    const next = Boolean(active);

    if (state.active === next) {
      if (next && state.started && !document.hidden) {
        startPolling();
        refreshFeed(false);
      }
      return;
    }

    state.active = next;
    if (!next) {
      stopPolling();
      return;
    }

    markWallVisited();

    if (!state.started) {
      state.started = true;
      if (API_CONFIGURED) refreshFeed(true);
    } else if (API_CONFIGURED && !document.hidden) {
      refreshFeed(false);
    }

    if (TURNSTILE_CONFIGURED) renderTurnstile();
    startPolling();
  }

  function init() {
    updateBanner();
    updateCounter();
    updateSubmitState();

    if (!API_CONFIGURED) {
      setFormStatus('Стена ещё не настроена: укажите адрес API.', 'error');
      renderFeedError('Стена ещё не настроена.', false);
    } else if (!TURNSTILE_CONFIGURED) {
      setFormStatus('Стена ещё не настроена: укажите site key Turnstile.', 'error');
    }

    if (el.form) el.form.addEventListener('submit', onSubmit);
    if (el.text) {
      el.text.addEventListener('input', () => {
        clearSuccessStatus();
        updateCounter();
        updateSubmitState();
      });
    }
    if (el.author) {
      el.author.addEventListener('input', () => {
        clearSuccessStatus();
        updateSubmitState();
      });
    }
    if (el.more) el.more.addEventListener('click', loadMore);
    if (el.banner) {
      el.banner.addEventListener('click', () => {
        // go() объявлен в main.js как const и не попадает в window.
        // Клик по пятой кнопке навигации — тот же путь, что и обычный переход.
        const wallNavButton = document.querySelectorAll('#nv button')[4];
        if (wallNavButton) wallNavButton.click();
      });
    }

    document.addEventListener('visibilitychange', handleVisibility);

    window.KDWall = {
      setActive,
      updateBanner,
      refresh: () => refreshFeed(false),
    };
  }

  init();
})();
