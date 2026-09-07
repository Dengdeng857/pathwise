import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const asDataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const sharedSource = await readFile(new URL('../functions/api/_shared.js', import.meta.url), 'utf8');
const sharedUrl = asDataUrl(sharedSource);
const endpointSource = (await readFile(new URL('../functions/api/profile-extract.js', import.meta.url), 'utf8'))
  .replace("'./_shared.js'", `'${sharedUrl}'`);
const { onRequestPost } = await import(asDataUrl(endpointSource));
const call = async (payload, env = {}) => {
  const request = new Request('https://pathwise.test/api/profile-extract', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const response = await onRequestPost({ request, env });
  return { response, body: await response.json() };
};

const empty = await call({ content: '   ' });
assert.equal(empty.response.status, 400);

const resume = '2027 届 北京大学 软件工程硕士，参与 AI 产品项目。';
const degraded = await call({ content: resume });
assert.equal(degraded.response.status, 200, 'AI outage must not block resume onboarding');
assert.equal(degraded.body.source, 'rules');
assert.equal(degraded.body.school, '北京大学');
assert.equal(degraded.body.major, '软件工程');
assert.match(degraded.body.aiWarning, /Key/);

globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
  stage: '2027 届硕士', school: '北京大学', major: '软件工程', experience: 'AI 项目经验',
  recommendation: { target: 'AI 产品经理', basis: '有 AI 项目产出', confidence: 78 }
}) } }] }), { status: 200 });
const intelligent = await call({ content: resume }, { MODELSNEXUS_API_KEY: 'test-key' });
assert.equal(intelligent.response.status, 200);
assert.equal(intelligent.body.source, 'ai');
assert.equal(intelligent.body.recommendation.target, 'AI 产品经理');

globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
  stage: '2027 届', school: '北京大学', major: '软件工程', experience: 'AI 项目',
  recommendation: { target: 'string', basis: 'string', confidence: 100 }
}) } }] }), { status: 200 });
const placeholderSuggestion = await call({ content: resume }, { MODELSNEXUS_API_KEY: 'test-key' });
assert.equal(placeholderSuggestion.body.source, 'ai');
assert.equal(placeholderSuggestion.body.recommendation.target, '', 'placeholder suggestion must never reach the confirmation UI');

console.log('profile extraction API tests passed');
