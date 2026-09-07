import { chat, compactProfile, hasModelPlaceholder, json, parseModelJson } from './_shared.js';
import { buildContinuityDelta, fallbackContinuityNarrative, validateContinuityNarrative } from '../../continuity-model.mjs';

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const delta = buildContinuityDelta(payload.previousPlan, payload.nextPlan, payload.evidence);
    const fallback = fallbackContinuityNarrative(delta);
    if (!delta.changed) return json({ delta, narrative: fallback, source: 'rules' });

    try {
      const profile = compactProfile(payload.profile || {});
      const prompt = `你是职业规划的变化解释器。用户刚提供一份新证据，系统已算出前后规划差异。你只解释这份证据能够支持的变化，不能把时间先后误判为因果，不能虚构经历。语言温和、简洁、具体。只返回 JSON：{"headline":"不超过24字","why":"不超过70字，说明证据与变化的关系","nextMove":"一个不超过45字的下一步","confidence":0}。confidence 是本次证据足以解释变化的置信度 0-100。\n用户画像：${JSON.stringify(profile)}\n新证据：${JSON.stringify(delta.evidence)}\n确定性差异：${JSON.stringify(delta)}`;
      const result = parseModelJson(await chat(env, [{ role: 'user', content: prompt }], 500));
      if (hasModelPlaceholder(result)) throw new Error('模型返回占位符');
      return json({ delta, narrative: validateContinuityNarrative(result), source: 'ai' });
    } catch (error) {
      return json({ delta, narrative: fallback, source: 'rules', aiWarning: String(error.message || error) });
    }
  } catch (error) {
    return json({ error: String(error.message || error) }, 400);
  }
}
