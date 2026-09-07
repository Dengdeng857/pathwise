const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const STORAGE = {
  profile: 'pathwiseProfile',
  plan: 'pathwisePlan',
  tasks: 'pathwiseTasks',
  guides: 'pathwiseActionGuides',
  history: 'pathwisePlanHistory',
  taskEvents: 'pathwiseTaskEvents',
  taskProofs: 'pathwiseTaskProofs',
  theme: 'pathwiseTheme'
};
const DEFAULT_PROFILE = {
  stage: '本科大三下',
  school: '211',
  major: '信息安全',
  target: '软件安全工程师',
  experience: '掌握 Python，有 2 个 AI 项目经验',
  updates: [],
  evidence: []
};

const isLocalHost = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const apiOrigin = location.protocol === 'file:' || (isLocalHost && location.port !== '8787') ? 'http://127.0.0.1:8787' : '';
const api = path => `${apiOrigin}${path}`;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

// Older builds seeded this demo profile into localStorage. Treat it as empty
// onboarding state unless the user has added real progress or evidence.
const storedProfile = readJSON(STORAGE.profile, null);
const isSeededDemo = storedProfile && storedProfile.stage === DEFAULT_PROFILE.stage && storedProfile.school === DEFAULT_PROFILE.school && storedProfile.major === DEFAULT_PROFILE.major && storedProfile.target === DEFAULT_PROFILE.target && storedProfile.experience === DEFAULT_PROFILE.experience && !(storedProfile.updates || []).length && !(storedProfile.evidence || []).length;
const hasValidStoredProfile = storedProfile && ['stage', 'school', 'major', 'target'].every(key => String(storedProfile[key] || '').trim());
if (isSeededDemo || (storedProfile && !hasValidStoredProfile)) Object.values(STORAGE).filter(key => key !== STORAGE.theme).forEach(key => localStorage.removeItem(key));
let hasStoredProfile = Boolean(hasValidStoredProfile && !isSeededDemo);

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function compact(value, length = 110) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

let profile = hasStoredProfile
  ? { ...DEFAULT_PROFILE, ...readJSON(STORAGE.profile, {}) }
  : { ...DEFAULT_PROFILE, stage: '', school: '', major: '', target: '', experience: '', updates: [], evidence: [] };
profile.updates = Array.isArray(profile.updates) ? profile.updates : [];
profile.evidence = Array.isArray(profile.evidence) ? profile.evidence.map(item => typeof item === 'string' ? { type: '材料', content: item } : item).filter(Boolean) : [];
profile.updates = unique(profile.updates.map(String).filter(update => {
  const text = update.trim();
  if (!text || (/已上传/.test(text) && /解析完成/.test(text))) return false;
  return !profile.evidence.some(item => {
    const content = String(item?.content || '').trim();
    const filename = String(item?.filename || '').trim();
    return (content && text.includes(content.slice(0, Math.min(80, content.length)))) || (filename && text.includes(filename));
  });
}));
profile.mood = profile.mood || '';
let plan = readJSON(STORAGE.plan, null);
if (plan) {
  const planText = JSON.stringify([plan.profile, plan.summary, plan.currentRoles, plan.graduationRoles]);
  const targetKey = /安全/.test(profile.target) ? '安全' : profile.target.replace(/工程师|产品经理|经理|实习生|专员/g, '').trim();
  if (targetKey && !planText.toLowerCase().includes(targetKey.toLowerCase())) plan = null;
}
let completedTasks = new Set(readJSON(STORAGE.tasks, []));
let taskEvents = readJSON(STORAGE.taskEvents, {});
let verifiedTasks = new Set(readJSON(STORAGE.taskProofs, []));
let activeTask = '';
let selectedEvidenceFile = null;
let evidenceFileRequest = null;
let pendingResume = null;
let progressTimer = null;
let toastTimer = null;

function makeLocalPlan(sourceProfile = profile, reason = '') {
  const target = sourceProfile.target || '目标岗位';
  const security = /安全|攻防|渗透|审计/.test(target);
  const actions = security
    ? ['拆解 10 个目标安全岗位 JD', '完成一份代码审计案例', '进行一次安全项目深挖模拟']
    : ['拆解 10 个目标岗位 JD', '完成一份可量化项目案例', '进行一次目标岗位项目深挖模拟'];
  const skill = security ? '安全基础与工程实践' : '岗位核心技能';
  const proof = security ? '代码审计、漏洞分析或安全工具成果' : '可量化项目结果';

  return {
    source: 'local',
    status: 'degraded',
    reason,
    profile: `${sourceProfile.stage} · ${sourceProfile.school} ${sourceProfile.major}`,
    summary: `${sourceProfile.experience || '暂未补充经历'} · 目标：${target}`,
    currentRoles: [
      { title: `${target}实习生`, match: 58, reason: `专业与目标方向有重合，但仍需用具体成果证明${skill}。` },
      { title: security ? '安全开发实习生' : '相邻方向实习生', match: 66, reason: '现有技能可以作为现实入口，再逐步向目标方向收敛。' }
    ],
    graduationRoles: [
      { title: target, match: 70, reason: `毕业前补齐一段相关经历和${proof}后，可以作为重点投递方向。` },
      { title: security ? 'AI 安全工程师' : `${target}（进阶方向）`, match: 52, reason: '需要形成差异化项目、实习结果和稳定的面试表达。' }
    ],
    gaps: [skill, proof, '真实面试反馈与复盘闭环'],
    actions,
    actionGuides: actions.map((title, index) => ({
      title,
      why: ['先确认岗位真正需要什么，避免把时间花在低频能力上。', '招聘方需要能查看、能追问、能验证的成果。', '把经历组织成面试中可以稳定讲清的证据。'][index],
      steps: index === 0
        ? ['收集 10 个近 30 天发布的岗位 JD', '标出重复出现的技能、任务和成果', '整理最高频的 3 项要求并更新简历']
        : index === 1
          ? ['选一个与目标岗位最相关的真实问题', '完成方案、过程、结果和取舍记录', '整理为一页案例并获得一次外部反馈']
          : ['准备背景、目标、行动、结果四段表达', '录制一次 15 分钟模拟面试', '复听并修改三个最模糊的回答'],
      doneWhen: ['形成一张岗位能力对照表', '形成一份可展示、可复述的案例', '能在 3 分钟内讲清项目并回答追问'][index],
      effort: [2, 4, 3][index],
      estimatedDays: [2, 7, 3][index]
    })),
    stages: [
      { title: '确认入口与补齐基础证据', why: '先找到现阶段够得着的入口，并集中补最影响筛选的一项能力。', tasks: actions, doneWhen: '完成三个近期行动并获得一次真实反馈' },
      { title: `形成 ${target} 的能力证据`, why: '把学习和 Demo 转成能被招聘方验证的项目、实习或公开成果。', tasks: ['完成一项真实场景项目', '记录可量化结果与关键取舍', '把成果更新进简历和作品集'], doneWhen: '至少形成两条可验证的核心证据' },
      { title: `冲刺毕业 ${target}`, why: '根据投递和面试反馈持续修正，不用一份静态计划押完整个校招。', tasks: ['建立分层投递岗位池', '每周进行一次模拟面试', '每次反馈后更新计划和材料'], doneWhen: '完成目标岗位的成套投递并获得理想结果' }
    ]
  };
}

function showToast(message) {
  const toast = $('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function companionSay(message) {
  $('#companionText').textContent = compact(message, 90);
  $('#companion').classList.remove('hidden');
}

function setAIStatus(text, ready) {
  $('#aiStatus').textContent = text;
  $('.top-status').classList.toggle('offline', !ready);
}

function startProgress() {
  clearInterval(progressTimer);
  const bar = $('#aiProgress');
  const fill = $('#aiProgressFill');
  const percent = $('#aiProgressPercent');
  const label = $('#aiProgressLabel');
  const labels = ['读取画像与证据', '对比目标岗位', '识别关键差距', '生成三阶段路径', '整理行动指导'];
  let value = 8;
  bar.classList.add('show');
  const tick = () => {
    value = Math.min(92, value + Math.max(1, (92 - value) * .08));
    fill.style.width = `${value}%`;
    percent.textContent = `${Math.round(value)}%`;
    label.textContent = labels[Math.min(labels.length - 1, Math.floor(value / 20))];
  };
  tick();
  progressTimer = setInterval(tick, 420);
}

function finishProgress(message = '路径已更新') {
  clearInterval(progressTimer);
  $('#aiProgressFill').style.width = '100%';
  $('#aiProgressPercent').textContent = '100%';
  $('#aiProgressLabel').textContent = message;
  setTimeout(() => $('#aiProgress').classList.remove('show'), 850);
}

async function requestJSON(path, options = {}, timeout = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(api(path), { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function requestStreamingPlan(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const response = await fetch(api('/api/plan'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', raw = '', content = '', finishReason = '';
    const appendChunk = (chunk) => {
      // Some OpenAI-compatible gateways emit the planner object itself as an
      // SSE data frame instead of wrapping it in choices[].
      if (chunk && typeof chunk === 'object' && (chunk.profile || chunk.currentRoles || chunk.stages)) {
        content += JSON.stringify(chunk);
        return;
      }
      const choice = chunk?.choices?.[0] || {};
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta || {};
      const message = choice.message || {};
      const value = delta.content ?? message.content ?? chunk?.output_text ?? chunk?.content ?? chunk?.text;
      if (typeof value === 'string') content += value;
      else if (Array.isArray(value)) content += value.map(item => typeof item === 'string' ? item : item?.text || '').join('');
      const reasoning = delta.reasoning_content ?? message.reasoning_content ?? chunk?.reasoning_content;
      if (!content && typeof reasoning === 'string' && reasoning.trim().startsWith('{')) content += reasoning;
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      raw += text;
      buffer += text;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') continue;
        try {
          const chunk = JSON.parse(trimmed.slice(5).trim());
          appendChunk(chunk);
        } catch (_) {}
      }
    }
    // A proxy may close immediately after the final frame without a newline;
    // process that buffered frame before deciding the response is empty.
    const finalLine = buffer.trim();
    if (finalLine.startsWith('data:') && finalLine !== 'data: [DONE]') {
      try { appendChunk(JSON.parse(finalLine.slice(5).trim())); } catch (_) {}
    }
    if (!content.trim()) {
      try { appendChunk(JSON.parse(raw)); } catch (_) {
        for (const line of raw.split(/\r?\n/)) {
          const value = line.replace(/^\s*data:\s*/, '').trim();
          if (!value || value === '[DONE]') continue;
          try { appendChunk(JSON.parse(value)); } catch (_) {}
        }
      }
    }
    if (!content.trim()) throw new Error('流式规划没有返回内容');
    // Gateways may return a JSON object followed by usage metadata or a second
    // JSON frame. Keep only the first complete object for the planner.
    const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parseCandidate = value => {
      const parsed = JSON.parse(value);
      return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    };
    try { return parseCandidate(cleaned); } catch (_) {}
    const extractBalanced = (source, start) => {
      const opening = source[start];
      const closing = opening === '[' ? ']' : '}';
      let depth = 0;
      let quoted = false;
      let escaped = false;
      for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') quoted = false;
          continue;
        }
        if (char === '"') { quoted = true; continue; }
        if (char === opening) depth += 1;
        else if (char === closing) depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
      }
      return '';
    };
    // A few gateways emit an opening brace as one frame and then repeat the
    // complete JSON object in a later frame. Try every candidate start and
    // keep the first balanced candidate that parses and has planner fields.
    for (let start = 0; start < cleaned.length; start += 1) {
      if (cleaned[start] !== '{' && cleaned[start] !== '[') continue;
      const candidate = extractBalanced(cleaned, start);
      if (!candidate) continue;
      try {
        const value = parseCandidate(candidate);
        if (value && (value.profile || value.currentRoles || value.stages)) return value;
      } catch (_) {}
    }
    console.warn('Pathwise planner raw response prefix:', cleaned.slice(0, 800));
    throw new Error(finishReason === 'length' ? '模型输出达到长度上限，规划 JSON 未完整返回' : '流式规划返回内容无法解析');
  } finally { clearTimeout(timer); }
}

function profileCompleteness() {
  const basics = ['stage', 'school', 'major', 'target', 'experience'].filter(key => String(profile[key] || '').trim()).length;
  const evidenceScore = Math.min(25, profile.evidence.length * 7);
  const updateScore = Math.min(15, profile.updates.length * 4);
  return Math.min(99, Math.round(basics / 5 * 60 + evidenceScore + updateScore));
}

function renderProfile(currentPlan = plan) {
  if (!hasStoredProfile) {
    $('#profileTitle').textContent = '还没有建立职业画像';
    $('#profileSummary').textContent = '上传简历或填写基本信息，小径会为你生成第一份职业规划。';
    $('#stageStat').textContent = '待填写';
    $('#targetStat').textContent = '待填写';
    $('#profileScore').innerHTML = '0<em>%</em>';
    $('#profileOrb').textContent = 'P';
    $('#userMeta').textContent = '等待建立画像';
    return;
  }
  const title = currentPlan?.profile || `${profile.stage} · ${profile.school} ${profile.major}`;
  const summary = currentPlan?.summary || `${profile.experience} · 目标：${profile.target}`;
  $('#profileTitle').textContent = compact(title, 70);
  $('#profileSummary').textContent = compact(summary, 118);
  $('#stageStat').textContent = profile.stage.replace(/^本科/, '') || '待补充';
  $('#targetStat').textContent = compact(profile.target.replace(/工程师|经理|实习生/g, ''), 8) || '待补充';
  $('#profileScore').innerHTML = `${profileCompleteness()}<em>%</em>`;
  $('#profileOrb').textContent = (profile.major || 'ME').slice(0, 2).toUpperCase();
  $('#userMeta').textContent = `${profile.stage} · ${profile.major}`;
}

function renderDecision(currentPlan) {
  const next = $('.task-toggle:not(.verified)');
  const awaitingProof = next && completedTasks.has(next.dataset.task) && !verifiedTasks.has(next.dataset.task);
  const gaps = (currentPlan?.gaps || []).filter(Boolean);
  const role = pickRoles(currentPlan || makeLocalPlan())[1]?.title || profile.target || '目标岗位';
  const gap = compact(gaps[0] || '补充一条真实成果', 18);
  $('#decisionTitle').textContent = next?.dataset.task || '补充一条真实进展';
  $('#decisionReason').textContent = awaitingProof
    ? '行动已经执行，补充结果、数据或链接后，AI 才能把它当作真实能力证据并更新后续路线。'
    : next ? `这一步会直接补齐“${gap}”，完成后可以重新判断你距离 ${role} 还差什么。` : '你已经完成当前行动清单，记录新的进展后会生成下一轮优先级。';
  $('#pulseTarget').textContent = compact(role.replace(/（.*?）/g, ''), 15);
  $('#pulseGap').textContent = gap;
  $('#pulseUpdate').textContent = profile.evidence.length ? '材料已进入' : '等你记录';
  $('#heroState').textContent = `${awaitingProof ? '待补成果：' : '当前规划重点：'}${next?.dataset.task || profile.target || '你的下一段职业方向'}`;
  $('#decisionCta').textContent = awaitingProof ? '补充行动成果 →' : next ? '打开这一步 →' : '记录新进展 →';
  $('#decisionCta').dataset.task = next?.dataset.task || '';
  const moodText = { steady: '今天按一个小步推进就很好。', anxious: '先只做最小的一步，不需要今天解决全部问题。', tired: '今天可以只整理材料，完成比强撑更重要。' }[profile.mood] || '';
  $('#moodNote').textContent = moodText;
  $$('.checkin button').forEach(button => button.classList.toggle('selected', button.dataset.mood === profile.mood));
}

function renderPlanDelta(previousPlan, nextPlan, sourceLabel = '新信息') {
  const box = $('#planDelta');
  if (!box || !nextPlan) return;
  const previousRole = pickRoles(previousPlan || {}).find(Boolean)?.title;
  const nextRole = pickRoles(nextPlan || {}).find(Boolean)?.title || profile.target || '目标方向';
  const previousGap = previousPlan?.gaps?.[0];
  const nextGap = nextPlan?.gaps?.[0];
  let title = `${sourceLabel}已进入职业规划`;
  let text = `小径重新检查了你的岗位方向、能力差距和行动顺序。当前优先推进：${compact(nextPlan.actions?.[0] || '补充一条真实成果', 38)}。`;
  if (previousRole && nextRole && previousRole !== nextRole) {
    title = `岗位判断已更新：${compact(nextRole, 30)}`;
    text = `根据${sourceLabel}，你的现实入口从“${compact(previousRole, 24)}”调整为“${compact(nextRole, 24)}”。先补齐：${compact(nextGap || '关键能力证据', 34)}。`;
  } else if (previousGap && nextGap && previousGap !== nextGap) {
    title = '行动优先级已重新排序';
    text = `原先最需要补的是“${compact(previousGap, 24)}”，现在更应该先处理“${compact(nextGap, 30)}”。这是因为新信息改变了证据权重。`;
  }
  $('#planDeltaTitle').textContent = title;
  $('#planDeltaText').textContent = text;
  box.hidden = false;
}

function recordPlanVersion(previousPlan, nextPlan, sourceLabel, mode = 'ai') {
  if (!nextPlan) return;
  const previousRole = pickRoles(previousPlan || {}).find(Boolean)?.title || '';
  const nextRole = pickRoles(nextPlan).find(Boolean)?.title || profile.target || '';
  const previousGap = previousPlan?.gaps?.[0] || '';
  const nextGap = nextPlan.gaps?.[0] || '';
  const previousAction = previousPlan?.actions?.[0] || '';
  const nextAction = nextPlan.actions?.[0] || '';
  if (previousPlan && previousRole === nextRole && previousGap === nextGap && previousAction === nextAction) return;
  const history = readJSON(STORAGE.history, []);
  history.push({ at:new Date().toISOString(), source:sourceLabel, mode, role:nextRole, previousRole, gap:nextGap, previousGap, action:nextAction, previousAction });
  writeJSON(STORAGE.history, history.slice(-20));
}

function pickRoles(currentPlan) {
  const currentRoles = Array.isArray(currentPlan.currentRoles) ? currentPlan.currentRoles : [];
  const graduationRoles = Array.isArray(currentPlan.graduationRoles) ? currentPlan.graduationRoles : [];
  const current = [...currentRoles].sort((a, b) => Number(b.match || 0) - Number(a.match || 0))[0];
  const graduation = [...graduationRoles].sort((a, b) => Number(b.match || 0) - Number(a.match || 0))[0];
  const stretch = graduationRoles.find(role => role.title !== graduation?.title) || currentRoles.find(role => role.title !== current?.title) || {
    title: `${profile.target}进阶方向`, match: Math.max(30, Number(graduation?.match || 55) - 18), reason: '需要更多真实成果、复杂任务和面试反馈作为证据。'
  };
  return [current, graduation, stretch];
}

function renderRoles(currentPlan) {
  const roles = pickRoles(currentPlan);
  $$('.role-card').forEach((card, index) => {
    const role = roles[index] || {};
    const match = Math.max(0, Math.min(100, Number(role.match || 0)));
    $('h3', card).textContent = role.title || '待生成岗位';
    $('p', card).textContent = compact(role.reason || '补充画像后生成岗位判断。', 112);
    $('.match-value', card).textContent = match || '--';
    $('.match-track i', card).style.width = `${match}%`;
    card.dataset.role = JSON.stringify(role);
  });
  const gaps = unique((currentPlan.gaps || []).map(item => compact(item, 55))).slice(0, 4);
  $('#gapList').innerHTML = gaps.length ? gaps.map(item => `<i>${escapeHtml(item)}</i>`).join('') : '<i>暂无有效差距信息</i>';
}

function renderStages(currentPlan) {
  const stages = Array.isArray(currentPlan.stages) && currentPlan.stages.length ? currentPlan.stages.slice(0, 3) : makeLocalPlan().stages;
  $('#stageList').innerHTML = stages.map((stage, stageIndex) => {
    const tasks = unique(stageIndex === 0 && currentPlan.actions?.length ? currentPlan.actions : (stage.tasks || [])).slice(0, 4);
    return `<article class="stage ${stageIndex === 0 ? 'active' : ''}">
      <div class="stage-index">0${stageIndex + 1}</div>
      <div class="stage-body">
        <div class="stage-title"><h3>${escapeHtml(stage.title || `阶段 ${stageIndex + 1}`)}</h3><span>${stageIndex === 0 ? '现在 · 进行中' : '后续 · 待解锁'}</span></div>
        <p>${escapeHtml(stage.why || '')}</p>
        <div class="stage-tasks">${tasks.map(task => {
          const guide = (currentPlan.actionGuides || []).find(item => item.title === task) || {};
          const effort = window.PathwiseModel.estimateEffort(task, stageIndex, currentPlan);
          const estimate = Number(guide.estimatedDays) > 0 ? `约 ${Number(guide.estimatedDays)} 天` : `难度 ${effort}/5`;
          const state = verifiedTasks.has(task) ? 'done verified' : completedTasks.has(task) ? 'done proof-pending' : '';
          const stateLabel = completedTasks.has(task) && !verifiedTasks.has(task) ? ' · 待成果' : '';
          return `<div class="action-row"><button class="task-toggle ${state}" data-task="${escapeHtml(task)}" type="button">${escapeHtml(task)}</button><span class="task-effort" title="AI 按实际投入估算：难度 ${effort}/5">${escapeHtml(estimate)} · ${effort} 点${stateLabel}</span><button class="task-guide" data-task="${escapeHtml(task)}" type="button">详细指导 →</button></div>`;
        }).join('')}</div>
      </div>
    </article>`;
  }).join('');
  syncTaskUI();
}

function renderCaseReferences(currentPlan) {
  const cases = Array.isArray(currentPlan?.caseReferences) ? currentPlan.caseReferences.filter(item => item?.title) : [];
  $('#caseCount').textContent = cases.length ? `${cases.length} 条参考` : '暂无参考';
  if (!cases.length) {
    $('#caseList').innerHTML = '<div class="case-empty">完成一次 AI 规划后，这里会显示与你当前阶段、目标和经历最相似的公开案例。</div>';
    return;
  }
  $('#caseList').innerHTML = cases.slice(0, 5).map((item, index) => {
    const signals = (item.signals || []).slice(0, 4).map(signal => `<span>${escapeHtml(signal)}</span>`).join('');
    const excerpt = (item.excerpt || []).find(Boolean) || '公开案例已纳入本次判断。';
    return `<article class="case-item"><div class="case-index">0${index + 1}</div><div class="case-body"><div class="case-meta"><span>${escapeHtml(item.type || '参考案例')}</span><b>${Math.round(Number(item.relevance || 0) * 100)}% 相关</b></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(compact(excerpt, 150))}</p><div class="case-signals">${signals}</div><a href="${escapeHtml(item.source_url || '#')}" target="_blank" rel="noreferrer">查看来源 ↗</a></div></article>`;
  }).join('');
}

function syncTaskUI() {
  const tasks = $$('.task-toggle');
  const done = tasks.filter(task => task.classList.contains('done')).length;
  $('#doneCount').textContent = done;
  $('#pendingCount').textContent = Math.max(0, tasks.length - done);
  const weighted = window.PathwiseModel.getWeightedProgress(plan || makeLocalPlan(), completedTasks, verifiedTasks);
  const progress = weighted.percent;
  if ($('#sideProgressFill')) $('#sideProgressFill').style.width = `${progress}%`;
  if ($('#sideProgressValue')) $('#sideProgressValue').textContent = `${progress}%`;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyDone = Object.values(taskEvents).filter(value => new Date(value).getTime() >= weekAgo).length;
  const weeklyWeight = weighted.tasks.filter(task => {
    const at = new Date(taskEvents[task.title] || 0).getTime();
    return at >= weekAgo;
  }).reduce((sum, task) => sum + task.effort * (verifiedTasks.has(task.title) ? 1 : .35), 0);
  if ($('#weeklyProgress')) $('#weeklyProgress').textContent = weeklyDone
    ? `本周获得 ${Number(weeklyWeight.toFixed(1))} 路径点 · 按投入估算`
    : '按行动难度与投入估算';
  const first = tasks.find(task => !task.classList.contains('verified'));
  $('#focusTitle').textContent = first?.dataset.task || '路径行动已完成';
  const awaitingProof = first && completedTasks.has(first.dataset.task) && !verifiedTasks.has(first.dataset.task);
  $('#focusMeta').textContent = awaitingProof ? '行动已执行，补一条成果才能完整计入进度。' : first ? '打开详细指导，完成后留下成果。' : '可以补充新进展，让 AI 生成下一段路径。';
  writeJSON(STORAGE.tasks, [...completedTasks]);
  writeJSON(STORAGE.taskEvents, taskEvents);
  writeJSON(STORAGE.taskProofs, [...verifiedTasks]);
  renderGrowth();
  renderDecision(plan || makeLocalPlan());
}

function renderActivity() {
  const entries = [];
  for (const update of profile.updates) {
    const text = compact(update, 130);
    if (text && !entries.some(item => item.text === text)) entries.push({ type: '进展', text });
  }
  for (const item of profile.evidence) {
    const raw = String(item?.content || '').trim();
    const label = item?.filename ? `${item.type || '材料'} · ${item.filename}` : (item?.type || '材料');
    entries.push({ type: label, text: compact(raw || '材料已保存，暂无可展示摘要。', 130), material: true });
  }
  const visible = entries.slice(-8).reverse();
  $('#activityCount').textContent = `${entries.length} 条记录`;
  $('#updateList').innerHTML = visible.length ? visible.map((item, index) => `<div class="update-item ${item.material ? 'material' : ''}"><span class="update-dot"></span><div><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.type)} · ${index === 0 ? '刚刚' : '路径记录'}</small></div></div>`).join('') : '<div class="empty-update">还没有记录。完成行动、上传简历或说一条真实进展，路径会从这里开始生长。</div>';
}

function renderGrowth() {
  if (!$('#growthTree')) return;
  const weighted = window.PathwiseModel.getWeightedProgress(plan || makeLocalPlan(), completedTasks, verifiedTasks);
  const done = $$('.task-toggle.done').length;
  const evidenceCount = profile.evidence.length;
  const score = weighted.percent;
  $('#growthScore').textContent = score;
  const graduationRole = pickRoles(plan || makeLocalPlan())[1]?.title || profile.target;
  const nodes = [
    ['建立画像', `${profile.stage} · ${profile.major}`],
    ['留下证据', evidenceCount ? `${evidenceCount} 份材料已验证` : '上传简历或成果'],
    ['形成能力', done ? `路径推进 ${weighted.percent}%` : '完成第一个行动'],
    ['抵达目标', graduationRole]
  ];
  $('#growthTree').innerHTML = nodes.map((node, index) => `<div class="growth-node ${index <= Math.floor(score / 26) ? 'lit' : ''}"><span class="node-dot">${index === 0 ? '✦' : index + 1}</span><strong>${escapeHtml(node[0])}</strong><small>${escapeHtml(node[1])}</small></div>`).join('');
  $('#growthHint').textContent = done ? `已获得 ${Number(weighted.doneWeight.toFixed(1))} / ${weighted.totalWeight} 路径点。留下成果后，行动才会完整计入。` : '完成第一个行动，点亮路径的下一站。';
}

function renderAll(currentPlan) {
  plan = currentPlan || makeLocalPlan();
  renderProfile(plan);
  renderRoles(plan);
  renderStages(plan);
  renderCaseReferences(plan);
  renderActivity();
  renderGrowth();
  renderDecision(plan);
}

function persistProfile() {
  writeJSON(STORAGE.profile, profile);
  hasStoredProfile = true;
  document.body.classList.remove('is-onboarding');
  // Profile edits must appear immediately while a new AI plan is still running;
  // never leak a stale or blank plan summary into the loading state.
  renderProfile(null);
  renderActivity();
}

async function recalculate(successMessage = '路径已经根据新信息更新。') {
  const previousPlan = plan;
  startProgress();
  try {
    const result = await requestStreamingPlan(profile);
    if (!result.currentRoles || !result.stages) throw new Error('模型返回缺少规划字段');
    plan = { ...result, source: result.source || 'ai' };
    recordPlanVersion(previousPlan, plan, '这次更新', plan.source);
    writeJSON(STORAGE.plan, plan);
    renderAll(plan);
    renderPlanDelta(previousPlan, plan, '这次更新');
    finishProgress();
    showToast('AI 已更新岗位与三阶段路径');
    companionSay(successMessage);
    setAIStatus(plan.source === 'ai' ? 'AI 已连接 · 路径实时更新' : '路径已更新 · 等待智能增强', plan.source === 'ai');
    return true;
  } catch (error) {
    const reason = error.name === 'AbortError' ? '模型响应超时' : error.message;
    plan = makeLocalPlan(profile, reason);
    recordPlanVersion(previousPlan, plan, '这次更新', 'local');
    writeJSON(STORAGE.plan, plan);
    renderAll(plan);
    renderPlanDelta(previousPlan, plan, '这次更新');
    finishProgress('已保留当前路径');
    showToast('新信息已保存，当前路径保持可用');
    companionSay(`智能规划暂时没有完成响应，但你的信息没有丢失，可以稍后再次更新。`);
    setAIStatus('路径已更新 · 使用本地规划', false);
    console.warn('Pathwise plan request failed:', error);
    return false;
  }
}

function openModal(element) { element.classList.add('open'); }
function closeModal(element) { element.classList.remove('open'); }

function openDrawer({ kicker = 'ACTION GUIDE', title, intro = '', content, action = '关闭指导', task = '' }) {
  activeTask = task;
  $('#drawerKicker').textContent = kicker;
  $('#drawerTitle').textContent = title;
  $('#drawerIntro').textContent = intro;
  $('#drawerContent').innerHTML = content;
  $('#drawerDone').textContent = action;
  openModal($('#drawer'));
}

function localGuide(action) {
  const cachedPlanGuide = (plan?.actionGuides || []).find(item => item.title === action);
  const effort = window.PathwiseModel.estimateEffort(action, 0, plan || {});
  return {
    title: action,
    why: cachedPlanGuide?.why || `这一步会为“${profile.target}”补充一条可验证的能力证据。`,
    steps: cachedPlanGuide?.steps || ['明确最终要交付的具体结果', '拆成三个不超过 45 分钟的小步骤', '整理过程、结果和一次复盘'],
    resources: ['目标岗位 JD', '个人经历材料', '复盘模板'],
    estimatedTime: ({ 1: '半天内', 2: '2-4 小时，可分两次完成', 3: '约 2-4 天', 4: '约 1 周', 5: '约 3 周或更久' })[effort],
    estimatedDays: cachedPlanGuide?.estimatedDays || null,
    effort,
    doneWhen: cachedPlanGuide?.doneWhen || '形成一份可查看、可复述的成果',
    evidence: '完成后记录成果、数据、反馈或链接，加入证据链。',
    source: 'local'
  };
}

function guideHtml(guide) {
  const resources = (guide.resources || []).map(item => `<span>${escapeHtml(item)}</span>`).join('');
  const effort = Math.max(1, Math.min(5, Number(guide.effort) || window.PathwiseModel.estimateEffort(guide.title || '', 0, plan || {})));
  const effortLabel = ['', '轻量', '较轻', '中等', '较重', '里程碑'][Math.round(effort)];
  return `<div class="guide-detail"><h3>照着做</h3><ol>${(guide.steps || []).map((step, index) => `<li><b>0${index + 1}</b><span>${escapeHtml(step)}</span></li>`).join('')}</ol></div>
    <div class="guide-meta"><div><small>预计投入 · ${escapeHtml(effortLabel)} ${Math.round(effort)}/5</small><strong>${escapeHtml(guide.estimatedTime || (guide.estimatedDays ? `约 ${guide.estimatedDays} 天` : '按个人节奏完成'))}</strong></div><div><small>完成标准</small><strong>${escapeHtml(guide.doneWhen || '形成可验证成果')}</strong></div></div>
    ${resources ? `<div class="guide-resources"><small>准备这些</small>${resources}</div>` : ''}
    <div class="guide-evidence"><small>完成后留下什么</small><p>${escapeHtml(guide.evidence || '记录成果与复盘。')}</p></div>`;
}

async function openActionGuide(action) {
  openDrawer({ title: action, intro: '正在结合你的画像与证据，把这一项拆成可以直接执行的步骤。', content: '<div class="guide-loading"><i></i><span>正在生成个人行动指导…</span></div>', action: completedTasks.has(action) ? '记录成果' : '完成并记录成果', task: action });
  const cache = readJSON(STORAGE.guides, {});
  let guide = cache[action];
  if (!guide) {
    try {
      guide = await requestJSON('/api/action-guide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, profile })
      }, 25000);
      cache[action] = guide;
      writeJSON(STORAGE.guides, cache);
    } catch {
      guide = localGuide(action);
      showToast('已显示可执行指导，稍后可再次请求智能深化');
    }
  }
  $('#drawerKicker').textContent = guide.source === 'ai' ? 'AI ACTION GUIDE' : 'ACTION GUIDE';
  $('#drawerTitle').textContent = guide.title || action;
  $('#drawerIntro').textContent = guide.why || '';
  $('#drawerContent').innerHTML = guideHtml(guide);
}

function openOutcome(action) {
  activeTask = action;
  $('#outcomePrompt').textContent = `“${action}”已完成。记录结果后，它会进入证据链并重新校准计划。`;
  $('#outcomeText').value = '';
  $('#outcomeLink').value = '';
  openModal($('#outcomeModal'));
  setTimeout(() => $('#outcomeText').focus(), 40);
}

function fillProfileForm() {
  const form = $('#profileForm');
  Object.entries(profile).forEach(([key, value]) => {
    if (form.elements[key] && typeof value === 'string') form.elements[key].value = value;
  });
}

async function addUpdate(text) {
  const note = String(text || '').trim();
  if (!note) return showToast('先写下一条真实进展');
  profile.updates.push(note);
  persistProfile();
  $('#updateInput').value = '';
  await recalculate('新进展已经进入路径，我重新排好了后续优先级。');
}

async function addEvidence(content, meta = {}) {
  const text = String(content || '').trim();
  if (!text) return showToast('先粘贴内容或选择一个文件');
  const item = { type: meta.type || $('#evidenceType').value, filename: meta.filename || '', content: text, addedAt: new Date().toISOString() };
  profile.evidence.push(item);
  persistProfile();
  $('#evidenceInput').value = '';
  await explainEvidence(item);
  await recalculate('材料已进入证据链，岗位与行动路径已经重新判断。');
}

async function parseSelectedEvidenceFile(file) {
  if (!file) return false;
  const status = $('#evidenceStatus');
  status.className = 'evidence-status';
  status.textContent = `正在解析 ${file.name}…`;
  const body = new FormData();
  body.append('file', file);
  const parsed = await requestJSON('/api/evidence', { method: 'POST', body }, 45000);
  if (!String(parsed.text || '').trim()) throw new Error('没有提取到可分析的内容');
  if ($('#evidenceType').value === '简历') {
    const extracted = await requestJSON('/api/profile-extract', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: parsed.text, profile })
    }, 60000);
    pendingResume = { extracted, text: parsed.text, filename: file.name };
    renderResumeReview(extracted);
    openModal($('#resumeReviewModal'));
    status.textContent = '已识别简历信息，请确认是否更新画像。';
    return true;
  }
  status.textContent = '解析完成，正在根据材料调整路径…';
  await addEvidence(parsed.text, { type: $('#evidenceType').value, filename: file.name });
  status.textContent = '材料已保存，计划已完成一次更新。';
  return true;
}

function renderResumeReview(extracted = {}) {
  const labels = { stage: '当前阶段', school: '学校层次', major: '专业', target: '目标岗位', experience: '经历摘要' };
  const fields = ['stage', 'school', 'major', 'experience'];
  $('#resumeReviewList').innerHTML = fields.map(key => `<label class="resume-review-row"><input type="checkbox" data-resume-field="${key}" checked><span><small>${labels[key]}</small><strong>${escapeHtml(extracted[key] || '未识别')}</strong></span></label>`).join('') + `<div class="resume-target-note"><span>当前目标岗位</span><strong>${escapeHtml(profile.target || '未填写')}</strong><small>默认保留，不会被简历自动覆盖</small></div>`;
}

async function confirmResumeProfile() {
  if (!pendingResume) return closeModal($('#resumeReviewModal'));
  const extracted = pendingResume.extracted || {};
  const fields = $$('.resume-review-row input:checked').map(input => input.dataset.resumeField);
  fields.forEach(field => { if (extracted[field]) profile[field] = extracted[field]; });
  profile.evidence.push({ type: '简历', filename: pendingResume.filename, content: pendingResume.text, addedAt: new Date().toISOString() });
  persistProfile();
  closeModal($('#resumeReviewModal'));
  pendingResume = null;
  await recalculate('简历信息已经确认，画像和岗位路径同步更新。');
}

async function explainEvidence(item) {
  const box = $('#evidenceInsight');
  if (!box) return;
  box.hidden = false;
  $('#insightProof').textContent = '正在提炼：这份材料证明了什么…';
  $('#insightGap').textContent = '';
  $('#insightNext').textContent = '';
  try {
    const insight = await requestJSON('/api/evidence-insight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: item.content, profile })
    }, 30000);
    $('#insightProof').textContent = `证明：${(insight.proves || []).join('；') || '暂未提炼出稳定证据'}`;
    $('#insightGap').textContent = `缺口：${(insight.gaps || []).join('；') || '继续积累外部反馈'}`;
    $('#insightNext').textContent = `下一步：${insight.next || '补充结果与反馈'}`;
  } catch {
    $('#insightProof').textContent = '材料已保存，后续规划会继续参考它。';
    $('#insightGap').textContent = '';
    $('#insightNext').textContent = '';
  }
}

async function checkHealth() {
  try {
    const health = await requestJSON('/api/health', { cache: 'no-store' }, 9000);
    if (health.configured) {
      const label = `AI 已连接 · ${health.model || '在线模型'}`;
      setAIStatus(label, true);
      companionSay('在线模型已连接。每次新进展都能重新校准整条路径。');
    } else {
      setAIStatus('路径引擎待连接 · 数据不会丢失', false);
      companionSay('智能规划暂时待连接，但画像、行动和证据仍然可以继续记录。');
    }
  } catch {
    setAIStatus('路径引擎待连接 · 数据不会丢失', false);
    companionSay('暂时无法连接智能规划，但你可以继续记录进展，稍后会自动重算。');
  }
}

function bindEvents() {
  $('#aiCommandForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = $('#aiCommandInput');
    const note = input.value.trim();
    if (!note) return showToast('告诉小径一件最近发生的事');
    input.value = '';
    await addUpdate(note);
  });
  $$('.ai-command-examples button').forEach(button => button.addEventListener('click', () => {
    $('#aiCommandInput').value = button.textContent.trim();
    $('#aiCommandInput').focus();
  }));
  $('#toggleCases')?.addEventListener('click', event => {
    const expanded = $('#caseCollapsible').classList.toggle('open');
    event.currentTarget.textContent = expanded ? '收起判断依据 ↑' : '展开判断依据 ↓';
  });
  $$('.side-link[data-target]').forEach(button => button.addEventListener('click', () => {
    const target = $(`#${button.dataset.target}`);
    if (target) setWorkspaceView(button.dataset.target);
  }));
  $$('[data-target="lab"]').forEach(button => button.addEventListener('click', () => {
    location.href = 'lab.html';
  }));

  $('#sideFocusBtn').addEventListener('click', () => {
    const first = $('.task-toggle:not(.verified)');
    if (first) {
      setWorkspaceView('route');
      setTimeout(() => openActionGuide(first.dataset.task), 350);
    } else {
      setWorkspaceView('evidence');
    }
  });

  $('#decisionCta').addEventListener('click', () => {
    const task = $('#decisionCta').dataset.task;
    if (task) return openActionGuide(task);
    setWorkspaceView('evidence');
    $('[data-compose="update"]').click();
    setTimeout(() => $('#updateInput').focus(), 350);
  });

  $$('.checkin button').forEach(button => button.addEventListener('click', () => {
    profile.mood = button.dataset.mood;
    persistProfile();
    const message = { steady: '收到。今天保持一个可完成的小步。', anxious: '收到。我们把目标拆小，不用一次证明自己。', tired: '收到。今天先保留体力，整理材料也算推进。' }[profile.mood];
    companionSay(message);
    showToast('今天的节奏已记录');
  }));

  $$('.quick-starts [data-start]').forEach(button => button.addEventListener('click', () => {
    const mode = button.dataset.start;
    if (mode === 'route') {
      setWorkspaceView('route');
      setTimeout(() => {
        const first = $('.task-toggle:not(.verified)');
        if (first) openActionGuide(first.dataset.task);
      }, 350);
      return;
    }
    if (mode === 'lab') { location.href = 'lab.html'; return; }
    if (mode === 'interview') { openActionGuide('进行一次目标岗位项目深挖模拟'); return; }
    if (mode === 'evidence') { setWorkspaceView('evidence'); $('[data-compose="update"]').click(); setTimeout(() => $('#updateInput').focus(), 350); return; }
    if (mode === 'profile') {
      $('#editProfile').click();
      return;
    }
    $(`[data-compose="${mode === 'resume' ? 'material' : 'update'}"]`).click();
    setWorkspaceView('evidence');
    if (mode === 'resume') {
      setTimeout(() => $('#evidenceFile').click(), 450);
    } else {
      setTimeout(() => $('#updateInput').focus(), 450);
    }
  }));

  $('#compareBtn').addEventListener('click', () => openDrawer({
    kicker: 'MATCH EXPLAINER', title: '匹配度不是录取概率', intro: '它只表达当前证据与岗位要求的重合程度。',
    content: '<div class="guide-block"><strong>01</strong><p>现在可投：以现有经历判断现实入口。</p></div><div class="guide-block"><strong>02</strong><p>毕业落点：考虑毕业前可以合理补齐的能力和经历。</p></div><div class="guide-block"><strong>03</strong><p>进阶选择：需要额外实习、项目结果或更强竞争背书。</p></div>'
  }));

  $$('.open-guide').forEach(button => button.addEventListener('click', () => {
    const card = button.closest('.role-card');
    const role = JSON.parse(card.dataset.role || '{}');
    const gaps = plan?.gaps || [];
    openDrawer({
      kicker: ['ROLE / NOW', 'ROLE / GRADUATION', 'ROLE / STRETCH'][Number(button.dataset.roleIndex)] || 'ROLE GUIDE',
      title: role.title || '岗位建议', intro: role.reason || '',
      content: `<div class="guide-detail"><h3>判断依据</h3><ol>${gaps.slice(0, 3).map((gap, index) => `<li><b>0${index + 1}</b><span>${escapeHtml(gap)}</span></li>`).join('')}</ol></div><div class="guide-evidence"><small>下一步</small><p>优先完成行动路径中的第一项，并用成果更新这张岗位地图。</p></div>`
    });
  }));

  $('#stageList').addEventListener('click', event => {
    const guide = event.target.closest('.task-guide');
    if (guide) return openActionGuide(guide.dataset.task);
    const task = event.target.closest('.task-toggle');
    if (!task) return;
    const name = task.dataset.task;
    if (completedTasks.has(name)) {
      completedTasks.delete(name);
      verifiedTasks.delete(name);
      delete taskEvents[name];
      task.classList.remove('done', 'verified', 'proof-pending');
      showToast('已恢复为待完成');
    } else {
      completedTasks.add(name);
      taskEvents[name] = new Date().toISOString();
      task.classList.add('done', 'proof-pending');
      task.closest('.action-row')?.classList.add('just-completed');
      showToast(`行动已执行 · 先获得部分进度，留下成果后完整计入`);
      companionSay('这一步已经记入路径。补充成果后，AI 还会重新判断后续路线。');
      setTimeout(() => openOutcome(name), 150);
    }
    syncTaskUI();
  });

  $$('.compose-tabs button').forEach(button => button.addEventListener('click', () => {
    $$('.compose-tabs button').forEach(item => item.classList.toggle('active', item === button));
    $$('.compose-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.pane === button.dataset.compose));
  }));

  $('#addUpdate').addEventListener('click', () => addUpdate($('#updateInput').value));
  $$('.quick-updates button').forEach(button => button.addEventListener('click', () => {
    $('#updateInput').value = button.dataset.update;
    $('#updateInput').focus();
  }));
  $('#addEvidence').addEventListener('click', async () => {
    if (evidenceFileRequest) {
      showToast('材料正在解析，请稍候');
      return evidenceFileRequest;
    }
    if (selectedEvidenceFile) {
      evidenceFileRequest = parseSelectedEvidenceFile(selectedEvidenceFile);
      try { await evidenceFileRequest; } catch (error) {
        $('#evidenceStatus').className = 'evidence-status error';
        $('#evidenceStatus').textContent = `解析失败：${error.message}`;
        showToast('材料没有写入证据链，请检查文件后重试');
      } finally { evidenceFileRequest = null; selectedEvidenceFile = null; }
      return;
    }
    const typedEvidence = $('#evidenceInput').value.trim();
    if (!typedEvidence && profile.evidence.length) {
      showToast('这份材料已经分析过了，结果已进入证据链');
      return;
    }
    await addEvidence(typedEvidence);
  });

  $('#evidenceFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    selectedEvidenceFile = file;
    evidenceFileRequest = parseSelectedEvidenceFile(file);
    try { await evidenceFileRequest; } catch (error) {
      $('#evidenceStatus').className = 'evidence-status error';
      $('#evidenceStatus').textContent = `解析失败：${error.message}`;
      showToast('材料没有写入证据链，请检查文件后重试');
    } finally {
      evidenceFileRequest = null;
      selectedEvidenceFile = null;
      event.target.value = '';
    }
  });
  $('#resumeReviewConfirm')?.addEventListener('click', confirmResumeProfile);

  const openProfile = () => { fillProfileForm(); openModal($('#profileModal')); };
  $('#editProfile').addEventListener('click', openProfile);
  $('.profile-edit-inline').addEventListener('click', openProfile);
  $('#modalResumeBtn')?.addEventListener('click', () => {
    closeModal($('#profileModal'));
    setWorkspaceView('evidence');
    const materialTab = $('[data-compose="material"]');
    materialTab.click();
    setTimeout(() => $('#evidenceFile').click(), 450);
  });
  $('#profileForm').addEventListener('submit', async event => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.target));
    const missing = ['stage', 'school', 'major', 'target'].find(key => !String(formData[key] || '').trim());
    if (missing) {
      showToast('请先补齐阶段、学校、专业和目标岗位');
      event.target.elements[missing]?.focus();
      return;
    }
    profile = { ...profile, ...formData };
    persistProfile();
    closeModal($('#profileModal'));
    await recalculate('基本信息已经更新，整条路径也同步换成了新的目标。');
  });

  $('#outcomeForm').addEventListener('submit', async event => {
    event.preventDefault();
    const text = $('#outcomeText').value.trim();
    const link = $('#outcomeLink').value.trim();
    if (!text) return;
    closeModal($('#outcomeModal'));
    closeModal($('#drawer'));
    verifiedTasks.add(activeTask);
    $$('.task-toggle').filter(task => task.dataset.task === activeTask).forEach(task => {
      task.classList.remove('proof-pending');
      task.classList.add('done', 'verified');
    });
    syncTaskUI();
    await addEvidence(`${activeTask}：${text}${link ? `（成果链接：${link}）` : ''}`, { type: '行动成果' });
  });

  $('#drawerDone').addEventListener('click', () => {
    if (!activeTask) return closeModal($('#drawer'));
    completedTasks.add(activeTask);
    taskEvents[activeTask] = taskEvents[activeTask] || new Date().toISOString();
    $$('.task-toggle').filter(task => task.dataset.task === activeTask).forEach(task => task.classList.add('done', 'proof-pending'));
    syncTaskUI();
    closeModal($('#drawer'));
    openOutcome(activeTask);
  });
  $('#closeDrawer').addEventListener('click', () => closeModal($('#drawer')));

  $$('.modal-close, .outcome-cancel, .reset-cancel, .resume-review-cancel').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
  $$('.modal-backdrop, .drawer-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop); }));

  $('.reset-path').addEventListener('click', () => openModal($('#resetModal')));
  $('.reset-confirm').addEventListener('click', () => {
    Object.values(STORAGE).forEach(key => localStorage.removeItem(key));
    location.reload();
  });

  $('#themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('night');
    localStorage.setItem(STORAGE.theme, document.body.classList.contains('night') ? 'night' : 'day');
  });
  $('#closeCompanion').addEventListener('click', () => $('#companion').classList.add('hidden'));

  $('#growthExport').addEventListener('click', () => {
    const report = { profile, plan, completedTasks: [...completedTasks], generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pathwise-growth-report.json';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('成长报告已导出');
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    $$('.open').forEach(element => closeModal(element));
  });

}

function setWorkspaceView(view = 'overview') {
  const allowed = ['overview', 'route', 'evidence'];
  const next = !hasStoredProfile ? 'overview' : (allowed.includes(view) ? view : 'overview');
  allowed.forEach(name => document.body.classList.toggle(`workspace-view-${name}`, name === next));
  $$('.side-link[data-target]').forEach(button => button.classList.toggle('active', button.dataset.target === next));
  history.replaceState(null, '', next === 'overview' ? location.pathname : `#${next}`);
  window.scrollTo({ top:0, behavior:'smooth' });
}

function init() {
  document.body.classList.toggle('is-onboarding', !hasStoredProfile);
  if (!hasStoredProfile) {
    $('#profileModalTitle').textContent = '建立你的职业画像';
    $('#companionText').textContent = '第一次使用，先告诉我你现在在哪、想去哪里。';
  }
  if (localStorage.getItem(STORAGE.theme) === 'night') document.body.classList.add('night');
  $('.hero-visual img').addEventListener('error', () => $('.hero-visual').classList.add('fallback'));
  const updateClock = () => { $('#clock').textContent = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); };
  updateClock();
  setInterval(updateClock, 30000);
  bindEvents();
  setWorkspaceView(location.hash === '#route' ? 'route' : location.hash === '#evidence' ? 'evidence' : 'overview');
  if (hasStoredProfile) persistProfile();
  renderAll(plan || makeLocalPlan());
  checkHealth();
  if (!hasStoredProfile) {
    setTimeout(() => {
      companionSay('第一次使用，先更新基本信息；也可以直接到“进展证据”上传简历。');
      fillProfileForm();
      openModal($('#profileModal'));
    }, 550);
  }
}

init();
