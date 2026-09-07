import { chat, compactProfile, hasModelPlaceholder, json, normalizeDirectionRecommendation, parseModelJson } from './_shared.js';

function fallbackExtract(content) {
  const oneLine = String(content || '').replace(/\s+/g, ' ').trim();
  const stage = oneLine.match(/(?:20\d{2}\s*届|本科(?:大[一二三四]|应届)?|硕士(?:研[一二三]|应届)?|博士(?:博[一二三四五]|应届)?)/)?.[0] || '';
  const school = oneLine.match(/(?:北京大学|清华大学|复旦大学|上海交通大学|浙江大学|中国人民大学|[^，。；\s]{2,18}(?:大学|学院)|985|211|双一流)/)?.[0] || '';
  const major = oneLine.match(/(?:信息安全|网络空间安全|软件工程|计算机科学与技术|数据科学|人工智能|电子信息|自动化|工商管理|市场营销|新闻传播)/)?.[0] || '';
  return { stage, school, major, experience: oneLine.slice(0, 600), recommendation: { target: '', basis: '', confidence: 0 }, source: 'rules' };
}

export async function onRequestPost({ request, env }) {
  try {
    let payload;
    try { payload = await request.json(); } catch (_) { return json({ error: '请求 JSON 格式无效' }, 400); }
    const content = String(payload.content || '').slice(0, 18000);
    if (!content.trim()) return json({ error: '缺少简历内容' }, 400);
    const schema = '{"stage":"简历中的学历和年级或毕业时间，没有就留空","school":"简历中的学校或学校层次，没有就留空","major":"简历中的专业，没有就留空","experience":"2-4句事实摘要","recommendation":{"target":"一个建议岗位","basis":"不超过45字的简历依据","confidence":0}}';
    const prompt = `你是简历信息提取与职业方向建议器。事实字段只能从原文提取，不夸张成果；recommendation 是基于现有证据的 AI 建议，不代表用户已选择，证据不足时 target 留空。只返回 JSON，结构为：${schema}。confidence 为 0-100。stage 填学历和年级/毕业时间，school 填学校层次或学校名，major 填专业，experience 用 2-4 句概括实习、项目和技能。\n当前画像：${JSON.stringify(compactProfile(payload.profile || {}))}\n简历原文：${content}`;
    try {
      const result = parseModelJson(await chat(env, [{ role: 'user', content: prompt }], 900));
      const facts = [result?.stage, result?.school, result?.major, result?.experience];
      if (!result || facts.some(hasModelPlaceholder) || !facts.some(value => String(value || '').trim())) throw new Error('简历信息提取结果无效');
      return json({
        stage: String(result.stage || '').slice(0, 120), school: String(result.school || '').slice(0, 120),
        major: String(result.major || '').slice(0, 120), experience: String(result.experience || '').slice(0, 3000),
        recommendation: normalizeDirectionRecommendation(result.recommendation), source: 'ai'
      });
    } catch (error) {
      return json({ ...fallbackExtract(content), aiWarning: String(error.message || error) });
    }
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
