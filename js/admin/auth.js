// Князев Admin: панель аналитики открывается после 5 тапов по надписи в футере.
let VS = null, VE = 0;
const vbox = () => {
  const n = key => VS ? Number(VS[key]).toLocaleString('ru-RU') : '…';
  return `<div class="vs"><div><b>${n('h')}</b><span>за последний час</span></div><div><b>${n('d')}</b><span>за сегодня</span></div><div><b>${n('m')}</b><span>за этот месяц</span></div><div><b>${n('a')}</b><span>за всё время</span></div></div>${VE ? '<p class="m">Не удалось получить данные счётчика. Попробуйте обновить.</p>' : ''}`;
};
async function loadVisits() {
  VE = 0;
  VS = null;
  const b = $('#vs');
  if (b) b.innerHTML = vbox();
  try { VS = await visitStats(); } catch (e) { VE = 1; }
  if ($('#vs')) $('#vs').innerHTML = vbox();
}
function admin() {
  $('#dg').innerHTML = `<div class="admin-head"><div><h2>Князев Admin <span class="m">· ФМШ 2007</span></h2><h2>Заходы на сайт <span class="m">· все пользователи</span></h2></div><button class="admin-close" id="cl" type="button" aria-label="Закрыть" title="Закрыть">×</button></div><div id="vs">${vbox()}</div><div class="row"><button class="b g" id="vr" type="button">Обновить</button></div>`;
}
$('#dg').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'vr') {
    loadVisits();
  } else if (b.id === 'cl') {
    $('#dg').close();
  }
};
let tp = [];
$('#adm').onclick = () => {
  const t = Date.now();
  tp = tp.filter(x => t - x < 2000);
  tp.push(t);
  if (tp.length >= 5) {
    tp = [];
    $('#dg').showModal();
    admin();
    loadVisits();
  }
};
