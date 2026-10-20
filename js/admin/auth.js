// Князев Admin: панель аналитики открывается после 5 нажатий подряд на надпись в футере.
let VS = null, VE = 0, VL = false, VT = null;
let visitsRequest = 0;
// В коде хранится только SHA-256 пароля; введённый пароль хешируется и сравнивается с ним.
const RESET_HASH = '85c822b8a31f204488c1bc2fab26206998480aad842f70aecf97845950f1f1a3';
const ADMIN_TAPS = 5, ADMIN_TAP_WINDOW = 1500;
let adminTaps = 0, adminTapTimer = null, resetBusy = false;
const vbox = () => {
  const n = key => VS ? Number(VS[key]).toLocaleString('ru-RU') : '…';
  const updated = VT ? `<p class="m vs-time">Обновлено в ${VT.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>` : '';
  return `<div class="vs" aria-busy="${VL}"><div><b>${n('w')}</b><span>пожелало здоровья гуру</span></div><div><b>${n('g')}</b><span>проанализировало лицо Mogg</span></div><div><b>${n('d')}</b><span>за сегодня</span></div><div><b>${n('m')}</b><span>за этот месяц</span></div><div><b>${n('a')}</b><span>за всё время</span></div></div>${VE ? '<p class="m vs-error" role="alert">Не удалось получить данные счётчика. Попробуйте обновить через несколько секунд.</p>' : updated}`;
};
function renderVisits() {
  const box = $('#vs');
  if (box) box.innerHTML = vbox();
  const refresh = $('#vr');
  if (refresh) {
    refresh.disabled = VL;
    refresh.textContent = VL ? 'Обновляется…' : 'Обновить';
  }
}
async function loadVisits() {
  // Повторное нажатие во время загрузки не создаёт лишних запросов (у счётчика лимит на IP).
  if (VL) return;
  const request = ++visitsRequest;
  VL = true;
  VE = 0;
  renderVisits();
  try {
    const stats = await visitStats();
    if (request !== visitsRequest) return;
    VS = stats;
    VT = new Date();
  } catch (e) {
    if (request !== visitsRequest) return;
    VE = 1;
  } finally {
    if (request === visitsRequest) {
      VL = false;
      renderVisits();
    }
  }
}
async function sha256Hex(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function showResetForm() {
  const box = $('#rsx');
  if (!box) return;
  box.innerHTML = `<form class="reset-form" id="rsf" autocomplete="off"><label for="rsp">Пароль для сброса счётчиков</label><div class="row"><input id="rsp" type="password" required autocomplete="current-password" aria-describedby="rsm" /><button class="b primary" id="rsok" type="submit">Сбросить</button><button class="b g" id="rscancel" type="button">Отмена</button></div><p class="m reset-msg" id="rsm" role="alert"></p></form>`;
  $('#rsp').focus();
}
function hideResetForm() {
  const box = $('#rsx');
  if (box) box.innerHTML = '';
}
async function submitReset(e) {
  e.preventDefault();
  if (resetBusy) return;
  const input = $('#rsp'), msg = $('#rsm'), ok = $('#rsok');
  if (!input) return;
  if (!(window.crypto && crypto.subtle)) { msg.textContent = 'Браузер не поддерживает проверку пароля (нужен HTTPS).'; return; }
  resetBusy = true;
  ok.disabled = true;
  try {
    if (await sha256Hex(input.value) !== RESET_HASH) {
      msg.textContent = 'Неверный пароль';
      input.select();
      return;
    }
    msg.textContent = 'Сбрасываем…';
    await resetAllCounters();
    hideResetForm();
    toast('Все счётчики сброшены до нуля');
    loadVisits();
  } catch (err) {
    console.warn('Сброс счётчиков не удался', err);
    msg.textContent = 'Не удалось сбросить счётчики. Попробуйте ещё раз через несколько секунд.';
  } finally {
    resetBusy = false;
    if ($('#rsok')) $('#rsok').disabled = false;
  }
}
function admin() {
  $('#dg').innerHTML = `<div class="admin-head"><div><h2>Князев Admin <span class="m">· ФМШ 2007</span></h2><h2>Заходы на сайт <span class="m">· все пользователи</span></h2></div><button class="admin-close" id="cl" type="button" aria-label="Закрыть" title="Закрыть">×</button></div><div id="vs" aria-live="polite">${vbox()}</div><div class="row"><button class="b g" id="vr" type="button">Обновить</button><button class="b g" id="rsopen" type="button">Сбросить счётчики</button></div><div id="rsx"></div>`;
  renderVisits();
}
$('#dg').onsubmit = e => { if (e.target.id === 'rsf') submitReset(e); };
$('#dg').onclick = e => {
  // Клик по затемнению вокруг окна закрывает панель (клик по внутренним отступам — нет).
  if (e.target === $('#dg')) {
    const r = $('#dg').getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) $('#dg').close();
    return;
  }
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'vr') {
    loadVisits();
  } else if (b.id === 'rsopen') {
    showResetForm();
  } else if (b.id === 'rscancel') {
    hideResetForm();
  } else if (b.id === 'cl') {
    $('#dg').close();
  }
};
$('#adm').onclick = () => {
  if ($('#dg').open) return;
  clearTimeout(adminTapTimer);
  adminTaps++;
  if (adminTaps < ADMIN_TAPS) {
    adminTapTimer = setTimeout(() => { adminTaps = 0; }, ADMIN_TAP_WINDOW);
    return;
  }
  adminTaps = 0;
  admin();
  $('#dg').showModal();
  loadVisits();
};
