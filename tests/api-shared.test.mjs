import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The Pages functions are native ESM while this static site's package stays
// CommonJS. Import the dependency-free shared module through a data URL so the
// same production source is exercised without changing deployment semantics.
const source = await readFile(new URL('../functions/api/_shared.js', import.meta.url), 'utf8');
const shared = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

assert.deepEqual(shared.parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
assert.deepEqual(shared.parseModelJson('before {"text":"brace } in string","ok":true} after'), { text: 'brace } in string', ok: true });
assert.deepEqual(shared.parseModelJson('{\n{"ok":true}'), { ok: true }, 'must recover from a duplicated opening frame');
assert.deepEqual(shared.parseModelJson(JSON.stringify('{"ok":true}')), { ok: true }, 'must unwrap JSON encoded as a string');
assert.throws(() => shared.parseModelJson('not json'));
assert.throws(() => shared.parseModelJson('{"cut":'));

const valid = {
  profile: '求职者画像', summary: '当前结论',
  currentRoles: [{ title: '当前岗位', match: 60 }], graduationRoles: [{ title: '毕业岗位', match: 70 }],
  gaps: ['一项真实差距'], actions: ['完成一项真实行动'],
  actionGuides: [{ title: '完成一项真实行动', steps: ['先完成第一步'] }],
  stages: [{ title: '第一阶段', tasks: ['完成一项真实行动'] }],
  caseReferences: [{ excerpt: ['N/A'] }]
};
assert.equal(shared.validatePlan(valid), valid);
const wrapped = shared.normalizePlanContract({ plan: { profile:'事实画像', summary:'简短判断', current_roles:[], graduation_roles:[], gaps:[], actions:[], action_guides:[], career_stages:[] } });
assert.equal(wrapped.schemaVersion, 'pathwise.plan.v1');
assert.ok(Array.isArray(wrapped.currentRoles) && Array.isArray(wrapped.actionGuides));
assert.equal(shared.normalizePlanContract({ profile:'x' }).profile, 'x');
for (const mutation of [
  value => { value.profile = 'string'; },
  value => { value.actions = []; },
  value => { value.currentRoles[0].match = null; },
  value => { value.actionGuides[0].title = '没有对齐的行动'; }
]) {
  const candidate = structuredClone(valid);
  mutation(candidate);
  assert.throws(() => shared.validatePlan(candidate));
}

assert.deepEqual(shared.normalizeDirectionRecommendation({ target: ' AI 产品经理 ', basis: '两段 AI 项目', confidence: 82.6 }), {
  target: 'AI 产品经理', basis: '两段 AI 项目', confidence: 83
});
assert.deepEqual(shared.normalizeDirectionRecommendation({ target: 'string', basis: 'string', confidence: 99 }), { target: '', basis: '', confidence: 0 });
assert.deepEqual(shared.normalizeDirectionRecommendation(null), { target: '', basis: '', confidence: 0 });

console.log('api shared tests passed');
