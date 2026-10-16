// Отрисовка схемы класса (парты и места)
function map(element, classData, isEditing) {
  const seatList = seats(classData);
  const assignedStudents = {};
  classData.people.forEach(person => {
    if (classData.asg[person.id]) assignedStudents[classData.asg[person.id]] = person.n;
  });

  // Отступ справа равен отступу слева (16px) — иначе средний ряд смещается от центра доски.
  let width = 360;
  let height = 240;
  classData.desks.forEach(desk => {
    width = Math.max(width, desk.x + 136 + 16);
    height = Math.max(height, desk.y + 88);
  });

  element.className = `map${isEditing ? ' edit' : ''}`;
  element.style.cssText = `width:${width}px;height:${height}px`;

  if (!classData.desks.length) {
    element.innerHTML = '<p class="m" style="padding:20px">Схема пуста: нажмите «+ Парта» или создайте сетку</p>';
    return;
  }

  element.innerHTML = classData.desks.map(desk => {
    const seatsMarkup = [0, 1].map(seatIndex => {
      const seat = seatList.find(item => item.k === `${desk.id}:${seatIndex}`);
      const studentName = assignedStudents[seat.k];
      const classes = [
        'seat',
        seat.on ? '' : 'off',
        studentName && !isEditing ? 'tk' : ''
      ].filter(Boolean).join(' ');
      const checkbox = isEditing
        ? `<input type="checkbox" data-k="${seat.k}"${seat.on ? ' checked' : ''}>`
        : '';
      const firstName = studentName && !isEditing
        ? `<em>${E(studentName.split(' ')[0])}</em>`
        : '';

      return `
        <div class="${classes}" data-k="${seat.k}">
          ${checkbox}
          <b>${seat.on ? seat.n : '—'}</b>
          ${firstName}
        </div>
      `;
    }).join('');

    return `
      <div class="desk" data-d="${desk.id}" style="left:${desk.x}px;top:${desk.y}px">
        ${isEditing ? '<i class="x">×</i>' : ''}
        ${seatsMarkup}
      </div>
    `;
  }).join('');
}
