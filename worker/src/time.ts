// Форматирование времени по Москве без зависимости от ICU/локальных данных.
// Москва всегда UTC+3, перехода на летнее время нет.

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function formatMsk(timestampSeconds: number, withYear = true): string {
  const date = new Date((timestampSeconds + 3 * 60 * 60) * 1000);
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()] ?? '';
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const yearPart = withYear ? ` ${year}` : '';
  return `${day} ${month}${yearPart}, ${hours}:${minutes} (МСК)`;
}
