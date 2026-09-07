const assert = require('node:assert/strict');

global.window = global;
require('../path-model.js');

const plan = {
  actions: ['整理 10 个 JD', '完成真实用户项目', '模拟面试'],
  actionGuides: [
    { title: '整理 10 个 JD', effort: 2, estimatedDays: 2 },
    { title: '完成真实用户项目', effort: 5, estimatedDays: 21 },
    { title: '模拟面试', effort: 3, estimatedDays: 3 }
  ],
  stages: [
    { tasks: ['旧的重复任务'] },
    { tasks: ['完成代码审计案例'] },
    { tasks: ['拿到相关实习'] }
  ]
};

const tasks = PathwiseModel.getPlanTasks(plan);
assert.deepEqual(tasks.map(task => task.title), [
  '整理 10 个 JD',
  '完成真实用户项目',
  '模拟面试',
  '完成代码审计案例',
  '拿到相关实习'
]);
assert.equal(PathwiseModel.estimateEffort('完成真实用户项目', 0, plan), 5);
assert.equal(PathwiseModel.estimateEffort('整理简历', 0, {}), 2);
assert.equal(PathwiseModel.estimateEffort('完成代码审计案例', 1, {}), 4);
assert.equal(PathwiseModel.estimateEffort('拿到相关实习', 2, {}), 5);

const claimed = new Set(['完成真实用户项目']);
const partial = PathwiseModel.getWeightedProgress(plan, claimed, new Set());
const verified = PathwiseModel.getWeightedProgress(plan, claimed, claimed);
assert.equal(partial.creditedWeight, 1.75);
assert.equal(verified.creditedWeight, 5);
assert.ok(verified.percent > partial.percent);

const invalidPlan = {
  actions: ['任务 A', '任务 B'],
  actionGuides: [{ title: '任务 A', effort: 0 }, { title: '任务 B', effort: 99 }],
  stages: [{ tasks: [] }]
};
assert.equal(PathwiseModel.estimateEffort('任务 A', 0, invalidPlan), 2);
assert.equal(PathwiseModel.estimateEffort('任务 B', 0, invalidPlan), 5);

console.log('path-model tests passed');
