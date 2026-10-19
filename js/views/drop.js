// Вкладка «Князев Drop»: розыгрыш мест, авто-режим, сброс
function drawDrop() {
  const c=cur();
  clean(c);
  const ps=c.people.filter(p=>p.n.trim()),un=ps.filter(p=>!c.asg[p.id]),ss=seats(c);
  map($('#m0'),c,0);
  fitMap($('#m0'));
  const free=ss.filter(s=>s.on&&!Object.values(c.asg).includes(s.k)).length;
  const rt=$('#rt');
  if(!rt.children.length&&!busy) {
    rt.style.transition='none';
    rt.style.transform='none';
    rt.innerHTML=seats(c).filter(s=>s.on).slice(0,14).map(s=>`<div class=sk>№${s.n}</div>`).join('')
  }
  if (!ps.length) {
    $('#fmsg').textContent = 'Добавьте людей во вкладке «Князев Class»';
  } else if (un.length) {
    const totalWays = waysToAssign(free, un.length);
    const digits = totalWays.toString();
    const isCompact = digits.length > 9;
    // Number(BigInt) > 1e308 даёт Infinity («NaN» в формуле), поэтому мантиссу
    // берём из первых цифр, а порядок — из длины числа.
    const scientific = Number(`${digits[0]}.${digits.slice(1, 16) || '0'}`).toExponential(2).split('e');
    const exponent = digits.length - 1 + Number(scientific[1]);
    const totalWaysText = isCompact
      ? `${scientific[0].replace('.', ',')} · 10<sup>${exponent}</sup>`
      : totalWays.toLocaleString('ru-RU');
    $('#fmsg').innerHTML = `Осталось ${un.length}. Способов рассадки: <span class="ways-formula"><span class="combination" role="img" aria-label="Сочетания из ${free} по ${un.length}"><span class="combination-letter">C</span><sup class="combination-upper">${free}</sup><sub class="combination-lower">${un.length}</sub></span> × ${un.length}! ${isCompact ? '≈' : '='} <span class="ways-value">${totalWaysText}</span></span>`;
  } else {
    $('#fmsg').textContent = 'Все на местах. Q.E.D. ∎';
  }
  $('#sl').innerHTML=ps.map(p=> {
    const s=ss.find(x=>x.k===c.asg[p.id]);
    return {
      p,
      n:s?s.n:999
    }
  }).sort((a,b)=>a.n-b.n).map(({
    p,n
  })=>`<div class="li${n>998?' w':''}"><b>${n>998?'·':'№'+n}</b>${E(p.n)}${n>998?'':`<i class=ux data-u=${p.id} title="Освободить место">×</i>`}</div>`).join('')||'<p class=m>Список пуст</p>';
  $('#sc').textContent=`${ps.length-un.length}/${ps.length}`;
  window.fitDropName?.();
  drawChips()
}
const BACK_ROW_PREFERRED=new Set(['Прохоров Марк','Андросов Никита','Зеленов Степан','Селицкий Лев','Курочкин Егор','Захаревич Илья']);
function backSeatKeys(c){
  const rows=[...new Set(c.desks.map(d=>Math.round(d.y/88)))].sort((a,b)=>a-b);
  const last=new Set(rows.slice(-2));
  return new Set(c.desks.filter(d=>last.has(Math.round(d.y/88))).flatMap(d=>d.s.map((on,i)=>on?`${d.id}:${i}`:null).filter(Boolean)));
}
async function drop() {
  const c=cur();
  if(busy)return 0;
  clean(c);
  const un=c.people.filter(p=>p.n.trim()&&!c.asg[p.id]),used=Object.values(c.asg),fr=seats(c).filter(s=>s.on&&!used.includes(s.k));
  if(!un.length) {
    toast('Все уже рассажены');
    return 0
  }
  if(fr.length<un.length) {
    toast(`Мест меньше, чем людей: ${fr.length} < ${un.length}`);
    return 0
  }
  busy=1;
  const p=un[R(un.length)],nm=$('#nm');
  let k=c.pre[p.id];
  if(!fr.some(s=>s.k===k) || Object.entries(c.pre).some(([id,key])=>id!==p.id&&key===k)) {
    const rs=un.filter(q=>q!==p).map(q=>c.pre[q.id]);
    let pl=fr.filter(s=>!rs.includes(s.k));
    if(!pl.length)pl=fr;
    const back=backSeatKeys(c),preferred=BACK_ROW_PREFERRED.has(p.n.trim());
    const preferredWaiting=un.filter(q=>q!==p&&BACK_ROW_PREFERRED.has(q.n.trim())&&!c.pre[q.id]).length;
    const backFree=pl.filter(s=>back.has(s.k));
    if(preferred&&backFree.length){
      // Strong preference with an occasional fully random outcome.
      if(Math.random()<.94)pl=backFree;
    }else if(!preferred&&backFree.length&&pl.length>backFree.length&&preferredWaiting){
      // Keep enough back-row places for pupils who prefer them, when possible.
      if(backFree.length<=preferredWaiting)pl=pl.filter(s=>!back.has(s.k));
    }
    k=pl[R(pl.length)].k
  }
  $('#rs').textContent='';
  nm.className='go';
  $('#rl').scrollIntoView({
    block:'nearest'
  });
  for(let i=0;i<22;i++) {
    nm.textContent=un[R(un.length)].n;
    await sl((45+i*i*.55)*S.spd)
  }
  nm.textContent=p.n;
  nm.className='fin';
  await sl(500*S.spd);
  {
    const rt=$('#rt'),W=$('#rl').offsetWidth,D=2.6*S.spd,tn=fr.find(s=>s.k===k).n,a=[];
    for(let i=0;i<40;i++)a.push(i==34?tn:fr[R(fr.length)].n);
    rt.innerHTML=a.map(n=>`<div class=sk>№${n}</div>`).join('');
    rt.style.transition='none';
    rt.style.transform='none';
    void rt.offsetWidth;
    rt.style.transition=`transform ${D}s cubic-bezier(.1,.7,.1,1)`;
    rt.style.transform=`translateX(${W/2-34*90-42+(Math.random()-.5)*40}px)`;
    const L=fr.length,ti=fr.findIndex(s=>s.k===k),si=R(L),ns=(ti-si+L)%L+L*Math.ceil(10/L);
    let pv;
    await Promise.all([(async()=> {
      for(let i=0;i<=ns;i++) {
        pv&&pv.classList.remove('hl');
        pv=$(`#m0 [data-k="${fr[(si+i)%L].k}"]`);
        if(pv) {
          pv.classList.add('hl');
          const dk=pv.parentNode,mw=$('#m0').closest('.mw');
          const dr=dk.getBoundingClientRect(),mr=mw.getBoundingClientRect();
          mw.scrollLeft+=dr.left+dr.width/2-(mr.left+mr.width/2)
        }
        await sl((30+170*Math.pow(i/ns,3))*S.spd)
      }
    })(),sl(D*1000+100)])
  }
  if(Object.values(c.asg).includes(k)||c.asg[p.id]) {
    document.querySelectorAll('#m0 .hl').forEach(n=>n.classList.remove('hl'));
    busy=0;
    return 0
  }
  c.asg[p.id]=k;
  sv();
  busy=0;
  drawDrop();
  const s=seats(c).find(x=>x.k===k),e=$(`#m0 [data-k="${k}"]`);
  if(e) {
    e.classList.add('hit');
    const desk=e.closest('.desk');
    if(desk)desk.classList.add('reveal');
    // Подсветка и увеличение плавно снимаются после результата.
    setTimeout(() => {e.classList.remove('hit');if(desk)desk.classList.remove('reveal')}, 2500);
    e.scrollIntoView({
      block:'nearest',inline:'nearest'
    })
  }
  // Результат читается по подсветке и увеличенной парте на схеме; без дублирующей подписи.
  $('#rs').textContent='';
  return 1
}
$('#go').onclick=()=>drop();
$('#cz').onclick=()=> {
  if(busy)return toast('Подождите, идёт розыгрыш');
  const c=cur();
  if(!Object.keys(c.asg).length)return toast('Рассадка и так пуста');
  if(!confirm('Очистить рассадку? Ученики и схема останутся — места можно разыграть заново.'))return;
  auto=0;
  c.asg = {};
  sv();
  $('#rt').innerHTML='';
  $('#rs').textContent='';
  $('#nm').className='';
  $('#nm').textContent='Князев Drop';
  draw();
  toast('Рассадка очищена')
};
$('#sl').onclick=e=> {
  const i=e.target.closest('[data-u]');
  if(!i||busy)return;
  delete cur().asg[i.dataset.u];
  sv();
  draw();
  toast('Место освобождено')
};
$('#au').onclick=async()=> {
  if(auto) {
    auto=0;
    return
  }
  if(busy)return;
  auto=1;
  $('#au').textContent='Стоп';
  while(auto&&await drop())await sl(700*S.spd);
  auto=0;
  $('#au').textContent='Авто до конца'
};
// Скачивание схемы рассадки в PNG (аналог «Скачать фото с точками» в MOGG).
function downloadScheme() {
  const c = cur();
  clean(c);
  const list = c.desks;
  if (!list.length) return toast('Сначала добавьте парты в конструкторе класса');
  // asg маппит id ученика → место; имена берём из c.people.
  const assigned = {};
  c.people.forEach(p => { if (c.asg[p.id]) assigned[c.asg[p.id]] = p.n; });
  const scale = 2;
  const W = Math.max(360, ...list.map(d => d.x + 152)) + 32;
  const H = Math.max(240, ...list.map(d => d.y + 64)) + 76;
  const cv = document.createElement('canvas');
  cv.width = W * scale; cv.height = H * scale;
  const g = cv.getContext('2d');
  g.scale(scale, scale);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.fillStyle = '#0b1526'; g.font = '700 15px "Segoe UI","KD Sans",sans-serif';
  g.fillText(`Князев Drop · рассадка · ${c.name}`, W / 2, 26);
  const ss = seats(c), by = 44;
  for (const d of list) {
    const x = d.x + 16, y = d.y + by;
    rr(x, y, 136, 64, 12);
    g.fillStyle = '#ffffff'; g.fill();
    g.strokeStyle = '#0b1526'; g.lineWidth = 1.5; g.stroke();
    for (const i of [0, 1]) {
      const s = ss.find(v => v.k === d.id + ':' + i);
      if (!s) continue;
      const cx = x + i * 68 + 34;
      if (s.on) {
        g.fillStyle = '#0b1526'; g.font = '700 15px "Segoe UI","KD Sans",sans-serif';
        g.fillText(String(s.n), cx, y + 25);
        const nm = assigned[s.k];
        if (nm) {
          const label = nm.trim().split(/\s+/)[0];
          let size = 12;
          g.font = `${size}px "Segoe UI","KD Sans",sans-serif`;
          while (size > 8 && g.measureText(label).width > 62) g.font = `${--size}px "Segoe UI","KD Sans",sans-serif`;
          g.fillStyle = '#475569';
          g.fillText(label, cx, y + 45, 64);
        }
      } else {
        g.fillStyle = '#94a3b8'; g.font = '700 15px "Segoe UI","KD Sans",sans-serif';
        g.fillText('—', cx, y + 30);
      }
      if (i === 1) { g.strokeStyle = '#cbd5e1'; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x + 68, y + 8); g.lineTo(x + 68, y + 56); g.stroke(); g.setLineDash([]); }
    }
  }
  g.fillStyle = '#94a3b8'; g.font = '11px "Segoe UI","KD Sans",sans-serif';
  g.fillText('ФМШ 2007 · Князев Drop гарантирует биекцию', W / 2, H - 16);
  return saveCanvasImage(cv, `knyazevdrop-rassadka-${c.name}.png`)
    .then(saved => { if (saved) toast('Фото рассадки сохранено'); })
    .catch(error => { console.warn('Не удалось сохранить рассадку', error); toast('Не удалось сохранить фото рассадки'); });
}
let fitTimer = 0;
window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => fitMap($('#m0')), 120); });
let schemeSaving = false;
$('#dlScheme').onclick = () => {
  if (schemeSaving) return;
  schemeSaving = true;
  Promise.resolve(downloadScheme()).finally(() => { schemeSaving = false; });
};
