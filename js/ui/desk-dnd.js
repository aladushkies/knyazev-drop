// Перетаскивание парт в редакторе схемы
function dnd(el) {
  const step=16, snap=n=>Math.max(0,Math.round(n/step)*step);
  let drag=null;
  const overlaps=(desk,x,y)=>cur().desks.some(other=>other!==desk&&Math.abs(other.x-x)<136&&Math.abs(other.y-y)<64);
  el.onpointerdown=e=>{
    const node=e.target.closest('.desk');
    if(!node||e.target.closest('input,.x'))return;
    const desk=cur().desks.find(d=>d.id===node.dataset.d);
    if(!desk)return;
    const rect=el.getBoundingClientRect();
    drag={node,desk,id:e.pointerId,startX:desk.x,startY:desk.y,
      offsetX:e.clientX-rect.left-desk.x,offsetY:e.clientY-rect.top-desk.y};
    el.setPointerCapture(e.pointerId);
    node.style.zIndex=3;
  };
  el.onpointermove=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const rect=el.getBoundingClientRect();
    const x=snap(e.clientX-rect.left-drag.offsetX),y=snap(e.clientY-rect.top-drag.offsetY);
    drag.node.style.left=x+'px';drag.node.style.top=y+'px';
    drag.node.classList.toggle('collision',overlaps(drag.desk,x,y));
  };
  const finish=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const {node,desk,startX,startY}=drag;
    const x=snap(parseFloat(node.style.left)),y=snap(parseFloat(node.style.top));
    if(!overlaps(desk,x,y)){desk.x=x;desk.y=y;}
    else {desk.x=startX;desk.y=startY;toast('Здесь уже стоит другая парта');}
    node.style.zIndex='';drag=null;sv();draw();
  };
  el.onpointerup=finish;el.onpointercancel=finish;
  el.onclick=e=>{
    const x=e.target.closest('.x');if(!x)return;
    const c=cur();c.desks=c.desks.filter(d=>d.id!==x.parentNode.dataset.d);
    clean(c);sv();draw();
  };
  el.onchange=e=>{
    const k=e.target.dataset.k;if(!k)return;
    const c=cur(),[d,i]=k.split(':');
    const desk=c.desks.find(q=>q.id===d);if(!desk)return;desk.s[+i]=e.target.checked?1:0;
    clean(c);sv();draw();
  };
}
dnd($('#m1'));
