// Утилиты: $, E (экранирование), R (случайное), U (id), sl (пауза)
const $ = selector => document.querySelector(selector);
const E = value => String(value).replace(/[&<>"]/g, char => `&#${char.charCodeAt(0)};`);
const R = max => Math.random() * max | 0;
const U = () => Math.random().toString(36).slice(2, 9);
const sl = duration => new Promise(resolve => setTimeout(resolve, duration));
// Русское склонение: plural(5, 'предмет', 'предмета', 'предметов') → «предметов».
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
};
const itemsCount = n => `${n} ${plural(n, 'предмет', 'предмета', 'предметов')}`;
