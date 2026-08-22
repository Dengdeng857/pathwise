const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

export function modelConfig(env) {
  return {
    key: env.MODELSNEXUS_API_KEY || env.DASHSCOPE_API_KEY || env.OPENAI_API_KEY,
    base: (env.AI_BASE_URL || 'https://modelsnexus.org/v1').replace(/\/$/, ''),
    model: env.AI_MODEL || 'qwen3.7-max'
  };
}

export async function chat(env, messages, maxTokens = 1800, options = {}) {
  const config = modelConfig(env);
  if (!config.key) throw new Error('AI Key 未配置');
  const response = await fetch(`${config.base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
      enable_thinking: false,
      stream: Boolean(options.stream)
    })
  });
  if (!response.ok) throw new Error(`模型服务返回 ${response.status}`);
  if (options.stream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let raw = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunkText = decoder.decode(value, { stream: true });
      raw += chunkText;
      buffer += chunkText;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') continue;
        try {
          const chunk = JSON.parse(trimmed.slice(5).trim());
          const delta = chunk.choices?.[0]?.delta?.content;
          if (typeof delta === 'string') content += delta;
        } catch (_) { /* Ignore keep-alive or non-JSON SSE frames. */ }
      }
    }
    // Some OpenAI-compatible gateways close the SSE stream without a final
    // [DONE] frame. If deltas were received, the content is still usable.
    if (content.trim()) return content;
    try {
      const payload = JSON.parse(raw);
      return payload.choices?.[0]?.message?.content || '';
    } catch (_) {
      throw new Error('流式模型响应为空或格式无法识别');
    }
  }
  const payload = await response.json();
  return payload.choices?.[0]?.message?.content || '';
}

export function parseModelJson(content) {
  return JSON.parse(String(content).replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
}

export function compactProfile(profile = {}) {
  return {
    stage: String(profile.stage || '').slice(0, 120),
    school: String(profile.school || '').slice(0, 120),
    major: String(profile.major || '').slice(0, 120),
    target: String(profile.target || '').slice(0, 160),
    mood: String(profile.mood || '').slice(0, 80),
    experience: String(profile.experience || '').slice(0, 3000),
    updates: (profile.updates || []).slice(-10).map(item => String(item).slice(0, 600)),
    evidence: (profile.evidence || []).slice(-6).map(item => ({
      type: String(item.type || '').slice(0, 80),
      content: String(item.content || '').slice(0, 1800)
    }))
  };
}
