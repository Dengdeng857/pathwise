import { chat, compactProfile, json, parseModelJson, upstreamChat } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const profile = compactProfile(await request.json());
    const schema = '{"profile":"string","summary":"string","currentRoles":[{"title":"string","match":0,"reason":"string"}],"graduationRoles":[{"title":"string","match":0,"reason":"string"}],"gaps":["string"],"actions":["string"],"actionGuides":[{"title":"string","why":"string","steps":["string"],"doneWhen":"string"}],"stages":[{"title":"string","why":"string","tasks":["string"],"doneWhen":"string"}]}';
    const messages = [{
      role: 'user',
      content: `你是可信、有人情味的应届生职业规划助手。根据画像、进展和证据，判断现在可投岗位、毕业可达岗位、关键差距和三个执行阶段。只返回完整且可解析的 JSON，不要 Markdown，不要解释。为避免截断：currentRoles 2项、graduationRoles 2项、gaps 3项、actions 3项；每个 reason/why/doneWhen 不超过 45 字；每个 stage 的 tasks 只写 3 项；actionGuides 只写 3 项且每项 steps 只写 3 个短动作。详细指导会在用户点击单项行动时另行生成。match 为 0-100 的证据匹配度，不是录取概率。结构为：${schema}\n用户画像：${JSON.stringify(profile)}`
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
    const result = parseModelJson(content);
    result.source = 'ai';
    result.status = 'ready';
    return json(result);
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}
