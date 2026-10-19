// Рулетка «Князев Drop»: подбор размера шрифта, чтобы любое «Фамилия Имя» текущего класса
// помещалось в одну строку.
// Размер считается заранее по самому длинному имени класса (включая созданные вручную),
// поэтому во время прокрутки имён шрифт не прыгает. Верхняя граница — штатный размер
// из CSS (--nm-base), больше него шрифт не становится. Ширины меряются в CSS-пикселях,
// поэтому масштаб страницы (Ctrl +/−, щипок) учитывается автоматически: при его смене
// меняется ширина блока, и ResizeObserver пересчитывает размер.
(() => {
  const nm = $('#nm');
  if (!nm) return;
  const DEFAULT_LABEL = 'Князев Drop';
  const MIN_PX = 8; // нижняя граница только для совсем нереальных имён длиной в полстроки текста
  const SAFETY = 0.97; // запас под субпиксельное округление и анимацию pop

  const probe = document.createElement('span');
  probe.className = 'nm-probe';
  probe.setAttribute('aria-hidden', 'true');
  nm.parentNode.appendChild(probe);

  const widthCache = new Map();
  let cacheFont = '';
  let lastKey = '';
  let applied = false;

  const classNames = () => {
    const c = typeof cur === 'function' ? cur() : null;
    const names = c ? c.people.map(p => p.n.trim()).filter(Boolean) : [];
    names.push(DEFAULT_LABEL);
    return names;
  };

  const measure = (text, fontKey) => {
    if (fontKey !== cacheFont) { widthCache.clear(); cacheFont = fontKey; }
    let w = widthCache.get(text);
    if (w === undefined) {
      probe.textContent = text;
      w = probe.getBoundingClientRect().width;
      widthCache.set(text, w);
    }
    return w;
  };

  function fitDropName(force) {
    const cs = getComputedStyle(nm);
    const available = nm.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (available <= 0) return; // вкладка скрыта — пересчитаем, когда станет видна
    const pcs = getComputedStyle(probe);
    const base = parseFloat(pcs.fontSize);
    const fontKey = `${base}|${pcs.fontFamily}|${pcs.fontWeight}|${pcs.letterSpacing}|${document.fonts?.status}`;
    const names = classNames();
    const key = `${fontKey}|${available}|${names.join('\u0001')}`;
    if (!force && key === lastKey) return;
    lastKey = key;

    let widest = 0;
    for (const n of names) widest = Math.max(widest, measure(n, fontKey));
    // Ширина текста пропорциональна размеру шрифта, поэтому достаточно одной пропорции.
    const fit = widest > 0 ? Math.min(base, Math.max(MIN_PX, (base * available * SAFETY) / widest)) : base;
    const px = `${Math.floor(fit * 4) / 4}px`;

    if (!applied) {
      // Первый расчёт применяем без анимации, чтобы при загрузке не было «сжатия» на глазах.
      nm.classList.add('nm-instant');
      nm.style.setProperty('--nm-fit', px);
      void nm.offsetWidth;
      nm.classList.remove('nm-instant');
      applied = true;
    } else {
      nm.style.setProperty('--nm-fit', px);
    }
  }
  window.fitDropName = fitDropName;

  if ('ResizeObserver' in window) new ResizeObserver(() => fitDropName()).observe(nm);
  window.addEventListener('resize', () => fitDropName());
  window.visualViewport?.addEventListener('resize', () => fitDropName());
  if (document.fonts) {
    document.fonts.ready.then(() => fitDropName(true));
    document.fonts.addEventListener?.('loadingdone', () => fitDropName(true));
  }
  // Смена масштаба меняет devicePixelRatio — подписываемся заново на каждое новое значение.
  const watchDpr = () => {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener?.('change', () => { fitDropName(true); watchDpr(); }, { once: true });
  };
  watchDpr();
})();
