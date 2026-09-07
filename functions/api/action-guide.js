import { chat, compactProfile, json, parseModelJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const action = String(payload.action || '').slice(0, 240);
    const profile = compactProfile(payload.profile || {});
    const schema = '{"title":"string","why":"string","steps":["string"],"resources":["string"],"estimatedTime":"string","estimatedDays":3,"effort":3,"doneWhen":"string","evidence":"string"}';
    const content = await chat(env, [{
      role: 'user',
      content: `你是职业行动教练。只深化这个行动项，结合用户画像给出立即可执行的 3-5 步指导，不要重新生成整份规划。按真实投入估算 effort（1-5整数）与 estimatedDays：1 是半天内简单整理，3 是数天成果，5 是实习、比赛成绩或长期里程碑。只返回 JSON，结构为：${schema}\n行动项：${action}\n用户画像：${JSON.stringify(profile)}`
    }], 900);
    const result = parseModelJson(content);
    result.source = 'ai';
    return json(result);
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
