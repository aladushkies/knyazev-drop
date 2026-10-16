// Состояние приложения (localStorage, ключ kd1) и флаги интерфейса
let S;
try {
  S = JSON.parse(localStorage.getItem('kd1'));
} catch (error) {
  S = null;
}
// Повреждённое сохранение (число, строка, массив) не должно ронять сайт.
if (!S || typeof S !== 'object' || Array.isArray(S)) S = null;
S = S || {
  cl: [], cur: 0, spd: 1, bal: ECON.startBalance, inv: [], bt: 0
};
if (!Array.isArray(S.inv)) S.inv = [];
if (!Number.isFinite(S.bal)) S.bal = ECON.startBalance;
if (!Number.isFinite(S.bt)) S.bt = 0;
S.tb = S.tb ? 1 : 0; // разовый бонус страницы «Князев Team» уже получен?
// spd — множитель длительности анимаций; NaN ломал бы все паузы и переходы.
if (!Number.isFinite(S.spd) || S.spd <= 0) S.spd = 1;
S.v2 = 1;
const sv = () => {try{localStorage.setItem('kd1', JSON.stringify(S))}catch(error){console.warn('Сохранение недоступно',error)}};
let busy = 0;
let auto = 0;
let sel = -1;
let tg = 1;
