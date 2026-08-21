import { chat, compactProfile, json, parseModelJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const action = String(payload.action || '').slice(0, 240);
    const profile = compactProfile(payload.profile || {});
    const schema = '{"title":"string","why":"string","steps":["string"],"resources":["string"],"estimatedTime":"string","doneWhen":"string","evidence":"string"}';
    const content = await chat(env, [{
      role: 'user',
      content: `你是职业行动教练。只深化这个行动项，结合用户画像给出立即可执行的 3-5 步指导，不要重新生成整份规划。只返回 JSON，结构为：${schema}\n行动项：${action}\n用户画像：${JSON.stringify(profile)}`
    }], 900);
    const result = parseModelJson(content);
    result.source = 'ai';
    return json(result);
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
