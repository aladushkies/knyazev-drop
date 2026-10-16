// Вкладка «Князев Class»: редактор схемы и управление классами
const free=c=> {
  for(let y=16;;y+=88)for(let x=16;x<=928;x+=152)if(!c.desks.some(d=>Math.abs(d.x-x)<136&&Math.abs(d.y-y)<64))return[x,y]
};
const nn=(i,d)=>Math.min(12,Math.max(1,+$(i).value||d));
function saveClassName(){const name=$('#cn').value.trim();if(!name)return toast('Введите название класса');cur().name=name;sv();draw();toast('Класс сохранён')}
$('#cn').onchange=saveClassName;
$('#saveClass').onclick=saveClassName;
$('#classSelect').onchange=e=>{if(busy){e.target.value=S.cur;return toast('Дождитесь окончания розыгрыша')}S.cur=e.target.value;sv();$('#rt').innerHTML='';draw()};
$('#backDrop').onclick=()=>go(0);
$('#ad').onclick=()=> {
  const c=cur(),[x,y]=free(c);
  c.desks.push({
    id:U(),x,y,s:[1,1]
  });
  sv();
  draw()
};
$('#ar').onclick=()=> {
  const c=cur(),y=c.desks.length?Math.max(...c.desks.map(d=>d.y))+88:16;
  for(let j=0;j<nn('#cc',3);j++){const x=16+j*152;if(!c.desks.some(d=>Math.abs(d.x-x)<136&&Math.abs(d.y-y)<64))c.desks.push({id:U(),x,y,s:[1,1]});}
  sv();
  draw()
};
$('#gn').onclick=()=> {
  const c=cur();
  if(c.desks.length&&!confirm('Заменить схему новой сеткой?'))return;
  c.desks=gen(nn('#rr',5),nn('#cc',3));
  clean(c);
  sv();
  draw()
};
$('#cx').onclick=()=> {
  if(!confirm('Очистить схему?'))return;
  const c=cur();
  c.desks=[];
  clean(c);
  sv();
  draw()
};
function drawClass() {
  const c=cur();
  $('#cn').value=c.name;
  $('#classSelect').innerHTML=S.cl.map(x=>`<option value="${E(x.id)}"${x.id===c.id?' selected':''}>${E(x.name)}</option>`).join('');
  map($('#m1'),c,1);
  $('#sn').textContent=`Парт: ${c.desks.length} · мест в розыгрыше: ${seats(c).filter(s=>s.on).length}`;
  rp()
}
