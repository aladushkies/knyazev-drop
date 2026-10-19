// Опрос «Князев заболел…»: показывается один раз за сессию, «Нет» не нажимается, каждое «Да» считается.
(() => {
  const box = $('#wish');
  if (!box) return;
  try { if (sessionStorage.getItem('kd-wish-shown')) return; } catch { /* без sessionStorage показываем всегда */ }

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
  yes.addEventListener('click', () => {
    try { sessionStorage.setItem('kd-wish-shown', '1'); } catch { /* ignore */ }
    wishHit();
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
