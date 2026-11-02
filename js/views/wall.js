// Князев Wall: отправка сообщения в Cloudflare Worker — он пересылает его модератору в Telegram.
// Адрес Worker'а выдаёт `wrangler deploy`; менять его нужно только при переезде бота.
const WALL_API = 'https://knyazev-wall.lev20112010.workers.dev/submit';
const WALL_COST = 100;        // КК за одну отправку
const WALL_COOLDOWN = 60000;  // пауза между сообщениями с одного браузера, мс
(() => {
  const f = document.getElementById('wallForm');
  if (!f) return;
  const t = document.getElementById('wallText');
  const c = document.getElementById('wallCnt');
  const m = document.getElementById('wallMsg');
  const b = document.getElementById('wallBtn');
  const idleLabel = b.textContent;

  const say = (text, kind) => { m.className = kind || ''; m.textContent = text; };

  t.addEventListener('input', () => { c.textContent = t.value.length + ' / 1000'; });

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const text = t.value.trim();
    if (!text) { say('Напиши сообщение', 'err'); t.focus(); return; }

    const left = WALL_COOLDOWN - (Date.now() - (+localStorage.wallLast || 0));
    if (left > 0) {
      say(`Подожди ещё ${Math.ceil(left / 1000)} с перед следующим сообщением`, 'err');
      return;
    }
    // Цена списывается в браузере; модератор всё равно проверяет каждое сообщение вручную.
    if (!window.KD || !KD.spend(WALL_COST)) {
      say(`Не хватает КК: отправка стоит ${WALL_COST} КК`, 'err');
      return;
    }

    b.disabled = true;
    b.textContent = 'Отправляем…';
    say('Отправляем на модерацию…');
    try {
      const r = await fetch(WALL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          name: document.getElementById('wallName').value.trim(),
          website: document.getElementById('wallHp').value
        })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      localStorage.wallLast = Date.now();
      t.value = '';
      c.textContent = '0 / 1000';
      say('Отправлено на модерацию ✓ Сообщение появится в канале после одобрения.', 'ok');
    } catch (_) {
      // Отправка не удалась — возвращаем КК на баланс.
      if (window.KD) KD.refund(WALL_COST);
      say('Не получилось отправить, попробуй позже. КК вернулись на баланс.', 'err');
    } finally {
      b.disabled = false;
      b.textContent = idleLabel;
    }
  });
})();

// Подсказка про бота на сайте: показываем один раз, пока её не закроют.
(() => {
  const b = document.getElementById('botBanner');
  if (!b) return;
  let seen = false;
  try { seen = !!localStorage.getItem('kd-bot-hint'); } catch (_) { /* без localStorage показываем */ }
  if (seen) return;
  b.hidden = false;
  const c = document.getElementById('botBannerClose');
  if (c) c.addEventListener('click', () => {
    b.hidden = true;
    try { localStorage.setItem('kd-bot-hint', '1'); } catch (_) { /* ignore */ }
  });
})();
