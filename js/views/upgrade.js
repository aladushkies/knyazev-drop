// Вкладка «Князев Upgrade»: колесо апгрейда оценок
let ins = 0; // страховка текущего спина (только если ECON.insurance.enabled)
// Фоновое вращение стрелки (анимация sw, 12 с на оборот) не сбрасывается при перерисовке:
// фаза задаётся отрицательной задержкой от общей точки отсчёта.
const IDLE_PERIOD = 12000;
let idleStart = performance.now();
const idlePhaseDelay = () => `-${((performance.now() - idleStart) % IDLE_PERIOD) / 1000}s`;
const resumeIdleFrom = deg => { idleStart = performance.now() - (((deg % 360) + 360) % 360) / 360 * IDLE_PERIOD; };
const currentArrowAngle = el => {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m = new DOMMatrixReadOnly(t);
  return ((Math.atan2(m.b, m.a) * 180 / Math.PI) + 360) % 360;
};
function drawUpgrade() {
  if(sel>=S.inv.length)sel=-1;
  const selectedItem = S.inv[sel];
  if (selectedItem && selectedItem.r < 3 && tg <= selectedItem.r) tg = selectedItem.r + 1;
  const canUpgrade = Boolean(selectedItem && selectedItem.r < 3);
  const chance = canUpgrade ? Math.min(ECON.upgrade.cap, ECON.upgrade.coef * selectedItem.v / IT[tg][2]) : 0;
  const circumference = 2 * Math.PI * 118;
  // Баланс и кнопка пополнения живут в шапке вкладки (см. index.html, #upBn/#upBal).
  // Колесо апгрейда, под ним инвентарь. Кейсы открываются только во вкладке Cases.
  $('#ui').innerHTML = `
    <div class="upgrade-workspace">
      <div class="upgrade-slot">
        <span class="slot-caption">Исходная оценка</span>
        ${selectedItem
          ? cell(selectedItem)
          : '<div class="it r0"><big>?</big>Выберите предмет</div>'}
        <span class="slot-subtitle">${selectedItem ? `${RN[selectedItem.r]} · ${selectedItem.v} КК` : 'Выберите карточку в инвентаре'}</span>
      </div>

      <div class="upgrade-wheel-column">
        <div class="ring idle">
          <svg viewBox="0 0 280 280" aria-hidden="true">
            <defs>
              <linearGradient id="ga" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#435064" />
                <stop offset="1" stop-color="#0b0e12" />
              </linearGradient>
            </defs>
            <circle cx="140" cy="140" r="131" fill="none" stroke="#9aa6b4" stroke-width="5" stroke-dasharray="1.5 20.5" />
            <circle cx="140" cy="140" r="118" fill="none" stroke="#e3e7ed" stroke-width="14" />
            <path d="M140 3l7 11h-14z" fill="#0b0e12" />
            <circle cx="140" cy="140" r="118" fill="none" stroke="url(#ga)" stroke-width="14" stroke-dasharray="${circumference * chance / 100} ${circumference}" transform="rotate(-90 140 140)" />
          </svg>
          <div class="arw" id="arw" style="animation-delay:${idlePhaseDelay()}">
            <svg viewBox="0 0 280 280" aria-hidden="true">
              <path d="M140 12L162 56H146V140H134V56H118Z" fill="#0b0e12" />
            </svg>
            <div class="hd"></div>
          </div>
        </div>
        <div class="pct" aria-live="polite">${canUpgrade ? `${Math.round(chance)}%` : '—'}</div>
        <div class="chance-caption">Шанс успеха</div>
        ${canUpgrade ? '<div class="upgrade-risk">При неудаче карточка сгорит</div>' : ''}
      </div>

      <div class="upgrade-slot">
        <span class="slot-caption">Целевая оценка</span>
        ${canUpgrade
          ? cell(it(tg))
          : '<div class="it r1"><big>?</big>Цель апгрейда</div>'}
        <span class="slot-subtitle">${canUpgrade ? `Оценка ${tg + 2} · ${IT[tg][2]} КК` : 'Выберите цель ниже'}</span>
      </div>
    </div>

    <div class="upgrade-controls">
      ${canUpgrade ? `
        <div class="target-buttons" aria-label="Выберите целевую оценку">
          ${[1, 2, 3].filter(target => target > selectedItem.r).map(target => `
            <button class="b${target === tg ? ' is-selected' : ' g'}" data-t="${target}" aria-pressed="${target === tg ? 'true' : 'false'}">Оценка ${target + 2}</button>
          `).join('')}
        </div>
        <div class="up-action-row">
          <button class="b primary" data-spin>Запустить</button>
          ${selectedItem.o ? '' : `<button class="b g" data-sell>Продать за ${sellPrice(selectedItem.v)} КК</button>`}
          ${ECON.insurance.enabled ? `<button class="b g" data-ins>${ins ? 'Страховка ✓' : 'Страховка'} · ${Math.floor(selectedItem.v * ECON.insurance.costRate)} КК</button>` : ''}
        </div>
      ` : selectedItem ? `
        ${selectedItem.o ? '' : `<button class="b g" data-sell>Продать за ${sellPrice(selectedItem.v)} КК</button>`}
      ` : ``}
    </div>

    <section class="card inventory-section">
      <div class="section-heading">
        <div>
          <h3>Инвентарь</h3>
        </div>
        <span class="inventory-counter">${itemsCount(S.inv.length)}</span>
      </div>
      ${S.inv.length
        ? `<div class="inv">${S.inv.map((item, index) => `
            <div class="iw" data-i="${index}">${cell(item, index === sel ? 'sel' : '')}</div>
          `).join('')}</div>`
        : '<div class="upgrade-empty">Инвентарь пуст</div>'}
    </section>
  `;
}
$('#ui').onclick=e=> {
  const w=e.target.closest('.iw'),b=e.target.closest('button');
  if(b&&'t' in b.dataset&&!busy) {
    tg=+b.dataset.t;
    drawCases()
  } else if(b&&'spin'in b.dataset)up(tg);
  else if(b&&'ins'in b.dataset&&!busy){ins=ins?0:1;drawCases()}
  else if(b&&'sell'in b.dataset&&!busy) {
    const x=S.inv[sel];
    if(!x||x.o)return;
    S.inv.splice(sel,1);
    S.bal+=sellPrice(x.v);
    sel=-1;
    sv();
    drawCases()
  } else if(w&&!busy) {
    sel=+w.dataset.i===sel?-1:+w.dataset.i;
    ins=0;
    drawCases()
  }
};
async function up(t) {
  if(busy||sel<0||!S.inv[sel]||t<=S.inv[sel].r||t>3)return;
  busy=1;
  $('#ures').innerHTML='';
  const x=S.inv[sel];
  let insured=0;
  // Страховка (разд. 7): 25 % стоимости, при неудаче карточка не сгорает.
  // Покупка перед спином; EV страхуемого спина ниже — плата за снижение дисперсии.
  if(ECON.insurance.enabled&&ins){
    const cost=Math.floor(x.v*ECON.insurance.costRate);
    if(S.bal<cost){busy=0;ins=0;return toast('Не хватает КК на страховку')}
    S.bal-=cost;insured=1;
  }
  const ch=Math.min(ECON.upgrade.cap,ECON.upgrade.coef*x.v/IT[t][2]),roll=Math.random()*100,a=$('#arw'),ring=a.closest('.ring');
  // Стрелка не прыгает: фиксируем текущий угол, быстро докручиваем до 0 и только потом запускаем спин.
  const from=currentArrowAngle(a);
  ring.classList.remove('idle');
  a.style.animation='none';
  a.style.transition='none';
  a.style.transform=`rotate(${from}deg)`;
  void a.offsetWidth;
  const rewind=from>0.5?Math.max(.15,(360-from)/360*.6)*S.spd:0;
  if(rewind){
    a.style.transition=`transform ${rewind}s ease-in`;
    a.style.transform='rotate(360deg)';
    await sl(rewind*1000);
  }
  a.style.transition=`transform ${4.2*S.spd}s cubic-bezier(.1,.6,.1,1)`;
  a.style.transform=`rotate(${360+1800+roll*3.6}deg)`;
  await sl(4.2*S.spd*1000+300);
  const ok=roll<ch;
  ring.classList.add(ok?'win':'lose');
  if(ok) {
    S.inv[sel]=it(t);
    if(x.o)S.inv[sel].o=1
  } else if(!insured) S.inv.splice(sel,1);
  // Итог одной строкой; о сгоревшей оценке отдельно не сообщаем.
  const resultText = ok
    ? `Успех: ${x.g} → ${IT[t][1]} · теперь оценка ${S.inv[sel].g} (${S.inv[sel].v} КК)`
    : insured ? `Не повезло: ${x.g} → ${IT[t][1]} · страховка спасла оценку ${x.g}` : '';
  $('#ures').innerHTML=resultText?`<div class=rsl><div style="font-size:20px;font-weight:700;color:var(--t)">${resultText}</div></div>`:'';
  await sl(1300);
  sel=-1;
  ins=0;
  sv();
  busy=0;
  // Фоновое вращение продолжается с того места, где остановилась стрелка.
  resumeIdleFrom(roll*3.6);
  drawCases()
}
