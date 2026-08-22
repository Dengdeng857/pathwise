import { chat, compactProfile, json, parseModelJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const content = String(payload.content || '').slice(0, 10000);
    if (!content.trim()) return json({ error: '缺少材料内容' }, 400);
    const profile = compactProfile(payload.profile || {});
    const schema = '{"proves":["string"],"gaps":["string"],"next":"string","resumeLine":"string"}';
    const prompt = `你是职业证据分析器。根据用户画像和一份材料，提炼这份材料对求职真正有用的证据。不要复述原文，不要夸大，不要编造。只返回 JSON，结构为：${schema}。proves 最多3条，gaps 最多3条，next 是一个具体下一步，resumeLine 是一条可放进简历的谨慎表达。\n用户画像：${JSON.stringify(profile)}\n材料：${content}`;
    const text = await chat(env, [{ role: 'user', content: prompt }], 700);
    const result = parseModelJson(text);
    return json({
      proves: Array.isArray(result.proves) ? result.proves.slice(0, 3) : [],
      gaps: Array.isArray(result.gaps) ? result.gaps.slice(0, 3) : [],
      next: String(result.next || '把这份材料补充一个结果或外部反馈。'),
      resumeLine: String(result.resumeLine || ''),
      source: 'ai'
    });
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
