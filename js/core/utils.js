// Утилиты: $, E (экранирование), R (случайное), U (id), sl (пауза)
const $ = selector => document.querySelector(selector);
const E = value => String(value).replace(/[&<>"]/g, char => `&#${char.charCodeAt(0)};`);
const R = max => Math.random() * max | 0;
const U = () => Math.random().toString(36).slice(2, 9);
const sl = duration => new Promise(resolve => setTimeout(resolve, duration));
