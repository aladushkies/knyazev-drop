// Страница «Князев Team»: данные о людях в одном месте, каждый человек выводится один раз.
// Разовый бонус за заход на страницу: флаг S.tb хранится в сохранении (localStorage, kd1).
const TEAM_BONUS = 500;
// Участники выводятся в случайном порядке при каждом открытии страницы (Фишер — Йейтс).
const TEAM = [
  { n: 'Андросов Никита',   r: 'дизайн · структурирование идей' },
  { n: 'Зеленов Степан',    r: 'разработка' },
  { n: 'Максимович Михаил', r: 'разработка · дизайн · спонсор · владелец домена' },
  { n: 'Прохоров Марк',     r: 'спонсор' },
  { n: 'Селицкий Лев',      r: 'разработка · дизайн' },
  { n: 'Слепых Алёна',      r: 'спонсор' }
];
const shuffled = list => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = R(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
let teamBonusJustClaimed = false;
let teamBonusHideTimer = null;
function drawTeam() {
  $('#teamList').innerHTML = shuffled(TEAM).map(p => `<li><b>${E(p.n)}</b><span>${E(p.r)}</span></li>`).join('');
  drawTeamBonus();
}
function drawTeamBonus() {
  const bn = $('#teamBn');
  // Уже полученный ранее бонус не занимает место в шапке. После получения
  // оставляем короткое подтверждение, а затем убираем кнопку целиком.
  bn.hidden = !!S.tb && !teamBonusJustClaimed;
  bn.disabled = !!S.tb;
  bn.textContent = S.tb ? 'Бонус получен' : `Бонус +${TEAM_BONUS}`;
}
const claimTeamBonus = () => {
  if (S.tb) return false;
  S.tb = 1;
  S.bal += TEAM_BONUS;
  teamBonusJustClaimed = true;
  sv();
  toast(`Спасибо, что заглянули: +${TEAM_BONUS} КК`);
  drawChips();
  drawTeamBonus();
  if (teamBonusHideTimer) clearTimeout(teamBonusHideTimer);
  teamBonusHideTimer = setTimeout(() => {
    teamBonusJustClaimed = false;
    const bn = $('#teamBn');
    if (bn) bn.hidden = true;
  }, 2600);
  return true;
};
$('#teamBn').onclick = claimTeamBonus;
drawTeam();
