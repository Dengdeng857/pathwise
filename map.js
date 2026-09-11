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
const hasRoute = Boolean(profile.stage && profile.target && Object.keys(plan).length);
const completed = new Set(read('pathwiseTasks', []));
const verified = new Set(read('pathwiseTaskProofs', []));
const history = read('pathwisePlanHistory', []);
const trajectory = read('pathwiseTrajectoryHistory', []);
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
const currentRoles = Array.isArray(plan.currentRoles) ? plan.currentRoles.filter(item => item?.title) : [];
const gaps = Array.isArray(plan.gaps) ? plan.gaps.filter(Boolean) : [];
const guides = Array.isArray(plan.actionGuides) ? plan.actionGuides : [];
const rawDestination = String(roles[0]?.title || profile.target || '毕业目标');
const destination = rawDestination.replace(/^（[^）]+）$/, '').trim() || profile.target || '毕业目标';
const taskNodes = stages.flatMap((stage, stageIndex) => {
  const source = stageIndex === 0 && Array.isArray(plan.actions) && plan.actions.length ? plan.actions : (stage.tasks || []);
  return source.slice(0, 2).map(title => ({ title, stage, stageIndex, type:'action' }));
}).slice(0, 5);
const weightedProgress = window.PathwiseModel.getWeightedProgress(Object.keys(plan).length ? plan : fallback, completed, verified);
const previousMilestones = read('pathwiseMapMilestones', []);
const mapFeedback = window.PathwiseFeedbackModel.buildMapFeedback({ weightedProgress, trajectory, previousUnlocked:previousMilestones });
localStorage.setItem('pathwiseMapMilestones', JSON.stringify(mapFeedback.unlocked));
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
function curvePath(points) {
  if (points.length < 2) return linePath(points);
  let path = `M${points[0][0]} ${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const first = [start[0] + (end[0] - before[0]) / 6, start[1] + (end[1] - before[1]) / 6];
    const second = [end[0] - (after[0] - start[0]) / 6, end[1] - (after[1] - start[1]) / 6];
    path += ` C${first[0]} ${first[1]} ${second[0]} ${second[1]} ${end[0]} ${end[1]}`;
  }
  return path;
}
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
function branchGuide(keyword, fallbackGuide = {}) {
  return guides.find(item => `${item.title} ${item.why || ''}`.includes(keyword)) || fallbackGuide;
}
function careerFamily(title = '') {
  const families = ['产品', '运营', '策略', '风控', '安全', '开发', '工程', '算法', '设计', '数据', '咨询', '销售', '研究'];
  return families.filter(keyword => String(title).includes(keyword));
}
function roleForkRatio(roleTitle = '') {
  const targetFamilies = careerFamily(destination);
  const roleFamilies = careerFamily(roleTitle);
  const sharesFoundation = roleFamilies.some(item => targetFamilies.includes(item))
    || (targetFamilies.includes('产品') && roleFamilies.some(item => ['策略', '风控', '运营'].includes(item)))
    || (roleFamilies.includes('产品') && targetFamilies.some(item => ['策略', '风控', '运营'].includes(item)));
  return sharesFoundation ? .72 : .48;
}
function inferredRoleAlternatives(target = '') {
  const rules = [
    { test:/风控.*产品|产品.*风控/, titles:['策略产品经理', '安全产品经理'] },
    { test:/AI.*产品|产品.*AI/i, titles:['策略产品经理', '数据产品经理'] },
    { test:/产品/, titles:['策略产品经理', '产品运营'] },
    { test:/安全/, titles:['安全开发工程师', 'AI 安全工程师'] },
    { test:/算法|机器学习|人工智能|AI/i, titles:['数据科学家', 'AI 应用工程师'] },
    { test:/开发|工程/, titles:['测试开发工程师', '平台工程师'] },
    { test:/数据/, titles:['商业分析师', '策略分析师'] },
    { test:/设计/, titles:['产品设计师', '用户研究员'] },
    { test:/运营/, titles:['策略运营', '商业化运营'] }
  ];
  return (rules.find(rule => rule.test.test(target))?.titles || ['相邻职能方向', '长期进阶方向'])
    .map(title => ({ title, reason:`与“${target}”共享部分基础能力，可作为降低单一路径风险的探索方向。` }));
}
function buildBranchSpecs() {
  const entry = currentRoles[1] || currentRoles[0] || roles[1];
  const roleCandidates = [...roles.slice(1), ...currentRoles, ...inferredRoleAlternatives(destination)]
    .filter(item => item?.title && item.title !== destination && item.title !== entry?.title)
    .filter((item, index, list) => list.findIndex(other => other.title === item.title) === index);
  const adjacent = roleCandidates[0];
  const longTerm = roleCandidates[1];
  const firstGap = gaps[0] || '补齐目标岗位最关键的能力证据';
  const secondGap = gaps[1] || '形成一项可以被招聘方验证的成果';
  const firstGuide = guides[0] || {};
  const secondGuide = guides[1] || firstGuide;
  const gapGuide = branchGuide(compact(firstGap, 6), firstGuide);
  const proofGuide = branchGuide(compact(secondGap, 6), secondGuide);
  return [
    {
      ratio:.18, title:entry?.title || '现实入口岗位',
      why:entry?.reason || '先从现有能力最容易获得反馈的岗位切入，积累下一段路径需要的经历。',
      steps:entry?.reason ? ['核对该岗位的硬性门槛', '寻找 10 个真实岗位并记录高频要求', '完成一次针对性投递或模拟面试'] : [],
      doneWhen:'得到一次真实投递、面试或从业者反馈', end:[230,390], rejoin:.31, kind:'quest', color:'branch-a', code:'ENTRY'
    },
    {
      ratio:.36, title:compact(firstGap.replace(/[：:].*$/, ''), 15) || '核心能力支线',
      why:`这条支线对应当前最关键的差距：${firstGap}`,
      steps:gapGuide.steps || [firstGap, '产出一个可展示的练习或作品', '请从业者按岗位标准给出反馈'],
      doneWhen:gapGuide.doneWhen || '形成能够证明该能力的作品或测评结果', end:[445,255], rejoin:.52, kind:'quest', color:'branch-b', code:'SKILL'
    },
    {
      ratio:.54, title:compact(secondGap.replace(/[：:].*$/, ''), 15) || '成果证明支线',
      why:`能力只有变成证据才会改变岗位判断：${secondGap}`,
      steps:proofGuide.steps || [secondGap, '整理过程、结果与个人贡献', '把成果加入进展与证据链'],
      doneWhen:proofGuide.doneWhen || '留下可查看、可复述、可验证的成果', end:[655,395], rejoin:.71, kind:'quest', color:'branch-c', code:'PROOF'
    },
    {
      ratio:roleForkRatio(adjacent?.title), title:adjacent?.title || `${compact(destination, 10)}的相邻方向`,
      why:adjacent?.reason || '这是与主目标共享较多能力、可以降低求职风险的相邻方向。',
      steps:['比较它与主目标的共同能力', '完成一次岗位样本调研', '决定保留为备选还是并入主路线'],
      doneWhen:'完成岗位对比并做出有证据的选择', end:[745,88], kind:'destination', color:'branch-d', code:'OPTION B'
    },
    {
      ratio:roleForkRatio(longTerm?.title) - .08, title:longTerm?.title || `${compact(destination, 10)}的进阶路线`,
      why:longTerm?.reason || '这是基于当前目标延展出的长期落点，不要求现在立刻切换。',
      steps:['了解该方向的典型成长路径', '识别与主路线共享的积累', '在获得新证据后重新评估'],
      doneWhen:'明确进入条件，并保留为可探索方向', end:[865,345], kind:'destination', color:'branch-e', code:'OPTION C'
    }
  ];
}
function showStation(node, index, status) {
  const guide = findGuide(node.title);
  const steps = node.steps || guide.steps || (node.stage?.tasks || []).filter(item => item !== node.title).slice(0, 3);
  $('#stationType').textContent = node.type === 'goal' ? 'DESTINATION' : node.type === 'origin' ? 'ORIGIN' : node.type === 'branch' ? (node.kind === 'quest' ? 'SIDE QUEST · REJOINS MAIN ROUTE' : 'OPTIONAL DESTINATION') : status === 'done' ? 'COMPLETED STATION' : status === 'current' ? 'CURRENT STATION' : 'UPCOMING STATION';
  $('#stationTitle').textContent = node.title;
  $('#stationWhy').textContent = node.why || guide.why || node.stage?.why || '这是当前路径上的必要一步。';
  $('#stationSteps').innerHTML = (steps.length ? steps : ['打开行动指导，将这一站拆成具体步骤']).map(item => `<li>${safe(item)}</li>`).join('');
  $('#stationDone').textContent = node.doneWhen || guide.doneWhen || node.stage?.doneWhen || '形成可查看、可复述的成果';
  $('#stationPanel').classList.add('open');
  document.querySelectorAll('.route-station').forEach(item => item.classList.toggle('selected', Number(item.dataset.index) === index));
}
function drawStation(node, index, [x, y], status) {
  const group = svg('g', { class:`route-station ${status} ${node.kind || ''}`.trim(), 'data-index':index, transform:`translate(${x} ${y})`, tabindex:'0', role:'button', 'aria-label':node.title });
  group.style.setProperty('--station-delay', `${180 + index * 75}ms`);
  group.append(svg('circle', { r:status === 'current' ? 16 : 12, class:'station-ring' }), svg('circle', { r:status === 'current' ? 7 : 5, class:'station-core' }));
  const labelBelow = !node.kind && index % 2 === 0 && node.type !== 'goal';
  const labelY = labelBelow ? 37 : -24;
  const label = svg('text', { x:'0', y:labelY, 'text-anchor':x > 820 ? 'end' : 'middle', class:'station-label' });
  label.textContent = compact(node.title, 20);
  group.appendChild(label);
  const code = svg('text', { x:'0', y:'27', 'text-anchor':'middle', class:'station-code' });
  code.setAttribute('y', labelBelow ? '53' : '27');
  code.textContent = node.type === 'goal' ? 'GOAL' : node.type === 'branch' ? (node.code || 'ALT') : String(index).padStart(2, '0');
  group.appendChild(code);
  group.addEventListener('click', () => showStation(node, index, status));
  group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showStation(node, index, status); } });
  $('#routeStations').appendChild(group);
}

const lines = $('#routeLines');
lines.appendChild(svg('path', { d:curvePath(baseCoords), class:'route-main-line' }));
const traveledPoints = partialPolyline(baseCoords, weightedProgress.percent / 100);
lines.appendChild(svg('path', { d:curvePath(traveledPoints), class:'route-traveled' }));
const progressPoint = traveledPoints[traveledPoints.length - 1];
if (profile.stage && weightedProgress.percent > 0 && weightedProgress.percent < 100) lines.appendChild(svg('circle', { cx:progressPoint[0], cy:progressPoint[1], r:'7', class:'route-live-marker' }));
const branchSpecs = hasRoute ? buildBranchSpecs() : [];
const destinationForks = branchSpecs.filter(branch => branch.kind === 'destination').map(branch => branch.ratio);
const destinationFork = destinationForks.length ? Math.min(...destinationForks) : 1;
branchSpecs.forEach((branch, index) => {
  const start = pointOnPolyline(baseCoords, branch.kind === 'destination' ? destinationFork : branch.ratio);
  const routePoints = [start, [(start[0] + branch.end[0]) / 2, (start[1] + branch.end[1]) / 2], branch.end];
  if (branch.rejoin) {
    const rejoin = pointOnPolyline(baseCoords, branch.rejoin);
    routePoints.push([(branch.end[0] + rejoin[0]) / 2, (branch.end[1] + rejoin[1]) / 2], rejoin);
  }
  lines.appendChild(svg('path', { d:curvePath(routePoints), class:`route-branch ${branch.kind} ${branch.color}` }));
  if (branch.kind === 'destination') lines.appendChild(svg('circle', { cx:start[0], cy:start[1], r:'4', class:'route-junction' }));
  drawStation({ ...branch, stage:stages[Math.min(2, Math.floor(index / 2))], type:'branch' }, mainNodes.length + index, branch.end, 'branch');
});
mainNodes.forEach((node, index) => {
  const status = node.type === 'action' && verified.has(node.title) ? 'done' : node.type === 'action' && completed.has(node.title) ? 'proof-pending' : index === currentIndex ? 'current' : 'future';
  drawStation(node, index, coords[index], status);
});

if (!hasRoute) {
  const canvas = $('#routeCanvas');
  canvas.classList.add('is-empty');
  canvas.insertAdjacentHTML('beforeend', '<div class="route-empty"><span class="route-empty-mark">P</span><strong>你的职业地图还没绘制</strong><p>先建立画像，地图会根据目标、行动成果和面试反馈动态改道。</p><a href="career.html#overview">建立第一份画像 ↗</a></div>');
  document.querySelector('.map-layer-switch').setAttribute('hidden', '');
}

const current = mainNodes[currentIndex];
const next = mainNodes[Math.min(mainNodes.length - 1, currentIndex + 1)];
$('#mapDestination').textContent = destination;
$('#currentStop').textContent = current.title;
$('#currentReason').textContent = current.stage?.why || '这是规划中的当前位置。';
$('#nextStop').textContent = next.title;
const percent = weightedProgress.percent;
$('#routePercent').textContent = `${percent}%`;
$('#routeProgressFill').style.width = `${percent}%`;
$('#routeProgressMeta').textContent = weightedProgress.totalWeight ? `已获得 ${Number(weightedProgress.creditedWeight.toFixed(1))} / ${weightedProgress.totalWeight} 路径点 · ${mapFeedback.mapProgress}% 已有成果验证` : '按行动难度与投入估算';
$('#nextMilestone').textContent = mapFeedback.next ? `下一里程碑：${mapFeedback.next.title} · ${mapFeedback.next.progress}%` : '当前路线的里程碑已经全部点亮';
$('#mapUpdated').textContent = !hasRoute ? '从你的第一份画像开始' : plan.source === 'ai' ? 'AI 已根据最新画像生成' : '等待第一份智能规划';
const lastChange = history[history.length - 1];
const lastTrajectory = trajectory[trajectory.length - 1];
if (lastTrajectory?.narrative) {
  $('#rerouteNote').hidden = false;
  $('#rerouteTitle').textContent = lastTrajectory.narrative.headline;
  $('#rerouteReason').textContent = lastTrajectory.narrative.why;
  $('#mapUpdated').textContent = `${lastTrajectory.source === 'ai' ? 'AI 解释' : '规则校准'} · ${new Date(lastTrajectory.at).toLocaleDateString('zh-CN')}`;
} else if (lastChange) {
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
$('#closeStation').addEventListener('click', () => $('#stationPanel').classList.remove('open'));
$('#centerCurrent').addEventListener('click', () => {
  const element = document.querySelector(`.route-station[data-index="${currentIndex}"]`);
  element?.classList.add('pulse');
  setTimeout(() => element?.classList.remove('pulse'), 900);
  showStation(current, currentIndex, 'current');
});
document.querySelectorAll('[data-map-layer]').forEach(button => button.addEventListener('click', () => {
  const layer = button.dataset.mapLayer;
  document.querySelectorAll('[data-map-layer]').forEach(item => item.classList.toggle('active', item === button));
  $('#routeCanvas').dataset.layer = layer;
}));
const unlockedFeedback = mapFeedback.newlyUnlocked.at(-1);
if (unlockedFeedback) {
  const feedbackBox = $('#mapFeedback');
  feedbackBox.hidden = false;
  feedbackBox.dataset.visual = unlockedFeedback.visual;
  $('#feedbackTitle').textContent = unlockedFeedback.title;
  $('#feedbackMessage').textContent = unlockedFeedback.message;
  feedbackBox.querySelector('button').addEventListener('click', () => { feedbackBox.hidden = true; });
}
