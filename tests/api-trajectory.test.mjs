import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const asDataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const sharedSource = await readFile(new URL('../functions/api/_shared.js', import.meta.url), 'utf8');
const continuitySource = await readFile(new URL('../continuity-model.mjs', import.meta.url), 'utf8');
const sharedUrl = asDataUrl(sharedSource);
const continuityUrl = asDataUrl(continuitySource);
const handlerSource = (await readFile(new URL('../functions/api/trajectory-update.js', import.meta.url), 'utf8'))
  .replace("'./_shared.js'", `'${sharedUrl}'`)
  .replace("'../../continuity-model.mjs'", `'${continuityUrl}'`);
const { onRequestPost } = await import(asDataUrl(handlerSource));

const oldPlan = {
  summary: '旧判断', currentRoles: [{ title: '产品实习生', match: 55 }],
  graduationRoles: [{ title: '产品经理', match: 60 }], gaps: ['缺少项目'],
  actions: ['完成通用项目'], stages: [{ title: '基础阶段' }]
};
const newPlan = {
  summary: '新判断', currentRoles: [{ title: '产品实习生', match: 68 }],
  graduationRoles: [{ title: '产品经理', match: 72 }], gaps: ['缺少量化结果'],
  actions: ['补充项目数据'], stages: [{ title: '成果阶段' }]
};
const call = async (payload, env = {}) => {
  const request = new Request('https://pathwise.test/api/trajectory-update', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const response = await onRequestPost({ request, env });
  return { response, body: await response.json() };
};

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls += 1; throw new Error('should not call AI'); };
const unchanged = await call({ previousPlan: oldPlan, nextPlan: oldPlan, evidence: {} });
assert.equal(unchanged.response.status, 200);
assert.equal(unchanged.body.source, 'rules');
assert.equal(unchanged.body.delta.changed, false);
assert.equal(fetchCalls, 0, 'unchanged routes must not spend an AI call');

const degraded = await call({ previousPlan: oldPlan, nextPlan: newPlan, evidence: { type: 'project', content: '项目已上线' } });
assert.equal(degraded.response.status, 200);
assert.equal(degraded.body.source, 'rules');
assert.match(degraded.body.aiWarning, /Key/);
assert.equal(degraded.body.delta.changed, true);

globalThis.fetch = async () => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify({ headline: '路线更清晰', why: '新项目增加了可验证经验', nextMove: '补充量化结果', confidence: 84 }) } }]
}), { status: 200, headers: { 'Content-Type': 'application/json' } });
const intelligent = await call({ previousPlan: oldPlan, nextPlan: newPlan, evidence: { type: 'project', content: '项目已上线' } }, { MODELSNEXUS_API_KEY: 'test-key' });
assert.equal(intelligent.response.status, 200);
assert.equal(intelligent.body.source, 'ai');
assert.equal(intelligent.body.narrative.confidence, 84);

globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not-json' } }] }), { status: 200 });
const invalidAi = await call({ previousPlan: oldPlan, nextPlan: newPlan, evidence: {} }, { MODELSNEXUS_API_KEY: 'test-key' });
assert.equal(invalidAi.response.status, 200);
assert.equal(invalidAi.body.source, 'rules');
assert.ok(invalidAi.body.narrative.headline);
assert.ok(invalidAi.body.aiWarning);

const badRequest = await onRequestPost({ request: new Request('https://pathwise.test', { method: 'POST', body: '{' }), env: {} });
assert.equal(badRequest.status, 400);

console.log('trajectory API tests passed');
