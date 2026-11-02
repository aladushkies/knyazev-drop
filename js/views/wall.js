// Князев Wall: отправка сообщения в Cloudflare Worker (он шлёт его модератору в Telegram)
const WALL_API='https://ВАШ-ВОРКЕР.ВАШ-АККАУНТ.workers.dev/submit'; // <-- поменять после деплоя
(()=>{
  const f=document.getElementById('wallForm');if(!f)return;
  const t=document.getElementById('wallText'),c=document.getElementById('wallCnt'),m=document.getElementById('wallMsg'),b=document.getElementById('wallBtn');
  t.oninput=()=>c.textContent=t.value.length+' / 1000';
  f.onsubmit=async e=>{
    e.preventDefault();
    const text=t.value.trim();if(!text)return;
    if(Date.now()-(+localStorage.wallLast||0)<60000){m.className='err';m.textContent='Подожди минуту перед следующим сообщением';return}
    b.disabled=true;m.className='';m.textContent='Отправляем…';
    try{
      const r=await fetch(WALL_API,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text,name:document.getElementById('wallName').value.trim(),website:document.getElementById('wallHp').value})});
      if(!r.ok)throw 0;
      localStorage.wallLast=Date.now();t.value='';c.textContent='0 / 1000';
      m.className='ok';m.textContent='Отправлено на модерацию ✓';
    }catch(_){m.className='err';m.textContent='Не получилось отправить, попробуй позже'}
    b.disabled=false;
  };
})();
