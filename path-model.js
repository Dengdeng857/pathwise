(function (global) {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const unique = items => [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];

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
    const completedSet = completed instanceof Set ? completed : new Set(completed || []);
    const verifiedSet = verified instanceof Set ? verified : new Set(verified || []);
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

  global.PathwiseModel = { estimateEffort, getPlanTasks, getWeightedProgress };
})(window);
