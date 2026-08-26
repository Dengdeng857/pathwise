import { chat, compactProfile, json, parseModelJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const content = String(payload.content || '').slice(0, 18000);
    if (!content.trim()) return json({ error: '缺少简历内容' }, 400);
    const schema = '{"stage":"string","school":"string","major":"string","experience":"string"}';
    const prompt = `你是简历信息提取器。只从简历原文中提取事实，不推测目标岗位，不改写成夸张成果。只返回 JSON，结构为：${schema}。stage 填学历和年级/毕业时间，school 填学校层次或学校名，major 填专业，experience 用 2-4 句概括实习、项目和技能。\n当前画像：${JSON.stringify(compactProfile(payload.profile || {}))}\n简历原文：${content}`;
    const result = parseModelJson(await chat(env, [{ role: 'user', content: prompt }], 900));
    return json({ stage: String(result.stage || ''), school: String(result.school || ''), major: String(result.major || ''), experience: String(result.experience || ''), source: 'ai' });
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
