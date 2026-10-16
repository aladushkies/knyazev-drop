// Вкладка «Князев Cases»: открытие кейсов, инвентарь, бонус
// Бонус за вход (+ECON.bonus.amount КК раз в ECON.bonus.cooldownMs мс).
// Общий для Cases, Upgrade и MOGG. Эксплойт Б-1: часы, переведённые назад,
// не сбрасывают кулдаун — ожидание отсчитывается заново (полный кулдаун),
// но бонус не блокируется навсегда, если часы вернули к правильному времени.
const claimBonus=()=> {
  const now=Date.now();
  if(now<S.bt){S.bt=now;sv()}
  const w=ECON.bonus.cooldownMs-(now-S.bt);
  if(w>0){toast('Бонус через '+Math.ceil(w/1000)+' с');return false}
  S.bt=now;
  S.bal+=ECON.bonus.amount;
  sv();
  // Во время спина полная перерисовка уничтожила бы колесо/ленту — обновляем только баланс.
  if(busy)drawChips();else drawCases();
  return true
};
function drawCases() {
  drawChips();
  // Баланс и бонус живут в шапке вкладки (см. index.html, #caseBn/#caseBal).
  $('#cb').innerHTML = `
    <p class="m">ФМШ 2007 · условная валюта «Князев-коины» (КК).</p>
    <div class="cg">
      ${CS.map((item, index) => `
        <button class="cse" data-c="${index}">
          <big>${index ? '∑' : '✎'}</big>
          <b>${item[0]}</b>
          <span>${item[1]} КК</span>

        </button>
      `).join('')}
    </div>
  `;
  // Единый инвентарь со Upgrade: та же белая карточка, заголовок и счётчик.
  $('#casesInventory').innerHTML = `
    <section class="card inventory-section">
      <div class="section-heading">
        <div>
          <h3>Инвентарь</h3>
          <p class="m">Продайте карточку или улучшите её во вкладке Upgrade.</p>
        </div>
        <span class="inventory-counter">${S.inv.length} предмет(ов)</span>
      </div>
      ${S.inv.length ? `<div class="cases-items">${S.inv.map((item,index)=>`<div class="cases-item">${cell(item)}<strong>${item.v} КК</strong><div class="item-actions">${item.o?'<span class="m">Личная оценка</span>':`<button class="b g" data-case-sell="${index}" type="button">Продать</button>`}${item.r<3?`<button class="b g" data-case-up="${index}" type="button">Улучшить</button>`:''}</div></div>`).join('')}</div>`:'<div class="upgrade-empty">Инвентарь пока пуст. Откройте кейс «Домашка» или «Самостоятельная».</div>'}
    </section>
  `;
  drawUpgrade();
}
$('#t2').onclick=e=> {
  const b=e.target.closest('button');
  if(!b)return;
  if('caseSell' in b.dataset){if(busy)return;const index=Number(b.dataset.caseSell),x=S.inv[index];if(!x||x.o)return;const sp=sellPrice(x.v);S.inv.splice(index,1);S.bal+=sp;if(sel===index)sel=-1;else if(sel>index)sel--;sv();drawCases();toast(`Продано за ${sp} КК`);return;}
  if('caseUp' in b.dataset){if(busy)return;sel=Number(b.dataset.caseUp);go(2);return;}
  if(b.dataset.c)openC(+b.dataset.c)
};
async function openC(ci) {
  if(busy)return;
  if(!Number.isInteger(ci)||!CS[ci])return;
  const[,p,w]=CS[ci];
  if(S.bal<p)return toast('Не хватает КК');
  busy=1;
  S.bal-=p;
  sv();
  drawCases();
  const win=pick(w),st=$('#st'),a=[];
  // Защита Б-3 (минимальная): перед записью pend перечитываем баланс и
  // инвентарь из localStorage, чтобы вторая вкладка не потеряла изменения.
  try{const f=JSON.parse(localStorage.getItem('kd1'));if(f&&Array.isArray(f.inv))S.inv=f.inv;if(f&&Number.isFinite(f.bal))S.bal=f.bal}catch(_){}
  S.pend=win;
  sv();
  for(let i=0;i<60;i++)a.push(i==50?win:pick(w));
  $('#res').innerHTML='';
  st.style.transition='none';
  st.style.transform='none';
  st.innerHTML=a.map(j=>cell(it(j))).join('');
  void st.offsetWidth;
  st.style.transition=`transform ${5*S.spd}s cubic-bezier(.1,.7,.1,1)`;
  st.style.transform=`translateX(${$('#vw').offsetWidth/2-50*110-52+(Math.random()-.5)*70}px)`;
  await sl(5*S.spd*1000+200);
  const x=it(win);
  S.inv.push(x);
  S.pend=null;
  sv();
  busy=0;
  drawCases();
  $('#res').innerHTML=`<div class=rsl><span class=m>Князев Result</span><div class="it r${x.r}" style="margin:6px auto;width:160px;height:130px"><big>${x.g}</big>${E(x.n)}<small>${RN[x.r]} · ${x.v} КК</small></div></div>`
}
