import { chat, compactProfile, hasModelPlaceholder, json, parseModelJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const action = String(payload.action || '').slice(0, 240);
    const profile = compactProfile(payload.profile || {});
    const schema = '{"title":"行动名称","why":"行动价值","steps":["具体步骤"],"resources":["真实所需材料"],"estimatedTime":"预计投入","estimatedDays":3,"effort":3,"doneWhen":"完成标准","evidence":"应留下的证据"}';
    const content = await chat(env, [{
      role: 'user',
      content: `你是职业行动教练。只深化这个行动项，结合用户画像给出立即可执行的 3-5 步指导，不要重新生成整份规划。按真实投入估算 effort（1-5整数）与 estimatedDays：1 是半天内简单整理，3 是数天成果，5 是实习、比赛成绩或长期里程碑。只返回 JSON，结构为：${schema}\n行动项：${action}\n用户画像：${JSON.stringify(profile)}`
    }], 900);
    const result = parseModelJson(content);
    if (hasModelPlaceholder(result) || !result || typeof result.title !== 'string' || !Array.isArray(result.steps) || !result.steps.length) throw new Error('行动指导返回无效');
    result.effort = Math.max(1, Math.min(5, Number(result.effort) || 3));
    result.estimatedDays = Math.max(1, Number(result.estimatedDays) || 3);
    result.title = action;
    result.source = 'ai';
    return json(result);
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
