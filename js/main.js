// Точка входа: навигация по вкладкам и первая отрисовка
const TN=['Drop','Cases','Upgrade','MOGG'];
// «Князев » скрывается на телефоне, чтобы все четыре вкладки помещались в экран
$('#nv').innerHTML=TN.map(n=>`<button type="button"><span class="nv-pre">Князев </span><span class="nv-name">${n}</span></button>`).join('');
let activeTab=0;
const showClass=()=>{if(busy)return toast('Дождитесь окончания розыгрыша');activeTab=-1;document.body.dataset.tab='class';[...$('#nv').children].forEach(b=>b.className='');[0,1,2,3,4,5].forEach(j=>$('#t'+j).hidden=j!==1);$('#cbar').hidden=true;drawClass()};
// Страница команды открывается из футера и не входит в меню — как конструктор Class.
const showTeam=()=>{if(busy)return toast('Дождитесь окончания розыгрыша');activeTab=-1;document.body.dataset.tab='team';[...$('#nv').children].forEach(b=>b.className='');[0,1,2,3,4,5].forEach(j=>$('#t'+j).hidden=j!==5);$('#cbar').hidden=true;drawTeam();syncPills();window.scrollTo(0,0)};
const go=i=> {
  if(busy && i!==activeTab)return toast('Дождитесь окончания розыгрыша');
  activeTab=i;
  document.body.dataset.tab=i;
  [...$('#nv').children].forEach((b,j)=>b.className=j===i?'on':'');
  const sectionByTab={0:0,1:2,2:3,3:4};
  [0,1,2,3,4,5].forEach(j=>$('#t'+j).hidden=j!==sectionByTab[i]);
  $('#cbar').hidden=i!==0;
  // Правки людей в конструкторе не перерисовывают Drop — обновляем при возврате.
  if(i===0&&!busy)drawDrop();
  if(i===1||i===2)drawCases();
  if(i===3&&window.KD)KD.refreshMogg();
};
$('#teamLink').onclick=showTeam;
$('#backTeam').onclick=()=>go(0);
$('#teamToMogg').onclick=()=>{go(3);window.scrollTo(0,0)};
const mtl=$('#mogTeamLink');if(mtl)mtl.onclick=showTeam;
$('#nv').onclick=e=> {
  const i=[...$('#nv').children].indexOf(e.target.closest('button'));
  if(i>=0)go(i)
};
function draw() {
  drawBar();
  drawDrop();
  drawClass();
  drawCases()
}
$('#st').innerHTML=Array.from({
  length:12
},()=>cell(it(pick(CS[0][2])))).join('');
// Мост в бандл MOGG (завёрнут в IIFE): баланс, бонус и оплата анализа КК.
window.KD = {
  bal: () => S.bal,
  cost: () => ECON.mogg.analysisCost,
  bonusAmount: () => ECON.bonus.amount,
  claimBonus: () => claimBonus(),
  spend: v => { if (S.bal < v) return false; S.bal -= v; sv(); drawChips(); return true },
  refund: v => { S.bal += v; sv(); drawChips() },
  refreshMogg: () => {
    if (typeof syncPills === 'function') syncPills();
    const hint = document.getElementById('mogCostHint');
    if (hint) hint.textContent = `Анализ стоит ${ECON.mogg.analysisCost} КК — списывается с баланса, при ошибке возвращается.`;
  }
};

// Кнопки бонуса в шапках вкладок Cases/Upgrade (элементы статичны, вешаем один раз).
const bindBn = id => { const b = document.getElementById(id); if (b) b.onclick = () => claimBonus(); };
bindBn('caseBn'); bindBn('upBn');
const dls = document.getElementById('dlScheme'); if (dls) dls.onclick = () => downloadScheme();

// Награда прерванного кейса (экономика v2.0, разд. 3): результат определяется
// в момент открытия и пишется в S.pend; если вкладку закрыли посреди рулетки,
// карточка выдаётся при следующей загрузке.
if (S.pend != null) {
  const p = Number(S.pend);
  if (Number.isInteger(p) && IT[p]) S.inv.push(it(p));
  S.pend = null;
  sv();
}
// Карточки из сохранения пересобираем по каталогу: битые записи отбрасываются,
// а название/стоимость всегда соответствуют текущей экономике.
S.inv = S.inv.filter(x => x && Number.isInteger(x.r) && IT[x.r]).map(x => Object.assign(it(x.r), x.o ? { o: 1 } : {}));
syncPills();
go(0);
draw();
