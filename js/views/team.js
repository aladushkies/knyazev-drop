// Страница «Князев Team»: данные о людях в одном месте, каждый человек выводится один раз.
// Разовый бонус за заход на страницу: флаг S.tb хранится в сохранении (localStorage, kd1).
const TEAM_BONUS = 500;
const TEAM = [
  { n: 'Селицкий Лев',      r: 'разработка · дизайн' },
  { n: 'Зеленов Степан',    r: 'разработка' },
  { n: 'Андросов Никита',   r: 'дизайн · структурирование идей' },
  { n: 'Максимович Михаил', r: 'разработка · спонсор · владелец домена' },
  { n: 'Прохоров Марк',     r: 'спонсор' },
  { n: 'Слепых Алена',      r: 'спонсор' }
];
const TEAM_AI = [
  { n: 'Claude', url: 'https://claude.ai/' },
  { n: 'ChatGPT', url: 'https://chatgpt.com/' },
  { n: 'Gemini', url: 'https://gemini.google.com/' },
  { n: 'Kimi', url: 'https://kimi.ai/' }
];
let teamBonusJustClaimed = false;
let teamBonusHideTimer = null;
function drawTeam() {
  $('#teamList').innerHTML = TEAM.map(p => `<li><b>${E(p.n)}</b><span>${E(p.r)}</span></li>`).join('');
  $('#teamAi').innerHTML = TEAM_AI.map(ai => `<a class="team-ai-name" href="${E(ai.url)}" target="_blank" rel="noopener noreferrer">${E(ai.n)}</a>`).join('');
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
  drawTeam();
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
