(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PathwiseEvidence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const VERSION = 1;
  const text = (value, limit = 24000) => String(value || '').trim().slice(0, limit);
  const list = (value, limit = 8) => [...new Set((Array.isArray(value) ? value : []).map(item => text(item, 180)).filter(Boolean))].slice(0, limit);
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));

  function hash(value) {
    let output = 2166136261;
    for (const char of String(value || '')) {
      output ^= char.charCodeAt(0);
      output = Math.imul(output, 16777619);
    }
    return (output >>> 0).toString(36);
  }

  function defaultSource(item) {
    if (item.filename) return { kind:'uploaded_file', label:text(item.filename, 240) };
    if (item.type === '行动成果') return { kind:'action_outcome', label:'用户提交的行动成果' };
    if (item.type === '简历') return { kind:'resume', label:'用户确认的简历' };
    return { kind:'manual', label:'用户输入' };
  }

  function normalizeEvidence(input, defaults = {}) {
    const item = typeof input === 'string' ? { type:'材料', content:input } : { ...(input || {}) };
    const capturedAt = text(item.capturedAt || item.addedAt || defaults.capturedAt, 40);
    const source = { ...defaultSource(item), ...(defaults.source || {}), ...(item.source || {}) };
    const verification = text(item.verification || defaults.verification || (item.filename ? 'supported' : 'self_reported'), 32);
    const rawConfidence = item.confidence ?? defaults.confidence ?? (verification === 'verified' ? .9 : verification === 'supported' ? .72 : .45);
    const confidence = clamp(Number(rawConfidence) > 1 ? Number(rawConfidence) / 100 : rawConfidence);
    const content = text(item.content);
    const type = text(item.type || defaults.type || '材料', 80);
    const id = text(item.id, 80) || `ev_${hash(`${capturedAt}|${type}|${content.slice(0, 500)}`)}`;
    return {
      ...item,
      schemaVersion:VERSION,
      id,
      type,
      filename:text(item.filename, 240),
      summary:text(item.summary, 600),
      content,
      capturedAt,
      addedAt:capturedAt,
      source:{ kind:text(source.kind, 40), label:text(source.label, 240) },
      confidence,
      verification,
      supports:list(item.supports || defaults.supports),
      exposesGap:list(item.exposesGap || defaults.exposesGap),
      impact:text(item.impact, 240),
      quality:item.quality && typeof item.quality === 'object' ? { score:Math.max(0, Math.min(100, Number(item.quality.score) || 0)), signals:{ ...(item.quality.signals || {}) } } : null
    };
  }

  function createEvidence(input = {}) {
    return normalizeEvidence(input, { capturedAt:new Date().toISOString() });
  }

  function isUsable(item) {
    return ['supported', 'verified'].includes(normalizeEvidence(item).verification);
  }

  function verificationLabel(item) {
    const value = normalizeEvidence(item).verification;
    return value === 'verified' ? '已验证成果' : value === 'supported' ? '有材料支持' : '用户自述';
  }

  return { VERSION, createEvidence, isUsable, normalizeEvidence, verificationLabel };
});
