import assert from 'node:assert/strict';
import { buildContinuityDelta, fallbackContinuityNarrative, validateContinuityNarrative } from '../continuity-model.mjs';

const previous = {
  summary: '旧判断',
  currentRoles: [{ title: '产品实习生', match: 55 }],
  graduationRoles: [{ title: '风控产品经理', match: 60 }],
  gaps: ['缺少风控项目', '缺少数据结果'],
  actions: ['做通用产品项目', '学习 SQL'],
  stages: [{ title: '产品基础' }, { title: '目标冲刺' }]
};
const next = {
  summary: '项目证明了风控经验',
  currentRoles: [{ title: '产品实习生', match: 62 }, { title: '风控产品实习生', match: 58 }],
  graduationRoles: [{ title: '风控产品经理', match: 74 }],
  gaps: ['缺少数据结果'],
  actions: ['沉淀风控项目复盘', '学习 SQL'],
  stages: [{ title: '产品基础' }, { title: '风控专项' }, { title: '目标冲刺' }]
};

const delta = buildContinuityDelta(previous, next, { type: 'project', label: '黑产识别项目', content: '完成策略设计与上线复盘' });
assert.equal(delta.kind, 'route-change');
assert.equal(delta.evidence.label, '黑产识别项目');
assert.deepEqual(delta.gaps.resolved, ['缺少风控项目']);
assert.deepEqual(delta.actions.added, ['沉淀风控项目复盘']);
assert.ok(delta.roleChanges.some(item => item.title === '风控产品经理' && item.delta === 14));
assert.ok(delta.impactScore > 0 && delta.impactScore <= 100);

const unchanged = buildContinuityDelta(next, next, {});
assert.equal(unchanged.kind, 'no-material-change');
assert.equal(unchanged.changed, false);
assert.match(fallbackContinuityNarrative(unchanged).headline, /不需要改变/);

assert.deepEqual(validateContinuityNarrative({ headline: '方向更清晰', why: '项目形成了新证据', nextMove: '补齐量化结果', confidence: 82 }), {
  headline: '方向更清晰', why: '项目形成了新证据', nextMove: '补齐量化结果', confidence: 82
});
assert.throws(() => validateContinuityNarrative({ headline: 'x', why: 'x', nextMove: 'x', confidence: 120 }));

console.log('continuity-model tests passed');
