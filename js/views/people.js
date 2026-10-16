// Список людей класса
function rp() {
  const c=cur();
  $('#pl').innerHTML=c.people.map(p=>`<div class=pr><input data-p=${p.id} value="${E(p.n)}" placeholder="Фамилия Имя"><i data-p=${p.id}>×</i></div>`).join('');
  pc()
}
const pc=()=>{$('#pc').textContent=cur().people.filter(p=>p.n.trim()).length;drawChips()};
$('#pl').oninput=e=> {
  const p=cur().people.find(x=>x.id===e.target.dataset.p);
  if(p) {
    p.n=e.target.value;
    sv();
    pc()
  }
};
$('#pl').onclick=e=> {
  const i=e.target.closest('i');
  if(!i)return;
  const c=cur(),p=c.people.find(x=>x.id===i.dataset.p),n=i.previousElementSibling;
  if(p.n) {
    p.n='';
    n.value='';
    n.focus()
  } else {
    c.people=c.people.filter(x=>x!==p);
    rp()
  }
  clean(c);
  sv();
  pc()
};
$('#pp').onclick=()=> {
  cur().people.push({
    id:U(),n:''
  });
  sv();
  rp();
  [...document.querySelectorAll('#pl input')].pop().focus()
};
$('#bt').onclick=()=>$('#bw').hidden=!$('#bw').hidden;
$('#bo').onclick=()=> {
  const c=cur();
  $('#bx').value.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean).forEach(n=>c.people.push({
    id:U(),n
  }));
  $('#bx').value='';
  $('#bw').hidden=1;
  sv();
  rp()
};
$('#px').onclick=()=> {
  if(!confirm('Очистить список людей и рассадку?'))return;
  const c=cur();
  c.people=[];
  c.asg = {};
  c.pre = {};
  sv();
  $('#rt').innerHTML='';
  draw()
};
