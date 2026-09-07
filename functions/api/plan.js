import { chat, compactProfile, json, parseModelJson, retrieveCases, upstreamChat, validatePlan } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const profile = compactProfile(await request.json());
    const cases = await retrieveCases(env, profile, 5);
    const schema = '{"profile":"用用户事实写一句画像","summary":"不超过80字的判断","currentRoles":[{"title":"现实可投岗位","match":0,"reason":"基于证据的原因"}],"graduationRoles":[{"title":"毕业可达岗位","match":0,"reason":"需要补齐什么"}],"gaps":["具体缺口"],"actions":["可执行行动"],"actionGuides":[{"title":"必须与 actions 完全一致","why":"行动价值","steps":["具体步骤"],"doneWhen":"完成标准","effort":3,"estimatedDays":7}],"stages":[{"title":"阶段名称","why":"阶段目的","tasks":["阶段任务"],"doneWhen":"阶段完成标准"}]}';
    const messages = [{
      role: 'user',
      content: `你是可信、有人情味的应届生职业规划助手。根据画像、进展、证据和参考案例，判断现在可投岗位、毕业可达岗位、关键差距和三个执行阶段。参考案例只能作为相似经验，不能把案例中的经历当成用户事实；优先使用用户明确提供的事实。只返回完整且可解析的 JSON，不要 Markdown，不要解释。为避免截断：currentRoles 2项、graduationRoles 2项、gaps 3项、actions 3项；每个 reason/why/doneWhen 不超过 45 字；每个 stage 的 tasks 只写 3 项；actionGuides 只写 3 项且每项 steps 只写 3 个短动作。每项行动必须估算 effort（1-5整数）和 estimatedDays：1 是半天内的简单整理，3 是数天可交付的成果，5 是实习、比赛成绩或长期能力里程碑；按真实投入与难度估算，不要按重要性夸大。详细指导会在用户点击单项行动时另行生成。match 为 0-100 的证据匹配度，不是录取概率。结构为：${schema}\n用户画像：${JSON.stringify(profile)}\n参考案例（仅供比较）：${JSON.stringify(cases)}`
    }];
    if (request.headers.get('Accept')?.includes('text/event-stream')) {
      const upstream = await upstreamChat(env, messages, 4000);
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = upstream.body.getReader();
      const encoder = new TextEncoder();
      const heartbeat = setInterval(() => writer.write(encoder.encode(': pathwise-heartbeat\n\n')).catch(() => {}), 8000);
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
        } catch (error) {
          await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(error.message || error) })}\n\n`)).catch(() => {});
        } finally {
          clearInterval(heartbeat);
          await writer.close().catch(() => {});
        }
      })();
      return new Response(readable, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' } });
    }
    const content = await chat(env, messages, 4000, { stream: true });
    const result = validatePlan(parseModelJson(content));
    result.source = 'ai';
    result.status = 'ready';
    result.caseReferences = cases;
    return json(result);
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
