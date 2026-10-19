// Защита от «таскания» страницы во встроенных браузерах (Telegram, Instagram, iOS Safari).
// iOS игнорирует user-scalable=no, поэтому щипок и жесты масштабирования гасим вручную:
// при зуме layout- и visual-viewport расходятся, и sticky-шапка уезжает в середину экрана.
(() => {
  const stop = e => { if (e.cancelable) e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, stop, { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) stop(e); }, { passive: false });

  // Высота видимой области: в Telegram панели браузера появляются и прячутся при прокрутке,
  // 100vh этого не учитывает. --vvh используют оверлеи, чтобы закрывать экран целиком.
  const vv = window.visualViewport;
  const sync = () => {
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--vvh', `${Math.round(h)}px`);
    // Если зум всё-таки случился (старые WebView), возвращаем горизонтальную прокрутку в 0,
    // чтобы страница не оставалась сдвинутой вбок.
    if ((!vv || Math.abs(vv.scale - 1) < 0.01) && window.scrollX !== 0) window.scrollTo(0, window.scrollY);
  };
  sync();
  (vv || window).addEventListener('resize', sync);
  window.addEventListener('orientationchange', () => setTimeout(sync, 250));
})();
