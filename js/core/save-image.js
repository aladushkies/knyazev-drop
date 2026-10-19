// Сохранение картинки из canvas.
// Телефон: iOS кладёт фото в «Фото» только через меню «Поделиться» → «Сохранить изображение»,
//          Android сохраняет загрузку в «Загрузки», которые сразу видны в Галерее.
// Компьютер: окно «Сохранить как» (File System Access API) — пользователь сам выбирает папку.
//            В браузерах без этого API (Firefox, Safari) — обычное скачивание.
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobileDevice = () => isIOS() || /Android|Mobi/i.test(navigator.userAgent);

const canvasToBlob = canvas => new Promise((resolve, reject) => {
  if (typeof canvas.toBlob !== 'function') {
    fetch(canvas.toDataURL('image/png')).then(r => r.blob()).then(resolve, reject);
    return;
  }
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось подготовить изображение')), 'image/png');
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Возвращает true, если файл сохранён (или передан системе), false — если пользователь отменил.
async function saveCanvasImage(canvas, filename) {
  const safeName = String(filename).replace(/[\\/:*?"<>|]+/g, '-');

  if (isMobileDevice()) {
    const blob = await canvasToBlob(canvas);
    if (isIOS()) {
      const file = new File([blob], safeName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return true;
        } catch (error) {
          if (error && error.name === 'AbortError') return false;
        }
      }
    }
    downloadBlob(blob, safeName);
    return true;
  }

  // showSaveFilePicker нужно вызвать сразу в обработчике клика (до любых await),
  // иначе браузер посчитает вызов не связанным с действием пользователя.
  if (typeof window.showSaveFilePicker === 'function') {
    let handle = null;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: safeName,
        types: [{ description: 'Изображение PNG', accept: { 'image/png': ['.png'] } }]
      });
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      handle = null; // например, сайт открыт во фрейме — сохраняем обычным способом
    }
    if (handle) {
      const blob = await canvasToBlob(canvas);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }
  }

  downloadBlob(await canvasToBlob(canvas), safeName);
  return true;
}
