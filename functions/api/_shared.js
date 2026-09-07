const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

export function modelConfig(env) {
  const explicitBase = String(env.AI_BASE_URL || '').replace(/\/$/, '');
  const provider = explicitBase.includes('api.openai.com')
    ? 'openai'
    : explicitBase.includes('dashscope.aliyuncs.com')
      ? 'dashscope'
      : explicitBase
        ? 'compatible'
        : env.OPENAI_API_KEY
          ? 'openai'
          : env.MODELSNEXUS_API_KEY
            ? 'compatible'
            : env.DASHSCOPE_API_KEY
              ? 'dashscope'
              : 'compatible';
  const defaults = {
    openai: { base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', key: env.OPENAI_API_KEY },
    dashscope: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', key: env.DASHSCOPE_API_KEY },
    compatible: { base: 'https://modelsnexus.org/v1', model: 'qwen3.7-max', key: env.MODELSNEXUS_API_KEY }
  }[provider];
  return {
    provider,
    key: defaults.key,
    base: explicitBase || defaults.base,
    model: env.AI_MODEL || defaults.model
  };
}

function chatBody(config, messages, maxTokens, stream) {
  const body = {
    model: config.model,
    messages,
    temperature: 0.2,
    max_tokens: maxTokens,
    stream
  };
  if (config.provider !== 'openai') body.enable_thinking = false;
  return body;
}

export async function upstreamChat(env, messages, maxTokens = 1800) {
  const config = modelConfig(env);
  if (!config.key) throw new Error('AI Key 未配置');
  const response = await fetch(`${config.base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(chatBody(config, messages, maxTokens, true))
  });
  if (!response.ok || !response.body) throw new Error(`模型服务返回 ${response.status}`);
  return response;
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
    body: JSON.stringify(chatBody(config, messages, maxTokens, Boolean(options.stream)))
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
  const cleaned = String(content).replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {
    const start = cleaned.search(/[\[{]/);
    if (start < 0) throw new Error('模型返回不是 JSON');
    const opening = cleaned[start];
    const closing = opening === '[' ? ']' : '}';
    let depth = 0; let quoted = false; let escaped = false;
    for (let index = start; index < cleaned.length; index += 1) {
      const char = cleaned[index];
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
      if (char === '"') { quoted = true; continue; }
      if (char === opening) depth += 1;
      else if (char === closing) depth -= 1;
      if (depth === 0) return JSON.parse(cleaned.slice(start, index + 1));
    }
    throw new Error('模型返回 JSON 不完整');
  }
}

export function hasModelPlaceholder(value) {
  if (typeof value === 'string') return /^(string|number|object|array|boolean|null|undefined)$/i.test(value.trim()) || value.trim().toLowerCase() === 'n/a';
  if (Array.isArray(value)) return value.some(hasModelPlaceholder);
  if (value && typeof value === 'object') return Object.values(value).some(hasModelPlaceholder);
  return false;
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

export async function retrieveCases(env, profile = {}, limit = 5) {
  try {
    const asset = env.ASSETS;
    if (!asset) return [];
    const url = new URL('/data/nowcoder.curated.jsonl', 'https://pathwise.local');
    const response = await asset.fetch(url);
    if (!response.ok) return [];
    const text = await response.text();
    const query = [profile.stage, profile.school, profile.major, profile.target, profile.experience, ...(profile.updates || [])].join(' ').toLowerCase();
    const chunks = query.match(/[\u4e00-\u9fff]{2,}|[A-Za-z0-9+#.-]{2,}/g) || [];
    const queryTerms = [...new Set(chunks.flatMap(chunk => {
      if (/^[\u4e00-\u9fff]+$/.test(chunk)) {
        return [chunk, ...Array.from({ length: Math.max(0, chunk.length - 1) }, (_, i) => chunk.slice(i, i + 2))];
      }
      return [chunk];
    }).filter(term => term.length >= 2))];
    const rows = text.split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch (_) { return null; } }).filter(Boolean);
    return rows.map(row => {
      const haystack = JSON.stringify(row).toLowerCase();
      const hits = queryTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
      const typeBoost = row.type === 'interview' ? 1 : row.type === 'career_path' ? 0.9 : row.type === 'jd' ? 0.7 : 0.4;
      return { row, score: hits + typeBoost };
    }).sort((a, b) => b.score - a.score).slice(0, limit).map(({ row, score }) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      source_url: row.source_url,
      signals: row.signals || [],
      excerpt: (row.source_excerpt || []).slice(0, 2),
      relevance: Math.min(1, Number((score / Math.max(5, queryTerms.length)).toFixed(2)))
    }));
  } catch (_) {
    return [];
  }
}
