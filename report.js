const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const compact = (value, size = 110) => {
  const output = String(value || '').replace(/\s+/g, ' ').trim();
  return output.length > size ? `${output.slice(0, size - 1)}…` : output;
};

const profile = read('pathwiseProfile', {});
const evidence = Array.isArray(profile.evidence) ? profile.evidence : [];
const trajectory = read('pathwiseTrajectoryHistory', []).filter(item => item?.delta && item?.narrative).slice(-20).reverse();
const labels = { 'route-change':'路线改变', 'priority-shift':'优先级调整', 'fit-update':'匹配度更新', 'no-material-change':'判断保持' };
document.body.classList.add(trajectory.length ? 'has-trajectory' : 'empty-report');

function evidenceFor(item) {
  const linked = evidence.find(entry => entry?.addedAt && entry.addedAt === item.evidenceId);
  return linked || item.delta?.evidence || {};
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '历史记录';
  return new Intl.DateTimeFormat('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(date);
}

function confidenceLabel(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return '证据影响已记录';
  if (confidence >= 80) return '证据关联较明确';
  if (confidence >= 55) return '证据提供了部分支持';
  return '暂作为弱信号观察';
}

function roleText(change) {
  if (change.type === 'match-changed') return `${change.title} ${change.delta > 0 ? '↑' : '↓'} ${Math.abs(change.delta)} 分`;
  if (change.type === 'role-added') return `新增方向 · ${change.title}`;
  return `暂缓方向 · ${change.title}`;
}

function listHtml(items, empty) {
  return items.length ? items.map(item => `<li>${safe(item)}</li>`).join('') : `<li class="muted">${safe(empty)}</li>`;
}

function renderLatest() {
  const item = trajectory[0];
  if (!item) {
    document.querySelector('#latestImpact').textContent = '0';
    return;
  }
  const source = evidenceFor(item);
  document.querySelector('#latestImpact').textContent = item.delta.impactScore ?? '—';
  document.querySelector('#latestKind').textContent = `${labels[item.delta.kind] || '路径更新'} · ${compact(source.filename || source.label || source.type || '新增证据', 24)}`;
  document.querySelector('#latestTitle').textContent = item.narrative.headline;
  document.querySelector('#latestWhy').textContent = item.narrative.why;
  document.querySelector('#latestMeta').textContent = `${dateLabel(item.at)} · ${confidenceLabel(item.narrative.confidence)}`;
  document.querySelector('#latestNext').textContent = item.narrative.nextMove;
}

function renderStats() {
  const routes = trajectory.filter(item => item.delta.kind === 'route-change').length;
  const resolved = new Set(trajectory.flatMap(item => item.delta.gaps?.resolved || [])).size;
  const strengthened = new Set(trajectory.flatMap(item => (item.delta.roleChanges || []).filter(change => change.type === 'role-added' || change.delta > 0).map(change => change.title))).size;
  document.querySelector('#routeCount').textContent = routes;
  document.querySelector('#resolvedCount').textContent = resolved;
  document.querySelector('#fitCount').textContent = strengthened;
  document.querySelector('#evidenceCount').textContent = evidence.length;
}

function makeHistoryItem(item) {
  const fragment = document.querySelector('#historyTemplate').content.cloneNode(true);
  const article = fragment.querySelector('.history-item');
  const delta = item.delta;
  const source = evidenceFor(item);
  article.dataset.kind = delta.kind;
  fragment.querySelector('.history-date').textContent = dateLabel(item.at);
  fragment.querySelector('.history-kind').textContent = `${labels[delta.kind] || '路径更新'} · ${compact(source.filename || source.label || source.type || '证据', 28)}`;
  fragment.querySelector('.history-title').textContent = item.narrative.headline;
  fragment.querySelector('.history-why').textContent = item.narrative.why;
  fragment.querySelector('.history-impact').textContent = `${delta.impactScore || 0} IMPACT`;
  const roles = (delta.roleChanges || []).map(roleText);
  const gaps = [...(delta.gaps?.resolved || []).map(value => `已补齐 · ${value}`), ...(delta.gaps?.added || []).map(value => `新发现 · ${value}`)];
  const actions = [...(delta.actions?.added || []).map(value => `优先 · ${value}`), ...(delta.actions?.deprioritized || []).map(value => `暂缓 · ${value}`)];
  fragment.querySelector('.role-changes').innerHTML = listHtml(roles, '岗位判断没有显著变化');
  fragment.querySelector('.gap-changes').innerHTML = listHtml(gaps, '关键缺口没有显著变化');
  fragment.querySelector('.action-changes').innerHTML = listHtml(actions, '行动顺序保持不变');
  fragment.querySelector('.history-next strong').textContent = item.narrative.nextMove;
  const button = fragment.querySelector('.history-summary');
  button.addEventListener('click', () => {
    document.querySelectorAll('.history-item.open').forEach(item => {
      if (item === article) return;
      item.classList.remove('open');
      item.querySelector('.history-summary')?.setAttribute('aria-expanded', 'false');
      const toggle = item.querySelector('.history-toggle');
      if (toggle) toggle.textContent = '＋';
    });
    const open = article.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
    article.querySelector('.history-toggle').textContent = open ? '−' : '＋';
  });
  return fragment;
}

function renderHistory(filter = 'all') {
  const container = document.querySelector('#historyList');
  const visible = filter === 'all' ? trajectory : trajectory.filter(item => item.delta.kind === filter);
  if (!visible.length) {
    container.innerHTML = `<div class="history-empty"><b>${trajectory.length ? '这个类型还没有变化' : '成长从第一份真实证据开始'}</b><p>${trajectory.length ? '切换到“全部”查看已有路径记录。' : '回到职业规划，上传简历、记录项目成果或一次面试反馈。'}</p><a href="career.html#evidence">添加一份证据 →</a></div>`;
    return;
  }
  container.replaceChildren(...visible.map(makeHistoryItem));
}

const profileBits = [profile.stage, profile.school, profile.major].filter(Boolean).join(' · ');
document.querySelector('#profileLine').textContent = profileBits ? `${profileBits}  →  ${profile.target || '目标待明确'}` : '建立职业画像后，这里会开始记录你的变化。';
document.querySelector('#historyCount').textContent = trajectory.length;
if (!trajectory.length) document.querySelector('.history-filter').hidden = true;
document.querySelectorAll('.history-filter button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.history-filter button').forEach(item => item.classList.toggle('active', item === button));
  renderHistory(button.dataset.filter);
}));

renderLatest();
renderStats();
renderHistory();
