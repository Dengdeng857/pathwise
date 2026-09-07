import { chat, compactProfile, hasModelPlaceholder, json, parseModelJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const content = String(payload.content || '').slice(0, 18000);
    if (!content.trim()) return json({ error: '缺少简历内容' }, 400);
    const schema = '{"stage":"简历中的学历和年级或毕业时间，没有就留空","school":"简历中的学校或学校层次，没有就留空","major":"简历中的专业，没有就留空","experience":"2-4句事实摘要"}';
    const prompt = `你是简历信息提取器。只从简历原文中提取事实，不推测目标岗位，不改写成夸张成果。只返回 JSON，结构为：${schema}。stage 填学历和年级/毕业时间，school 填学校层次或学校名，major 填专业，experience 用 2-4 句概括实习、项目和技能。\n当前画像：${JSON.stringify(compactProfile(payload.profile || {}))}\n简历原文：${content}`;
    const result = parseModelJson(await chat(env, [{ role: 'user', content: prompt }], 900));
    if (hasModelPlaceholder(result) || !result || !Object.values(result).some(value => String(value || '').trim())) throw new Error('简历信息提取结果无效');
    return json({ stage: String(result.stage || ''), school: String(result.school || ''), major: String(result.major || ''), experience: String(result.experience || ''), source: 'ai' });
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
