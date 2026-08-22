import { chat, compactProfile, json, parseModelJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const profile = compactProfile(await request.json());
    const schema = '{"profile":"string","summary":"string","currentRoles":[{"title":"string","match":0,"reason":"string"}],"graduationRoles":[{"title":"string","match":0,"reason":"string"}],"gaps":["string"],"actions":["string"],"actionGuides":[{"title":"string","why":"string","steps":["string"],"doneWhen":"string"}],"stages":[{"title":"string","why":"string","tasks":["string"],"doneWhen":"string"}]}';
    const content = await chat(env, [{
      role: 'user',
      content: `你是可信、有人情味的应届生职业规划助手。根据画像、进展、证据和今天的状态，判断现在可投岗位、毕业可达岗位与三个执行阶段。状态只用于调整建议节奏和语气，不要做心理诊断，也不要降低用户的职业可能性。新事实优先于旧画像；不得臆造录取概率。请保留足够详细的 reason、why、tasks 和 doneWhen。只返回 JSON，结构为：${schema}\n用户画像：${JSON.stringify(profile)}`
    }], 2000, { stream: true });
    const result = parseModelJson(content);
    result.source = 'ai';
    result.status = 'ready';
    return json(result);
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
