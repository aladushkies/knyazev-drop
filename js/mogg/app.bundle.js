/* GENERATED FILE — не редактируйте вручную.
   Источник: js/mogg-source/metrics.js + app.js. Пересборка: npm run build */
(() => {
'use strict';
/* Pure geometry/scoring helpers. No network calls or image uploads. */
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function pointPx(landmarks, index, width, height) {
  const p = landmarks[index];
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    throw new Error(`Не найден лицевой ориентир №${index}. Попробуй более чёткое фото анфас.`);
  }
  return { x: p.x * width, y: p.y * height };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function distanceAt(landmarks, first, second, width, height) {
  return distance(pointPx(landmarks, first, width, height), pointPx(landmarks, second, width, height));
}

// Positive angle means the outer eye corner is higher than the inner corner.
function canthalTilt(inner, outer) {
  const dx = Math.abs(outer.x - inner.x);
  if (dx < 1e-6) return 0;
  const dy = inner.y - outer.y; // canvas/image y increases downwards
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function gaussian(value, target, sigma) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(sigma) || sigma <= 0) return 0;
  return 100 * Math.exp(-0.5 * ((value - target) / sigma) ** 2);
}

function mean(values) {
  return values.reduce((acc, v) => acc + v, 0) / Math.max(1, values.length);
}

function rounded(value, decimals = 2) {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

// Условная градация по геометрическому баллу. Пороги одинаковы для всех пресетов,
// а названия верхних ступеней зависят от выбранного пресета (Chad / Stacy и т. д.).
const TIER_DEFS = [
  { key: 'low', max: 3, range: 'ниже 3', label: 'Sub 3', names: { neutral: 'Sub 3', masculine: 'Sub 3', feminine: 'Sub 3' } },
  { key: 'sub5', max: 3.5, range: '3–3.5', label: 'Sub 5', names: { neutral: 'Sub 5', masculine: 'Sub 5', feminine: 'Sub 5' } },
  { key: 'ltn', max: 4.5, range: '3.5–4.5', label: 'LTN', names: { neutral: 'LTN', masculine: 'LTN', feminine: 'LTN' } },
  { key: 'mtn', max: 5.5, range: '4.5–5.5', label: 'MTN', names: { neutral: 'MTN', masculine: 'MTN', feminine: 'MTN' } },
  { key: 'htn', max: 6.5, range: '5.5–6.5', label: 'HTN', names: { neutral: 'HTN', masculine: 'HTN', feminine: 'HTN' } },
  { key: 'chadlite', max: 8, range: '6.5–8', label: 'Chadlite', names: { neutral: 'Chadlite', masculine: 'Chadlite', feminine: 'Stacylite' } },
  { key: 'chad', max: 9, range: '8–9', label: 'Chad', names: { neutral: 'Chad/Stacy', masculine: 'Chad', feminine: 'Stacy' } },
  { key: 'giga', max: 10, range: '9–10', label: 'GigaChad', names: { neutral: 'GigaChad/GigaStacy', masculine: 'GigaChad', feminine: 'GigaStacy' } },
  { key: 'true', max: Infinity, range: '10', label: 'True Adam', names: { neutral: 'True Adam/True Eve', masculine: 'True Adam', feminine: 'True Eve' } },
];

// Пресеты задают, какие пропорции считаются эталоном для выбранного пола.
// Пол по фото НЕ определяется: пресет выбирает пользователь. Эталон мужского
// пресета — шире челюсть и скулы, ниже и массивнее верх лица; женского — мягче
// челюсть, выше наклон глаз, полнее нижняя губа. Веса групп тоже зависят от пресета.
const PROFILES = {
  neutral:   { label: 'Универсальный', jaw: 0.83, chin: 1.45, jawFace: 0.68, fwhr: 1.90, tilt: 2.5, lip: 1.45, weights: { harmony: 35, dimorphism: 25, angularity: 20, misc: 20 } },
  masculine: { label: 'Мужской',       jaw: 0.87, chin: 1.55, jawFace: 0.72, fwhr: 1.98, tilt: 3.0, lip: 1.35, weights: { harmony: 30, dimorphism: 25, angularity: 28, misc: 17 } },
  feminine:  { label: 'Женский',       jaw: 0.79, chin: 1.30, jawFace: 0.64, fwhr: 1.82, tilt: 4.0, lip: 1.65, weights: { harmony: 40, dimorphism: 25, angularity: 12, misc: 23 } },
};

function getTierLadder(profile = 'neutral') {
  const key = PROFILES[profile] ? profile : 'neutral';
  return TIER_DEFS.map((tier, index) => ({ key: tier.key, index, range: tier.range, community: tier.names[key] }));
}

function getTier(score, profile = 'neutral') {
  // NaN не меньше ни одного порога: без запасного варианта TIER_DEFS[-1] уронил бы отчёт.
  const found = TIER_DEFS.findIndex((tier) => score < tier.max);
  const index = found >= 0 ? found : 0;
  const ladder = getTierLadder(profile);
  const tier = TIER_DEFS[index];
  return { key: tier.key, index, label: tier.label, community: ladder[index].community, range: tier.range, ladder };
}

function calculateMetrics(landmarks, width, height, profile = 'neutral') {
  if (!Array.isArray(landmarks) || landmarks.length < 468) {
    throw new Error('Модель вернула неполный набор лицевых ориентиров. Попробуй другое фото.');
  }
  if (!(width > 0 && height > 0)) throw new Error('Не удалось определить размеры изображения.');

  // Frequently used points from MediaPipe Face Landmarker (468-point mesh + optional iris points).
  const P = (i) => pointPx(landmarks, i, width, height);
  const d = (a, b) => distance(P(a), P(b));
  const cheekWidth = d(234, 454);
  const jawWidth = d(132, 361);
  const foreheadY = P(10).y;
  const browY = mean([P(70).y, P(300).y]);
  const noseBaseY = mean([P(2).y, P(98).y, P(327).y]);
  const chinY = P(152).y;
  const thirdsRaw = [browY - foreheadY, noseBaseY - browY, chinY - noseBaseY];
  if (thirdsRaw.some((n) => !Number.isFinite(n) || n <= 0) || cheekWidth <= 0 || jawWidth <= 0) {
    throw new Error('Положение лица выглядит нестандартно для расчёта. Выбери ровный снимок анфас.');
  }
  const thirdsTotal = thirdsRaw.reduce((a, b) => a + b, 0);
  const thirds = thirdsRaw.map((v) => v / thirdsTotal);
  const thirdsDeviation = mean(thirds.map((v) => Math.abs(v - 1 / 3)));
  const thirdsScore = gaussian(thirdsDeviation, 0, 0.105);

  const pairs = [[33, 263], [133, 362], [234, 454], [61, 291], [132, 361]];
  const midlineX = mean([P(1).x, P(168).x, P(0).x, P(152).x]);
  const symmetryErrors = pairs.map(([li, ri]) => {
    const L = P(li), R = P(ri);
    const horizontalMismatch = Math.abs(Math.abs(L.x - midlineX) - Math.abs(R.x - midlineX));
    const verticalMismatch = Math.abs(L.y - R.y) * 0.45; // reduce sensitivity to slight head tilt
    return Math.hypot(horizontalMismatch, verticalMismatch) / cheekWidth;
  });
  const asymmetryIndex = mean(symmetryErrors) * 100;
  const symmetryScore = gaussian(mean(symmetryErrors), 0, 0.045);

  const leftEyeWidth = d(33, 133);
  const rightEyeWidth = d(263, 362);
  const averageEyeWidth = mean([leftEyeWidth, rightEyeWidth]);
  const interEyeGap = d(133, 362);
  const eyeGapRatio = interEyeGap / Math.max(averageEyeWidth, 1e-6);
  const eyeSpacingScore = gaussian(eyeGapRatio, 1.0, 0.48);
  const harmonyScore = clamp(thirdsScore * 0.38 + symmetryScore * 0.37 + eyeSpacingScore * 0.25);

  const jawToCheek = jawWidth / cheekWidth;
  const philtrumLength = Math.abs(P(0).y - P(2).y);
  const chinLength = Math.abs(P(152).y - P(17).y);
  const chinToPhiltrum = chinLength / Math.max(philtrumLength, 1e-6);
  const selectedProfile = PROFILES[profile] ? profile : 'neutral';
  const target = PROFILES[selectedProfile];
  const weights = target.weights;
  const jawProfileScore = gaussian(jawToCheek, target.jaw, 0.13);
  const chinProfileScore = gaussian(chinToPhiltrum, target.chin, 0.55);
  const dimorphismScore = clamp(jawProfileScore * 0.65 + chinProfileScore * 0.35);

  const faceHeight = Math.abs(chinY - foreheadY);
  const jawToFaceHeight = jawWidth / Math.max(faceHeight, 1e-6);
  const upperFaceHeight = P(13).y - browY;
  if (!(upperFaceHeight > 0)) throw new Error('Не удалось определить верхнюю высоту лица. Выбери ровный снимок анфас.');
  const fwhr = cheekWidth / upperFaceHeight;
  const fwhrScore = gaussian(fwhr, target.fwhr, 0.35);
  const angularityScore = clamp(
    fwhrScore * 0.48 +
    gaussian(jawToFaceHeight, target.jawFace, 0.13) * 0.32 +
    gaussian(jawToCheek, target.jaw, 0.16) * 0.20
  );

  const pupilLeft = landmarks[468] && landmarks[473] ? d(468, 473) : d(33, 263) * 1.8;
  const ipdProxy = Math.max(pupilLeft, 1e-6); // proxy only; never reported as millimetres
  const noseWidth = d(129, 358);
  const mouthWidth = d(61, 291);
  const upperLipHeight = d(0, 13);
  const lowerLipHeight = d(14, 17);
  const lipRatio = lowerLipHeight / Math.max(upperLipHeight, 1e-6);
  const leftTilt = canthalTilt(P(133), P(33));
  const rightTilt = canthalTilt(P(362), P(263));
  const averageTilt = mean([leftTilt, rightTilt]);
  const tiltScore = gaussian(averageTilt, target.tilt, 8.0);
  const noseRatio = noseWidth / ipdProxy;
  const mouthRatio = mouthWidth / ipdProxy;
  const noseScore = gaussian(noseRatio, 0.66, 0.19);
  const mouthScore = gaussian(mouthRatio, 1.45, 0.38);
  const lipScore = gaussian(lipRatio, target.lip, 0.95);
  const miscellaneousScore = clamp(tiltScore * 0.32 + noseScore * 0.26 + mouthScore * 0.25 + lipScore * 0.17);

  const combined = clamp((harmonyScore * weights.harmony + dimorphismScore * weights.dimorphism + angularityScore * weights.angularity + miscellaneousScore * weights.misc) / 100);
  // Display the weighted composite geometry directly on a 0–10 scale; no PSL remapping.
  const geometryScore = rounded(combined / 10, 1);
  const tier = getTier(geometryScore, selectedProfile);

  return {
    overallScore: geometryScore,
    compositeScore: rounded(combined, 1),
    tier,
    profile: { key: selectedProfile, label: target.label },
    categories: [
      { key: 'harmony', title: 'Фациальная гармония', short: 'Гармония', score: rounded(harmonyScore), weight: weights.harmony, description: 'Баланс приблизительных третей, симметрия ключевых точек и расстояние между глазами.', details: { thirdsScore: rounded(thirdsScore), symmetryScore: rounded(symmetryScore), eyeSpacingScore: rounded(eyeSpacingScore) } },
      { key: 'dimorphism', title: 'Структура / выбранный профиль', short: 'Структура', score: rounded(dimorphismScore), weight: weights.dimorphism, description: 'Сравнение отношения ширины челюсти к скулам и пропорции подбородка с эталоном выбранного пресета.', details: { jawToCheek: rounded(jawToCheek), chinToPhiltrum: rounded(chinToPhiltrum), targetProfile: target.label } },
      { key: 'angularity', title: 'Геометрия контура', short: 'Контур', score: rounded(angularityScore), weight: weights.angularity, description: 'Приближение FWHR (ширина скул / высота от линии бровей до верхней губы) и ширины нижней трети.', details: { fwhr: rounded(fwhr), fwhrScore: rounded(fwhrScore), jawToFaceHeight: rounded(jawToFaceHeight), jawToCheek: rounded(jawToCheek) } },
      { key: 'misc', title: 'Вторичные пропорции', short: 'Детали', score: rounded(miscellaneousScore), weight: weights.misc, description: 'Наклон глаз и отношения ширины носа/рта к межзрачковому расстоянию; соотношение губ.', details: { canthalTiltDegrees: rounded(averageTilt, 1), noseToIpd: rounded(noseRatio), mouthToIpd: rounded(mouthRatio), lipRatio: rounded(lipRatio) } },
    ],
    measurements: {
      canthalTiltDegrees: rounded(averageTilt, 1),
      intercanthalDistancePx: rounded(d(133, 362), 1),
      eyeGapRatio: rounded(eyeGapRatio),
      thirds: thirds.map((v) => rounded(v, 3)),
      asymmetryIndexPercent: rounded(asymmetryIndex, 2),
      cheekWidthPx: rounded(cheekWidth, 1),
      jawWidthPx: rounded(jawWidth, 1),
      jawToCheekRatio: rounded(jawToCheek),
      jawToFaceHeightRatio: rounded(jawToFaceHeight),
      fwhr: rounded(fwhr),
      cheekToJawRatio: rounded(cheekWidth / jawWidth),
      chinToPhiltrumRatio: rounded(chinToPhiltrum),
      noseToIpdRatio: rounded(noseRatio),
      mouthToIpdRatio: rounded(mouthRatio),
      lipRatio: rounded(lipRatio),
    },
    notes: [
      'Пропорции третей приблизительны: линия роста волос напрямую не определяется, поэтому используется верхний видимый ориентир лба.',
      'Миллиметры не выводятся: без известного масштаба фотографии они были бы ложной точностью.',
      'Модель видит двумерную проекцию; профиль, глубину посадки глаз и выраженность костей в 3D надёжно не измерить.',
    ],
  };
}

const MP_VERSION = '1.1.0';
const MP_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;

const mogRoot = document.getElementById('mogApp');
const el = (id) => mogRoot.querySelector(`#${id}`);
const fileInput = el('fileInput');
const dropZone = el('dropZone');
const previewWrap = el('previewWrap');
const sourcePreview = el('sourcePreview');
const analyzeBtn = el('analyzeBtn');
const analyzeBtnText = el('analyzeBtnText');
const profileSelect = el('profileSelect');
const errorBox = el('errorBox');
const progressBox = el('progressBox');
const progressTitle = el('progressTitle');
const progressText = el('progressText');
const emptyState = el('emptyState');
const reportContent = el('reportContent');
const annotatedCanvas = el('annotatedCanvas');
const canvasCtx = annotatedCanvas.getContext('2d');

let chosenFile = null;
let objectUrl = null;
let detectorPromise = null;
let faceLandmarker = null;
let analysisLandmarks = null;
let processingWidth = 0;
let processingHeight = 0;
let processingCanvas = null;
let latestMetrics = null;
let isBusy = false;
let loadToken = 0; // защита от гонок, если фото выбрали несколько раз подряд

function updateAnalyzeButton() {
  analyzeBtn.disabled = !chosenFile || isBusy;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('mog-hidden');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('mog-hidden');
}

function setProgress(title, message) {
  progressTitle.textContent = title;
  progressText.textContent = message;
  progressBox.classList.remove('mog-hidden');
}

function hideProgress() {
  progressBox.classList.add('mog-hidden');
}

function humanFileSize(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function resetReport() {
  latestMetrics = null;
  analysisLandmarks = null;
  processingCanvas = null;
  processingWidth = 0;
  processingHeight = 0;
  emptyState.classList.remove('mog-hidden');
  reportContent.classList.add('mog-hidden');
  document.getElementById('t4').classList.remove('mog-analyzed');
  el('formulaContent').classList.add('mog-hidden');
  el('formulaToggle').setAttribute('aria-expanded', 'false');
}

// ---- Определение формата файла -------------------------------------------------
// file.type бывает пустым или неверным (Windows без записи в реестре для .webp,
// файлы из буфера обмена, перетаскивание из некоторых программ), поэтому формат
// определяем по первым байтам файла, а не по расширению или MIME-типу.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSION_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function sniffImageType(file) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from, to) => String.fromCharCode(...head.slice(from, to));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1|heif)/.test(ascii(8, 12))) return 'image/heic';
  if (ascii(0, 3) === 'GIF') return 'image/gif';
  if (ascii(0, 2) === 'BM') return 'image/bmp';
  return '';
}

async function resolveImageType(file) {
  let sniffed = '';
  try { sniffed = await sniffImageType(file); } catch (err) { /* читаем по MIME/расширению ниже */ }
  if (sniffed) return sniffed;
  if (ALLOWED_TYPES.includes(file.type)) return file.type;
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  return EXTENSION_TYPES[extension] || '';
}

function unsupportedMessage(type) {
  if (type === 'image/heic') return 'Формат HEIC/HEIF (фото с iPhone) не поддерживается. Сохрани фото как JPG или PNG либо сделай скриншот.';
  return 'Формат файла не поддерживается. Выбери JPG, PNG или WebP.';
}

async function setPhoto(file) {
  clearError();
  if (!file) return;
  const token = ++loadToken;
  if (file.size === 0) {
    clearPhoto();
    showError('Файл пустой. Выбери другое фото.');
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    clearPhoto();
    showError('Файл больше 12 МБ. Уменьши изображение и попробуй снова.');
    return;
  }
  const type = await resolveImageType(file);
  if (token !== loadToken) return; // за время чтения выбрали другой файл
  if (!ALLOWED_TYPES.includes(type)) {
    clearPhoto();
    showError(unsupportedMessage(type));
    return;
  }
  // Если браузер не знает MIME-тип файла, подставляем определённый нами.
  const blob = file.type === type ? file : new Blob([file], { type });
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  chosenFile = file;
  objectUrl = URL.createObjectURL(blob);
  sourcePreview.onload = () => {
    if (chosenFile !== file || token !== loadToken) return;
    if (!sourcePreview.naturalWidth || !sourcePreview.naturalHeight) {
      clearPhoto();
      showError('Не удалось прочитать изображение. Попробуй другой файл.');
      return;
    }
    el('fileInfo').textContent = `${file.name || 'Изображение из буфера обмена'} · ${sourcePreview.naturalWidth} × ${sourcePreview.naturalHeight} · ${humanFileSize(file.size)}`;
    dropZone.classList.add('mog-hidden');
    previewWrap.classList.remove('mog-hidden');
    resetReport();
    updateAnalyzeButton();
  };
  sourcePreview.onerror = () => {
    if (chosenFile !== file || token !== loadToken) return;
    clearPhoto();
    showError('Не удалось открыть изображение. Возможно, файл повреждён.');
  };
  sourcePreview.src = objectUrl;
}

function clearPhoto() {
  chosenFile = null;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  sourcePreview.removeAttribute('src');
  previewWrap.classList.add('mog-hidden');
  dropZone.classList.remove('mog-hidden');
  fileInput.value = '';
  resetReport();
  clearError();
  updateAnalyzeButton();
}

async function loadFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    setProgress('Загружаю MediaPipe…', 'Подключаю библиотеку и модель. При первом запуске это может занять некоторое время.');
    const { FaceLandmarker, FilesetResolver } = await import(MP_MODULE_URL);
    const vision = await FilesetResolver.forVisionTasks(MP_WASM_URL);
    const commonOptions = {
      runningMode: 'IMAGE',
      numFaces: 2,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    };
    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        ...commonOptions,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      });
    } catch (gpuError) {
      // Some devices/browser drivers do not support the GPU delegate; retry on CPU.
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        ...commonOptions,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      });
    }
    return faceLandmarker;
  })();
  try {
    return await detectorPromise;
  } catch (err) {
    detectorPromise = null;
    faceLandmarker = null;
    throw new Error('Не получилось загрузить MediaPipe или модель Google. Проверь интернет, HTTPS и доступ к cdn.jsdelivr.net и storage.googleapis.com, затем обнови страницу. Детали: ' + (err?.message || String(err)));
  }
}

function prepareCanvas(img) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  processingWidth = Math.max(1, Math.round(img.naturalWidth * scale));
  processingHeight = Math.max(1, Math.round(img.naturalHeight * scale));
  processingCanvas = document.createElement('canvas');
  processingCanvas.width = processingWidth;
  processingCanvas.height = processingHeight;
  const ctx = processingCanvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('Браузер не смог создать canvas для обработки изображения.');
  ctx.drawImage(img, 0, 0, processingWidth, processingHeight);
}

function drawAnnotated(landmarks) {
  annotatedCanvas.width = processingWidth;
  annotatedCanvas.height = processingHeight;
  canvasCtx.clearRect(0, 0, processingWidth, processingHeight);
  canvasCtx.drawImage(processingCanvas, 0, 0);
  const radius = Math.max(1.05, Math.min(processingWidth, processingHeight) / 650);
  canvasCtx.fillStyle = '#bafa58';
  canvasCtx.strokeStyle = 'rgba(15, 18, 13, .65)';
  canvasCtx.lineWidth = 0.5;
  // Draw sparse mesh points for a readable overlay rather than painting every vertex as a blob.
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    if (i % 2 !== 0 && i > 467) continue;
    const x = p.x * processingWidth;
    const y = p.y * processingHeight;
    if (x < 0 || y < 0 || x >= processingWidth || y >= processingHeight) continue;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
    canvasCtx.fill();
    canvasCtx.stroke();
  }
  // Emphasize the primary geometry landmarks.
  const marked = [10, 70, 300, 2, 152, 33, 133, 362, 263, 234, 454, 132, 361, 61, 291, 129, 358];
  canvasCtx.fillStyle = '#fff9d7';
  marked.forEach((index) => {
    const p = landmarks[index];
    if (!p) return;
    canvasCtx.beginPath();
    canvasCtx.arc(p.x * processingWidth, p.y * processingHeight, radius * 1.8, 0, Math.PI * 2);
    canvasCtx.fill();
  });
}

function safeNumber(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}

function buildMetricDetails(category) {
  const d = category.details;
  if (category.key === 'harmony') {
    return `Трети: ${safeNumber(d.thirdsScore, 0)} · Симметрия: ${safeNumber(d.symmetryScore, 0)} · Посадка глаз: ${safeNumber(d.eyeSpacingScore, 0)}`;
  }
  if (category.key === 'dimorphism') {
    return `Челюсть/скулы: ${safeNumber(d.jawToCheek)} · Подбородок/филтрум: ${safeNumber(d.chinToPhiltrum)}`;
  }
  if (category.key === 'angularity') {
    return `FWHR: ${safeNumber(d.fwhr)} · Челюсть/видимая высота: ${safeNumber(d.jawToFaceHeight)} · Челюсть/скулы: ${safeNumber(d.jawToCheek)}`;
  }
  return `Наклон глаз: ${safeNumber(d.canthalTiltDegrees, 1)}° · Нос/IPD: ${safeNumber(d.noseToIpd)} · Рот/IPD: ${safeNumber(d.mouthToIpd)} · Губы: ${safeNumber(d.lipRatio)}`;
}

function renderMetrics(metrics) {
  const grid = el('metricGrid');
  grid.replaceChildren();
  metrics.categories.forEach((category) => {
    const card = document.createElement('article');
    card.className = 'mog-metric-card';
    const top = document.createElement('div');
    top.className = 'mog-metric-card-top';
    const title = document.createElement('h4');
    title.textContent = category.title;
    const score = document.createElement('span');
    score.className = 'mog-metric-score';
    score.textContent = `${Math.round(category.score)}/100`;
    top.append(title, score);
    const bar = document.createElement('div');
    bar.className = 'mog-metric-bar';
    const fill = document.createElement('span');
    fill.style.width = `${Math.max(0, Math.min(100, category.score))}%`;
    bar.append(fill);
    const desc = document.createElement('p');
    desc.textContent = category.description;
    const more = document.createElement('div');
    more.className = 'mog-metric-more';
    more.textContent = buildMetricDetails(category);
    card.append(top, bar, desc, more);
    grid.append(card);
  });
}

function renderReport(metrics) {
  latestMetrics = metrics;
  const score = metrics.overallScore;
  const tier = metrics.tier;
  emptyState.classList.add('mog-hidden');
  reportContent.classList.remove('mog-hidden');
  el('scoreValue').textContent = score.toFixed(1);
  el('tierName').textContent = tier.range + ' / 10';
  el('tierBadge').textContent = tier.community;
  el('scoreSummaryText').textContent = `Геометрический балл · ${score.toFixed(1)}/10 · ${metrics.profile.label.toLowerCase()} пресет. Приблизительная оценка пропорций по фото, не объективная оценка внешности.`;
  el('scoreRing').style.setProperty('--score-angle', `${score / 10 * 360}deg`);
  // Only the matching category is shown; no full tier ladder.
  document.getElementById('t4').classList.add('mog-analyzed');
  renderMetrics(metrics);
  const formulaList = el('formulaList');
  formulaList.replaceChildren();
  metrics.categories.forEach((category) => {
    const li = document.createElement('li');
    li.textContent = `${category.title}: ${category.weight}% веса, подбалл ${category.score}/100. ${buildMetricDetails(category)}`;
    formulaList.append(li);
  });
  drawAnnotated(analysisLandmarks);
}

async function analyzePhoto() {
  if (!chosenFile || isBusy) return;
  // Анализ стоит КК: списываем с баланса до старта, при ошибке возвращаем.
  const bridge = window.KD || null;
  const cost = bridge ? bridge.cost() : 0;
  if (cost > 0 && !(bridge && bridge.spend(cost))) {
    showError(`Анализ стоит ${cost} КК — на балансе не хватает. Забери бонус или открой кейс.`);
    return;
  }
  isBusy = true;
  updateAnalyzeButton();
  clearError();
  resetReport();
  analyzeBtnText.textContent = 'Идёт анализ…';
  const analyzedFile = chosenFile;
  const photoChanged = () => chosenFile !== analyzedFile;
  try {
    if (!sourcePreview.complete || !sourcePreview.naturalWidth) {
      await sourcePreview.decode();
    }
    prepareCanvas(sourcePreview);
    const detector = await loadFaceLandmarker();
    setProgress('Ищу ориентиры лица…', 'Изображение обрабатывается в этом браузере; оно не отправляется на ваш сервер.');
    // detect() is synchronous and may block briefly on large photos, so we resize before inference.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Фото удалили или заменили во время загрузки модели: отчёт по старому фото не показываем.
    if (photoChanged()) {
      processingCanvas = null;
      if (cost > 0 && bridge) bridge.refund(cost);
      return;
    }
    const result = detector.detect(processingCanvas);
    const faces = result?.faceLandmarks || [];
    if (faces.length === 0) throw new Error('Лицо не найдено. Используй чёткий снимок анфас с хорошим освещением.');
    if (faces.length > 1) throw new Error('На фото найдено больше одного лица. Оставь в кадре одного человека.');
    analysisLandmarks = faces[0];
    const metrics = calculateMetrics(analysisLandmarks, processingWidth, processingHeight, profileSelect.value);
    renderReport(metrics);
    reportContent.scrollIntoView({ behavior: 'auto', block: 'start' });
  } catch (err) {
    if (cost > 0 && bridge) bridge.refund(cost);
    if (!photoChanged()) showError(err?.message || 'Не удалось проанализировать изображение. Попробуй другой файл.');
  } finally {
    isBusy = false;
    hideProgress();
    analyzeBtnText.textContent = kdAnalyzeLabel();
    updateAnalyzeButton();
  }
}

// ---- Выбор файла, перетаскивание и вставка ---------------------------------------
const mogSection = document.getElementById('t4');
const isMogActive = () => !mogSection.hidden;
const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');

// 1) Диалог «Проводника»: label[for] открывает его и без JS.
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = ''; // чтобы повторный выбор того же файла снова вызвал change
  if (file) setPhoto(file);
});

// 2) Перетаскивание. Слушаем всё окно: если файл уронили мимо зоны, браузер
//    иначе открыл бы картинку вместо сайта и сбросил текущее состояние.
let dragDepth = 0;
const setDragging = (on) => dropZone.classList.toggle('mog-dragging', on && isMogActive());
window.addEventListener('dragenter', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth += 1;
  setDragging(true);
});
window.addEventListener('dragover', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = isMogActive() ? 'copy' : 'none';
});
window.addEventListener('dragleave', (event) => {
  if (!hasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDragging(false);
});
window.addEventListener('drop', (event) => {
  const withFiles = hasFiles(event);
  const droppedLink = !withFiles && isMogActive() && Array.from(event.dataTransfer?.types || []).some((t) => t === 'text/uri-list' || t === 'text/html');
  if (!withFiles && !droppedLink) return;
  event.preventDefault();
  dragDepth = 0;
  setDragging(false);
  if (!isMogActive()) return;
  if (droppedLink) {
    showError('Перетащи сам файл, а не картинку с сайта: сохрани её на компьютер или скопируй и нажми Ctrl+V.');
    return;
  }
  const files = Array.from(event.dataTransfer.files || []);
  const file = files.find((f) => f.type.startsWith('image/')) || files[0];
  if (file) setPhoto(file); else showError('Не удалось получить файл. Попробуй выбрать его кнопкой.');
});

// 3) Ctrl+V / Cmd+V: скриншот, скопированная картинка или файл, скопированный в Проводнике.
document.addEventListener('paste', (event) => {
  if (!isMogActive()) return;
  const data = event.clipboardData;
  if (!data) return;
  const fromFiles = Array.from(data.files || []);
  const fromItems = Array.from(data.items || []).filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter(Boolean);
  const candidates = fromFiles.length ? fromFiles : fromItems;
  const file = candidates.find((f) => f.type.startsWith('image/')) || candidates[0];
  if (file) {
    event.preventDefault();
    setPhoto(file);
  } else {
    showError('В буфере обмена нет изображения. Скопируй картинку или сделай скриншот и нажми Ctrl+V ещё раз.');
  }
});
el('changePhotoBtn').addEventListener('click', () => fileInput.click());
// Клик по загруженному фото (без точек) снова открывает проводник.
el('sourcePreview').addEventListener('click', () => fileInput.click());
el('sourcePreview').title = 'Нажми, чтобы выбрать другое фото';
el('removePhotoBtn').addEventListener('click', clearPhoto);
analyzeBtn.addEventListener('click', analyzePhoto);
profileSelect.addEventListener('change', () => {
  if (analysisLandmarks && processingWidth && processingHeight) {
    try { renderReport(calculateMetrics(analysisLandmarks, processingWidth, processingHeight, profileSelect.value)); }
    catch (err) { showError(err?.message || 'Не удалось пересчитать выбранный профиль.'); }
  }
});
el('formulaToggle').addEventListener('click', () => {
  const button = el('formulaToggle');
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  el('formulaContent').classList.toggle('mog-hidden', expanded);
});
el('downloadBtn').addEventListener('click', () => {
  if (!annotatedCanvas.width || !annotatedCanvas.height) return;
  const link = document.createElement('a');
  link.download = 'knyazev-mogg-landmarks.png';
  link.href = annotatedCanvas.toDataURL('image/png');
  link.click();
});
el('resetBtn').addEventListener('click', () => {
  clearPhoto();
  updateAnalyzeButton();
  el('dropZone').scrollIntoView({ behavior: 'auto', block: 'nearest' });
});

window.addEventListener('beforeunload', () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (faceLandmarker?.close) faceLandmarker.close();
});

updateAnalyzeButton();

// Пресет (пол для эталона) запоминаем: он не меняется от фото к фото.
try {
  const savedProfile = localStorage.getItem('mogg.profile');
  if (savedProfile && [...profileSelect.options].some((option) => option.value === savedProfile)) profileSelect.value = savedProfile;
} catch (err) { /* localStorage недоступен: работаем без запоминания */ }
profileSelect.addEventListener('change', () => {
  try { localStorage.setItem('mogg.profile', profileSelect.value); } catch (err) { /* ignore */ }
});

// ---- Князев-коины: баланс, бонус, стоимость анализа (мост window.KD) ----
const kdAnalyzeLabel = () => {
  const bridge = window.KD || null;
  return bridge ? `Проанализировать лицо · ${bridge.cost()} КК` : 'Проанализировать лицо';
};
function refreshKdUi() {
  const bridge = window.KD || null;
  if (!bridge) return;
  const bal = document.getElementById('mogBal'), bn = document.getElementById('mogBn');
  if (bal) bal.textContent = `${bridge.bal()} КК`;
  if (bn) bn.textContent = `Бонус +${bridge.bonusAmount()}`;
  analyzeBtnText.textContent = kdAnalyzeLabel();
  bridge.refreshMogg();
}
const mogBn = document.getElementById('mogBn');
if (mogBn) mogBn.addEventListener('click', () => {
  const bridge = window.KD || null;
  if (bridge && bridge.claimBonus()) refreshKdUi();
});
refreshKdUi();
})();
