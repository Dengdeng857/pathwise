const assert = require('node:assert/strict');
const { assessOutcome } = require('../evidence-quality-model.js');

assert.equal(assessOutcome('做完了').credible, false, '空泛完成描述不能成为职业证据');
assert.equal(assessOutcome('完成了项目并整理文档').credible, false, '只有产出动词但没有验证信号仍不够');

const metric = assessOutcome('完成登录模块性能优化，接口耗时从 420ms 降到 180ms，并记录了压测过程');
assert.equal(metric.credible, true);
assert.equal(metric.signals.metric, true);

const linked = assessOutcome('完成岗位调研并整理出高频能力要求和作品集案例', 'https://github.com/example/demo');
assert.equal(linked.credible, true);
assert.equal(linked.signals.link, true);

const feedback = assessOutcome('完成产品原型并交付导师检查，导师反馈核心流程已经通过验收');
assert.equal(feedback.credible, true);
assert.equal(feedback.signals.feedback, true);

console.log('evidence quality model tests passed');
