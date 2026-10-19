// Князев Admin: панель аналитики открывается после нажатию на надпись в футере.
let VS = null, VE = 0, VL = false, VT = null;
let visitsRequest = 0;
const vbox = () => {
  const n = key => VS ? Number(VS[key]).toLocaleString('ru-RU') : '…';
  const updated = VT ? `<p class="m vs-time">Обновлено в ${VT.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>` : '';
  return `<div class="vs" aria-busy="${VL}"><div><b>${n('w')}</b><span>пожелало здоровья гуру</span></div><div><b>${n('d')}</b><span>за сегодня</span></div><div><b>${n('m')}</b><span>за этот месяц</span></div><div><b>${n('a')}</b><span>за всё время</span></div></div>${VE ? '<p class="m vs-error" role="alert">Не удалось получить данные счётчика. Попробуйте обновить через несколько секунд.</p>' : updated}`;
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
function admin() {
  $('#dg').innerHTML = `<div class="admin-head"><div><h2>Князев Admin <span class="m">· ФМШ 2007</span></h2><h2>Заходы на сайт <span class="m">· все пользователи</span></h2></div><button class="admin-close" id="cl" type="button" aria-label="Закрыть" title="Закрыть">×</button></div><div id="vs" aria-live="polite">${vbox()}</div><div class="row"><button class="b g" id="vr" type="button">Обновить</button></div>`;
  renderVisits();
}
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
  } else if (b.id === 'cl') {
    $('#dg').close();
  }
};
$('#adm').onclick = () => {
  if ($('#dg').open) return;
  admin();
  $('#dg').showModal();
  loadVisits();
};
