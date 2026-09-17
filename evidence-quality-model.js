(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PathwiseEvidenceQuality = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const text = value => String(value || '').trim();
  const URL_RE = /^https?:\/\/[^\s]+$/i;
  const NUMBER_RE = /(?:\d+(?:\.\d+)?\s*(?:%|个|次|名|人|天|小时|分钟|条|项|分|元|万|k|K|ms|s)\b)|(?:提升|降低|减少|增加|覆盖|完成|发现|修复|获得|上线|通过)\s*\d+/;
  const FEEDBACK_RE = /(导师|老师|面试官|用户|客户|同事|负责人|评审|review|反馈|采纳|通过|验收|合并|merge|录用|面试)/i;
  const RESULT_RE = /(完成|产出|实现|上线|发布|修复|发现|优化|整理|分析|设计|开发|交付|验证|复盘|对比|提交|解决)/;

  function assessOutcome(content, link = '') {
    const value = text(content);
    const normalizedLink = text(link);
    const signals = {
      result: RESULT_RE.test(value),
      metric: NUMBER_RE.test(value),
      feedback: FEEDBACK_RE.test(value),
      link: URL_RE.test(normalizedLink)
    };
    const signalCount = Object.values(signals).filter(Boolean).length;
    const lengthReady = value.length >= 18;
    const credible = lengthReady && signals.result && signalCount >= 2;
    const missing = [];
    if (!lengthReady) missing.push('再具体写清做了什么');
    if (!signals.result) missing.push('补充明确的产出或结果');
    if (!signals.metric && !signals.feedback && !signals.link) missing.push('增加数据、外部反馈或成果链接');
    return {
      credible,
      score: Math.min(100, (lengthReady ? 35 : Math.min(25, value.length)) + (signals.result ? 25 : 0) + Math.min(40, Math.max(0, signalCount - (signals.result ? 1 : 0)) * 20)),
      signals,
      missing,
      message: credible ? '这份成果包含可验证信息，可以用于更新路线。' : missing.join('；') + '。'
    };
  }

  return { assessOutcome };
});
