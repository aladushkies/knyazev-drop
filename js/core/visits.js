// Общий счётчик заходов: скользящий час / московский календарный день и месяц / всё время.
// Для скользящего часа используем пятиминутные корзины: это удерживает число запросов
// к Abacus ниже лимита при общем школьном IP. 13 корзин гарантируют полный последний час
// с запасом не более 5 минут (у сервиса нет пакетного чтения/хранения отдельных timestamp).
const VN = 'knyazev-drop-fmsh2007-k7x2';
const VB = 'https://abacus.jasoncameron.dev';
const FIVE_MINUTES = 5 * 60 * 1000;
const p2 = n => String(n).padStart(2, '0');
function vkeys(now = Date.now()) {
  // Только календарные сутки и месяц привязаны к Москве; rolling-hour зависит от Unix-времени.
  const msk = new Date(now + 3 * 36e5);
  const y = msk.getUTCFullYear(), m = p2(msk.getUTCMonth() + 1), d = p2(msk.getUTCDate());
  return {
    r: `r5-${Math.floor(now / FIVE_MINUTES)}`,
    d: `d-${y}-${m}-${d}`,
    m: `m-${y}-${m}`,
    a: 'all'
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
    const k = vkeys();
    await Promise.all([k.r, k.d, k.m, k.a].map(key => vreq('hit', key)));
  } catch (e) { console.warn('Счётчик заходов недоступен', e); }
}
// Счётчик «пожелало здоровья гуру»: каждое нажатие «Да» в опросе — +1.
const WISH_KEY = 'wish-health';
const wishHit = () => vreq('hit', WISH_KEY).catch(e => console.warn('Счётчик пожеланий недоступен', e));
async function visitStats() {
  const k = vkeys();
  const [w, d, m, a] = await Promise.all([vreq('get', WISH_KEY), vreq('get', k.d), vreq('get', k.m), vreq('get', k.a)]);
  return { w, d, m, a };
}
visitHit();
