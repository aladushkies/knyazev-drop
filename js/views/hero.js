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
// Строки hero-плашки всегда в одну строку: если ширины не хватает, шрифт уменьшается под доступное место.
// Так работает посвящение.
const HERO_LINE_MIN_FONT = 5;
function fitHeroLine(el) {
  if (!el) return;
  el.style.fontSize = '';
  const cs = getComputedStyle(el);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const textNeed = el.scrollWidth - pad, textAvail = el.clientWidth - pad;
  if (textAvail <= 0 || textNeed <= textAvail + 0.5) return;
  const base = parseFloat(cs.fontSize);
  let size = Math.max(HERO_LINE_MIN_FONT, Math.floor(base * textAvail / textNeed * 10) / 10);
  el.style.fontSize = `${size}px`;
  // Подстраховка от округления: если всё ещё не влезает, уменьшаем шаг за шагом.
  for (let i = 0; i < 6 && size > HERO_LINE_MIN_FONT && el.scrollWidth - pad > el.clientWidth - pad + 0.5; i++) {
    size = Math.max(HERO_LINE_MIN_FONT, Math.round((size - 0.2) * 10) / 10);
    el.style.fontSize = `${size}px`;
  }
}
function fitDedication() {
  fitHeroLine(document.getElementById('dedication'));
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
