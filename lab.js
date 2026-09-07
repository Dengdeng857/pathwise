const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const profile = read('pathwiseProfile', {});
let plan = read('pathwisePlan', null);
try { if (plan) window.PathwiseModel.validatePlanShape(plan); }
catch (_) { plan = null; }
const roles = [...(plan?.currentRoles || []).slice(0, 1), ...(plan?.graduationRoles || []).slice(0, 2)];
const choices = roles.length ? roles : [{ title: profile.target || '目标岗位', match: 50 }, { title: '相邻方向岗位', match: 42 }, { title: '进阶方向岗位', match: 30 }];
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const list = document.querySelector('#standaloneChoices');
const insight = document.querySelector('#standaloneInsight');
list.innerHTML = choices.map((role, index) => `<button class="lab-choice ${index ? '' : 'selected'}" data-index="${index}"><span>0${index + 1}</span><div><strong>${escapeHtml(role.title)}</strong><small>${index === 0 ? '现在最接近' : index === 1 ? '毕业落点' : '进阶选择'} · ${Number(role.match || 0)} match</small></div><i>→</i></button>`).join('');
function show(index) { const role = choices[index]; const gap = (plan?.gaps || [])[index] || '一条可验证的真实成果'; insight.innerHTML = `<span class="kicker">AI READOUT / 0${index + 1}</span><strong>${escapeHtml(role.title)}</strong><p>当前匹配度 ${Number(role.match || 0)}。这条方向最需要补齐的是：${escapeHtml(gap)}。</p><div class="lab-micro"><span>建议先做</span><b>${index === 0 ? '拆解岗位要求，确认你是否喜欢这类问题' : index === 1 ? '完成一个可展示项目，并获得外部反馈' : '做一次深挖面试，测试能力上限'}</b></div><a class="text-button" href="career.html#route">回到行动计划 →</a>`; }
document.querySelectorAll('.lab-choice').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.lab-choice').forEach(item => item.classList.remove('selected')); button.classList.add('selected'); show(Number(button.dataset.index)); }));
show(0);
