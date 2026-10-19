// Чипы в hero-блоке теперь статичные (посвящение в разметке), поэтому здесь только баланс.
function drawChips() {
  syncPills()
}
// Пилюли баланса в шапках вкладок (Cases/Upgrade/MOGG).
function syncPills() {
  for (const id of ['caseBal','upBal','mogBal']) {
    const el = document.getElementById(id);
    if (el) el.textContent = `${S.bal} КК`;
  }
}
