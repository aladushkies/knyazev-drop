// Данные кейсов и оценок: IT, RN, CS, генерация предметов, выбор по шансам.
// Источник — константа ECON в js/data/economy.js (экономика v2.0).
const IT = ECON.items.map(x => [x.n, x.g, x.v, x.r]);
const RN = ECON.rarities;
// Порядок шансов: двойка, тройка, четвёрка, пятёрка. Сумма в каждом кейсе — 100 %
// (инвариант №1 проверяет validateEconomy() из js/data/economy.js).
const DROP_CHANCES = ECON.cases[0].chances;
const CS = ECON.cases.map(c => [c.name, c.price, c.chances]);
// Цена продажи карточки: ECON.sell.rate от стоимости (сейчас 100 %, без комиссии).
const sellPrice = v => Math.floor(v * ECON.sell.rate);
const it=j=>({
  n:IT[j][0],
  g:IT[j][1],
  v:IT[j][2],
  r:IT[j][3]
}),cell=(x,k='')=>`<div class="it r${x.r} ${k}"><big>${E(x.g)}</big>${E(x.n)}<small>${x.o?'своя оценка':E(x.v)+' КК'}</small></div>`;
const pick=w=> {
  let r=Math.random()*100,i=0;
  while(i<3&&r>=w[i])r-=w[i++];
  const l=IT.map((_,j)=>j).filter(j=>IT[j][3]===i);
  return l[R(l.length)]
};
