// Чипы в hero-блоке (ученики, места, баланс)
function drawChips() {
  const c=cur(),ps=c.people.filter(p=>p.n.trim());
  const icon = id => `<svg class="chip-icon" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
  $('#chips').innerHTML=`<span>${icon('ic-people')}${ps.length} учеников</span><span>${icon('ic-seat')}${seats(c).filter(s=>s.on).length} мест</span><span>${icon('ic-check')}${Object.keys(c.asg).length} рассажено</span><span>${icon('ic-coin')}${S.bal} КК</span>`
  syncPills()
}
// Пилюли баланса и кнопки бонуса в шапках вкладок (Cases/Upgrade/MOGG).
function syncPills() {
  for (const id of ['caseBal','upBal','mogBal']) {
    const el = document.getElementById(id);
    if (el) el.textContent = `${S.bal} КК`;
  }
  for (const id of ['caseBn','upBn','mogBn']) {
    const el = document.getElementById(id);
    if (el) el.textContent = `Бонус +${ECON.bonus.amount}`;
  }
}
