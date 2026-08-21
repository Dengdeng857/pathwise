import { chat, compactProfile, json, parseModelJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const profile = compactProfile(await request.json());
    const schema = '{"profile":"string","summary":"string","currentRoles":[{"title":"string","match":0,"reason":"string"}],"graduationRoles":[{"title":"string","match":0,"reason":"string"}],"gaps":["string"],"actions":["string"],"actionGuides":[{"title":"string","why":"string","steps":["string"],"doneWhen":"string"}],"stages":[{"title":"string","why":"string","tasks":["string"],"doneWhen":"string"}]}';
    const content = await chat(env, [{
      role: 'user',
      content: `你是可信的应届生职业规划助手。根据画像、进展和证据，判断现在可投岗位、毕业可达岗位与三个执行阶段。新事实优先于旧画像；不得臆造录取概率。只返回 JSON，结构为：${schema}\n用户画像：${JSON.stringify(profile)}`
    }], 2000);
    const result = parseModelJson(content);
    result.source = 'ai';
    result.status = 'ready';
    return json(result);
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
