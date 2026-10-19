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
// Посвящение всегда в одну строку: если ширины не хватает, шрифт уменьшается под доступное место.
const DEDICATION_MIN_FONT = 7;
function fitDedication() {
  const el = document.getElementById('dedication');
  if (!el) return;
  el.style.fontSize = '';
  const cs = getComputedStyle(el);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const textNeed = el.scrollWidth - pad, textAvail = el.clientWidth - pad;
  if (textAvail <= 0 || textNeed <= textAvail + 0.5) return;
  const base = parseFloat(cs.fontSize);
  el.style.fontSize = `${Math.max(DEDICATION_MIN_FONT, Math.floor(base * textAvail / textNeed * 10) / 10)}px`;
}
let dedicationFrame = 0;
const scheduleFitDedication = () => {
  cancelAnimationFrame(dedicationFrame);
  dedicationFrame = requestAnimationFrame(fitDedication);
};
if (typeof ResizeObserver !== 'undefined') {
  const hero = document.querySelector('.hero');
  if (hero) new ResizeObserver(scheduleFitDedication).observe(hero);
}
window.addEventListener('resize', scheduleFitDedication);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFitDedication);
scheduleFitDedication();
