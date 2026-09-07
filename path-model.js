(function (global) {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const unique = items => [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];

  function isCompleteProfile(profile) {
    return Boolean(profile && ['stage', 'school', 'major', 'target'].every(key => String(profile[key] || '').trim()));
  }

  function isLegacyDemoProfile(profile, demo) {
    if (!profile || !demo) return false;
    const sameSeed = ['stage', 'school', 'major', 'target', 'experience'].every(key => String(profile[key] || '') === String(demo[key] || ''));
    return sameSeed && !(Array.isArray(profile.updates) && profile.updates.length) && !(Array.isArray(profile.evidence) && profile.evidence.length);
  }

  function prepareProfileForStorage(profile = {}) {
    const updates = Array.isArray(profile.updates) ? profile.updates : [];
    const evidence = Array.isArray(profile.evidence) ? profile.evidence : [];
    return {
      ...profile,
      updates: updates.slice(-100).map(item => String(item || '').slice(0, 1200)),
      evidence: evidence.slice(-30).map(item => typeof item === 'string'
        ? { type: '材料', content: item.slice(0, 24000) }
        : { ...item, type:String(item?.type || '').slice(0, 80), filename:String(item?.filename || '').slice(0, 240), summary:String(item?.summary || '').slice(0, 600), content:String(item?.content || '').slice(0, 24000) })
    };
  }

  function hasModelPlaceholder(value) {
    if (typeof value === 'string') return /^(string|number|object|array|boolean|null|undefined)$/i.test(value.trim()) || value.trim().toLowerCase() === 'n/a';
    if (Array.isArray(value)) return value.some(hasModelPlaceholder);
    if (value && typeof value === 'object') return Object.values(value).some(hasModelPlaceholder);
    return false;
  }

  function validatePlanShape(value) {
    const required = ['profile', 'summary', 'currentRoles', 'graduationRoles', 'gaps', 'actions', 'actionGuides', 'stages'];
    if (!value || typeof value !== 'object' || required.some(key => !(key in value))) throw new Error('模型返回缺少规划字段');
    // Optional metadata can legitimately contain values such as "N/A". Only
    // inspect the fields that are rendered as the actual career plan.
    const core = Object.fromEntries(required.map(key => [key, value[key]]));
    if (hasModelPlaceholder(core)) throw new Error('模型把 JSON 示例占位符当成了规划内容');
    if (typeof value.profile !== 'string' || !value.profile.trim() || typeof value.summary !== 'string' || !value.summary.trim()) throw new Error('模型画像或总结为空');
    if (required.slice(2).some(key => !Array.isArray(value[key]) || !value[key].length)) throw new Error('模型规划内容为空');
    if (value.actions.some(item => typeof item !== 'string' || item.trim().length < 4)) throw new Error('模型行动项无效');
    if ([...value.currentRoles, ...value.graduationRoles].some(item => !item || typeof item.title !== 'string' || !item.title.trim() || item.match === null || item.match === '' || !Number.isFinite(Number(item.match)))) throw new Error('模型岗位判断无效');
    if (value.gaps.some(item => typeof item !== 'string' || item.trim().length < 2)) throw new Error('模型差距内容无效');
    if (value.actionGuides.some(item => !item || typeof item.title !== 'string' || item.title.trim().length < 4 || !Array.isArray(item.steps) || !item.steps.length)) throw new Error('模型行动指导无效');
    const guideTitles = new Set(value.actionGuides.map(item => item.title.trim()));
    if (value.actions.some(item => !guideTitles.has(item.trim()))) throw new Error('行动项与行动指导未对齐');
    if (value.stages.some(item => !item || typeof item.title !== 'string' || !item.title.trim() || !Array.isArray(item.tasks) || !item.tasks.length || item.tasks.some(task => typeof task !== 'string' || !task.trim()))) throw new Error('模型阶段结构无效');
    return value;
  }

  function guideFor(plan, title) {
    return (Array.isArray(plan?.actionGuides) ? plan.actionGuides : []).find(item => item && item.title === title) || {};
  }

  function estimateEffort(title, stageIndex = 0, plan = {}) {
    const guide = guideFor(plan, title);
    const explicit = Number(guide.effort);
    if (Number.isFinite(explicit) && explicit > 0) return clamp(Math.round(explicit), 1, 5);

    const days = Number(guide.estimatedDays);
    if (Number.isFinite(days) && days > 0) return clamp(Math.ceil(Math.log2(days + 1)), 1, 5);

    const text = `${title} ${guide.doneWhen || ''}`.toLowerCase();
    if (/实习|offer|录用|获奖|比赛名次|论文|cve|cnvd|正式上线|真实用户/.test(text)) return 5;
    if (/完整项目|作品集|代码审计|漏洞|案例|开源|量化结果|外部反馈/.test(text)) return 4;
    if (/模拟面试|复盘|投递|系统学习|课程|训练/.test(text)) return 3;
    if (/整理|修改|拆解|收集|筛选|标注|准备/.test(text)) return 2;
    return clamp(stageIndex + 2, 1, 5);
  }

  function getPlanTasks(plan = {}) {
    const stages = Array.isArray(plan.stages) ? plan.stages.slice(0, 3) : [];
    const seen = new Set();
    const tasks = [];
    stages.forEach((stage, stageIndex) => {
      const source = stageIndex === 0 && Array.isArray(plan.actions) && plan.actions.length
        ? plan.actions
        : (Array.isArray(stage.tasks) ? stage.tasks : []);
      unique(source).forEach(title => {
        if (seen.has(title)) return;
        seen.add(title);
        const guide = guideFor(plan, title);
        tasks.push({
          title,
          stageIndex,
          effort: estimateEffort(title, stageIndex, plan),
          estimatedDays: Number(guide.estimatedDays) > 0 ? Number(guide.estimatedDays) : null
        });
      });
    });
    return tasks;
  }

  function getWeightedProgress(plan = {}, completed = [], verified = completed) {
    const completedSet = completed instanceof Set ? new Set(completed) : new Set(completed || []);
    const verifiedSet = verified instanceof Set ? verified : new Set(verified || []);
    // A verified outcome necessarily means the action itself was completed.
    // Repair older/corrupted state where proofs existed without task flags.
    verifiedSet.forEach(title => completedSet.add(title));
    const tasks = getPlanTasks(plan);
    const totalWeight = tasks.reduce((sum, task) => sum + task.effort, 0);
    const doneTasks = tasks.filter(task => completedSet.has(task.title));
    const verifiedTasks = tasks.filter(task => verifiedSet.has(task.title));
    const creditedWeight = tasks.reduce((sum, task) => {
      if (verifiedSet.has(task.title)) return sum + task.effort;
      if (completedSet.has(task.title)) return sum + task.effort * .35;
      return sum;
    }, 0);
    return {
      tasks,
      doneTasks,
      verifiedTasks,
      totalWeight,
      doneWeight: creditedWeight,
      creditedWeight,
      verifiedWeight: verifiedTasks.reduce((sum, task) => sum + task.effort, 0),
      percent: totalWeight ? Math.round(creditedWeight / totalWeight * 100) : 0
    };
  }

  global.PathwiseModel = { estimateEffort, getPlanTasks, getWeightedProgress, hasModelPlaceholder, isCompleteProfile, isLegacyDemoProfile, prepareProfileForStorage, validatePlanShape };
})(window);
