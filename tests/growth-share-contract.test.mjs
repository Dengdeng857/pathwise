import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../career.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../career.js', import.meta.url), 'utf8');

assert.match(html, /id="growthShare"[^>]*>复制成长摘要/);
assert.match(js, /function buildGrowthShareText\(\)/);
assert.match(js, /按行动难度与成果计算/);
assert.match(js, /最近一次路径变化/);
assert.match(js, /growth_summary_copied/);
assert.match(js, /navigator\.clipboard/);
const shareFunction = js.slice(js.indexOf('function buildGrowthShareText()'), js.indexOf('function stripPrivateExportFields'));
assert.doesNotMatch(shareFunction, /filename|content/, '分享摘要不应包含文件名或证据原文');
assert.match(html, /导出隐私版数据/);
assert.match(js, /function buildPrivacySafeExport\(\)/);
assert.match(js, /privacyMode:'redacted'/);
assert.match(js, /privateFields = new Set\(\['content', 'filename', 'quote', 'excerpt', 'sourceLabel', 'link', 'url'\]\)/);
assert.match(js, /trajectory:stripPrivateExportFields/);
assert.match(js, /verifiedTasks:\[\.\.\.verifiedTasks\]/);

console.log('growth share contract tests passed');
