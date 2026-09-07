const $ = selector => document.querySelector(selector);
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const compact = (value, length = 24) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

const profile = read('pathwiseProfile', {});
const storedPlan = read('pathwisePlan', {});
const plan = profile.stage && profile.target ? storedPlan : {};
const completed = new Set(read('pathwiseTasks', []));
const verified = new Set(read('pathwiseTaskProofs', []));
const history = read('pathwisePlanHistory', []);
const fallback = {
  stages: [
    { title:'建立职业画像', why:'确认你现在的位置与想去的方向。', tasks:['补齐基本信息'] },
    { title:'形成能力证据', why:'通过真实行动缩小岗位差距。', tasks:['完成一项目标岗位成果', '获得一次外部反馈'] },
    { title:'毕业求职冲刺', why:'把积累转化为岗位机会。', tasks:['完成目标岗位投递'] }
  ],
  graduationRoles: [{ title:profile.target || '目标岗位' }, { title:'相邻可达方向' }, { title:'长期进阶方向' }],
  actionGuides: []
};
const stages = Array.isArray(plan.stages) && plan.stages.length ? plan.stages.slice(0, 3) : fallback.stages;
const roles = Array.isArray(plan.graduationRoles) && plan.graduationRoles.length ? plan.graduationRoles.slice(0, 3) : fallback.graduationRoles;
const guides = Array.isArray(plan.actionGuides) ? plan.actionGuides : [];
const rawDestination = String(roles[0]?.title || profile.target || '毕业目标');
const destination = rawDestination.replace(/^（[^）]+）$/, '').trim() || profile.target || '毕业目标';
const taskNodes = stages.flatMap((stage, stageIndex) => {
  const source = stageIndex === 0 && Array.isArray(plan.actions) && plan.actions.length ? plan.actions : (stage.tasks || []);
  return source.slice(0, 2).map(title => ({ title, stage, stageIndex, type:'action' }));
}).slice(0, 5);
const weightedProgress = window.PathwiseModel.getWeightedProgress(Object.keys(plan).length ? plan : fallback, completed, verified);
const originStage = {
  title:'职业起点',
  why:profile.stage ? '基于你的阶段、专业和目标建立路径起点。' : '先提供阶段、专业和目标，AI 才能判断路径起点。',
  tasks:profile.stage ? [] : ['补齐基本信息']
};
const mainNodes = [
  { title:profile.stage ? `${profile.stage} · ${profile.major || '已建立画像'}` : '建立职业画像', stage:originStage, type:'origin' },
  ...taskNodes,
  { title:destination, stage:stages[2], type:'goal' }
];
const baseCoords = [[92,545], [255,480], [405,405], [545,335], [675,270], [800,205], [905,135]];
const taskEndRatio = title => {
  const index = weightedProgress.tasks.findIndex(task => task.title === title);
  if (index < 0 || !weightedProgress.totalWeight) return .5;
  const through = weightedProgress.tasks.slice(0, index + 1).reduce((sum, task) => sum + task.effort, 0);
  return through / weightedProgress.totalWeight;
};
const coords = mainNodes.map(node => node.type === 'origin' ? baseCoords[0] : node.type === 'goal' ? baseCoords[baseCoords.length - 1] : pointOnPolyline(baseCoords, taskEndRatio(node.title)));
const firstPendingIndex = mainNodes.findIndex((node, index) => index > 0 && node.type === 'action' && !verified.has(node.title));
const currentIndex = profile.stage ? (firstPendingIndex >= 0 ? firstPendingIndex : mainNodes.length - 1) : 0;
const ns = 'http://www.w3.org/2000/svg';

function svg(name, attrs = {}) {
  const element = document.createElementNS(ns, name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}
function linePath(points) { return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' '); }
function pointOnPolyline(points, ratio) {
  const partial = partialPolyline(points, ratio);
  return partial[partial.length - 1];
}
function partialPolyline(points, ratio) {
  if (ratio <= 0) return [points[0]];
  if (ratio >= 1) return points;
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  const target = lengths.reduce((sum, length) => sum + length, 0) * ratio;
  const result = [points[0]];
  let walked = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    if (walked + lengths[index] <= target) { result.push(points[index + 1]); walked += lengths[index]; continue; }
    const segmentRatio = (target - walked) / lengths[index];
    result.push([points[index][0] + (points[index + 1][0] - points[index][0]) * segmentRatio, points[index][1] + (points[index + 1][1] - points[index][1]) * segmentRatio]);
    break;
  }
  return result;
}
function findGuide(title) { return guides.find(item => item.title === title) || {}; }
function showStation(node, index, status) {
  const guide = findGuide(node.title);
  const steps = guide.steps || (node.stage?.tasks || []).filter(item => item !== node.title).slice(0, 3);
  $('#stationType').textContent = node.type === 'goal' ? 'DESTINATION' : node.type === 'origin' ? 'ORIGIN' : status === 'done' ? 'COMPLETED STATION' : status === 'current' ? 'CURRENT STATION' : 'UPCOMING STATION';
  $('#stationTitle').textContent = node.title;
  $('#stationWhy').textContent = guide.why || node.stage?.why || '这是当前路径上的必要一步。';
  $('#stationSteps').innerHTML = (steps.length ? steps : ['打开行动指导，将这一站拆成具体步骤']).map(item => `<li>${safe(item)}</li>`).join('');
  $('#stationDone').textContent = guide.doneWhen || node.stage?.doneWhen || '形成可查看、可复述的成果';
  $('#stationPanel').classList.add('open');
  document.querySelectorAll('.route-station').forEach(item => item.classList.toggle('selected', Number(item.dataset.index) === index));
}
function drawStation(node, index, [x, y], status) {
  const group = svg('g', { class:`route-station ${status}`, 'data-index':index, transform:`translate(${x} ${y})`, tabindex:'0', role:'button', 'aria-label':node.title });
  group.style.setProperty('--station-delay', `${180 + index * 75}ms`);
  group.append(svg('circle', { r:status === 'current' ? 16 : 12, class:'station-ring' }), svg('circle', { r:status === 'current' ? 7 : 5, class:'station-core' }));
  const label = svg('text', { x:'0', y:'-24', 'text-anchor':x > 820 ? 'end' : 'middle', class:'station-label' });
  label.textContent = compact(node.title, 20);
  group.appendChild(label);
  const code = svg('text', { x:'0', y:'27', 'text-anchor':'middle', class:'station-code' });
  code.textContent = node.type === 'goal' ? 'GOAL' : node.type === 'branch' ? 'ALT' : String(index).padStart(2, '0');
  group.appendChild(code);
  group.addEventListener('click', () => showStation(node, index, status));
  group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showStation(node, index, status); } });
  $('#routeStations').appendChild(group);
}

const lines = $('#routeLines');
lines.appendChild(svg('path', { d:linePath(baseCoords), class:'route-main-line' }));
const traveledPoints = partialPolyline(baseCoords, weightedProgress.percent / 100);
lines.appendChild(svg('path', { d:linePath(traveledPoints), class:'route-traveled' }));
const progressPoint = traveledPoints[traveledPoints.length - 1];
if (profile.stage && weightedProgress.percent > 0 && weightedProgress.percent < 100) lines.appendChild(svg('circle', { cx:progressPoint[0], cy:progressPoint[1], r:'7', class:'route-live-marker' }));
const branchStart = pointOnPolyline(baseCoords, .64);
[{ role:roles[1], end:[915,330], color:'branch-a' }, { role:roles[2], end:[900,520], color:'branch-b' }]
  .filter(item => item.role?.title)
  .forEach((branch, index) => {
    const midpoint = [branchStart[0] + 100, branch.end[1] - (index ? 35 : -35)];
    lines.appendChild(svg('path', { d:linePath([branchStart, midpoint, branch.end]), class:`route-branch ${branch.color}` }));
    drawStation({ title:branch.role.title, stage:stages[2], type:'branch' }, mainNodes.length + index, branch.end, 'branch');
  });
mainNodes.forEach((node, index) => {
  const status = node.type === 'action' && verified.has(node.title) ? 'done' : node.type === 'action' && completed.has(node.title) ? 'proof-pending' : index === currentIndex ? 'current' : 'future';
  drawStation(node, index, coords[index], status);
});

const current = mainNodes[currentIndex];
const next = mainNodes[Math.min(mainNodes.length - 1, currentIndex + 1)];
$('#mapDestination').textContent = destination;
$('#currentStop').textContent = current.title;
$('#currentReason').textContent = current.stage?.why || '这是规划中的当前位置。';
$('#nextStop').textContent = next.title;
const percent = weightedProgress.percent;
$('#routePercent').textContent = `${percent}%`;
$('#routeProgressFill').style.width = `${percent}%`;
$('#routeProgressMeta').textContent = weightedProgress.totalWeight ? `已获得 ${Number(weightedProgress.creditedWeight.toFixed(1))} / ${weightedProgress.totalWeight} 路径点` : '按行动难度与投入估算';
$('#mapUpdated').textContent = plan.source === 'ai' ? 'AI 已根据最新画像生成' : '等待第一份智能规划';
const lastChange = history[history.length - 1];
if (lastChange) {
  $('#rerouteNote').hidden = false;
  $('#rerouteTitle').textContent = lastChange.previousRole && lastChange.previousRole !== lastChange.role ? `${lastChange.previousRole} → ${lastChange.role}` : '行动优先级已更新';
  const progressChanged = Number.isFinite(lastChange.previousProgress) && lastChange.previousProgress !== lastChange.progress;
  $('#rerouteReason').textContent = lastChange.previousGap && lastChange.previousGap !== lastChange.gap
    ? `关键差距变为：${lastChange.gap}`
    : progressChanged
      ? `路线重估 ${lastChange.previousProgress}% → ${lastChange.progress}%：行动难度或顺序已改变`
      : `下一站：${lastChange.action || next.title}`;
  $('#mapUpdated').textContent = `${lastChange.mode === 'ai' ? 'AI' : '本地规划'} · ${new Date(lastChange.at).toLocaleDateString('zh-CN')}`;
}
showStation(current, currentIndex, currentIndex ? 'current' : 'origin');
$('#closeStation').addEventListener('click', () => $('#stationPanel').classList.remove('open'));
$('#centerCurrent').addEventListener('click', () => {
  const element = document.querySelector(`.route-station[data-index="${currentIndex}"]`);
  element?.classList.add('pulse');
  setTimeout(() => element?.classList.remove('pulse'), 900);
  showStation(current, currentIndex, 'current');
});
