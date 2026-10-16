// Модель классов: создание, стартовая сетка, миграции сохранений, cur()
const gen = (rows, columns) => {
  const desks = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      desks.push({
        id: U(), x: 16 + column * 152, y: 16 + row * 88, s: [1, 1]
      });
    }
  }
  return desks;
};
function addCl(name) {
  const newClass = {
    id: U(),
    name,
    desks: gen(5, 3),
    people: [],
    asg: {},
    pre: {}
  };
  S.cl.push(newClass);
  S.cur = newClass.id;
  sv();
  return newClass;
}
// Старая стандартная схема: 3 ряда по 5 парт, нетронутая пользователем.
const isOldDefaultGrid = desks => desks.length === 15 && desks.every(desk =>
  desk.s && desk.s[0] === 1 && desk.s[1] === 1 &&
  desk.x === 16 + Math.round((desk.x - 16) / 152) * 152 &&
  desk.y === 16 + Math.round((desk.y - 16) / 88) * 88 &&
  (desk.x - 16) / 152 >= 0 && (desk.x - 16) / 152 <= 4 &&
  (desk.y - 16) / 88 >= 0 && (desk.y - 16) / 88 <= 2
) && new Set(desks.map(desk => desk.x + ':' + desk.y)).size === 15;
function setupDefaultClasses() {
  if (!Array.isArray(S.cl)) S.cl = [];
  // Старый стартовый класс назывался «Класс 10А». Если он пуст, сохраняем его схему,
  // но переименовываем, чтобы не потерять пользовательские настройки парт.
  const legacyTenA = S.cl.find(classItem => classItem.name === 'Класс 10А' && !(classItem.people || []).some(person => person.n && person.n.trim()));
  if (!S.cl.length) addCl('10А');
  let classTenA = S.cl.find(classItem => classItem.name === '10А');
  if (!classTenA && legacyTenA) {
    legacyTenA.name = '10А';
    classTenA = legacyTenA;
  }
  if (!classTenA) classTenA = addCl('10А');
  let defaultClass = S.cl.find(classItem => classItem.name === 'Класс');
  if (!defaultClass) defaultClass = classTenA;
  // Поддерживаем старые сохранения и добавляем только отсутствующие фамилии.
  for (const classItem of S.cl) {
    classItem.desks = Array.isArray(classItem.desks) ? classItem.desks : gen(5, 3);
    classItem.people = Array.isArray(classItem.people) ? classItem.people : [];
    classItem.asg = classItem.asg || {};
    classItem.pre = classItem.pre || {};
  }
  for (const classItem of S.cl) {
    classItem.people.forEach(person => {
      const fixed = NAME_FIXES[String(person.n || '').trim().toLocaleLowerCase('ru')];
      if (fixed) person.n = fixed;
    });
    // Один раз переводим нетронутую старую сетку 3×5 на новую 5×3 (только если нет рассадки и заданных мест).
    if (!S.layout53 && isOldDefaultGrid(classItem.desks) && !Object.keys(classItem.asg).length && !Object.keys(classItem.pre).length) {
      classItem.desks = gen(5, 3);
    }
  }
  S.layout53 = true;
  classTenA.people = Array.isArray(classTenA.people) ? classTenA.people : [];
  classTenA.people.forEach(person => {
    if (!person.id) person.id = U();
    person.n = String(person.n || '');
  });
  const existingNames = new Set(classTenA.people.map(person => person.n.trim().toLocaleLowerCase('ru')));
  for (const name of DEFAULT_STUDENTS) {
    if (!existingNames.has(name.toLocaleLowerCase('ru'))) {
      classTenA.people.push({
        id: U(), n: name
      });
      existingNames.add(name.toLocaleLowerCase('ru'));
    }
  }
  classTenA.people.sort((first, second) => first.n.localeCompare(second.n, 'ru'));
  if (!S.setupV3) {
    S.cur = classTenA.id;
    S.setupV3 = true;
  }
  // Rename the existing class in place to preserve pupils, seating and stored references.
  let class9V = S.cl.find(classItem => classItem.name === CLASS_9V_NAME);
  const old11A = S.cl.find(classItem => classItem.name === '11А');
  if (old11A && !class9V) {
    old11A.name = CLASS_9V_NAME;
    class9V = old11A;
  } else if (old11A && class9V && old11A.id !== class9V.id) {
    // Merge pupils without deleting an existing class or its seating layout.
    const present = new Set(class9V.people.map(person => String(person.n || '').trim().toLocaleLowerCase('ru')));
    for (const person of old11A.people) {
      const key = String(person.n || '').trim().toLocaleLowerCase('ru');
      if (key && !present.has(key)) { class9V.people.push(person); present.add(key); }
    }
    // Keep the older class's layout intact if both classes already exist.
    old11A.name = '9В (старый класс)';
  }
  if (!class9V) {
    class9V = { id: U(), name: CLASS_9V_NAME, desks: gen(5, 3), people: [], asg: {}, pre: {} };
    S.cl.push(class9V);
  }
  const names9V = new Set(class9V.people.map(person => String(person.n || '').trim().toLocaleLowerCase('ru')));
  for (const name of STUDENTS_9V) {
    if (!names9V.has(name.toLocaleLowerCase('ru'))) { class9V.people.push({ id: U(), n: name }); names9V.add(name.toLocaleLowerCase('ru')); }
  }
  class9V.people.sort((first, second) => first.n.localeCompare(second.n, 'ru'));
  if (!S.setupV4) {
    S.cur = class9V.id;
    S.setupV4 = true;
  }
  if (!S.cl.some(classItem => classItem.id === S.cur)) S.cur = classTenA.id;
  sv();
}
setupDefaultClasses();
const cur = () => S.cl.find(classItem => classItem.id === S.cur) || (S.cur = S.cl[0].id, S.cl[0]);
