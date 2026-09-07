(function (global) {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const asList = value => Array.isArray(value) ? value : [];

  const MILESTONES = [
    { id:'first-proof', title:'第一处路标', message:'你留下了第一份行动成果，路径开始有真实依据。', visual:'trail-sign', test:s => s.verifiedCount >= 1 },
    { id:'deep-work', title:'翻过一段陡坡', message:'你完成了一项高投入行动，这比多个轻量勾选更能改变路径。', visual:'ridge', test:s => s.maxVerifiedEffort >= 4 },
    { id:'route-clarity', title:'看见新的岔路', message:'一份新证据真正改变了岗位判断或行动顺序。', visual:'fork', test:s => s.meaningfulTrajectoryCount >= 1 },
    { id:'momentum', title:'形成连续脚印', message:'你已经积累了多份成果，能力证据开始彼此支撑。', visual:'footprints', test:s => s.verifiedCount >= 2 && s.verifiedWeight >= 7 },
    { id:'halfway', title:'抵达半程营地', message:'按真实投入计算，你已完成至少一半的成果路径。', visual:'camp', test:s => s.verifiedCount >= 3 && s.verifiedRatio >= .5 },
    { id:'arrival', title:'抵达当前目的地', message:'这版规划中的高低难度行动都已有成果支撑。', visual:'summit', test:s => s.verifiedCount > 0 && s.verifiedRatio >= .98 }
  ];

  function meaningfulTrajectory(item) {
    const delta = item?.delta || {};
    const confidence = Number(item?.narrative?.confidence);
    return Boolean(delta.changed !== false && delta.kind !== 'no-material-change' && Number(delta.impactScore) >= 18 && (!Number.isFinite(confidence) || confidence >= 55));
  }

  function buildSignals(weighted = {}, trajectory = []) {
    const tasks = asList(weighted.tasks);
    const verifiedTasks = asList(weighted.verifiedTasks);
    const verifiedTitles = new Set(verifiedTasks.map(task => typeof task === 'string' ? task : task?.title).filter(Boolean));
    const verifiedWithEffort = tasks.filter(task => verifiedTitles.has(task?.title));
    const verifiedWeight = Number(weighted.verifiedWeight) || verifiedWithEffort.reduce((sum, task) => sum + (Number(task.effort) || 0), 0);
    const totalWeight = Math.max(0, Number(weighted.totalWeight) || tasks.reduce((sum, task) => sum + (Number(task?.effort) || 0), 0));
    return {
      verifiedCount: verifiedTitles.size,
      verifiedWeight,
      totalWeight,
      verifiedRatio: totalWeight ? clamp(verifiedWeight / totalWeight, 0, 1) : 0,
      maxVerifiedEffort: verifiedWithEffort.reduce((max, task) => Math.max(max, Number(task.effort) || 0), 0),
      meaningfulTrajectoryCount: asList(trajectory).filter(meaningfulTrajectory).length
    };
  }

  function nextMilestone(signals, unlocked) {
    const next = MILESTONES.find(item => !unlocked.includes(item.id));
    if (!next) return null;
    const progress = {
      'first-proof': signals.verifiedCount ? 1 : 0,
      'deep-work': signals.maxVerifiedEffort / 4,
      'route-clarity': signals.meaningfulTrajectoryCount ? 1 : 0,
      momentum: Math.min(signals.verifiedCount / 2, signals.verifiedWeight / 7),
      halfway: Math.min(signals.verifiedCount / 3, signals.verifiedRatio / .5),
      arrival: signals.verifiedRatio
    }[next.id] || 0;
    return { id:next.id, title:next.title, progress:Math.round(clamp(progress, 0, 1) * 100) };
  }

  function buildMapFeedback({ weightedProgress = {}, trajectory = [], previousUnlocked = [] } = {}) {
    const signals = buildSignals(weightedProgress, trajectory);
    const unlocked = MILESTONES.filter(item => item.test(signals)).map(item => item.id);
    const previous = new Set(asList(previousUnlocked));
    const newlyUnlocked = MILESTONES.filter(item => unlocked.includes(item.id) && !previous.has(item.id)).map(item => ({
      id:item.id, title:item.title, message:item.message, visual:item.visual,
      intensity:['halfway', 'arrival'].includes(item.id) ? 'major' : 'gentle'
    }));
    const latestTrajectory = asList(trajectory).filter(meaningfulTrajectory).slice(-1)[0];
    const activeFeedback = newlyUnlocked.at(-1) || (latestTrajectory ? {
      id:'route-updated',
      title:latestTrajectory.narrative?.headline || '路径判断已更新',
      message:latestTrajectory.narrative?.why || '新证据改变了路径判断。',
      visual:'route-pulse', intensity:'gentle'
    } : null);
    return {
      unlocked,
      newlyUnlocked,
      activeFeedback,
      next:nextMilestone(signals, unlocked),
      signals,
      // Only verified effort advances the map distance. A completion click
      // without an outcome remains visible as "in progress" elsewhere.
      mapProgress:Math.round(signals.verifiedRatio * 100)
    };
  }

  global.PathwiseFeedbackModel = { buildMapFeedback, buildSignals, meaningfulTrajectory };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.PathwiseFeedbackModel;
})(typeof window !== 'undefined' ? window : globalThis);
