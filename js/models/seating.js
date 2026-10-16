// Модель рассадки: нумерация мест, очистка, число сочетаний
function seats(classData) {
  let seatNumber = 0;
  const result = [];
  const sortedDesks = [...classData.desks].sort((first, second) =>
    Math.round(first.y / 88) - Math.round(second.y / 88) || first.x - second.x
  );

  sortedDesks.forEach(desk => {
    desk.s.forEach((isEnabled, seatIndex) => {
      result.push({
        k: `${desk.id}:${seatIndex}`,
        n: isEnabled ? ++seatNumber : 0,
        on: isEnabled
      });
    });
  });

  return result;
}

function clean(classData) {
  const availableSeats = new Set(
    seats(classData).filter(seat => seat.on).map(seat => seat.k)
  );
  const peopleIds = new Set(
    classData.people.filter(person => person.n.trim()).map(person => person.id)
  );

  for (const assignmentMap of [classData.asg, classData.pre]) {
    for (const [personId, seatKey] of Object.entries(assignmentMap)) {
      if (!availableSeats.has(seatKey) || !peopleIds.has(personId)) {
        delete assignmentMap[personId];
      }
    }
  }
}

// Число сочетаний C(n, k) = n! / (k! (n-k)!) без вычисления факториалов
const comb = (n, k) => {
  if (k < 0 || k > n) return '0';
  k = Math.min(k, n - k);
  let result = 1n;
  for (let i = 1n; i <= BigInt(k); i++) {
    result = result * (BigInt(n) - BigInt(k) + i) / i;
  }

  const value = String(result);
  return value.length > 9
    ? `${value[0]},${value.slice(1, 3)}·10^${value.length - 1}`
    : value;
};


// Число способов рассадить k разных учеников на n разных мест: n!/(n-k)!.
function waysToAssign(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return 0n;
  let total = 1n;
  for (let i = 0; i < k; i++) total *= BigInt(n - i);
  return total;
}
