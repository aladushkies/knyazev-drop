// Пополнение КК: кнопка «+» сразу начисляет ECON.topup.kk, не чаще раза в ECON.topup.cooldownSec.
// Время последнего пополнения хранится в сохранении (S.tu), поэтому перезагрузка не сбрасывает паузу.
(function () {
  const { kk: AMOUNT, cooldownSec } = ECON.topup;
  const COOLDOWN_MS = cooldownSec * 1000;
  if (!Number.isFinite(S.tu) || S.tu > Date.now()) S.tu = 0;

  const buttons = () => document.querySelectorAll('[data-topup]');
  const leftMs = () => Math.max(0, S.tu + COOLDOWN_MS - Date.now());
  let timer = 0;

  function render() {
    const left = leftMs();
    const sec = Math.ceil(left / 1000);
    buttons().forEach(button => {
      const cooling = left > 0;
      button.classList.toggle('is-cooling', cooling);
      button.style.setProperty('--topup-progress', cooling ? String(1 - left / COOLDOWN_MS) : '1');
      const label = cooling ? `Пополнить КК: доступно через ${sec} с` : `Пополнить КК: +${AMOUNT} КК`;
      button.setAttribute('aria-label', label);
      button.title = label;
    });
    clearTimeout(timer);
    if (left > 0) timer = setTimeout(render, Math.min(250, left));
  }

  function claim() {
    const left = leftMs();
    if (left > 0) return toast(`Следующее пополнение через ${Math.ceil(left / 1000)} с`);
    S.bal += AMOUNT;
    S.tu = Date.now();
    sv();
    syncPills();
    toast(`+${AMOUNT} КК на баланс`);
    render();
  }

  document.addEventListener('click', e => { if (e.target.closest('[data-topup]')) claim(); });
  // Пауза могла пройти, пока вкладка браузера была в фоне.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
})();
