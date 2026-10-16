// Панель выбора класса
function drawBar() {
  // Панель класса живёт в шапке вкладки Drop (справа, как пилюли в других вкладках).
  $('#cbar').innerHTML=`<button class="b" id="classLink" type="button" aria-label="Открыть конструктор класса" title="Открыть конструктор класса">Князев <span class="brand-word">Class</span></button><select id=cs class="b" aria-label="Текущий класс">${S.cl.map(c=>`<option value="${E(c.id)}"${c.id===S.cur?' selected':''}>${E(c.name)}</option>`).join('')}</select>`;
  $('#classLink').onclick=()=>showClass();
  $('#cs').onchange=e=> {
    if(busy){e.target.value=S.cur;return toast('Дождитесь окончания розыгрыша')}
    S.cur=e.target.value;
    sv();
    $('#rt').innerHTML='';
    draw()
  };
  $('#nc').onclick=()=> {
    if(busy)return toast('Дождитесь окончания розыгрыша');
    const n=prompt('Название класса','Класс 11Б');
    if(n) {
      addCl(n);
      $('#rt').innerHTML='';
      draw()
    }
  }
}
