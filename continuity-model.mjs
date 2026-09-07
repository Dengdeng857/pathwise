const text = value => String(value || '').trim();
const list = value => Array.isArray(value) ? value : [];

function roles(plan = {}) {
  return [...list(plan.currentRoles).map(item => ({ ...item, horizon: 'current' })),
    ...list(plan.graduationRoles).map(item => ({ ...item, horizon: 'graduation' }))]
    .filter(item => text(item.title));
}

function roleKey(role) {
  return `${role.horizon}:${text(role.title).toLowerCase()}`;
}

function stringDiff(before, after) {
  const oldSet = new Set(list(before).map(text).filter(Boolean));
  const newSet = new Set(list(after).map(text).filter(Boolean));
  return {
    added: [...newSet].filter(item => !oldSet.has(item)),
    removed: [...oldSet].filter(item => !newSet.has(item))
  };
}

export function buildContinuityDelta(previousPlan = {}, nextPlan = {}, evidence = {}) {
  const before = new Map(roles(previousPlan).map(role => [roleKey(role), role]));
  const after = new Map(roles(nextPlan).map(role => [roleKey(role), role]));
  const roleChanges = [];

  for (const [key, role] of after) {
    const old = before.get(key);
    if (!old) {
      roleChanges.push({ type: 'role-added', title: role.title, horizon: role.horizon, match: Number(role.match) || 0 });
      continue;
    }
    const from = Number(old.match) || 0;
    const to = Number(role.match) || 0;
    if (Math.abs(to - from) >= 3) roleChanges.push({ type: 'match-changed', title: role.title, horizon: role.horizon, from, to, delta: to - from });
  }
  for (const [key, role] of before) {
    if (!after.has(key)) roleChanges.push({ type: 'role-removed', title: role.title, horizon: role.horizon, match: Number(role.match) || 0 });
  }

  const gaps = stringDiff(previousPlan.gaps, nextPlan.gaps);
  const actions = stringDiff(previousPlan.actions, nextPlan.actions);
  const stageBefore = list(previousPlan.stages).map(item => text(item.title));
  const stageAfter = list(nextPlan.stages).map(item => text(item.title));
  const stagesChanged = JSON.stringify(stageBefore) !== JSON.stringify(stageAfter);
  const strongestMatchMove = roleChanges.reduce((max, item) => Math.max(max, Math.abs(item.delta || 0)), 0);
  const routeChanged = roleChanges.some(item => item.type === 'role-added' || item.type === 'role-removed') || stagesChanged;
  const priorityChanged = actions.added.length > 0 || actions.removed.length > 0 || gaps.added.length > 0 || gaps.removed.length > 0;
  const impactScore = Math.min(100, Math.round(
    strongestMatchMove * 2 +
    roleChanges.filter(item => item.type !== 'match-changed').length * 16 +
    (actions.added.length + actions.removed.length) * 7 +
    (gaps.added.length + gaps.removed.length) * 7 +
    (stagesChanged ? 18 : 0)
  ));

  return {
    version: 1,
    kind: routeChanged ? 'route-change' : priorityChanged ? 'priority-shift' : roleChanges.length ? 'fit-update' : 'no-material-change',
    impactScore,
    evidence: {
      type: text(evidence.type).slice(0, 80),
      label: text(evidence.label || evidence.name || evidence.title).slice(0, 120),
      excerpt: text(evidence.content).replace(/\s+/g, ' ').slice(0, 240)
    },
    roleChanges: roleChanges.sort((a, b) => Math.abs(b.delta || 20) - Math.abs(a.delta || 20)).slice(0, 8),
    gaps: { added: gaps.added.slice(0, 5), resolved: gaps.removed.slice(0, 5) },
    actions: { added: actions.added.slice(0, 5), deprioritized: actions.removed.slice(0, 5) },
    stagesChanged,
    summaryChanged: text(previousPlan.summary) !== text(nextPlan.summary),
    changed: routeChanged || priorityChanged || roleChanges.length > 0
  };
}

export function validateContinuityNarrative(value) {
  if (!value || typeof value !== 'object') throw new Error('变化解释不是对象');
  const required = ['headline', 'why', 'nextMove', 'confidence'];
  if (required.some(key => !text(value[key]))) throw new Error('变化解释字段不完整');
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) throw new Error('变化解释置信度无效');
  return {
    headline: text(value.headline).slice(0, 60),
    why: text(value.why).slice(0, 180),
    nextMove: text(value.nextMove).slice(0, 120),
    confidence: Math.round(confidence)
  };
}

export function fallbackContinuityNarrative(delta) {
  if (!delta.changed) return { headline: '路线暂时不需要改变', why: '这份新材料尚未形成足以改变岗位判断的新增证据。', nextMove: '补充可验证的结果、数据或外部反馈。', confidence: 90 };
  const move = delta.roleChanges.find(item => item.type === 'match-changed');
  const headline = delta.kind === 'route-change' ? '你的职业路线出现了新分支' : delta.kind === 'priority-shift' ? '下一步的优先级已调整' : '岗位匹配判断已更新';
  const why = move ? `${move.title}的证据匹配度由 ${move.from} 调整为 ${move.to}。` : `本次材料带来了 ${delta.roleChanges.length + delta.gaps.added.length + delta.gaps.resolved.length} 项有效变化。`;
  return { headline, why, nextMove: delta.actions.added[0] || '沿更新后的第一优先行动继续积累证据。', confidence: 70 };
}
