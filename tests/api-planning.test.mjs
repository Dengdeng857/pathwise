import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const asDataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const sharedSource = await readFile(new URL('../functions/api/_shared.js', import.meta.url), 'utf8');
const sharedUrl = asDataUrl(sharedSource);
const shared = await import(sharedUrl);
const importEndpoint = async name => {
  const source = (await readFile(new URL(`../functions/api/${name}.js`, import.meta.url), 'utf8'))
    .replace("'./_shared.js'", `'${sharedUrl}'`);
  return import(asDataUrl(source));
};
const { onRequestPost:plan } = await importEndpoint('plan');
const { onRequestPost:evidenceInsight } = await importEndpoint('evidence-insight');

const validPlan = {
  profile:'大三学生，目标软件安全工程师', summary:'当前应优先补充代码审计成果',
  currentRoles:[{ title:'安全开发实习生', match:62, reason:'已有 Python 项目证据' }],
  graduationRoles:[{ title:'软件安全工程师', match:70, reason:'仍需真实审计成果' }],
  gaps:['代码审计成果'], actions:['完成一个代码审计案例'],
  actionGuides:[{ title:'完成一个代码审计案例', steps:['选择真实开源项目'] }],
  stages:[{ title:'形成第一份安全证据', tasks:['完成一个代码审计案例'] }]
};
const jsonRequest = (path, body, headers = {}) => new Request(`https://pathwise.test/api/${path}`, {
  method:'POST', headers:{ 'Content-Type':'application/json', ...headers }, body:typeof body === 'string' ? body : JSON.stringify(body)
});
const sseResponse = content => new Response(`data: ${JSON.stringify({ choices:[{ delta:{ content } }] })}\n\ndata: [DONE]\n\n`, {
  status:200, headers:{ 'Content-Type':'text/event-stream' }
});

let response = await plan({ request:jsonRequest('plan', '{'), env:{} });
assert.equal(response.status, 400);
assert.deepEqual(await response.json(), { error:'请求 JSON 格式无效', code:'invalid_request' });

response = await plan({ request:jsonRequest('plan', { stage:'本科大三', target:'软件安全工程师' }), env:{} });
assert.equal(response.status, 503);
assert.equal((await response.json()).code, 'not_configured');

globalThis.fetch = async () => sseResponse(JSON.stringify(validPlan));
response = await plan({ request:jsonRequest('plan', { stage:'本科大三', target:'软件安全工程师' }), env:{ MODELSNEXUS_API_KEY:'test-key' } });
assert.equal(response.status, 200);
const planned = await response.json();
assert.equal(planned.status, 'ready');
assert.equal(planned.actions[0], validPlan.actions[0]);

globalThis.fetch = async () => sseResponse('{"profile":"只有半截"');
response = await plan({ request:jsonRequest('plan', { target:'软件安全工程师' }), env:{ MODELSNEXUS_API_KEY:'test-key' } });
assert.equal(response.status, 502);
assert.equal((await response.json()).code, 'invalid_response');

response = await evidenceInsight({ request:jsonRequest('evidence-insight', {}), env:{} });
assert.equal(response.status, 400);
assert.equal((await response.json()).code, 'invalid_request');

response = await evidenceInsight({ request:jsonRequest('evidence-insight', { content:'项目形成了可复核成果' }), env:{} });
assert.equal(response.status, 503);
assert.equal((await response.json()).code, 'not_configured');

globalThis.fetch = async () => new Response(JSON.stringify({ choices:[{ message:{ content:JSON.stringify({
  proves:['完成了可运行项目'], gaps:['缺少用户反馈'], next:'获得一次外部评审', resumeLine:'完成项目交付'
}) } }] }), { status:200, headers:{ 'Content-Type':'application/json' } });
response = await evidenceInsight({ request:jsonRequest('evidence-insight', { content:'项目形成了可复核成果' }), env:{ MODELSNEXUS_API_KEY:'test-key' } });
assert.equal(response.status, 200);
assert.equal((await response.json()).source, 'ai');

globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
  options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once:true });
});
await assert.rejects(
  () => shared.chat({ MODELSNEXUS_API_KEY:'test-key', AI_TIMEOUT_MS:1000 }, [{ role:'user', content:'timeout contract' }]),
  /模型服务超时/
);
assert.deepEqual(shared.classifyServiceError(new Error('模型服务超时（>1秒）')), {
  code:'timeout', status:504, message:'模型服务超时（>1秒）'
});

console.log('planning API contract tests passed');
