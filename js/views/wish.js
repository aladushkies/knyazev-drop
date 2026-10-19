// Опрос «Князев заболел…»: пожелать здоровья можно один раз с одного устройства
// (флаг в localStorage, как разовый бонус Князев Team). «Нет» не нажимается.
(() => {
  const box = $('#wish');
  if (!box) return;
  const DONE_KEY = 'kd-wish-done';
  try { if (localStorage.getItem(DONE_KEY)) return; } catch { /* без localStorage показываем опрос */ }

  const yes = $('#wishYes'), no = $('#wishNo'), note = $('#wishNote');
  let noteTimer = 0;
  const refuse = e => {
    e.preventDefault();
    note.hidden = false;
    note.classList.remove('is-shaking');
    void note.offsetWidth;
    note.classList.add('is-shaking');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.hidden = true; }, 2600);
    yes.focus();
  };
  const trap = e => {
    if (e.key === 'Escape') e.preventDefault();
    if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === yes ? no : yes).focus(); }
  };

  no.addEventListener('click', refuse);
  let wished = false;
  yes.addEventListener('click', () => {
    if (wished) return;
    wished = true;
    let alreadyCounted = false;
    try {
      alreadyCounted = !!localStorage.getItem(DONE_KEY);
      localStorage.setItem(DONE_KEY, String(Date.now()));
    } catch { /* ignore */ }
    if (!alreadyCounted) wishHit();
    box.classList.add('is-leaving');
    document.removeEventListener('keydown', trap, true);
    document.documentElement.classList.remove('wish-open');
    setTimeout(() => { box.hidden = true; }, 220);
    if (typeof toast === 'function') toast('Спасибо! Гуру поправится');
  });

  box.hidden = false;
  document.documentElement.classList.add('wish-open');
  document.addEventListener('keydown', trap, true);
  requestAnimationFrame(() => yes.focus());
})();
