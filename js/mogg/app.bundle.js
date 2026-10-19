/* GENERATED FILE — не редактируйте вручную.
   Источник: mogg/src/metrics.js + app.js. Пересборка: cd mogg && npm run build */
(() => {
'use strict';
/* Сравнение лица с эталоном: чистая геометрия, без сетевых запросов.
   Алгоритм (v3):
   1. Фронтализация. По 3D-ориентирам MediaPipe (x, y, z) строится система координат самого лица:
      ось X — по шести симметричным парам точек (глаза, скулы, рот, виски), ось Y — по средней линии
      (лоб → подбородок). Все точки проецируются на плоскость лица, поэтому наклон (roll), поворот (yaw)
      и кивок (pitch) головы в умеренных пределах почти не влияют на пропорции.
   2. Из фронтализованных точек считаются 16 безразмерных признаков (отношения расстояний, доли третей,
      наклон глаз, межзрачковое расстояние по радужкам).
   3. Каждое отличие от эталона делится на σ — разброс признака у подростков 11–18 лет. Признаки,
      которые сильно меняются в пубертате (длина носа, нижняя треть, челюсть, подбородок), получили
      увеличенный σ: школьника не «штрафуют» за то, что лицо ещё растёт.
   4. z-отличия ограничиваются 3σ (одна сбойная точка не обнуляет результат), усредняются в квадрате
      с весами (аналог расстояния Махаланобиса), итог = 100·exp(−½·(D/K)²).
      Калибровка: то же фото после отражения, масштаба и поворота на ±9° даёт 92–100 %,
      фото другого человека (D ≈ 1,2–1,6) — 35–55 %, похожий — 70–85 %.
   5. Мимика (улыбка, открытый рот) по blendshapes MediaPipe снижает вес признаков рта и подбородка. */
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

// Положительный угол: внешний уголок глаза выше внутреннего.
function canthalTilt(inner, outer) {
  const dx = Math.abs(outer.x - inner.x);
  if (dx < 1e-6) return 0;
  const dy = inner.y - outer.y; // ось y изображения направлена вниз
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function mean(values) {
  return values.reduce((acc, v) => acc + v, 0) / Math.max(1, values.length);
}

function rounded(value, decimals = 2) {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

const v3 = {
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  scale: (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k }),
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  norm: (a) => Math.hypot(a.x, a.y, a.z),
  unit: (a) => { const n = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / n, y: a.y / n, z: a.z / n }; },
  avg: (list) => list.reduce((acc, p) => v3.add(acc, v3.scale(p, 1 / list.length)), { x: 0, y: 0, z: 0 }),
};

// Пары «левая — правая» сторона лица и средняя линия: по ним строится система координат лица.
const SYMMETRIC_PAIRS = [[33, 263], [133, 362], [234, 454], [61, 291], [127, 356], [93, 323]];
const MIDLINE_UPPER = [10, 151, 9, 168];
const MIDLINE_LOWER = [152, 17, 0, 2];

const Z_CAP = 3;
const SCORE_K = 1.15;

// Схожесть одного признака по z-отличию (в единицах σ).
function featureSimilarity(value, target, sigma) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || !(sigma > 0)) return 0;
  const z = Math.min(Z_CAP, Math.abs(value - target) / sigma);
  return 100 * Math.exp(-0.5 * (z / SCORE_K) ** 2);
}

const GROUPS = [
  { key: 'outline', title: 'Контур лица', short: 'Контур', weight: 28, description: 'Ширина скул к высоте лица, ширина челюсти и FWHR (скулы к высоте от бровей до верхней губы).' },
  { key: 'vertical', title: 'Вертикальные пропорции', short: 'Трети', weight: 22, description: 'Доли верхней, средней и нижней трети лица и длина носа.' },
  { key: 'eyes', title: 'Глаза', short: 'Глаза', weight: 30, description: 'Межзрачковое расстояние, расстояние между глазами, ширина и наклон глаз. Самая стабильная зона лица.' },
  { key: 'lower', title: 'Нос и рот', short: 'Нос и рот', weight: 20, description: 'Ширина носа и рта, соотношение губ и длина подбородка. Вес рта автоматически снижается при улыбке.' },
];

// sigma — разброс признака у подростков 11–18 лет в выходе MediaPipe (≈ 1 стандартное отклонение).
// Сетка MediaPipe «притягивает» лица к усреднённой модели, поэтому разброс меньше антропометрического;
// значения откалиброваны так, чтобы разные лица надёжно расходились, а одно и то же лицо давало > 90 %.
// teen — во сколько раз σ увеличен из-за возрастной изменчивости (лицо ещё растёт).
// weight — надёжность признака (точность ориентиров MediaPipe).
// expr — от какой мимики зависит признак: 'smile' или 'jaw'.
const FEATURES = [
  { key: 'widthToHeight', group: 'outline', label: 'Ширина скул / высота лица', sigma: 0.033, teen: 1.1, weight: 1, digits: 2, expr: 'jaw' },
  { key: 'jawToCheek', group: 'outline', label: 'Челюсть / скулы', sigma: 0.042, teen: 1.2, weight: 0.9, digits: 2 },
  { key: 'jawMidToCheek', group: 'outline', label: 'Середина челюсти / скулы', sigma: 0.042, teen: 1.15, weight: 0.7, digits: 2 },
  { key: 'fwhr', group: 'outline', label: 'FWHR', sigma: 0.108, teen: 1, weight: 1, digits: 2, expr: 'smile' },
  { key: 'thirdUpper', group: 'vertical', label: 'Верхняя треть', sigma: 0.021, teen: 1, weight: 0.8, digits: 3 },
  { key: 'thirdMiddle', group: 'vertical', label: 'Средняя треть', sigma: 0.0168, teen: 1.1, weight: 1, digits: 3 },
  { key: 'thirdLower', group: 'vertical', label: 'Нижняя треть', sigma: 0.021, teen: 1.2, weight: 1, digits: 3, expr: 'jaw' },
  { key: 'noseLength', group: 'vertical', label: 'Длина носа / высота лица', sigma: 0.018, teen: 1.2, weight: 1, digits: 3 },
  { key: 'ipd', group: 'eyes', label: 'Межзрачковое / скулы', sigma: 0.015, teen: 1.1, weight: 1.2, digits: 3 },
  { key: 'eyeGap', group: 'eyes', label: 'Между глазами / ширина глаза', sigma: 0.084, teen: 1, weight: 1, digits: 2 },
  { key: 'eyeWidth', group: 'eyes', label: 'Ширина глаза / скулы', sigma: 0.0108, teen: 1.15, weight: 1, digits: 3, expr: 'smile' },
  { key: 'eyeTilt', group: 'eyes', label: 'Наклон глаз, °', sigma: 2.1, teen: 1, weight: 0.8, digits: 1 },
  { key: 'noseWidth', group: 'lower', label: 'Ширина носа / скулы', sigma: 0.0168, teen: 1.15, weight: 1, digits: 3, expr: 'smile' },
  { key: 'mouthWidth', group: 'lower', label: 'Ширина рта / скулы', sigma: 0.027, teen: 1.1, weight: 0.7, digits: 3, expr: 'smile' },
  { key: 'lipRatio', group: 'lower', label: 'Нижняя / верхняя губа', sigma: 0.33, teen: 1, weight: 0.4, digits: 2, expr: 'smile' },
  { key: 'chinToPhiltrum', group: 'lower', label: 'Подбородок / губной желобок', sigma: 0.27, teen: 1.2, weight: 0.8, digits: 2, expr: 'jaw' },
];

const FEATURE_SIGNATURE = FEATURES.map((f) => f.key).join(',');

// Признаки эталонного лица, посчитанные тем же конвейером (MediaPipe, 2 кадрирования, фронтализация).
// Эталонное фото на сайт не загружается и не показывается.
const REFERENCE_PRESET = {
  widthToHeight: 0.8247, jawToCheek: 0.9586, jawMidToCheek: 0.8130, fwhr: 1.6489,
  thirdUpper: 0.2123, thirdMiddle: 0.3672, thirdLower: 0.4205, noseLength: 0.2945,
  ipd: 0.4513, eyeGap: 1.2684, eyeWidth: 0.1880, eyeTilt: 0.11,
  noseWidth: 0.3065, mouthWidth: 0.3900, lipRatio: 1.5004, chinToPhiltrum: 2.7879,
};
// Мимика на эталонном фото (blendshapes): лёгкая улыбка, рот закрыт.
const REFERENCE_EXPRESSION = { smile: 0.51, jawOpen: 0.0 };

function isValidReference(values) {
  return !!values && FEATURES.every((f) => Number.isFinite(values[f.key]));
}

const BANDS = [
  { key: 'other', max: 30, range: 'ниже 30 %', label: 'Другая вселенная', phrase: 'Общее с гуру у вас одно — оба знаете, что такое интеграл.' },
  { key: 'weak', max: 45, range: '30–45 %', label: 'Дальний родственник', phrase: 'Если прищуриться и выключить свет — что-то общее есть.' },
  { key: 'moderate', max: 60, range: '45–60 %', label: 'Ученик гуру', phrase: 'До гуру ещё пара контрольных.' },
  { key: 'clear', max: 75, range: '60–75 %', label: 'Подающий надежды', phrase: 'Наденьте розовую рубашку в полоску — и могут перепутать.' },
  { key: 'strong', max: 90, range: '75–90 %', label: 'Почти гуру', phrase: 'Ещё чуть-чуть — и вас попросят объяснить задачу у доски.' },
  { key: 'match', max: Infinity, range: 'от 90 %', label: 'Гуру, это вы?', phrase: 'Это вы, Ваше Вылечиство?' },
];

function getSimilarityBand(percent) {
  const index = Math.max(0, BANDS.findIndex((band) => percent < band.max));
  const band = BANDS[index];
  return { key: band.key, index, label: band.label, phrase: band.phrase, range: band.range, total: BANDS.length };
}

// Фронтальная проекция лица: P(i) → {x, y} в плоскости лица + оценка позы головы.
function frontalize(landmarks, width, height) {
  const p3 = (i) => {
    const p = landmarks[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new Error(`Не найден лицевой ориентир №${i}. Попробуй более чёткое фото анфас.`);
    }
    return { x: p.x * width, y: p.y * height, z: Number.isFinite(p.z) ? p.z * width : 0 };
  };
  const xAxis = v3.unit(SYMMETRIC_PAIRS.reduce((acc, [l, r]) => v3.add(acc, v3.sub(p3(r), p3(l))), { x: 0, y: 0, z: 0 }));
  const down = v3.sub(v3.avg(MIDLINE_LOWER.map(p3)), v3.avg(MIDLINE_UPPER.map(p3)));
  if (!(v3.norm(down) > 0)) throw new Error('Положение лица выглядит нестандартно для расчёта. Выбери ровный снимок анфас.');
  const yAxis = v3.unit(v3.sub(down, v3.scale(xAxis, v3.dot(down, xAxis))));
  const origin = p3(168);
  const cache = new Map();
  const P = (i) => {
    if (!cache.has(i)) {
      const d = v3.sub(p3(i), origin);
      cache.set(i, { x: v3.dot(d, xAxis), y: v3.dot(d, yAxis) });
    }
    return cache.get(i);
  };
  const deg = (r) => r * 180 / Math.PI;
  return {
    P,
    pose: {
      rollDeg: rounded(deg(Math.atan2(xAxis.y, xAxis.x)), 1),
      yawDeg: rounded(deg(Math.asin(clamp(xAxis.z, -1, 1))), 1),
      pitchDeg: rounded(deg(Math.asin(clamp(yAxis.z, -1, 1))), 1),
    },
  };
}

function extractFeatures(landmarks, width, height) {
  if (!Array.isArray(landmarks) || landmarks.length < 468) {
    throw new Error('Модель вернула неполный набор лицевых ориентиров. Попробуй другое фото.');
  }
  if (!(width > 0 && height > 0)) throw new Error('Не удалось определить размеры изображения.');

  const { P, pose: angles } = frontalize(landmarks, width, height);
  const d = (a, b) => distance(P(a), P(b));
  const has = (i) => landmarks[i] && Number.isFinite(landmarks[i].x);

  const cheek = d(234, 454);
  const jaw = d(132, 361);
  const jawMid = d(172, 397);
  const topY = P(10).y;
  const chinY = P(152).y;
  const faceHeight = chinY - topY;
  const browY = mean([P(70).y, P(300).y, P(105).y, P(334).y]);
  const noseBaseY = mean([P(2).y, P(98).y, P(327).y]);
  const thirdsRaw = [browY - topY, noseBaseY - browY, chinY - noseBaseY];
  if (!(cheek > 0) || !(jaw > 0) || !(faceHeight > 0) || thirdsRaw.some((n) => !Number.isFinite(n) || n <= 0)) {
    throw new Error('Положение лица выглядит нестандартно для расчёта. Выбери ровный снимок анфас.');
  }
  const thirdsTotal = thirdsRaw.reduce((a, b) => a + b, 0);
  const upperFace = P(13).y - browY;
  if (!(upperFace > 0)) throw new Error('Не удалось определить верхнюю высоту лица. Выбери ровный снимок анфас.');

  const eyeWidth = mean([d(33, 133), d(263, 362)]);
  const tilt = mean([canthalTilt(P(133), P(33)), canthalTilt(P(362), P(263))]);
  const upperLip = d(0, 13);
  const philtrum = Math.abs(P(0).y - P(2).y);
  const centre = (a, b) => ({ x: (P(a).x + P(b).x) / 2, y: (P(a).y + P(b).y) / 2 });
  // Центры зрачков по радужкам (468, 473); если модель их не вернула — центры глаз.
  const pupilL = has(468) ? P(468) : centre(33, 133);
  const pupilR = has(473) ? P(473) : centre(263, 362);

  const values = {
    widthToHeight: cheek / faceHeight,
    jawToCheek: jaw / cheek,
    jawMidToCheek: jawMid / cheek,
    fwhr: cheek / upperFace,
    thirdUpper: thirdsRaw[0] / thirdsTotal,
    thirdMiddle: thirdsRaw[1] / thirdsTotal,
    thirdLower: thirdsRaw[2] / thirdsTotal,
    noseLength: Math.abs(P(2).y - P(168).y) / faceHeight,
    ipd: distance(pupilL, pupilR) / cheek,
    eyeGap: d(133, 362) / Math.max(eyeWidth, 1e-6),
    eyeWidth: eyeWidth / cheek,
    eyeTilt: tilt,
    noseWidth: d(129, 358) / cheek,
    mouthWidth: d(61, 291) / cheek,
    lipRatio: d(14, 17) / Math.max(upperLip, 1e-6),
    chinToPhiltrum: Math.abs(chinY - P(17).y) / Math.max(philtrum, 1e-6),
  };
  if (!FEATURES.every((f) => Number.isFinite(values[f.key]))) {
    throw new Error('Не удалось рассчитать пропорции лица. Выбери более чёткое фото анфас.');
  }

  // Двумерная оценка поворота: смещение кончика носа от середины скул (работает и без z).
  const yaw2d = (P(1).x - mean([P(234).x, P(454).x])) / cheek;
  const turned = Math.abs(yaw2d) > 0.07 || Math.abs(angles.yawDeg) > 18 || Math.abs(angles.pitchDeg) > 25;
  const pose = {
    ...angles,
    yawRatio: rounded(yaw2d, 3),
    warning: turned ? 'Голова заметно повёрнута: фронтализация частично это исправляет, но для точного результата лучше фото строго анфас.' : null,
  };
  return { values, pose };
}

// Усредняет признаки нескольких проходов детектора (разные кадрирования): меньше шума ориентиров.
function averageFeatures(list) {
  const valid = list.filter(isValidReference);
  if (!valid.length) return null;
  const out = {};
  for (const f of FEATURES) out[f.key] = mean(valid.map((v) => v[f.key]));
  return out;
}

// Множитель веса от мимики. expression: { smile: 0..1, jawOpen: 0..1 } из blendshapes MediaPipe.
// Сравнивается с мимикой эталона: отличие до 0,15 не мешает, дальше вес плавно падает до 25 %.
function expressionFactor(feature, expression, reference = REFERENCE_EXPRESSION) {
  if (!expression || !feature.expr) return 1;
  const key = feature.expr === 'smile' ? 'smile' : 'jawOpen';
  const level = expression[key];
  if (!Number.isFinite(level)) return 1;
  return 1 - 0.75 * clamp((Math.abs(level - (reference?.[key] ?? 0)) - 0.15) / 0.4, 0, 1);
}

function expressionDiffers(expression, reference = REFERENCE_EXPRESSION) {
  return !!expression && (Math.abs(expression.smile - reference.smile) > 0.4 || Math.abs(expression.jawOpen - reference.jawOpen) > 0.4);
}

function compareValues(values, reference, { pose = null, expression = null } = {}) {
  if (!isValidReference(reference)) throw new Error('Эталон не готов: не удалось получить его пропорции.');
  if (!isValidReference(values)) throw new Error('Не удалось рассчитать пропорции лица. Выбери более чёткое фото анфас.');

  const scoreOf = (d2) => clamp(100 * Math.exp(-0.5 * d2 / SCORE_K ** 2));
  const groups = GROUPS.map((group) => {
    const features = FEATURES.filter((f) => f.group === group.key).map((f) => {
      const sigma = f.sigma * f.teen;
      return {
        key: f.key,
        label: f.label,
        digits: f.digits,
        weight: f.weight * expressionFactor(f, expression),
        value: values[f.key],
        reference: reference[f.key],
        z: Math.min(Z_CAP, Math.abs(values[f.key] - reference[f.key]) / sigma),
        similarity: featureSimilarity(values[f.key], reference[f.key], sigma),
      };
    });
    const weightSum = features.reduce((acc, f) => acc + f.weight, 0);
    const d2 = features.reduce((acc, f) => acc + f.weight * f.z * f.z, 0) / weightSum;
    return { d2, category: { key: group.key, title: group.title, short: group.short, description: group.description, weight: group.weight, score: rounded(scoreOf(d2), 1), features } };
  });

  const weightTotal = GROUPS.reduce((acc, g) => acc + g.weight, 0);
  const d2Total = groups.reduce((acc, g, i) => acc + g.d2 * GROUPS[i].weight, 0) / weightTotal;
  const percent = rounded(scoreOf(d2Total), 1);

  const measurements = {};
  for (const f of FEATURES) measurements[f.key] = rounded(values[f.key], 4);

  return {
    similarityPercent: percent,
    distance: rounded(Math.sqrt(d2Total), 3),
    band: getSimilarityBand(percent),
    categories: groups.map((g) => g.category),
    measurements,
    pose: pose || { warning: null },
    expressionWarning: expressionDiffers(expression) ? 'Мимика сильно отличается от эталона (гуру слегка улыбается): признаки рта и подбородка учтены с пониженным весом.' : null,
  };
}

function compareFaces(landmarks, width, height, reference, expression = null) {
  if (!isValidReference(reference)) throw new Error('Эталон не готов: не удалось получить его пропорции.');
  const { values, pose } = extractFeatures(landmarks, width, height);
  return compareValues(values, reference, { pose, expression });
}

const MP_VERSION = '1.1.0';
const MP_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const mogRoot = document.getElementById('mogApp');
const mogSection = document.getElementById('t4');
const el = (id) => mogRoot.querySelector(`#${id}`);
const fileInput = el('fileInput');
const dropZone = el('dropZone');
const previewWrap = el('previewWrap');
const sourcePreview = el('sourcePreview');
const analyzeBtn = el('analyzeBtn');
const analyzeBtnText = el('analyzeBtnText');
const errorBox = el('errorBox');
const progressBox = el('progressBox');
const progressTitle = el('progressTitle');
const progressText = el('progressText');
const emptyState = el('emptyState');
const reportContent = el('reportContent');

let chosenFile = null;
let objectUrl = null;
let detectorPromise = null;
let faceLandmarker = null;
let isBusy = false;
let loadToken = 0; // защита от гонок, если фото выбрали несколько раз подряд

// ---- Князев-коины: стоимость анализа и баланс (мост window.KD из js/main.js) ----
const kd = () => window.KD || null;
const analysisCost = () => (kd() ? kd().cost() : 0);
const analyzeLabel = () => {
  const cost = analysisCost();
  return cost > 0 ? `Сравнить с гуру · ${cost} КК` : 'Сравнить с гуру';
};

function updateAnalyzeButton() {
  analyzeBtn.disabled = !chosenFile || isBusy;
  if (!isBusy) analyzeBtnText.textContent = analyzeLabel();
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
  emptyState.classList.remove('mog-hidden');
  reportContent.classList.add('mog-hidden');
  mogSection.classList.remove('mog-analyzed');
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
  if (!file || isBusy) return;
  clearError();
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
  loadToken += 1;
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
    setProgress('Загружаю MediaPipe…', 'Подключаю модель распознавания ориентиров. При первом запуске нужен интернет.');
    const lib = window.MPVision;
    if (!lib?.FaceLandmarker) throw new Error('Не найден файл js/vendor/tasks-vision-1.1.0.js.');
    const { FaceLandmarker, FilesetResolver } = lib;
    const vision = await FilesetResolver.forVisionTasks(MP_WASM_URL);
    const commonOptions = {
      runningMode: 'IMAGE',
      numFaces: 2,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    };
    // Только CPU: GPU-делегат MediaPipe в Firefox при повторных detect() на canvas разного
    // размера мог сбрасывать видеопроцесс браузера (мигание окна и падение страницы).
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, { ...commonOptions, baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' } });
    return faceLandmarker;
  })();
  try {
    return await detectorPromise;
  } catch (err) {
    detectorPromise = null;
    faceLandmarker = null;
    const detail = err?.message || String(err);
    throw new Error('Не получилось загрузить модель MediaPipe. Проверь интернет и доступ к cdn.jsdelivr.net и storage.googleapis.com, затем обнови страницу. Детали: ' + detail);
  }
}

// Уменьшенная копия фото для первого (грубого) поиска лица.
function makeCanvas(img) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не смог создать canvas для обработки изображения.');
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height, scale };
}

// Квадратный кадр вокруг лица, вырезанный из ОРИГИНАЛА в полном разрешении:
// мелкое лицо на большом фото не теряет детализацию при уменьшении.
function cropFace(img, landmarks, scale, factor, outputSize = 768) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const xs = landmarks.map((p) => p.x * W);
  const ys = landmarks.map((p) => p.y * H);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const faceSize = Math.max(maxX - minX, maxY - minY);
  if (!Number.isFinite(faceSize) || faceSize < 2) throw new Error('Не удалось определить размер лица.');
  if (faceSize * scale < 60) throw new Error('Лицо на фото слишком маленькое. Возьми снимок, где лицо крупнее.');
  const side = Math.max(2, Math.min(Math.min(W, H), faceSize * factor));
  const sx = Math.max(0, Math.min(W - side, (minX + maxX) / 2 - side / 2));
  const sy = Math.max(0, Math.min(H - side, (minY + maxY) / 2 - side / 2));
  const crop = document.createElement('canvas');
  crop.width = outputSize;
  crop.height = outputSize;
  const ctx = crop.getContext('2d');
  if (!ctx) throw new Error('Браузер не смог нормализовать область лица.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, outputSize, outputSize);
  return crop;
}

function readExpression(blendshapes) {
  const cats = blendshapes?.categories;
  if (!cats?.length) return null;
  const score = (name) => cats.find((c) => c.categoryName === name)?.score ?? 0;
  return { smile: (score('mouthSmileLeft') + score('mouthSmileRight')) / 2, jawOpen: score('jawOpen') };
}

// Два прохода: грубый поиск лица, затем уточнение на двух кадрированиях разного масштаба.
// Признаки и мимика усредняются по кадрам.
const CROP_FACTORS = [1.7, 2.1];
function analyzeFace(detector, img) {
  const { canvas, scale } = makeCanvas(img);
  const firstPass = detector.detect(canvas)?.faceLandmarks || [];
  if (!firstPass.length) throw new Error('Лицо не найдено. Используй чёткий снимок анфас с хорошим освещением.');
  if (firstPass.length > 1) throw new Error('На фото найдено больше одного лица. Оставь в кадре одного человека.');
  const passes = [];
  for (const factor of CROP_FACTORS) {
    const crop = cropFace(img, firstPass[0], scale, factor);
    const result = detector.detect(crop);
    const landmarks = result?.faceLandmarks?.[0];
    if (!landmarks) continue;
    const { values, pose } = extractFeatures(landmarks, crop.width, crop.height);
    passes.push({ values, pose, expression: readExpression(result.faceBlendshapes?.[0]) });
  }
  if (!passes.length) throw new Error('Не удалось уточнить ориентиры лица. Попробуй фото, где лицо крупнее и лучше освещено.');
  const exprs = passes.map((p) => p.expression).filter(Boolean);
  const expression = exprs.length ? { smile: exprs.reduce((a, e) => a + e.smile, 0) / exprs.length, jawOpen: exprs.reduce((a, e) => a + e.jawOpen, 0) / exprs.length } : null;
  return { pose: passes[0].pose, values: averageFeatures(passes.map((p) => p.values)), expression };
}

function getReference() {
  if (!isValidReference(REFERENCE_PRESET)) throw new Error('Эталон не задан: заполни REFERENCE_PRESET в metrics.js.');
  return REFERENCE_PRESET;
}

function renderReport(metrics) {
  const percent = metrics.similarityPercent;
  emptyState.classList.add('mog-hidden');
  reportContent.classList.remove('mog-hidden');
  el('scoreValue').textContent = String(Math.round(percent));
  el('tierBadge').textContent = metrics.band.label;
  el('tierBadge').dataset.band = metrics.band.key;
  el('tierPhrase').textContent = metrics.band.phrase;
  el('tierPhrase').hidden = !metrics.band.phrase;
  el('scoreRing').style.setProperty('--score-angle', `${percent / 100 * 360}deg`);
  mogSection.classList.add('mog-analyzed');
  if (metrics.band.key === 'match') grantGuruBonus();
}

// «Гуру, это вы?» — разовый бонус 1000 КК на пользователя (флаг в localStorage).
const GURU_BONUS_KEY = 'kd-mogg-guru-bonus';
function grantGuruBonus() {
  try {
    if (localStorage.getItem(GURU_BONUS_KEY)) return;
    localStorage.setItem(GURU_BONUS_KEY, '1');
  } catch { return; }
  kd().refund(1000);
  if (typeof toast === 'function') toast('Гуру узнан! +1000 КК');
}

async function analyzePhoto() {
  if (!chosenFile || isBusy) return;
  // Анализ стоит КК: списываем до старта, при ошибке или смене фото возвращаем.
  const bridge = kd();
  const cost = analysisCost();
  if (cost > 0 && !bridge.spend(cost)) {
    showError(`Анализ стоит ${cost} КК — на балансе не хватает. Нажми «+» рядом с балансом или продай карточку в Князев Cases.`);
    return;
  }
  const refund = () => { if (cost > 0) bridge.refund(cost); };
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
    const detector = await loadFaceLandmarker();
    setProgress('Ищу ориентиры лица…', 'Фото обрабатывается прямо в этом браузере и никуда не отправляется.');
    // detect() синхронный и может ненадолго заблокировать страницу: даём отрисоваться прогрессу.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (photoChanged()) {
      refund();
      return;
    }
    const face = analyzeFace(detector, sourcePreview);
    const metrics = compareValues(face.values, getReference(), { pose: face.pose, expression: face.expression });
    renderReport(metrics);
    reportContent.scrollIntoView({ behavior: 'auto', block: 'start' });
  } catch (err) {
    refund();
    if (!photoChanged()) showError(err?.message || 'Не удалось проанализировать изображение. Попробуй другой файл.');
  } finally {
    isBusy = false;
    hideProgress();
    updateAnalyzeButton();
  }
}

// ---- Выбор файла, перетаскивание и вставка ---------------------------------------
const isMogActive = () => !mogSection.hidden;
const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
const openPicker = () => { if (!isBusy) fileInput.click(); };

// 1) Диалог «Проводника»: label[for] открывает его и без JS.
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); }
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
el('changePhotoBtn').addEventListener('click', openPicker);
sourcePreview.addEventListener('click', openPicker);
el('removePhotoBtn').addEventListener('click', () => { if (!isBusy) clearPhoto(); });
analyzeBtn.addEventListener('click', analyzePhoto);
el('formulaToggle').addEventListener('click', () => {
  const button = el('formulaToggle');
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  el('formulaContent').classList.toggle('mog-hidden', expanded);
});
el('resetBtnTop').addEventListener('click', () => el('resetBtn').click());
el('resetBtn').addEventListener('click', () => {
  if (isBusy) return;
  clearPhoto();
  dropZone.scrollIntoView({ behavior: 'auto', block: 'nearest' });
});

window.addEventListener('beforeunload', () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (faceLandmarker?.close) faceLandmarker.close();
});

updateAnalyzeButton();
})();
