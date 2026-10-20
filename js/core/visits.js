// Общий счётчик заходов: скользящий час / московский календарный день и месяц / всё время.
// Для скользящего часа используем пятиминутные корзины: это удерживает число запросов
// к Abacus ниже лимита при общем школьном IP. 13 корзин гарантируют полный последний час
// с запасом не более 5 минут (у сервиса нет пакетного чтения/хранения отдельных timestamp).
const VN = 'knyazev-drop-fmsh2007-k7x2';
const VB = 'https://abacus.jasoncameron.dev';
const FIVE_MINUTES = 5 * 60 * 1000;
const p2 = n => String(n).padStart(2, '0');
// Сброс счётчиков: Abacus не даёт обнулить ключ без admin-ключа, поэтому у всех счётчиков
// есть «поколение» (общий ключ GEN_KEY). Сброс увеличивает поколение — все пользователи
// начинают писать и читать новые ключи, которые стартуют с нуля. Поколение 0 — исходные ключи.
const GEN_KEY = 'reset-gen';
const genPrefix = gen => gen > 0 ? `g${gen}-` : '';
function vkeys(gen = 0, now = Date.now()) {
  // Только календарные сутки и месяц привязаны к Москве; rolling-hour зависит от Unix-времени.
  const msk = new Date(now + 3 * 36e5);
  const y = msk.getUTCFullYear(), m = p2(msk.getUTCMonth() + 1), d = p2(msk.getUTCDate());
  const g = genPrefix(gen);
  return {
    r: `${g}r5-${Math.floor(now / FIVE_MINUTES)}`,
    d: `${g}d-${y}-${m}-${d}`,
    m: `${g}m-${y}-${m}`,
    a: `${g}all`,
    w: `${g}wish-health`,
    g: `${g}mogg-analyzed`
  };
}
// Повторы при 429 (лимит сервиса: 30 запросов за 10 секунд с одного IP).
async function vreq(kind, key) {
  for (let i = 0; i < 4; i++) {
    // Зависший запрос не должен навсегда оставлять панель в состоянии «…».
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
    const r = await fetch(`${VB}/${kind}/${VN}/${key}`, { cache: 'no-store', signal });
    if (r.status === 429) { await sl(1500 * (i + 1)); continue; }
    if (r.status === 404 && kind === 'get') return 0;
    if (!r.ok) throw new Error('visits ' + r.status);
    const body = await r.json();
    const value = Number(body && body.value);
    if (!Number.isFinite(value) || value < 0) throw new Error('visits invalid value');
    return value;
  }
  throw new Error('visits 429');
}
async function visitHit() {
  try {
    if (sessionStorage.getItem('kdv')) return;
    sessionStorage.setItem('kdv', '1');
  } catch (e) { /* без sessionStorage считаем каждую загрузку */ }
  try {
    await sl(R(1500));
    const k = vkeys(await getGen());
    await Promise.all([k.r, k.d, k.m, k.a].map(key => vreq('hit', key)));
  } catch (e) { console.warn('Счётчик заходов недоступен', e); }
}
const getGen = () => vreq('get', GEN_KEY);
// Счётчик «пожелало здоровья гуру»: каждое нажатие «Да» в опросе — +1.
const wishHit = () => getGen().then(gen => vreq('hit', vkeys(gen).w)).catch(e => console.warn('Счётчик пожеланий недоступен', e));
// Счётчик «проанализировало лицо Mogg»: каждый успешный анализ — +1. Сбрасывается вместе с остальными (поколение).
const moggHit = () => getGen().then(gen => vreq('hit', vkeys(gen).g)).catch(e => console.warn('Счётчик анализов Mogg недоступен', e));
async function visitStats() {
  const k = vkeys(await getGen());
  const [w, g, d, m, a] = await Promise.all([vreq('get', k.w), vreq('get', k.g), vreq('get', k.d), vreq('get', k.m), vreq('get', k.a)]);
  return { w, g, d, m, a };
}
// Обнуление всех счётчиков для всех пользователей (вызывается из админки после проверки пароля).
const resetAllCounters = () => vreq('hit', GEN_KEY);
visitHit();
