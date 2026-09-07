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

const validFullPlan = {
  profile: '一名有真实经历的求职者', summary: '当前需要补齐一项核心成果',
  currentRoles: [{ title: '产品实习生', match: 65, reason: '经历匹配' }],
  graduationRoles: [{ title: '产品经理', match: 72, reason: '补齐成果后可达' }],
  gaps: ['缺少可验证成果'], actions: ['完成一次用户访谈'],
  actionGuides: [{ title: '完成一次用户访谈', steps: ['找到一名目标用户'] }],
  stages: [{ title: '证据补齐', tasks: ['完成一次用户访谈'] }],
  caseReferences: [{ title: '公开案例', excerpt: ['N/A'] }]
};
assert.equal(PathwiseModel.validatePlanShape(validFullPlan), validFullPlan, '可选参考数据不应污染核心规划校验');
for (const mutate of [
  value => { value.summary = 'string'; },
  value => { value.currentRoles = []; },
  value => { value.currentRoles[0].match = 'unknown'; },
  value => { value.actionGuides[0].steps = []; },
  value => { value.actionGuides[0].title = '另一个行动'; },
  value => { value.stages[0].tasks = []; }
]) {
  const candidate = structuredClone(validFullPlan);
  mutate(candidate);
  assert.throws(() => PathwiseModel.validatePlanShape(candidate));
}

const proofOnly = PathwiseModel.getWeightedProgress(plan, new Set(), new Set(['模拟面试']));
assert.ok(proofOnly.doneTasks.some(task => task.title === '模拟面试'));
assert.ok(proofOnly.verifiedTasks.some(task => task.title === '模拟面试'));

const demo = { stage: '本科大三下', school: '211', major: '信息安全', target: '软件安全工程师', experience: '两个项目' };
assert.equal(PathwiseModel.isLegacyDemoProfile({ ...demo, updates: [], evidence: [] }, demo), true);
assert.equal(PathwiseModel.isLegacyDemoProfile({ ...demo, updates: ['用户的真实进展'], evidence: [] }, demo), false, '只要有真实进展就不能清理');
assert.equal(PathwiseModel.isCompleteProfile({ stage: '研一', school: '某高校', major: '软件工程', target: '产品经理' }), true);
assert.equal(PathwiseModel.isCompleteProfile({ stage: '', evidence: [{ type: '简历' }] }), false, '未建档完成不等于数据无效');

const oversizedProfile = {
  updates: Array.from({ length: 140 }, (_, index) => `update-${index}-${'x'.repeat(1500)}`),
  evidence: Array.from({ length: 40 }, (_, index) => ({ type:'简历', filename:`resume-${index}.pdf`, content:'x'.repeat(30000) }))
};
const storageSafe = PathwiseModel.prepareProfileForStorage(oversizedProfile);
assert.equal(storageSafe.updates.length, 100);
assert.equal(storageSafe.evidence.length, 30);
assert.ok(storageSafe.updates.every(item => item.length <= 1200));
assert.ok(storageSafe.evidence.every(item => item.content.length <= 24000));
assert.match(storageSafe.evidence[0].filename, /resume-10/, '容量受限时应保留最新证据');

console.log('path-model tests passed');
