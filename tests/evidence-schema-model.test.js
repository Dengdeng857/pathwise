const assert = require('node:assert/strict');
const model = require('../evidence-schema-model.js');

const legacy = model.normalizeEvidence({ type:'简历', filename:'resume.pdf', content:'项目经历', addedAt:'2026-01-02T03:04:05.000Z' });
assert.equal(legacy.schemaVersion, 1);
assert.equal(legacy.source.kind, 'uploaded_file');
assert.equal(legacy.verification, 'supported');
assert.equal(legacy.capturedAt, legacy.addedAt);
assert.ok(legacy.id.startsWith('ev_'));
assert.equal(model.isUsable(legacy), true);

const selfReported = model.normalizeEvidence('我感觉进步了');
assert.equal(selfReported.verification, 'self_reported');
assert.equal(model.isUsable(selfReported), false);

const verified = model.normalizeEvidence({
  type:'行动成果', content:'完成优化，耗时下降 30%', capturedAt:'2026-01-02T03:04:05.000Z',
  verification:'verified', confidence:92, supports:['性能优化', '性能优化'], exposesGap:['缺少用户反馈']
});
assert.equal(verified.confidence, .92);
assert.deepEqual(verified.supports, ['性能优化']);
assert.equal(model.verificationLabel(verified), '已验证成果');

const trace = model.roleTrace({ title:'后端工程师', reason:'需要性能优化能力' }, [verified], { target:'后端工程师' });
assert.equal(trace.evidenceId, verified.id);
assert.equal(trace.claim, '性能优化');
assert.equal(trace.verificationLabel, '已验证成果');
assert.equal(trace.sourceLabel, '行动成果');
const profileTrace = model.roleTrace({ title:'产品经理' }, [], { stage:'本科大三', major:'计算机', target:'产品经理' });
assert.equal(profileTrace.evidenceId, 'profile');
assert.equal(profileTrace.verification, 'self_reported');
assert.match(profileTrace.claim, /本科大三/);
const unrelated = model.roleTrace({ title:'数据分析师', reason:'需要 SQL 与指标分析' }, [verified], { target:'数据分析师' });
assert.equal(unrelated.evidenceId, 'profile', 'unrelated evidence must not be presented as role support');
const tracedPlan = model.attachPlanEvidence({ currentRoles:[{ title:'后端工程师', reason:'需要性能优化能力' }], graduationRoles:[] }, [verified], { target:'后端工程师' });
assert.equal(tracedPlan.evidenceTraceVersion, 1);
assert.deepEqual(tracedPlan.currentRoles[0].evidenceRefs, [verified.id]);
assert.equal(tracedPlan.currentRoles[0].evidenceTrace.claim, '性能优化');

console.log('evidence schema model tests passed');
