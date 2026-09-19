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

console.log('evidence schema model tests passed');
