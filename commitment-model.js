(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  root.PathwiseCommitmentModel = model;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DAY = 86400000;

  function createCommitment(estimatedDays, now = Date.now()) {
    const days = Math.max(1, Math.round(Number(estimatedDays) || 3));
    return {
      startedAt: new Date(now).toISOString(),
      dueAt: new Date(now + days * DAY).toISOString(),
      estimatedDays: days
    };
  }

  function formatCommitment(commitment, now = Date.now()) {
    const due = new Date(commitment?.dueAt || 0);
    if (!Number.isFinite(due.getTime())) return '进行中';
    const days = Math.ceil((due.getTime() - now) / DAY);
    if (days < 0) return `已到期 ${Math.abs(days)} 天`;
    if (days === 0) return '今天到期';
    if (days === 1) return '明天到期';
    return `还剩 ${days} 天`;
  }

  function pickCommittedTask(commitments, visibleTasks) {
    const visible = new Set(visibleTasks || []);
    return Object.keys(commitments || {}).find(task => visible.has(task)) || '';
  }

  return { createCommitment, formatCommitment, pickCommittedTask };
});
